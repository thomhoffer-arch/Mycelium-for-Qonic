# Qonic API — plain-language reference
> Source: https://api-docs.qonic.com/ (2026-06-17). Base URL: `https://api.qonic.com/v1`.

## Auth
OAuth 2.1 Authorization Code (+ optional PKCE). `Authorization: Bearer <token>` on every request.
- App at https://developer.qonic.com → `client_id`/`client_secret` + redirect URI.
- `GET /v1/auth/authorize?client_id&redirect_uri&scope&state[&code_challenge&code_challenge_method=S256]`
- `POST /v1/auth/token`: `client_id, client_secret, code, redirect_uri[, code_verifier], grant_type=authorization_code`
- Secret exchange on a backend. Samples: github.com/QonicOpen/ApiPythonSample, github.com/QonicOpen/QonicExcel
- Scopes: `projects:read|write` · `models:read|write` · `issues:read` · `libraries:read|write`

## Products (elements; each has a GUID + properties)
| Method | Path | Purpose |
|---|---|---|
| GET | /projects/:projectId/models | list models |
| GET | /projects/:projectId/models/:modelId/products?fields[]=…&filters[key]=val | get products |
| GET | /projects/:projectId/models/:modelId/products/available-data | list available properties |
| POST | /projects/:projectId/models/products/query | query (body: modelId, fields, filters) |
| POST | /projects/:projectId/models/products | update props (body: modelId, add, update, delete, property) |
| POST | /projects/:projectId/models/products/start-session | begin a modification session (body: modelId) |
| POST | /projects/:projectId/models/products/end-session | end the session (body: modelId) |
| DELETE | /projects/:projectId/models/:modelId/products/:guid | delete a product |
| GET | /projects | list accessible projects |

Bulk modifications must be wrapped in start-session … end-session.

## Other resources
Codifications (classification libs; code has `identification`, e.g. 21.20) · Custom Properties
(read-only Qonic/IFC lib + editable custom lib) · Materials · Locations (Site→Building→Floor→Space) · Types.

## Known doc errata (match the server, not the docs)
- "Update a property" URL typo `customProeprties` — test `customProperties`.
- Product-object field table mislabels descriptions; real query params are `fields` + `filters`.
- "Update type" path param documented as `locationGuid` should be `typeGuid`.
- Exact body shape for product `update` not fully specified — verify on a live model.
