#!/usr/bin/env node
// mycelium-for-qonic — standalone binary entry point.
// Compiled via: esbuild → pkg. No external runtime deps.
// Node built-ins only; all SDK logic is inlined below.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// ── Inline spine SDK ──────────────────────────────────────────────────────────
const SPINE_VERSION = '0.1';

function stamp({ source, revisionId = null, asOf = null, confidence = 'snapshot' }) {
  return { source, revisionId, asOf, confidence, stampedAt: new Date().toISOString() };
}

function checkConformance(record) {
  const id = record?.identity ?? {};
  const missing = ['source', 'sourceLocalId', 'projectKey'].filter((k) => !id[k]);
  return missing.length === 0
    ? { conformant: true }
    : { conformant: false, conformanceErrors: missing.map((k) => `missing identity.${k}`) };
}

function tpl(str, rec) {
  return typeof str === 'string' ? str.replace(/\{(\w+)\}/g, (_, k) => rec[k] ?? '') : str;
}

async function runAdapter(cfg, { fetchSource }) {
  const rows = await fetchSource();
  const records = rows.map((rec) => {
    const identity = {
      source: cfg.source,
      sourceLocalId: String(rec[cfg.identity.localIdField] ?? rec.id ?? ''),
      projectKey: tpl(cfg.identity.projectKey, rec),
      ...(rec.ifcGuid        ? { ifcGuid:        rec.ifcGuid }        : {}),
      ...(rec.classification  ? { classification: rec.classification } : {}),
    };
    const freshness = stamp({
      source: cfg.source,
      revisionId: tpl(cfg.freshness.revisionId, rec) || null,
      asOf:       tpl(cfg.freshness.asOf, rec)       || null,
      confidence: cfg.freshness.confidence ?? 'snapshot',
    });
    const base = { identity, freshness, payload: rec };
    return { ...base, ...checkConformance(base) };
  });
  return { source: cfg.source, spineVersion: SPINE_VERSION,
    conformant: records.every((r) => r.conformant), records };
}

// ── .env loader ───────────────────────────────────────────────────────────────
function loadDotEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch { /* no .env */ }
}

// ── First-run wizard ──────────────────────────────────────────────────────────
async function wizard() {
  const rl  = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => rl.question(q);
  const lines = [];

  console.log('\n=== Mycelium-for-Qonic — first-run setup ===\n');
  console.log('  1) Phase 0 — IFC export file  (no API key needed)');
  console.log('  2) Phase 1 — Qonic REST API   (OAuth 2.1 Bearer token)\n');

  const mode = (await ask('Mode [1/2]: ')).trim();

  if (mode === '1') {
    const p = (await ask('Path to IFC export file: ')).trim();
    if (p) lines.push(`QONIC_IFC=${p}`);
  } else if (mode === '2') {
    console.log('\nOAuth token from https://developer.qonic.com (scopes: projects:read, models:read)\n');
    const tok  = (await ask('QONIC_TOKEN: ')).trim();
    const proj = (await ask('QONIC_PROJECT_ID: ')).trim();
    const url  = (await ask('QONIC_API_URL [https://api.qonic.com/v1]: ')).trim();
    const wb   = (await ask('Enable Phase 2 write-back? [y/N]: ')).trim().toLowerCase();
    if (tok)       lines.push(`QONIC_TOKEN=${tok}`);
    if (proj)      lines.push(`QONIC_PROJECT_ID=${proj}`);
    if (url)       lines.push(`QONIC_API_URL=${url}`);
    if (wb === 'y') lines.push('QONIC_APPLY=1');
  }

  rl.close();

  if (lines.length) {
    writeFileSync('.env', lines.join('\n') + '\n');
    console.log('\n✓ Config saved to .env — re-run to execute the connector.\n');
    process.exit(0);
  }
}

// ── Phase 0: IFC export reader ────────────────────────────────────────────────
const ENTITY_RE = /(IFC[A-Z0-9]+)\s*\(\s*'([0-9A-Za-z_$]{22})'/g;
function extractIfcElements(text, projectKey) {
  const byGuid = new Map();
  for (const m of String(text ?? '').matchAll(ENTITY_RE)) {
    const [, type, ifcGuid] = m;
    if (type === 'IFCPROJECT' || type === 'IFCOWNERHISTORY') continue;
    if (!byGuid.has(ifcGuid))
      byGuid.set(ifcGuid, { elementId: ifcGuid, ifcGuid, type, project: projectKey || 'qonic-ifc', revision: 'ifc', modified: null });
  }
  return [...byGuid.values()];
}

// ── Phase 1: Qonic REST API ───────────────────────────────────────────────────
async function qonic(base, token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Qonic ${method} ${path} → HTTP ${res.status}`);
  return res.status === 204 ? {} : res.json();
}
const arr = (d, ...keys) => keys.map((k) => d?.[k]).find(Array.isArray) || (Array.isArray(d) ? d : []);

async function fetchApiElements(base, token, project) {
  const models = arr(await qonic(base, token, `/projects/${project}/models`), 'models','results','data');
  const out = [];
  for (const m of models) {
    const modelId = m.modelId ?? m.id ?? m.guid ?? m;
    const products = arr(
      await qonic(base, token, `/projects/${project}/models/${modelId}/products`),
      'products','results','data');
    for (const p of products) {
      const guid = p.guid ?? p.globalId ?? p.id;
      if (!guid) continue;
      out.push({ elementId: guid, ifcGuid: guid, modelId,
        type: p.class ?? p.ifcType ?? p.type ?? null,
        classification: p.classification ?? p.codification ?? undefined,
        project, revision: p.modifiedAt ?? p.updated ?? null, modified: p.modifiedAt ?? p.updated ?? null });
    }
  }
  return out;
}

// ── Entry point ───────────────────────────────────────────────────────────────
loadDotEnv();

const SOURCE  = 'qonic';
const BASE    = process.env.QONIC_API_URL    || 'https://api.qonic.com/v1';
const TOKEN   = process.env.QONIC_TOKEN      || '';
const PROJECT = process.env.QONIC_PROJECT_ID || '';
const IFC     = process.env.QONIC_IFC        || '';

// Show wizard on first run (no .env, interactive terminal)
if (!existsSync('.env') && process.stdin.isTTY) await wizard();

const cfg = {
  source: SOURCE,
  identity:  { localIdField: 'elementId', projectKey: '{project}' },
  freshness: { revisionId: '{revision}', asOf: '{modified}', confidence: IFC ? 'snapshot' : 'live' },
};

async function fetchSource() {
  if (IFC)            return extractIfcElements(readFileSync(IFC, 'utf8'), PROJECT);
  if (TOKEN && PROJECT) return fetchApiElements(BASE, TOKEN, PROJECT);
  // Demo record (no config set — lets the binary be smoke-tested without credentials)
  return [{ elementId: 'QNC-DEMO-001', project: 'demo',
    ifcGuid: '0DemoGuidXXXXXXXXXXXXX1', revision: 'demo', modified: new Date().toISOString() }];
}

const result = await runAdapter(cfg, { fetchSource });
console.log(JSON.stringify(result, null, 2));
process.exit(result.conformant ? 0 : 1);
