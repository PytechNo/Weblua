import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { Theme } from "../lib/theme";
import { GitHubMark, MoonMark } from "./Brand";

/** The header's links; `current` matches one of these hrefs. */
const NAV: Array<[label: string, href: string]> = [
  ["Playground", "/playground"],
  ["Learn Luau", "/learn-luau"],
  ["Examples", "/examples"],
  ["Lua vs Luau", "/lua-vs-luau"],
  ["Pattern tester", "/lua-pattern-tester"],
  ["Table to JSON", "/lua-table-to-json"]
];

const FOOTER: Array<[heading: string, links: Array<[label: string, href: string]>]> = [
  [
    "Run code",
    [
      ["Online Lua compiler", "/playground"],
      ["Lua playground", "/lua"],
      ["Luau playground", "/luau"],
      ["Luau bytecode viewer", "/luau-bytecode-viewer"]
    ]
  ],
  [
    "Tools",
    [
      ["Lua pattern tester", "/lua-pattern-tester"],
      ["Lua table to JSON", "/lua-table-to-json"],
      ["Lua & Luau formatter", "/lua-formatter"],
      ["Luau type checker", "/luau-type-checker"]
    ]
  ],
  [
    "Learn",
    [
      ["Learn Luau course", "/learn-luau"],
      ["Lua and Luau examples", "/examples"],
      ["Lua vs Luau", "/lua-vs-luau"],
      ["Lua 5.1 vs 5.4", "/lua-5-1-vs-5-4"]
    ]
  ]
];

interface SiteFrameProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** The NAV href this page belongs under. */
  current?: string;
  children: ReactNode;
}

/** Header and footer for the content pages: articles, lessons, comparisons, and standalone tools. */
export function SiteFrame({ theme, onToggleTheme, current, children }: SiteFrameProps) {
  return (
    <div className="site">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Weblua home">
          <MoonMark size={26} />
          <span className="brand-name">Weblua</span>
        </a>
        <nav className="site-nav" aria-label="Main">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} aria-current={href === current ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="icon-button" href="https://github.com/PytechNo/Weblua" target="_blank" rel="noreferrer" title="Open GitHub repository" aria-label="Open GitHub repository">
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

      {children}

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <a className="brand" href="/">
              <MoonMark size={24} />
              <span className="brand-name">Weblua</span>
            </a>
            <p>Run Lua 5.1 to 5.5 and Luau in your browser. Free, with no install and no account.</p>
          </div>
          {FOOTER.map(([heading, links]) => (
            <nav key={heading} aria-label={heading}>
              <h2>{heading}</h2>
              {links.map(([label, href]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
            </nav>
          ))}
        </div>
      </footer>
    </div>
  );
}
