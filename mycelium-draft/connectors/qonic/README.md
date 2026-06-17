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
