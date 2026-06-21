# mycelium-for-qonic

A [Mycelium](https://connectivespine.org) connector for **Qonic** — collaborative BIM element records keyed by `ifcGuid`.

## Install

### Windows
Download **`mycelium-for-qonic-vX.X.X-setup.exe`** from the [latest release](https://github.com/thomhoffer-arch/Mycelium-for-Qonic/releases/latest) and run it.

The installer checks for (and if needed installs) Node 18+ and Git via `winget`, clones the connector, runs `npm install`, then opens the setup wizard.

### macOS
Download **`mycelium-for-qonic-vX.X.X.pkg`** from the [latest release](https://github.com/thomhoffer-arch/Mycelium-for-Qonic/releases/latest) and open it.

The package checks for (and if needed installs) Node 18+ via Homebrew, clones the connector, runs `npm install`, then opens the setup wizard.

### Linux / manual
```sh
git clone https://github.com/thomhoffer-arch/Mycelium-for-Qonic.git
cd Mycelium-for-Qonic
npm install
node setup.mjs   # interactive wizard → writes .env, smoke-tests
```

## Setup wizard

The wizard (run automatically by the installers) asks:

| Mode | What you need |
|---|---|
| Phase 0 — IFC export | path to a `.ifc` file Qonic exported (no API key) |
| Phase 1 — REST API | OAuth 2.1 Bearer token + project ID from [developer.qonic.com](https://developer.qonic.com) |

Config is saved to `.env` and auto-loaded on every run.

## Run

```sh
node connector.mjs
```

Should print `"conformant": true`.

## Wire it to real Qonic

Replace `fetchSource()` in `connector.mjs` with a call to the Qonic API. Keep the field shape — the spine adapter normalises and conformance-checks the rest. See `QONIC-API.md` for endpoint reference.

> This is the lightweight **spine-source** connector. For the full **model-source contract** (five MCP tools), see `mycelium-sdk/model-source` and [`spec/model-source-contract.md`](https://github.com/thomhoffer-arch/Mycelium/blob/main/spec/model-source-contract.md).

## Release a new version

Push a tag — CI builds both installers and publishes a GitHub Release automatically:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

## Reference

- [Mycelium spec](https://connectivespine.org/spec/)
- [mycelium-sdk on npm](https://www.npmjs.com/package/mycelium-sdk)
- [Qonic API docs](https://api-docs.qonic.com/) — see also `QONIC-API.md`

## License

Apache-2.0
