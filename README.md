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

## Known Limitations

### Luau `pcall`/`xpcall` cannot catch runtime errors

In the **Luau** runtime (`luau-web`), `pcall` and `xpcall` do **not** catch errors. Any
error that occurs inside a protected call — `error(...)`, a failed `assert`, indexing
`nil`, arithmetic on `nil`, etc. — escapes the protected call, aborts the VM, and stops
the whole script instead of returning `false, message`. The Lua 5.4 runtime (`wasmoon`)
is unaffected and handles `pcall` correctly.

**Root cause:** Luau raises errors as C++ exceptions, and its `pcall` implementation
relies on `try/catch`. The prebuilt WASM shipped in `luau-web@1.4.0` (both the JSPI and
Asyncify builds) was compiled with Emscripten's exception catching **disabled**, so
`__cxa_throw` aborts to the top level instead of unwinding into `pcall`'s handler. You
can see the evidence in `node_modules/luau-web/src/lib/Luau.Web.Asyncify.js`, which
contains the Emscripten stub string *"Exception thrown, but exception catching is not
enabled."* The JSPI build has no exception symbols at all.

Until this is fixed upstream, [runWorker.ts](src/workers/runWorker.ts) appends a note to
the output whenever a Luau run errors out and the source used `pcall`/`xpcall`.

**How to fix it (for when you come back to this):**

1. The real fix is upstream in [luau-web](https://github.com/xNasuni/luau-web). The WASM
   must be rebuilt with C++ exception support enabled. In Emscripten that means adding
   `-sNO_DISABLE_EXCEPTION_CATCHING` (Emscripten/JS-based exceptions) or the newer
   `-fwasm-exceptions` + `-sSUPPORT_LONGJMP=wasm` (native WASM exceptions) to the link
   flags, and building Luau's `Luau.VM` with exceptions enabled (not `LUA_USE_LONGJMP`).
   Note that native WASM exceptions can conflict with Asyncify, so the Asyncify build may
   need the JS-based exception scheme while the JSPI build can use native.
2. File an issue upstream at https://github.com/xNasuni/luau-web/issues so the maintainer
   can publish a fixed `luau-web` release (draft text lives in `docs/luau-web-pcall-issue.md`).
3. Once a fixed version is published, bump `luau-web` in `package.json`, then verify with
   a snippet like `print(pcall(function() error("x") end))` — it should print
   `false   <chunk>:1: x` and keep running. Remove the `pcallLimitationNote` hint in
   [runWorker.ts](src/workers/runWorker.ts) when it's no longer needed.
4. If upstream stalls, the interim option is to vendor a self-built WASM: clone luau-web,
   apply the link flags above, rebuild, and drop the artifacts into a local copy of the
   package (or a patched fork referenced from `package.json`).

## Production Hooks

Optional launch hooks are environment driven:

```sh
VITE_PLAUSIBLE_DOMAIN=weblua.com
VITE_SENTRY_DSN=https://example@sentry.io/project
```
