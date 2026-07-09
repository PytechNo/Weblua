# Weblua

Weblua is a client-side Lua playground for Lua 5.1, 5.2, 5.3, 5.4, and Luau. It runs multi-file projects in a Web Worker, captures output, and keeps sharing and persistence entirely in the browser — no backend required.

## Run Locally

```sh
npm install
npm run dev
```

Open the local Vite URL and press Ctrl/Cmd-Enter to run the current project.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks the app, then builds the frontend.
- `npm run test` runs utility tests.

## Projects, sharing, and persistence

Projects can contain multiple Lua or Luau files and select an entry file. Standard Lua
projects use `require("lib.module")` against an in-worker virtual filesystem; Luau projects
use an equivalent browser-safe module loader. The Input drawer supplies preset stdin for
`io.read()` in Lua and `read()` in Luau.

Sharing is fully client-side. A source-only project map is compressed with browser-native
`CompressionStream` (raw DEFLATE) and base64url-encoded into the link fragment, e.g.
`/playground#c=2...`. Links restore files, entry point, and runtime on any static host.
Input, output, and local project metadata are deliberately excluded. Older `#c=1...` and
`#share=` links still decode as one-file projects. The same mechanism backs `/embed`.

The browser keeps a recovery draft and named project library in IndexedDB. Exports use
source-only `.weblua.json` files for offline transfer when a project is too large for a
reliable URL fragment.

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
