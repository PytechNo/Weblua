import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Theme } from "../lib/theme";
import { GitHubMark, MoonMark } from "./Brand";

/** The header's links; `current` matches one of these hrefs. */
const NAV: Array<[label: string, href: string]> = [
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

interface SiteHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** The NAV href this page belongs under; "/playground" also drops the link to the playground. */
  current?: string;
  /** The page's <h1>, for the editor pages, which have no room for one below the header. */
  title?: string;
  /** Page-specific actions, placed before the shared ones. */
  children?: ReactNode;
}

/** The header on every page except embeds. */
export function SiteHeader({ theme, onToggleTheme, current, title, children }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const onPlayground = current === "/playground";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={scrolled ? "nav is-scrolled" : "nav"}>
      <div className="nav-inner">
        <div className="app-heading">
          <a className="nav-brand" href="/" aria-label="Weblua home">
            <MoonMark />
            <span>Weblua</span>
          </a>
          {title && <h1 className="app-title">{title}</h1>}
        </div>

        <nav className="nav-links" aria-label="Primary">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} aria-current={href === current ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          {children}
          <a
            className="nav-icon"
            href="https://github.com/PytechNo/Weblua"
            target="_blank"
            rel="noreferrer"
            aria-label="Weblua on GitHub"
          >
            <GitHubMark />
          </a>
          <button
            className="nav-icon"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {!onPlayground && (
            <a className="btn btn-primary nav-cta" href="/playground">
              Launch playground
              <ArrowRight size={15} />
            </a>
          )}
          <button
            className="nav-icon nav-burger"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="nav-mobile" aria-label="Mobile">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} aria-current={href === current ? "page" : undefined}>
              {label}
            </a>
          ))}
          {!onPlayground && (
            <a className="btn btn-primary" href="/playground">
              Launch playground
              <ArrowRight size={15} />
            </a>
          )}
        </nav>
      )}
    </header>
  );
}

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
      <SiteHeader theme={theme} onToggleTheme={onToggleTheme} current={current} />

      {children}

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <a className="brand" href="/">
              <MoonMark size={24} />
              <span className="brand-name">Weblua</span>
            </a>
            <p>Run Lua 5.1 to 5.5 and Luau in your browser. Free, with no install and no account.</p>
            <p>
              Built by{" "}
              <a href="https://mcusson.com" target="_blank" rel="noopener">
                mcusson.com
              </a>
            </p>
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
