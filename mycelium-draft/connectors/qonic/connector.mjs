#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Mycelium-for-Qonic (v0.1 DRAFT) — Apache-2.0 (Mycelium open ecosystem; NOT Loam's proprietary license).
// Qonic (cloud-native, browser-first BIM; Ghent, ex-Bricsys) -> Connective Spine.
//
// Qonic is IFC-native; products (elements) carry a GUID, so the join key is ifcGuid — it slots onto
// the spine like OpenAEC, no new key. Three phases, lowest-risk first:
//   Phase 0  IFC export reader — zero-API: read a Qonic IFC export, lift each rooted object's GlobalId.
//                                Works today regardless of the API. (QONIC_IFC=<path>)
//   Phase 1  API read          — Qonic REST v1 (OAuth 2.1 Bearer; scopes projects:read / models:read):
//                                list models, read products by GUID. (QONIC_TOKEN + QONIC_PROJECT_ID)
//   Phase 2  write-back        — push enrichment (classification / PO) onto products by GUID
//                                (models:write, wrapped in a modification session). PROPOSE by default;
//                                writes only with QONIC_APPLY=1.
//
// Endpoints/auth/scopes are from the official API docs (see QONIC-API.md, base https://api.qonic.com/v1).
// Remaining things to confirm against a live model: (a) the product GUID equals the IFC GlobalId
// (Qonic is IFC-native and its UI copies the object GlobalId, so this is expected), and (b) the exact
// body shape for the product `update` write. Phase 0 needs none of this.
import { readFileSync } from 'node:fs';
import { stamp, SPINE_VERSION } from '../../lib/spine-adapter.mjs';
import { checkConformance } from '../../conformance/validate.mjs';

const SOURCE  = 'qonic';
const BASE    = process.env.QONIC_API_URL || 'https://api.qonic.com/v1';
const TOKEN   = process.env.QONIC_TOKEN || '';                              // OAuth 2.1 Bearer (see QONIC-API.md)
const PROJECT = process.env.QONIC_PROJECT_ID || '';
const IFC     = process.env.QONIC_IFC || '';                               // path to an IFC export (Phase 0)
const APPLY   = process.env.QONIC_APPLY === '1';                           // gate Phase 2 writes

// ── Phase 0: IFC export reader (pure text scan, no STEP parser, no deps) ─────────
// Only IfcRoot-derived objects carry a GlobalId as their first attribute, so "IFC type immediately
// followed by a 22-char IFC-GUID string" selects the real building objects and skips geometry.
const ENTITY_RE = /(IFC[A-Z0-9]+)\s*\(\s*'([0-9A-Za-z_$]{22})'/g;
function extractIfcElements(text) {
  const byGuid = new Map();
  for (const m of String(text ?? '').matchAll(ENTITY_RE)) {
    const [, type, ifcGuid] = m;
    if (type === 'IFCPROJECT' || type === 'IFCOWNERHISTORY') continue;
    if (!byGuid.has(ifcGuid)) byGuid.set(ifcGuid, { id: ifcGuid, ifcGuid, type, projectKey: PROJECT || 'qonic-ifc' });
  }
  return [...byGuid.values()];
}

// ── Qonic REST v1 ────────────────────────────────────────────────────────────────
async function qonic(path, { method = 'GET', body } = {}) {
  if (!TOKEN) throw new Error('QONIC_TOKEN required (OAuth 2.1 Bearer; scopes projects:read/models:read[/models:write])');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Qonic ${method} ${path} -> HTTP ${res.status}`);
  return res.status === 204 ? {} : res.json();
}
const arr = (d, ...keys) => keys.map((k) => d?.[k]).find(Array.isArray) || (Array.isArray(d) ? d : []);

// Phase 1: list each model's products → spine rows keyed on the product GUID (= IFC GlobalId).
async function fetchApiElements() {
  if (!PROJECT) throw new Error('QONIC_PROJECT_ID required for API read');
  const models = arr(await qonic(`/projects/${PROJECT}/models`), 'models', 'results', 'data');
  const out = [];
  for (const m of models) {
    const modelId = m.modelId ?? m.id ?? m.guid ?? m;
    const products = arr(await qonic(`/projects/${PROJECT}/models/${modelId}/products`), 'products', 'results', 'data');
    for (const p of products) {
      const guid = p.guid ?? p.globalId ?? p.id;            // product GUID == IFC GlobalId (confirm on a live model)
      if (!guid) continue;
      out.push({
        id: guid, ifcGuid: guid, modelId,
        type: p.class ?? p.ifcType ?? p.type ?? null,
        classification: p.classification ?? p.codification ?? undefined,
        projectKey: PROJECT, modified: p.modifiedAt ?? p.updated ?? null,
      });
    }
  }
  return out;
}

// ── Phase 2: write-back (models:write) — accountable: propose unless QONIC_APPLY=1 ──────────────
// Bulk modifications must be wrapped in a session (start-session … end-session).
async function pushEnrichment(modelId, guid, properties) {
  const proposal = { source: SOURCE, action: 'set_properties', projectKey: PROJECT, targetKeys: { ifcGuid: guid }, after: { modelId, properties } };
  if (!APPLY) return { ...proposal, result: 'proposed', note: 'dry-run — set QONIC_APPLY=1 to write' };
  await qonic(`/projects/${PROJECT}/models/products/start-session`, { method: 'POST', body: { modelId } });
  try {
    // VERIFY the exact update payload against a live model; this keys properties by product GUID.
    await qonic(`/projects/${PROJECT}/models/products`, { method: 'POST', body: { modelId, update: { [guid]: properties } } });
    return { ...proposal, result: 'executed' };
  } catch (e) {
    return { ...proposal, result: 'failed', error: e.message };
  } finally {
    await qonic(`/projects/${PROJECT}/models/products/end-session`, { method: 'POST', body: { modelId } }).catch(() => {});
  }
}

// ── normalise → spine ───────────────────────────────────────────────────────────
function toSpine(rec, live) {
  return {
    identity: {
      source: SOURCE,
      sourceLocalId: String(rec.id),
      projectKey: rec.projectKey,
      ifcGuid: rec.ifcGuid || undefined,                    // THE join edge
      ...(rec.classification ? { classification: rec.classification } : {}),
    },
    freshness: stamp({ source: SOURCE, revisionId: rec.modified || (live ? 'live' : IFC), asOf: rec.modified || null, confidence: live ? 'live' : 'snapshot' }),
    payload: rec,
  };
}

// Phase 0 wins when an IFC export is given (works with no API); else Phase 1 API read.
const live = !IFC;
const rows = IFC ? extractIfcElements(readFileSync(IFC, 'utf8')) : await fetchApiElements();
const records = rows.map((r) => toSpine(r, live)).map((r) => ({ ...r, ...checkConformance(r) }));

console.log(JSON.stringify({ source: SOURCE, spineVersion: SPINE_VERSION, mode: IFC ? 'ifc-export' : 'api',
  conformant: records.every((r) => r.conformant), records }, null, 2));
process.exit(records.every((r) => r.conformant) ? 0 : 1);

export { extractIfcElements, toSpine, pushEnrichment };                    // for a future test harness
