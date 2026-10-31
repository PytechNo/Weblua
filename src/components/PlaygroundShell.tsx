import { Moon, Sun, X } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolPage } from "../lib/routes";
import type { Theme } from "../lib/theme";
import { GitHubMark, MoonMark } from "./Brand";

/** Read by index.html's pre-paint script, which hides the card on later visits. */
const ABOUT_DISMISSED_KEY = "weblua:about-dismissed";

function dismissAbout() {
  document.body.dataset.aboutDismissed = "";
  try {
    window.localStorage.setItem(ABOUT_DISMISSED_KEY, "1");
  } catch {
    // Still hidden for this visit when browser storage is unavailable.
  }
}

interface PlaygroundShellProps {
  theme: Theme;
  onToggleTheme: () => void;
  isEmbed: boolean;
  /** Set on a tool page, which swaps the <h1> and about text for that tool's. */
  tool?: ToolPage;
  /** The workspace; an empty one holds its space while the editor chunk loads. */
  children?: ReactNode;
}

const PLAYGROUND_PAGE = {
  title: "Online Lua & Luau Compiler",
  aboutTitle: "Online Lua compiler, interpreter, and editor",
  about: (
    <>
      <p>
        Weblua is a free online Lua compiler and Luau editor. Pick a runtime, Luau or Lua 5.1,
        5.2, 5.3, 5.4, or 5.5, and press Run. Each run happens in a Web Worker in your browser
        through WebAssembly, so there is no execution server, nothing to install, and no account.
        Compare runs the same code on a second runtime and shows both outputs side by side.
      </p>
      <p>
        The editor runs Luau's <a href="/luau-type-checker">type checker</a> as you type, in
        strict or nonstrict mode, and the Bytecode tab shows what the Luau compiler emits at
        optimization levels 0 to 2. Projects can span several files linked with require, read
        preset input, and be <a href="/lua-formatter">formatted with StyLua</a>.
      </p>
      <p>
        Share a project as a link or an iframe embed, or open one from a GitHub gist. Named
        projects stay in this browser. Weblua runs the Luau language, not Roblox, so Roblox
        services and instances aren't available. More in the{" "}
        <a href="/#faq">Luau &amp; Lua playground FAQ</a>.
      </p>
    </>
  )
};

const TOOL_PAGES: Record<ToolPage, typeof PLAYGROUND_PAGE> = {
  formatter: {
    title: "Lua & Luau Formatter",
    aboutTitle: "Format Lua and Luau code online with StyLua",
    about: (
      <>
        <p>
          Paste Lua or Luau code into the editor and press Format, or Shift+Alt+F. Weblua formats
          it with StyLua, a widely used Lua and Luau formatter, running as WebAssembly in your
          browser. Your code never leaves the page.
        </p>
        <p>
          Pick the runtime first: StyLua parses Luau, Lua 5.1, 5.2, 5.3, and 5.4 syntax, and Lua
          5.5 files format as 5.4. If the code doesn't parse, you get the error instead of a
          silent no-op. Formatting is one edit, so Ctrl+Z undoes it.
        </p>
        <p>
          You can run the code before and after to check that nothing changed. Code on this page
          isn't saved between visits; use the <a href="/playground">playground</a> to keep a
          draft. Need types too? Try the <a href="/luau-type-checker">Luau type checker</a>.
        </p>
      </>
    )
  },
  "type-checker": {
    title: "Luau Type Checker",
    aboutTitle: "Check Luau types online in strict mode",
    about: (
      <>
        <p>
          Paste Luau code into the editor and Luau's own type checker underlines errors as you
          type. Hover an underline to read the error, or press Check to list type errors and lints
          for every file. It runs as WebAssembly in your browser, with no Roblox Studio and no
          install.
        </p>
        <p>
          Strict mode is the default, and --!strict, --!nonstrict, and --!nocheck comments work per
          file. Types cross files through require, so a module can export types to the files that
          use it. The checker knows the Luau standard library, not Roblox APIs.
        </p>
        <p>
          A type error doesn't stop a run: press Run to see what the code does anyway. Code on this
          page isn't saved between visits; use the <a href="/playground">playground</a> to keep a
          draft. To tidy the code, try the <a href="/lua-formatter">Lua &amp; Luau formatter</a>.
        </p>
      </>
    )
  },
  bytecode: {
    title: "Luau Bytecode Viewer",
    aboutTitle: "See the bytecode Luau compiles your code to",
    about: (
      <>
        <p>
          The Bytecode tab lists the instructions Luau's own compiler emits for the open file, and
          updates as you type. Each instruction sits under the source line it came from, with the
          compiler's remarks on inlining and constant folding.
        </p>
        <p>
          Optimize sets the level from 0 to 2: level 2 inlines small local functions and unrolls
          short loops. Debug 0 strips line info and names, 2 keeps local names. A --!optimize comment
          at the top of a file sets the level for runs as well as the listing.
        </p>
        <p>
          The compiler runs as WebAssembly in your browser, about 0.8 MB on first use. Code on this
          page isn't saved between visits; the <a href="/playground">playground</a> keeps a draft
          and has the same tab. To check types as well, try the{" "}
          <a href="/luau-type-checker">Luau type checker</a>.
        </p>
      </>
    )
  },
  lua: {
    title: "Lua Playground",
    aboutTitle: "Run Lua 5.1 to 5.5 online",
    about: (
      <>
        <p>
          Write Lua and press Run, or Ctrl+Enter. The Runtime menu switches between the official
          Lua 5.1, 5.2, 5.3, 5.4, and 5.5 interpreters, compiled to WebAssembly, so the output is
          what that version prints, down to 3 versus 3.0.
        </p>
        <p>
          A project can have several files joined with require, read preset input through
          io.read, and be shared as a link. Compare runs the code on two versions side by side;
          see <a href="/lua-5-1-vs-5-4">Lua 5.1 vs 5.4</a> for what changed between them.
        </p>
        <p>
          Code here isn't saved between visits; the <a href="/playground">playground</a> keeps a
          draft and named projects. New to the language? The{" "}
          <a href="/examples">runnable examples</a> cover strings, tables, and metatables.
        </p>
      </>
    )
  },
  luau: {
    title: "Luau Playground",
    aboutTitle: "Run Luau online, with type checking",
    about: (
      <>
        <p>
          Write Luau, the language Roblox scripts are written in, and press Run. Luau's own
          compiler and type checker run as WebAssembly in your browser, so errors are underlined as
          you type and nothing is sent to a server.
        </p>
        <p>
          Types, string interpolation, compound assignment, generics, and the task library all
          work. Roblox services and instances don't: this is the Luau language, not Roblox
          Studio. <a href="/lua-vs-luau">Lua vs Luau</a> shows where Luau differs from Lua 5.1.
        </p>
        <p>
          Code here isn't saved between visits; the <a href="/playground">playground</a> keeps a
          draft. To learn the language, start with the <a href="/learn-luau">Luau lessons</a>.
        </p>
      </>
    )
  },
  "lua-vs-luau": {
    title: "Lua vs Luau",
    aboutTitle: "Lua 5.1 and Luau, run side by side",
    about: (
      <>
        <p>
          Luau started as Lua 5.1 and is still close to it: the same tables, closures, metatables,
          and string patterns. Press Run and the code runs on both Lua 5.1 and Luau, with the two
          outputs side by side and a note when they differ.
        </p>
        <p>
          Luau adds syntax that Lua 5.1 rejects: type annotations, +=, continue, string
          interpolation, and if-expressions. It adds library functions such as string.split,
          table.find, and math.clamp, and takes loadstring away from scripts. Its compiler and
          type checker are built for large codebases, catching mistakes before a run.
        </p>
        <p>
          Change either side under Runtime and Compare. For the Lua side of the family, see{" "}
          <a href="/lua-5-1-vs-5-4">Lua 5.1 vs 5.4</a>, or start in the{" "}
          <a href="/luau">Luau playground</a>.
        </p>
      </>
    )
  },
  "lua51-vs-lua54": {
    title: "Lua 5.1 vs 5.4",
    aboutTitle: "Lua 5.1 and Lua 5.4, run side by side",
    about: (
      <>
        <p>
          Press Run and the code runs on the real Lua 5.1 and Lua 5.4 interpreters, with the two
          outputs side by side. Edit the code to test what worries you before an upgrade, or before
          you pick a version to embed.
        </p>
        <p>
          The changes that break the most code: 5.3 added integers, so 6 / 2 prints 3.0; unpack
          moved to table.unpack and setfenv gave way to _ENV in 5.2. New syntax includes goto
          (5.2), // and bitwise operators (5.3), and &lt;const&gt; and &lt;close&gt; locals (5.4).
        </p>
        <p>
          Lua 5.2, 5.3, and 5.5 are under Runtime and Compare too. LuaJIT follows 5.1, so the 5.1
          side is a fair guide for it. To compare with Roblox's language, see{" "}
          <a href="/lua-vs-luau">Lua vs Luau</a>.
        </p>
      </>
    )
  },
  "pattern-tester": {
    title: "Lua Pattern Tester",
    aboutTitle: "Test Lua patterns online",
    about: (
      <>
        <p>
          Type a pattern and some text. Every match is highlighted as string.gmatch finds it, with
          its position and captures; the first match is what string.find and string.match return.
          Add a replacement to see string.gsub's result.
        </p>
        <p>
          The pattern runs on the real runtime you pick, from Lua 5.1 to 5.5 or Luau, because the
          versions differ at the edges: since 5.3, gmatch skips an empty match right after another
          match. Lua patterns are not regular expressions: % escapes, there is no |, and quantifiers
          apply to one character or class, such as %d or [%w_].
        </p>
        <p>
          Positions count bytes, as Lua does, so a UTF-8 character can take two to four. To use
          the pattern in a program, copy it into the <a href="/playground">playground</a>.
        </p>
      </>
    )
  },
  "table-to-json": {
    title: "Lua Table to JSON",
    aboutTitle: "Convert a Lua table to JSON, and JSON to a Lua table",
    about: (
      <>
        <p>
          Paste a Lua table constructor and get JSON. Lua 5.4 evaluates it in your browser, so
          expressions, nested tables, and a chunk that returns a table all work. Switch the
          direction to turn JSON into a Lua table literal.
        </p>
        <p>
          A table with keys 1 to n becomes a JSON array, any other table an object with sorted
          keys, and an empty table []. Number keys in an object become strings. Functions, NaN,
          infinity, and tables that contain themselves have no JSON form, so they are reported as
          errors. JSON null becomes nil.
        </p>
        <p>
          Nothing is uploaded. To keep working with the table, open the{" "}
          <a href="/playground">playground</a>.
        </p>
      </>
    )
  }
};

/**
 * The playground's page frame: the header with the page's <h1>, and the about
 * text, a dismissible card on desktop. It stays out of Playground.tsx so the build can
 * prerender it into dist/playground/index.html for crawlers that don't run JS,
 * and so App's Suspense fallback paints the same markup until the editor loads.
 */
export function PlaygroundShell({ theme, onToggleTheme, isEmbed, tool, children }: PlaygroundShellProps) {
  const page = tool ? TOOL_PAGES[tool] : PLAYGROUND_PAGE;
  return (
    <div className={isEmbed ? "app app-embed" : "app"}>
      {!isEmbed && (
        <header className="app-header">
          <div className="app-heading">
            <a className="brand" href="/" aria-label="Weblua home">
              <MoonMark size={26} />
              <span className="brand-name">Weblua</span>
            </a>
            <h1 className="app-title">{page.title}</h1>
          </div>
          <div className="header-actions">
            <a
              className="icon-button"
              href="https://github.com/PytechNo/Weblua"
              target="_blank"
              rel="noreferrer"
              title="Open GitHub repository"
              aria-label="Open GitHub repository"
            >
              <GitHubMark size={17} />
            </a>
            <button
              className="icon-button"
              type="button"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Use light theme" : "Use dark theme"}
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
      )}

      {children ?? <main className="workspace" />}

      {!isEmbed && (
        <section className="playground-about" aria-labelledby="playground-about-title">
          <h2 id="playground-about-title">{page.aboutTitle}</h2>
          {page.about}
          <button
            className="icon-button playground-about-close"
            type="button"
            onClick={dismissAbout}
            title="Dismiss"
            aria-label="Dismiss about Weblua"
          >
            <X size={16} />
          </button>
        </section>
      )}
    </div>
  );
}
