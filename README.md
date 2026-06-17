# Mycelium-for-Qonic

Brings **Qonic** (cloud-native, browser-first BIM; Ghent, ex-Bricsys) onto the Connective Spine via
`ifcGuid`. Built on **[mycelium-sdk](https://www.npmjs.com/package/mycelium-sdk)** (the contract +
conformance kit; see its README to build your own connector). API contract: `QONIC-API.md`.

## Phases (lowest-risk first)
| Phase | Transport | Needs | Confidence |
|---|---|---|---|
| 0 — IFC export | read an IFC export, lift each rooted object's GlobalId | `QONIC_IFC=<path>` | snapshot |
| 1 — API read | Qonic REST, OAuth 2.1 Bearer (`projects:read`/`models:read`) | `QONIC_TOKEN`, `QONIC_PROJECT_ID` | live |
| 2 — write-back | enrichment onto elements by GUID (`models:write`) | + `QONIC_APPLY=1` (else dry-run) | — |

Phase 0 works with zero API dependency — run it first.

## Config (env)
`QONIC_IFC` · `QONIC_API_URL` (default `https://api.qonic.com/v1`) · `QONIC_TOKEN` ·
`QONIC_PROJECT_ID` · `QONIC_APPLY` (`1` to write in Phase 2).

## Confirm on a live model before Phase 1/2
1. product GUID == IFC `GlobalId` (mind Revit→IFC GUID stability on imports);
2. the exact body shape of the product `update` write.

## Run
```sh
npm install
QONIC_IFC=./export.ifc node connector.mjs
QONIC_TOKEN=… QONIC_PROJECT_ID=… node connector.mjs
```

## License
Apache-2.0
