# Launch post drafts

Drafts for announcing Luau type checking. Post them only after the type checker is
deployed to weblua.com, and edit freely: they are written in the maintainer's voice.

Facts below were checked on 2026-10-01. Re-check the comparison lines before posting,
since play.luau.org changes too.

- play.luau.org has type checking, multiple files, share links, embeds, a bytecode
  view, and solver/compiler settings. It has no `task` library and runs only Luau.
  Weblua now has a bytecode view with optimization and debug levels too, but no
  solver choice.
- Weblua's example menu has **Luau typed modules**, which shows types crossing a
  `require`. Point people at it rather than pasting a long `#c=` link: that example
  alone makes an 877-character link.

---

## 1. Roblox DevForum: Community Resources

Check the category's posting requirements and template before posting.

**Title:** Weblua: a free browser playground for Luau, with type checking, `task`, and multi-file projects

**Body:**

Hi all! I've been building **Weblua** (https://weblua.com), a free, open-source
playground for testing Luau in a browser tab, without opening Studio.

**What it does**

- **Type checking as you type**, using Luau's own analyzer: squiggles in the editor,
  strict mode by default, and `--!strict` / `--!nonstrict` / `--!nocheck` per file.
- **Typed autocomplete and hover**: hover a variable to see its type, including types
  that come from another file through `require`.
- **Multi-file projects** with `require("./module")`, `../`, `@self`, and `init.luau`
  folders.
- **The `task` library**: `task.spawn`, `defer`, `delay`, `wait`, and `cancel`, with
  real waits, so output streams in as it prints.
- **A bytecode view**: see what the compiler makes of a file at each optimization
  level, including what `--!optimize 2` inlines.
- **StyLua formatting** (Shift+Alt+F), **share links**, **iframe embeds**, and saved
  projects in your browser.
- It also runs **Lua 5.1 through 5.5**, handy for checking how a snippet behaves
  outside Luau.

Everything runs locally through WebAssembly. There's no account, and your code isn't
sent to a server.

**What it isn't:** Weblua is not a Roblox emulator. There's no `game`, `Instance`,
`Vector3`, or any other Roblox API, and the type checker doesn't know Roblox types. It's
for language-level things: trying out a type, testing a module, reproducing a
`task` ordering question, or sharing a snippet in a support thread.

**Try it:** open https://weblua.com/playground and pick **Luau typed modules** from the
Example menu. Hover `potion`, or type `inventory.` to see completions typed from the
other file.

It's MIT licensed: https://github.com/PytechNo/Weblua. Bug reports and feature
requests are very welcome. I'd especially like to hear about any place where `require`
or `task` behaves differently from what you see in Studio.

---

## 2. Luau GitHub Discussions: Show and tell

https://github.com/luau-lang/luau/discussions/categories/show-and-tell

**Title:** Weblua: a browser playground with the Luau analyzer, `task`, and Lua 5.1–5.5 side by side

**Body:**

I'd like to share **Weblua** (https://weblua.com), an MIT-licensed browser playground
for multi-file Luau and Lua 5.1–5.5 projects:
https://github.com/PytechNo/Weblua

On the Luau side:

- The editor runs `Luau.Analysis` (via the `@luau-rs/luau` WebAssembly build) in a
  worker: live diagnostics and lints, strict mode by default with hot comments
  respected, plus typed completion and hover.
- `require` follows require-by-string: `./`, `../`, `@self`, and `init.luau`. The
  analyzer's module resolution mirrors the runtime's, so types flow between files.
- A small `task` scheduler written in Luau (`spawn`, `defer`, `delay`, `wait`,
  `cancel`) runs on real time, so top-level code can `task.wait`.
- A bytecode tab lists the open file at optimization and debug levels 0–2, with
  remarks and source lines. Runs honor `--!optimize`.
- Runs execute in a Web Worker; nothing is sent to a server.

play.luau.org is still the place to try the old solver, and I point people there for
that. Weblua's niche is multi-file projects with `task`, and comparing a snippet
against Lua 5.1–5.5 in the same tool.

One caveat I'd welcome advice on: the analyzer and the runtime come from different
Luau releases, so very new syntax can pass one and not the other. If there's a better
way to keep the two in step, I'd love to hear it.

---

## 3. r/robloxgamedev

I could not load the subreddit's rules while drafting this. Check its self-promotion
rules and any required post flair first.

**Title:** I made a free browser playground for testing Luau: type checking, task.wait, multiple files, no Studio needed

**Body:**

When I want to test a type annotation or a quick module idea, opening Studio feels
heavy, so I built **Weblua**: https://weblua.com

- Luau's real type checker runs as you type (strict by default), with hover types and
  typed autocomplete.
- Multi-file projects with `require("./module")`, so you can test how types flow
  between modules.
- `task.spawn` / `task.delay` / `task.wait` work, so you can check scheduling order.
- Share a project as a link, and format with StyLua.
- It runs in your browser: no account, and your code stays on your machine.

To be clear, it's **not** a Roblox emulator: no `game`, `Instance`, or Roblox types. It's
for pure Luau logic, like types, modules, and tasks.

The "Luau typed modules" example is a good starting point. It's free and open source
(MIT), and feedback is very welcome!

---

## 4. Issue for luau-lang/site: a community tools page

https://github.com/luau-lang/site/issues/new

luau.org has no community-tools page today, so this proposes one rather than asking
for a single link. Keep it about the page, not about Weblua.

**Title:** Proposal: a "Community tools" page listing third-party Luau tools

**Body:**

luau.org links the official playground and Lute. Beyond those, people searching for
Luau tooling find community projects scattered across the DevForum, Discord, and
GitHub, with no single place to start.

Would the team be open to a short **Community tools** page, for example under
Learn or in the footer? It could list editors and language servers, formatters,
linters, runtimes, and playgrounds. Each entry would be a name, a link, and one
neutral sentence, with a note that the projects are community-maintained and not
endorsed.

Possible inclusion criteria, to keep it maintainable:

- open source, with a public repository and issue tracker;
- actively maintained (a release or commit in the last year);
- focused on Luau itself, not a single game.

For transparency: I maintain one such tool, Weblua (https://weblua.com), a browser
playground for multi-file Luau and Lua 5.1–5.5 projects with the Luau analyzer. I'd be
glad to open a PR with the page and a first list of entries if this direction works
for you, or to drop the idea if it doesn't fit the site.
