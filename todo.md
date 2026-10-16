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

### 8. Compiler settings (play.luau.org parity)

- [x] **Type mode setting**: the Types menu (see 6).
- [x] **Bytecode view**: an output-pane tab for Luau projects, from the compiler in
  `@luau-rs/luau`'s runtime build (`Lua.dump`), in its own lazily loaded worker
  (~830 KB gzip). Optimize and Debug levels 0–2, optional source lines, remarks.
- [x] **Compiler options for runs**: luau-web takes source only, so the only lever
  is the `--!optimize` hot comment, which it honors. Runs default to level 1. Both
  are pinned by tests in `luauExecution.test.ts`. The debug level cannot change.
- [ ] **Type solver toggle**: the analysis wasm contains both solvers (the
  `LuauSolverV2` flag is in the binary), but `@luau-rs/luau` exposes no way to set
  it. Ask upstream for a solver option, or get it with an owned build (see the
  download-size item in 6).

---

### 9. Search ranking for "luau playground" and "lua playground"
Search Console, 18 Aug–14 Oct 2026: 295 clicks, 5,153 impressions, 5.7% CTR. Weekly
clicks rose from 8 to 69 and average position from ~19 to ~6. The brand query
"weblua" brings 111 clicks (38%). The gap is the two generic queries:

| Query | Impressions | Avg position | Clicks |
|---|---|---|---|
| luau playground | 1,572 | 6.7 | 25 (1.6%) |
| lua playground | 699 | 9.1 | 13 (1.9%) |

Google results (US, English, logged out) checked three times on 2026-10-16; positions
moved between runs:

- **"luau playground"**: Weblua #6–#8. Above it in every run: play.luau.org,
  luau.org, and github.com/luau-lang/playground (the official project), plus
  xnasuni.github.io/luau-web and a Reddit cluster that includes our own r/lua launch
  post. codapi.org/lua was above us in one run. The top 3 is the official project, so
  the realistic target is #4.
- **"lua playground"**: Weblua #6 in both runs, below codapi.org/lua,
  coddy.tech/playground/lua, play.luau.org, lua.org/demo, and an r/lua thread. This
  top 3 can be beaten.

What the pages above us do differently:

- The tool sites (play.luau.org, luau-web, codapi, Coddy) run code on the URL that
  ranks. Our ranking URL is the homepage, whose hero (`HeroCodeWindow` in
  `Landing.tsx`) is a `role="img"` animation with output faked on a timer. luau.org,
  GitHub, lua.org/demo, and Reddit have no editor and rank on authority.
- They match the query exactly. codapi.org/lua is 108 words titled and headed "Lua
  playground". Coddy has separate `/playground/lua` and `/playground/luau` pages
  (~800 words each) with headings like "What makes this Lua playground useful" and
  "Online Lua compiler FAQ".
- `/playground` renders only "Weblua" as its H1 and ~110 words, mostly UI labels.
  Search Console has it at position ~11.

- [ ] **Runnable editor in the homepage hero**: replace `HeroCodeWindow` with the
  `/embed` iframe, preloaded with the same snippet. Iframe content counts toward the
  page's LCP, so compare Lighthouse LCP before and after. If it regresses, keep the
  static window and swap in the live embed on first click or focus.
- [x] **Give `/playground` its own queries**: the homepage keeps "luau/lua
  playground" (it has 288 of 295 clicks). Change `/playground`'s H1 to match its
  title, "Online Luau & Lua Editor", and add 100–200 words of crawlable text. Queries
  with impressions and no clicks today: "luau online compiler" (18), "luau editor"
  (12), "online luau compiler" (10), "luau online editor" (6).
  Done: the H1 replaces the "Playground" pill in the header, and a 146-word "Online
  Luau compiler and Lua interpreter" section sits below the first screen, linking to
  the homepage FAQ. Both live in `PlaygroundShell`, which the postbuild prerenders
  into `dist/playground/index.html`.
- [x] **Descriptive section headings on the homepage**: "Questions, answered" →
  "Luau & Lua playground FAQ"; "Three steps. Zero setup." → "How to run Luau online".
  These target "run lua in browser" (15 impressions) and "execute luau" (10). Expect
  a small effect: Google describes headings as helping it understand a page, not as a
  strong ranking factor.
- [ ] **Links from where the audience is** (76% of clicks are desktop; Roblox
  developers): this is the open community-posts and luau.org items in 7. luau-web,
  which ranks #4–#7, has a DevForum Community Resources post (Sep 2025) behind it.
  seaofvoices/awesome-luau lists npm packages only, so it is not an option.
- [ ] **Only if "lua playground" stalls**: exact-match `/lua` and `/luau` pages, as
  Coddy and codapi have. `scripts/postbuild.mjs` already generates per-route HTML,
  so this is mostly route config, an nginx location, and the router.

No action needed:

- Google shows the footer tagline as our snippet, not the meta description. Google
  builds snippets mainly from page content, so this is expected.
- The `#access`, `#features`, and similar rows in Search Console are expected: Google
  reports a fragment URL when a search feature links to a section of the page.
- `http://weblua.com/playground/` (10 impressions): nginx already 301s
  `/playground/` to `/playground`.

Fact-check notes (2026-10-16), including corrections to the first read:

- The query table lists 101 named queries totaling 178 clicks. The other 117 come from
  rare queries Google hides for privacy, which still count in the totals. (The first
  read said "top 100 queries"; it isn't a cap.)
- Not every result above us runs code: luau.org, GitHub, lua.org/demo (links out to
  other sites), and Reddit don't.
- The Reddit result is our own launch post grouped with other r/lua threads, not a
  third party recommending Weblua.
- CTR studies put position 3 at about 10–11% (First Page Sage 10.2%, via Coursera;
  Sistrix 11%, via SEJ), and AI Overviews push these numbers down (GrowthSRC: position
  1 fell from 28% to 19%). ~150 clicks from "luau playground" in the top 3 is an upper
  bound, and that top 3 is held by the official project.
- Google's use of click data (NavBoost) comes from 2023 DOJ trial testimony, known
  through secondary reports. How much a quick return to the results counts is not
  public.
- Ranking changes usually take weeks to months to show.

Sources: [Search Console anonymized queries](https://support.google.com/webmasters/answer/7576553),
[Google snippet docs](https://developers.google.com/search/docs/appearance/snippet),
[web.dev LCP and iframes](https://web.dev/articles/lcp),
[CTR, First Page Sage via Coursera](https://www.coursera.org/articles/what-is-serp),
[CTR, Sistrix via SEJ](https://www.searchenginejournal.com/google-first-page-clicks/),
[CTR, GrowthSRC via SEJ](https://www.searchenginejournal.com/google-ctrs-drop-32-for-top-result-after-ai-overview-rollout/551730/),
[headings (SEJ on Mueller)](https://www.searchenginejournal.com/google-heading-tags-important/377592/),
[fragment URLs in GSC (SEJ)](https://searchenginejournal.com/google-reassures-that-anchor-urls-in-gsc-are-okay/539811),
[NavBoost overview](https://www.hobo-web.co.uk/navboost-how-google-uses-large-scale-user-interaction-data-to-rank-websites/),
[luau-web DevForum post](https://devforum.roblox.com/t/luau-web-luau-bindings-with-dynamic-javascript-interop-for-web-browsers-nodejs-and-typescript/3920716),
[awesome-luau](https://github.com/seaofvoices/awesome-luau),
[codapi.org/lua](https://codapi.org/lua/), [coddy.tech/playground/lua](https://coddy.tech/playground/lua),
[play.luau.org](https://play.luau.org), [luau.org](https://luau.org), [lua.org/demo](https://www.lua.org/demo.html).

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
