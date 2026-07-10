# Weblua

[Weblua](https://weblua.com/) is a free, client-side playground for multi-file
Lua 5.1, 5.2, 5.3, 5.4, and Luau projects. Each run happens in a dedicated Web
Worker through WebAssembly; there is no account system, code-execution backend,
or project database.

Weblua is a language playground, not a Roblox emulator. Its Luau runtime accepts
Luau language syntax, including annotations and generics, but does not provide
Roblox services, instances, globals, Studio tooling, or static type analysis.

## What the playground includes

- Lua 5.1, 5.2, 5.3, 5.4, and Luau runtime selection per project.
- Multi-file projects with a selectable entry file.
- `require("lib.module")`, `require("lib/module")`, and `init.lua` module aliases.
- A compile-only **Check** action with per-file syntax diagnostics.
- Preset stdin through `io.read()` in Lua and `read()` in Luau.
- Captured stdout, stderr, status, and elapsed time after each run finishes.
- Source-only share links and lazy-loading iframe embeds.
- Recovery drafts and named projects stored in IndexedDB.
- Source-only `.weblua.json` import and export.
- Thirteen built-in examples, including a multi-file capability tour.

## Try the capability tour

Choose **Multi-file capability tour** from the Example menu. It demonstrates:

- nested modules and `init.lua` resolution;
- `require` caching;
- a selected `main.lua` entry point;
- preset line and whole-input reads; and
- formatted output from several source files.

The same project is available as
[`examples/weblua-capability-tour.weblua.json`](examples/weblua-capability-tour.weblua.json)
and can be loaded with the playground's Import project button.

## Project execution model

Projects contain a runtime flavor, an entry path, and a map of normalized relative
source paths. Lua 5.4 mounts those files into Wasmoon's virtual filesystem. Lua
5.1–5.3 register the same paths through `package.preload`. Luau compiles every file
and resolves modules through an in-VM browser-safe loader.

The **Check** action only compiles every source file. For Luau, this verifies syntax;
it does not invoke the Luau Analysis library or report static type errors.

Output is collected inside the worker and returned when execution completes or
fails. It is not streamed incrementally to the UI.

## Sharing, embeds, and persistence

Current share links encode a source-only project as `/playground#c=2...`. The map is
compressed with browser-native `CompressionStream` using raw DEFLATE, then
base64url-encoded into the fragment. The same payload is used by `/embed#c=2...`.
URL fragments are not included in HTTP requests to the static host.

Share links and embeds include:

- source files;
- the selected entry file; and
- the runtime flavor.

They deliberately exclude preset input, output, active editor state, named-project
metadata, and IndexedDB records. Older `#c=1...` and `#share=` links still decode as
one-file projects.

Encoded share payloads are limited to 32 KiB. When a project is too large for a
reliable URL, export its source as `.weblua.json` instead. Decompressed incoming
share data is capped at 1 MiB before JSON parsing.

The browser stores the recovery draft and named project library in IndexedDB. If
IndexedDB is unavailable, the editor falls back to non-persistent in-memory storage.

## Runtime boundaries

- Runs stop after five seconds by terminating the worker.
- Lua 5.4 has a 32 MiB runtime memory cap.
- URL sharing has a 32 KiB encoded-payload cap.
- The Luau runtime does not include Roblox APIs or a static type checker.
- The virtual project filesystem only contains the source files supplied to the run.
- Lua 5.4's `io.read` override and Luau's `read` helper support `*l`, `*L`, and
  `*a`. Lua 5.1–5.3 receive the preset input through their standard byte-stream stdin.

These boundaries make Weblua suitable for examples, experiments, bug reproductions,
and language comparisons—not long-running jobs or validation against a production
Roblox environment.

## Privacy and optional telemetry

Normal execution does not upload project source to a code-execution service. Sharing
places source in a URL fragment only when the user requests a link or embed.

Deployments may optionally enable Plausible usage events and Sentry error reporting.
The tracked product events contain runtime/status metadata rather than source. Sentry
is configured without default PII, and Weblua strips URL fragments and redacts `#c=`
and `#share=` payloads from error events and navigation breadcrumbs before sending.
Plausible is not loaded on a URL that contains a current or legacy source payload.
Leave both environment variables unset to disable these integrations completely.

## Browser requirements

Weblua targets current evergreen browsers with JavaScript, WebAssembly, module Web
Workers, and modern URL APIs. Project sharing additionally needs
`CompressionStream`/`DecompressionStream`; persistence needs IndexedDB; copying links
and embeds needs the Clipboard API.

There is currently no service worker, so reliable offline startup is not guaranteed.
An already loaded session can execute without an execution-server round trip, but
Weblua should not yet be described as a complete offline PWA.

## Run locally

Node 22.12 or newer is recommended.

```sh
npm install
npm run dev
```

Open the local Vite URL. Press Ctrl/Cmd-Enter to run, or Ctrl/Cmd-Shift-Enter to
compile-check every file.

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks, builds, writes static `/playground` and `/embed`
  entry pages, and prerenders the landing page.
- `npm run preview` serves the production build locally.
- `npm test` runs the project, codec, persistence, routing, telemetry, and Luau
  regression tests.

## Docker and self-hosting

The included multi-stage Dockerfile builds the Vite app with Node 22 and serves the
static output with nginx:

```sh
docker build -t weblua .
docker run --rm -p 8080:80 weblua
```

Open `http://localhost:8080`. The nginx configuration serves hashed assets with
long-lived caching and provides route fallback for `/playground` and `/embed`.

For a complete hosted deployment walkthrough, see
[`docs/coolify-deployment.md`](docs/coolify-deployment.md).

## Upstream note: Luau JSPI `pcall`/`xpcall`

`luau-web@1.4.0` auto-selects its JSPI build in browsers that expose
`WebAssembly.Suspending` and `WebAssembly.promising`. In that build, Luau runtime
errors can escape `pcall`/`xpcall` instead of returning `false, message`.

Weblua avoids that path in
[`src/lib/luauWebAsyncify.ts`](src/lib/luauWebAsyncify.ts) by loading
`luau-web/src/lib/Luau.Web.Asyncify.js` directly. Regression tests cover both
`pcall` and `xpcall` and verify that execution continues after the protected error.
This fixes Weblua's user-visible behavior, but it is a local workaround—not an
upstream JSPI fix.

The upstream JSPI target links with `-fwasm-exceptions`, while the protected-call
implementation lives in the ordinary `Luau.VM` static library. A clean upstream
fix would compile a separate `Luau.VM.JSPI` with native WebAssembly exceptions and
link `Luau.Web.JSPI` against it. The prepared reproduction and proposed patch shape
are in [`docs/luau-web-pcall-issue.md`](docs/luau-web-pcall-issue.md).

Once upstream publishes a fixed release, update `luau-web`, verify both protected
call regressions in a JSPI-capable browser, and remove the Asyncify-only wrapper.

## Production hooks

Optional build-time environment variables:

```sh
VITE_PLAUSIBLE_DOMAIN=weblua.com
VITE_SENTRY_DSN=https://example@sentry.io/project
```

Both are optional and disabled when empty. Because Vite inlines them at build time,
changing either value requires a rebuild.

## License

Weblua is available under the [MIT License](LICENSE).
