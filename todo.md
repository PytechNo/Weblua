# Weblua Roadmap & Todo

## Direction

Weblua is a multi-dialect Lua playground (5.1–5.5 plus Luau) that runs entirely in
the browser. The Luau audience is the larger one, and most items below serve it,
but the positioning stays "language runtime, not Roblox emulator": features that
only make sense with a partial Roblox engine behind them are out of scope.

- Every item that changes what the runtime or Check action can do must update the
  positioning copy in the same change: `README.md`, `src/components/Landing.tsx`
  (feature cards and FAQ), and the FAQ JSON-LD in `index.html`.
- Lua 5.x users should not be an afterthought: per-version accuracy (grammar,
  stdlib, completions) is part of what makes a multi-dialect playground worth using.
- Anything heavy (formatter, analysis) is lazy-loaded so the first paint and the
  first run stay fast.

Work in the order below. Each phase builds on the previous one.

---

### 1. Lezer grammar for Lua 5.1–5.5 and Luau
Replace the CM5-era `@codemirror/legacy-modes/mode/lua` stream mode. It does not
recognize Luau syntax (an apostrophe inside a backtick string opens a bogus string)
and gives the enabled fold gutter nothing to fold.

- [x] **One grammar, covering every flavor** (`src/lang/lua/lua.grammar`, plus
  external tokenizers for long brackets, `::labels::`, and `>` closing generics):
  - Lua: long strings/comments, `goto` and `::labels::` (5.2+), `<const>`/`<close>`
    attributes (5.4+), `global` declarations (5.5), integer division and bitwise
    operators (5.3+).
  - Luau: type annotations, `type`/`export type` aliases with generics and packs,
    `typeof`, `::` type assertions, backtick interpolated strings with embedded
    expressions, compound assignments, `continue`, `if ... then ... else`
    expressions, function attributes (`@native`).
  - Contextual keywords (`type`, `export`, `continue`, `global`) stay usable as
    identifiers.
  - Also Lua 5.5 named varargs (`...rest`), found by parsing the built-in examples.
- [x] **Structure from the tree**: folding for blocks, functions, tables, and long
  comments; indentation from the tree.
- [x] Builtin globals colored per flavor (a decoration, since which names are builtin
  depends on the runtime, not the syntax), plus `self`.
- [x] ~~Bracket/quote auto-closing~~ — already on via `@uiw/react-codemirror`'s
  default `basicSetup`.

---

### 2. Modern Luau `require`
The Luau resolver only accepts project-root paths (`lib.module`, `lib/module`).
Current Luau code — and every Luau standalone runtime — uses require-by-string.

- [x] **Relative requires**: `./sibling`, `../parent/module`, resolved against the
  requiring file (for `init.luau`, against its folder's parent, per the RFC). The
  caller is found by walking `debug.info` frames, so it works through `pcall` and
  helper functions.
- [x] **`@self` alias**: resolves against the requiring module's own directory.
- [x] **Alias hook for builtins**: `@`-prefixed names branch off before project
  lookup; unknown aliases error with a clear message. Builtin modules plug in there.
- [x] Keep legacy root-relative `lib.module` / `lib/module` working for existing
  share links and examples.
- [ ] `.luaurc` alias files — blocked on non-source project files (see Deferred).

---

### 3. Standard library data, completion, and hover
One per-version data source feeds completion and hover. Versions differ:
`bit32` is 5.2-only, `utf8` is 5.3+, 5.1 has neither, `table.move` is 5.3+, etc.

- [x] **Per-flavor stdlib catalog** (5.1, 5.2, 5.3, 5.4, 5.5, Luau) with
  signatures and one-line docs, plus the Weblua-provided helpers (Luau `read`,
  `warn`, `task`). `stdlib.test.ts` checks it against every engine in both
  directions.
- [x] **Global and member completion** from the catalog for the active flavor.
- [x] **In-file symbols**: locals, functions, parameters, `type` names, and the
  fields a file gives its own tables (`M.x`, `function M:f()`).
- [x] **Luau type completion** in annotations, return types, and casts.
- [x] **`require()` path completion** from project files: dotted names for Lua,
  relative paths for Luau (dotted when the typed text is not `./`-style).
- [x] **Hover documentation** for stdlib functions and libraries; names the
  current flavor lacks say which runtimes have them.

---

### 4. `task` library for Luau
`task` is shared by Roblox, Lune, and Lute, so it fits a language playground.

- [x] **Scheduler written in Luau** (`LUAU_TASK_BOOTSTRAP`), driving
  coroutines. Asyncify alone only lets Luau block on a promise; it does not give
  cooperative threads.
- [x] Entry module runs inside a scheduler thread so top-level `task.wait` works.
- [x] `task.spawn`, `task.defer`, `task.delay`, `task.wait`, `task.cancel`.
- [x] **Real-time clock** (changed from the planned virtual clock): there is no
  output cap, so on a virtual clock `while true do task.wait(1) print() end` would
  flood hundreds of thousands of lines before the timeout instead of avoiding it.
  Real waits stream one line per wait through the live-output path. Waits last at
  least one 60 Hz frame, as on Roblox.
- [x] Run timeout needs no new work — the runner already terminates the worker.
- [x] An error in a spawned task prints to stderr and the rest keep running; an
  error in the main thread fails the run.

---

### 5. Formatter
- [x] **Format action** using StyLua's WASM build (`@johnnymorganz/stylua`),
  lazy-loaded on first use (899 KB gzip), with `Shift+Alt+F` and a pane-header
  button. Applied as a minimal edit so undo and the cursor survive.
- [x] Choose StyLua's syntax per flavor; show a notice (not a silent no-op) when
  the source does not parse.
- [ ] Lua 5.5: StyLua 2.5.2 has no 5.5 mode, so 5.5 files format as 5.4 and
  5.5-only syntax (`global`) gets a notice. Switch when StyLua adds 5.5.

---

### 6. Static type analysis
`luau-web` ships only the compiler and VM, so this means owning an Emscripten
build of `Luau.Analysis` and tracking upstream releases.

- [x] **Spike** (Luau release 740, emsdk 6.0.10). Compiled the 140 sources that
  `Sources.cmake` lists for Common, Ast, Bytecode, Compiler, Config, Analysis, and
  VM with `em++ -fwasm-exceptions`, plus a small harness around one persistent
  `Frontend` (`registerBuiltinGlobals`, `markDirty`, `check`):

  | Build | Raw | gzip | brotli |
  |---|---|---|---|
  | `-O2` | 3.09 MB | 1.04 MB | 758 KB |
  | `-Oz` | 1.84 MB | 713 KB | 543 KB |

  Timings (`-Oz`, Node 22, file already local): instantiate 11 ms, frontend and
  builtin types 24 ms, first check 13 ms, re-check after an edit 1 ms, a 331-line
  strict file 11 ms. It reported real type errors ("Expected this to be 'number',
  but got 'string'"). For scale: the whole Playground chunk is 179 KB gzip, and
  the lazily loaded StyLua is 899 KB gzip.
- [x] **Shipped** on the `@luau-rs/luau` npm package's analysis build rather than an
  owned Emscripten build (`src/workers/luauAnalysisSession.ts`):
  - Lazy-loaded in its own worker, for Luau projects only, once the editor is up.
  - Live diagnostics for the open file in the lint gutter, with column ranges, and
    Check runs it on every file. Lints are warnings, named by lint code.
  - Honors `--!strict` / `--!nonstrict` / `--!nocheck`; the editor header's Types
    menu (Strict / Nonstrict / Off) sets the default.
  - `require` resolves as the runtime does: dotted names, `./`, `../`, `@self`.
  - Declares the Weblua globals `read` and `task`; a test type-checks every built-in
    Luau example.
  - Adds checked types to completion and hover, layered on the stdlib catalog.
  - Positioning copy updated.
- [x] **Typed modules example**: a module exporting types and a typed table that
  `main.luau` requires, with a commented-out call the checker rejects (a test
  uncomments it).
- [ ] **Download size**: the package build is 1.7 MB gzip against the spike's 713 KB
  `-Oz` build. Switching to an owned `-Oz` build would save ~1 MB on the first Luau
  load, at the cost of owning the build. The package's require hooks are internal
  API, which is also why it is pinned to an exact version.

---

### 7. Sharing and launch

- [x] **Share limit measured, kept**: 32 KiB encoded holds about 85 KB (~2,500 lines)
  of source, and typed Luau compresses like any other, so projects rarely hit it.
  The tighter limit is chat: Discord caps a message at 2,000 characters (without
  Nitro), so even a modest project's link does not fit.
- [x] **Gist links** (`src/lib/gist.ts`): `#gist=<id>` on `/playground` and `/embed`
  opens a `.weblua.json` export, or plain `.lua`/`.luau` files, from a GitHub gist;
  **Projects → Open gist** takes a URL. Read-only, since creating a gist needs a
  GitHub login and Weblua has no backend; people export and upload it themselves.
- [x] **Positioning**: meta description, keywords, OG/Twitter text, the OG card
  (`public/og.svg`, rendered to `og.png`), `featureList` in the SoftwareApplication
  JSON-LD, the manifest, and the `/playground` route description mention type
  checking. The landing page has a comparison table against play.luau.org and Roblox
  Studio, dated, that also says where those tools are the better choice.
- [ ] **Community posts**: Roblox DevForum (Community Resources), the Luau repository's
  Show and tell discussions, and r/robloxgamedev. Drafts in `docs/launch-posts.md`.
  Post only once the type checker is deployed.
- [ ] **Ask luau.org to link Weblua**: the site (luau-lang/site) has no community-tools
  page today, so the request is an issue proposing one. Draft in the same file.

---

### Deferred — needs a product decision first
- **Standalone-runtime namespace (Lute)**: `fs`, `serde`, and a `@lute/*`/`@std/*`
  veneer only serve standalone-runtime users; Roblox has no `fs`. If pursued, target
  Lute alone (official `luau-lang` runtime, actively developed) rather than badging
  Lune and Lute over one implementation — their module layouts differ, so each is
  its own adapter. Unsupported calls (`net.serve`, `process.exec`) must `error()`
  with a browser-limitation message.
- **Non-source project files**: prerequisite for `fs` reads and `.luaurc`. Today
  every project file is compiled before a run, so a `data.json` would fail the run.
  Touches validation, the codec and share links, and the file tree.
- **Roblox value types** (`Vector3`, `CFrame`): defensible as pure math types, but a
  correct `CFrame` is large. Only if there is clear demand.

### Dropped
- **`Instance.new` / DataModel stubs**: real Roblox scripts reach for
  `game:GetService`, RemoteEvents, and RunService within a few lines, so a minimal
  tree fails almost immediately, every gap becomes a bug report, and it contradicts
  the "not a Roblox emulator" positioning.
