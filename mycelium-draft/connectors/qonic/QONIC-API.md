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
