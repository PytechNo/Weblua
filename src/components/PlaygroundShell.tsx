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
  title: "Online Luau & Lua Editor",
  aboutTitle: "Online Luau compiler and Lua interpreter",
  about: (
    <>
      <p>
        Weblua is a free online Luau and Lua editor. Pick a runtime, Luau or Lua 5.1, 5.2, 5.3,
        5.4, or 5.5, and press Run. Each run happens in a Web Worker in your browser through
        WebAssembly, so there is no execution server, nothing to install, and no account.
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
