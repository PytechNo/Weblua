# Weblua

Weblua is a client-side Lua playground for Lua 5.4 and Luau. It runs snippets in a Web Worker, captures output, supports URL-fragment sharing, and includes a Cloudflare Worker scaffold for short links.

## Run Locally

```sh
npm install
npm run dev
```

Open the local Vite URL and press Ctrl/Cmd-Enter to run the current snippet.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks the app and Cloudflare Worker, then builds the frontend.
- `npm run test` runs utility tests.
- `npm run worker:dev` starts the short-link Worker once KV IDs are configured.
- `npm run worker:deploy` deploys the short-link Worker.

## Short Links

Fragment links work without a backend. For `/p/:id` short links, create a Cloudflare KV namespace, replace the placeholder IDs in `wrangler.toml`, deploy the Worker, and route `/api/snippets/*` to it. The frontend POSTs snippets to `/api/snippets` and reads `/api/snippets/:id`.

## Upstream Notes

### Luau JSPI `pcall`/`xpcall`

`luau-web@1.4.0` auto-selects its JSPI build in browsers that expose
`WebAssembly.Suspending` and `WebAssembly.promising`. That JSPI build can let Luau runtime
errors escape `pcall`/`xpcall` instead of returning `false, message`.

Weblua works around this in [luauWebAsyncify.ts](src/lib/luauWebAsyncify.ts) by loading
`luau-web/src/lib/Luau.Web.Asyncify.js` directly. The Asyncify build has been smoke-tested
with `print(pcall(function() error("x") end))`, and it keeps running after the protected
error.

The real fix belongs upstream in [luau-interop](https://github.com/xNasuni/luau-interop),
which produces the WASM bundled by [luau-web](https://github.com/xNasuni/luau-web). The
JSPI target links with `-fwasm-exceptions`, but Luau's protected-call implementation lives
inside `Luau.VM`, so the VM library also needs to be compiled with the same native
WebAssembly exception mode. A clean upstream patch would add a separate `Luau.VM.JSPI`
static library, compiled with `-fwasm-exceptions`, and link `Luau.Web.JSPI` against that.

Once upstream publishes a fixed release, bump `luau-web`, verify
`print(pcall(function() error("x") end))`, and remove the local Asyncify-only wrapper.

## Production Hooks

Optional launch hooks are environment driven:

```sh
VITE_PLAUSIBLE_DOMAIN=weblua.com
VITE_SENTRY_DSN=https://example@sentry.io/project
```
