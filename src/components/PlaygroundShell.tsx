import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { Theme } from "../lib/theme";
import { GitHubMark, MoonMark } from "./Brand";

interface PlaygroundShellProps {
  theme: Theme;
  onToggleTheme: () => void;
  isEmbed: boolean;
  /** The workspace; an empty one holds its space while the editor chunk loads. */
  children?: ReactNode;
}

/**
 * The playground's page frame: the header with the page's <h1>, and the about
 * text under the workspace. It stays out of Playground.tsx so the build can
 * prerender it into dist/playground/index.html for crawlers that don't run JS,
 * and so App's Suspense fallback paints the same markup until the editor loads.
 */
export function PlaygroundShell({ theme, onToggleTheme, isEmbed, children }: PlaygroundShellProps) {
  return (
    <div className={isEmbed ? "app app-embed" : "app"}>
      {!isEmbed && (
        <header className="app-header">
          <div className="app-heading">
            <a className="brand" href="/" aria-label="Weblua home">
              <MoonMark size={26} />
              <span className="brand-name">Weblua</span>
            </a>
            <h1 className="app-title">Online Luau &amp; Lua Editor</h1>
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
          <h2 id="playground-about-title">Online Luau compiler and Lua interpreter</h2>
          <p>
            Weblua is a free online Luau and Lua editor. Pick a runtime, Luau or Lua 5.1, 5.2, 5.3,
            5.4, or 5.5, and press Run. Each run happens in a Web Worker in your browser through
            WebAssembly, so there is no execution server, nothing to install, and no account.
          </p>
          <p>
            The editor runs Luau's type checker as you type, in strict or nonstrict mode, and the
            Bytecode tab shows what the Luau compiler emits at optimization levels 0 to 2. Projects
            can span several files linked with require, read preset input, and be formatted with
            StyLua.
          </p>
          <p>
            Share a project as a link or an iframe embed, or open one from a GitHub gist. Named
            projects stay in this browser. Weblua runs the Luau language, not Roblox, so Roblox
            services and instances aren't available. More in the{" "}
            <a href="/#faq">Luau &amp; Lua playground FAQ</a>.
          </p>
        </section>
      )}
    </div>
  );
}
