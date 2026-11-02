import { ArrowDown, X } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolPage } from "../lib/routes";
import type { Theme } from "../lib/theme";
import { SiteHeader } from "./SiteFrame";

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
  /** Set on a tool page, which swaps the <h1> for the tool's and the about card for `guide`. */
  tool?: ToolPage;
  /** A tool page's guide, rendered below the editor's first screen. */
  guide?: ReactNode;
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

/** Each tool page's <h1>. Its guide, below the editor, comes from components/Articles. */
const TOOL_TITLES: Record<ToolPage, string> = {
  formatter: "Lua & Luau Formatter",
  "type-checker": "Luau Type Checker",
  bytecode: "Luau Bytecode Viewer",
  lua: "Lua Playground",
  luau: "Luau Playground",
  "lua-vs-luau": "Lua vs Luau",
  "lua51-vs-lua54": "Lua 5.1 vs 5.4",
  "pattern-tester": "Lua Pattern Tester",
  "table-to-json": "Lua Table to JSON"
};

/**
 * The playground's page frame: the header with the page's <h1>, then either the
 * about text, a dismissible card on desktop, or on a tool page that tool's
 * guide below the editor. It stays out of Playground.tsx so the build can
 * prerender it into dist/playground/index.html for crawlers that don't run JS,
 * and so App's Suspense fallback paints the same markup until the editor loads.
 */
export function PlaygroundShell({ theme, onToggleTheme, isEmbed, tool, guide, children }: PlaygroundShellProps) {
  return (
    <>
      <div className={isEmbed ? "app app-embed" : "app"}>
        {!isEmbed && (
          <SiteHeader theme={theme} onToggleTheme={onToggleTheme} current="/playground" title={tool ? TOOL_TITLES[tool] : PLAYGROUND_PAGE.title}>
            {tool && (
              <a className="button app-guide-link" href="#guide">
                Guide <ArrowDown size={15} />
              </a>
            )}
          </SiteHeader>
        )}

        {children ?? <main className="workspace" />}

        {!isEmbed && !tool && (
          <section className="playground-about" aria-labelledby="playground-about-title">
            <h2 id="playground-about-title">{PLAYGROUND_PAGE.aboutTitle}</h2>
            {PLAYGROUND_PAGE.about}
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
      {guide}
    </>
  );
}
