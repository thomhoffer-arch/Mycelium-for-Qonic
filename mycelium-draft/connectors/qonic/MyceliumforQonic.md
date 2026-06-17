# Mycelium-for-Qonic — connector bundle

Single copy-paste file: README + connector source + API reference.
License: **Apache-2.0** (Mycelium open ecosystem — NOT Loam core proprietary).
Recreate under `mycelium-draft/connectors/qonic/`. Imports the spine helpers `../../lib/spine-adapter.mjs` + `../../conformance/validate.mjs`.

---

## README.md

# Mycelium-for-Qonic

Brings **Qonic** (cloud-native, browser-first BIM; Ghent, founded by ex-Bricsys) onto the Connective
Spine. Qonic is **IFC-native** with a per-object **GlobalId**, so it joins on `ifcGuid` like OpenAEC —
no new spine key. Implements the
[connective-spine contract](https://github.com/thomhoffer-arch/Mycelium/blob/main/spec/connective-spine.md).
API contract kept alongside in [`QONIC-API.md`](./QONIC-API.md).

> **Status: 🧪 draft.** Lives here as a folder while it iterates; per the
> [hub registry](../../hub/REGISTRY.md) it spins out to its **own repo** (`Mycelium-for-Qonic`)
> when it graduates to **verified** (conformance kit + tested against the live Qonic API).

## What it connects
- **Source:** Qonic projects/models (IFC-native BIM, openBIM; bSDD classification; per-object GUID).
- **Join key:** `ifcGuid` (IFC `GlobalId`). MUST-keys: `source` / `sourceLocalId` / `projectKey`.
- **Direction:** read (Phase 0/1); optional write-back (Phase 2).

## Three phases (lowest-risk first)
| Phase | Transport | Needs | Confidence |
|---|---|---|---|
| **0 — IFC export** | read an IFC file Qonic exported, lift each rooted object's GlobalId | `QONIC_IFC=<path>` | `snapshot` |
| **1 — API read** | Qonic REST, OAuth 2.1 Bearer (scopes `projects:read` / `models:read`) | `QONIC_TOKEN`, `QONIC_PROJECT_ID` | `live` |
| **2 — write-back** | PATCH enrichment (classification / PO) onto elements by GUID (`models:write`) | + `QONIC_APPLY=1` (else dry-run proposal) | — |

Phase 0 works **today with zero API dependency** and validates the GUID join immediately. Run it first.

## Config (env)
| Var | Meaning |
|---|---|
| `QONIC_IFC` | path to an IFC export → Phase 0 (wins when set) |
| `QONIC_API_URL` | API base (default `https://api.qonic.com/v1` — **verify**) |
| `QONIC_TOKEN` | OAuth 2.1 Bearer access token |
| `QONIC_PROJECT_ID` | Qonic project for API read |
| `QONIC_APPLY` | `1` to actually write in Phase 2 (default: propose/dry-run) |

## Spine mapping
| Qonic | → Spine record | Join |
|---|---|---|
| element (IFC export or API) | identity [+ `classification`] | `ifcGuid` |
| property write-back | provenance `set_properties` (proposed → executed) | `ifcGuid` |

## Endpoints (from the official docs — see [`QONIC-API.md`](./QONIC-API.md))
- Read: `GET /projects/:id/models` → `GET /projects/:id/models/:modelId/products` (products carry the GUID).
- Write: `POST /projects/:id/models/products/start-session` → `POST …/products` (`update`) → `…/end-session`.

## ⚠️ Two things to confirm on a live model
The endpoints, auth and scopes are **documented and used as-is**. Still worth confirming with a real
project before relying on Phase 1/2:
1. the **product GUID equals the IFC `GlobalId`** (expected — Qonic is IFC-native and its UI copies the
   object GlobalId — but confirm, and mind the Revit→IFC GUID-stability caveat on imported models);
2. the exact **body shape of the product `update`** write (how properties key to a product GUID).
Phase 0 (IFC export) depends on neither.

## Run
```sh
QONIC_IFC=./export.ifc node connector.mjs          # Phase 0 (no API)
QONIC_TOKEN=… QONIC_PROJECT_ID=… node connector.mjs  # Phase 1 (API read)
```

## License
**Apache-2.0** — the Mycelium open-ecosystem license (see `mycelium-draft/LICENSE`), **not** Loam
core's proprietary license. Connectors are open so anyone can build/verify/ship them.


---

## connector.mjs

```javascript
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

```

---

## QONIC-API.md

# Qonic API — plain-language reference

> Source: https://api-docs.qonic.com/ — fetched 2026-06-17. Kept with the connector as its API
> contract. Base URL: `https://api.qonic.com/v1`.

## Auth
OAuth 2.1 Authorization Code (+ optional PKCE). Bearer token on every request:
`Authorization: Bearer <token>`.
- Register an Application at https://developer.qonic.com → `client_id` / `client_secret` + redirect URI.
- `GET /v1/auth/authorize?client_id&redirect_uri&scope&state[&code_challenge&code_challenge_method=S256]`
- `POST /v1/auth/token` (form/JSON): `client_id, client_secret, code, redirect_uri[, code_verifier], grant_type=authorization_code`
- Do the secret exchange on a backend, never in a browser. Samples: github.com/QonicOpen/ApiPythonSample, github.com/QonicOpen/QonicExcel

### Scopes
`projects:read` · `projects:write` · `models:read` · `models:write` · `issues:read` ·
`libraries:read` · `libraries:write`

## Products (= building elements; each has a GUID + properties)
| Method | Path | Purpose |
|---|---|---|
| GET | `/projects/:projectId/models` | list models in a project |
| GET | `/projects/:projectId/models/:modelId/products?fields[]=…&filters[key]=val` | get products |
| GET | `/projects/:projectId/models/:modelId/products/available-data` | list available product properties |
| POST | `/projects/:projectId/models/products/query` | query products (body: `modelId, fields, filters`) |
| POST | `/projects/:projectId/models/products` | update props (body: `modelId, add, update, delete, property`) |
| POST | `/projects/:projectId/models/products/start-session` | begin a modification session (body: `modelId`) |
| POST | `/projects/:projectId/models/products/end-session` | end the session (body: `modelId`) |
| DELETE | `/projects/:projectId/models/:modelId/products/:guid` | delete a product (permanent) |
| GET | `/projects` | list accessible projects |

Bulk modifications must be wrapped in start-session … end-session.

## Other resources (libraries)
- **Codifications** (classification libs, e.g. NL-SfB/Uniclass): `…/codifications[/…]` — code object has
  `identification` (e.g. `21.20`), `name`, `parentId`.
- **Custom Properties**: project has a read-only Qonic/IFC schema lib + an editable Custom Properties lib;
  property sets + definitions under `…/customProperties/…`.
- **Materials**: `…/material-libraries[/…]`. **Locations** (Site→Building→Floor→Space tree): `…/locations`.
  **Types** (IfcWallType etc.): `…/types`.
(See the upstream docs for full field lists; the connector only needs products + codifications today.)

## Known doc errata (match the server, not the docs)
- "Update a property" path has a typo `customProeprties` — test `customProperties` first.
- The product-object field table mislabels descriptions; the real query params are `fields` + `filters`.
- "Update type" path param documented as `locationGuid` should be `typeGuid`.
- The exact body shape for product `update` (how properties key to a product GUID) is not fully spelled
  out — verify against a live model before bulk writes.
