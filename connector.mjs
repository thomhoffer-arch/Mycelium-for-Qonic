#!/usr/bin/env node
// Mycelium-for-Qonic (v0.1 DRAFT)
// Qonic (cloud-native, browser-first BIM; Ghent, ex-Bricsys) -> Connective Spine.
//
// Qonic is IFC-native; products (elements) carry a GUID, so the join key is ifcGuid. Three phases:
//   Phase 0  IFC export reader — zero-API: read a Qonic IFC export, lift each rooted object's GlobalId. (QONIC_IFC)
//   Phase 1  API read          — Qonic REST v1 (OAuth 2.1 Bearer; projects:read/models:read). (QONIC_TOKEN+QONIC_PROJECT_ID)
//   Phase 2  write-back        — enrichment onto products by GUID (models:write); PROPOSE unless QONIC_APPLY=1.
//
// Contract + conformance come from the mycelium-sdk package. Endpoints/auth from QONIC-API.md
// (base https://api.qonic.com/v1). Confirm on a live model: product GUID == IFC GlobalId, and the
// exact product `update` body shape. Phase 0 needs neither.
import { readFileSync } from 'node:fs';
import { stamp, checkConformance, report } from 'mycelium-sdk';

const SOURCE  = 'qonic';
const BASE    = process.env.QONIC_API_URL || 'https://api.qonic.com/v1';
const TOKEN   = process.env.QONIC_TOKEN || '';
const PROJECT = process.env.QONIC_PROJECT_ID || '';
const IFC     = process.env.QONIC_IFC || '';
const APPLY   = process.env.QONIC_APPLY === '1';

// ── Phase 0: IFC export reader (pure text scan, no STEP parser, no deps) ─────────
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

// ── Phase 2: write-back (models:write) — propose unless QONIC_APPLY=1; sessions wrap bulk writes ──
async function pushEnrichment(modelId, guid, properties) {
  const proposal = { source: SOURCE, action: 'set_properties', projectKey: PROJECT, targetKeys: { ifcGuid: guid }, after: { modelId, properties } };
  if (!APPLY) return { ...proposal, result: 'proposed', note: 'dry-run — set QONIC_APPLY=1 to write' };
  await qonic(`/projects/${PROJECT}/models/products/start-session`, { method: 'POST', body: { modelId } });
  try {
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
      ifcGuid: rec.ifcGuid || undefined,
      ...(rec.classification ? { classification: rec.classification } : {}),
    },
    freshness: stamp({ source: SOURCE, revisionId: rec.modified || (live ? 'live' : IFC), asOf: rec.modified || null, confidence: live ? 'live' : 'snapshot' }),
    payload: rec,
  };
}

const live = !IFC;
const rows = IFC ? extractIfcElements(readFileSync(IFC, 'utf8')) : await fetchApiElements();
const records = rows.map((r) => toSpine(r, live)).map((r) => ({ ...r, ...checkConformance(r) }));
report(SOURCE, records, { mode: IFC ? 'ifc-export' : 'api' });

export { extractIfcElements, toSpine, pushEnrichment };
