# mycelium-for-qonic

A [Mycelium](https://connectivespine.org) connector for **Qonic** — collaborative BIM element records keyed by `ifcGuid`.

## Download

Grab the binary for your platform from the [latest release](https://github.com/thomhoffer-arch/Mycelium-for-Qonic/releases/latest):

| Platform | File |
|---|---|
| Windows | `mycelium-for-qonic-vX.X.X-win.exe` |
| macOS (Intel) | `mycelium-for-qonic-vX.X.X-macos` |
| macOS (Apple Silicon) | `mycelium-for-qonic-vX.X.X-macos-arm64` |

Node.js is bundled — nothing else to install.

### macOS: allow the binary to run

```sh
xattr -cr mycelium-for-qonic-*-macos*   # clear Gatekeeper quarantine
chmod +x  mycelium-for-qonic-*-macos*
```

## First run

On first run (no `.env` in the working directory) the binary opens a setup wizard:

```
=== Mycelium-for-Qonic — first-run setup ===

  1) Phase 0 — IFC export file  (no API key needed)
  2) Phase 1 — Qonic REST API   (OAuth 2.1 Bearer token)

Mode [1/2]:
```

Config is saved to `.env` in the working directory and auto-loaded on every subsequent run.

## Run

```sh
# Windows
mycelium-for-qonic-v0.1.0-win.exe

# macOS
./mycelium-for-qonic-v0.1.0-macos
```

Outputs a conformance-checked JSON spine record. Exit 0 = conformant.

## Config (env / .env)

| Var | Meaning |
|---|---|
| `QONIC_IFC` | path to an IFC export → Phase 0 |
| `QONIC_TOKEN` | OAuth 2.1 Bearer token → Phase 1 |
| `QONIC_PROJECT_ID` | Qonic project ID → Phase 1 |
| `QONIC_API_URL` | API base (default `https://api.qonic.com/v1`) |
| `QONIC_APPLY` | `1` to write back in Phase 2 (default: dry-run) |

## For developers (npm)

```sh
npm install
node connector.mjs   # uses mycelium-sdk from npm
```

## Release a new build

Push a version tag — CI builds all three binaries and publishes a GitHub Release:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

## Reference

- [Mycelium spec](https://connectivespine.org/spec/)
- [mycelium-sdk on npm](https://www.npmjs.com/package/mycelium-sdk)
- [Qonic API docs](https://api-docs.qonic.com/) — see also `QONIC-API.md`

## License

Apache-2.0
