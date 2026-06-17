# mycelium-for-qonic

A [Mycelium](https://connectivespine.org) connector for **Qonic** — collaborative BIM element records keyed by `ifcGuid`.

## Install

```sh
npm install
```

## Run

```sh
node connector.mjs
```

Should print `"conformant": true`.

## Wire it to real Qonic

Replace `fetchSource()` in `connector.mjs` with a call to the Qonic API. Keep the field shape — the spine adapter normalises and conformance-checks the rest.

> Note: this is the lightweight **spine-source** connector for Qonic. If you need the full **model-source contract** (the five MCP tools), see `mycelium-sdk/model-source` and [`spec/model-source-contract.md`](https://github.com/thomhoffer-arch/Mycelium/blob/main/spec/model-source-contract.md).

## Reference

- [Mycelium spec](https://connectivespine.org/spec/)
- [mycelium-sdk on npm](https://www.npmjs.com/package/mycelium-sdk)

## License

Apache-2.0
