# mycelium-for-qonic

A [Mycelium](https://connectivespine.org) connector for **Qonic** — collaborative BIM element records keyed by `ifcGuid`.

## One-click install

```sh
curl -fsSL https://raw.githubusercontent.com/thomhoffer-arch/Mycelium-for-Qonic/main/install.sh | bash
```

Or clone and run manually:

```sh
git clone https://github.com/thomhoffer-arch/Mycelium-for-Qonic.git
cd Mycelium-for-Qonic
npm install
node setup.mjs   # interactive wizard → writes .env, smoke-tests
```

The wizard asks you to choose a mode and collects the right credentials:

| Mode | What you need |
|---|---|
| Phase 0 — IFC export | path to a `.ifc` file Qonic exported (no API key) |
| Phase 1 — REST API | OAuth 2.1 Bearer token + project ID (from [developer.qonic.com](https://developer.qonic.com)) |

After setup, run any time with:

```sh
node connector.mjs
```

Config is stored in `.env` (auto-loaded on every run).

## Wire it to real Qonic

Replace `fetchSource()` in `connector.mjs` with a call to the Qonic API. Keep the field shape — the spine adapter normalises and conformance-checks the rest.

> Note: this is the lightweight **spine-source** connector for Qonic. If you need the full **model-source contract** (the five MCP tools), see `mycelium-sdk/model-source` and [`spec/model-source-contract.md`](https://github.com/thomhoffer-arch/Mycelium/blob/main/spec/model-source-contract.md).

## Reference

- [Mycelium spec](https://connectivespine.org/spec/)
- [mycelium-sdk on npm](https://www.npmjs.com/package/mycelium-sdk)
- [Qonic API docs](https://api-docs.qonic.com/) — see also `QONIC-API.md`

## License

Apache-2.0
