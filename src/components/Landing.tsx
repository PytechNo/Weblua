import {
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  Code2,
  Cpu,
  Gauge,
  Keyboard,
  Link,
  Lock,
  Menu,
  Moon,
  Play,
  Share2,
  Sparkles,
  Sun,
  Terminal,
  X,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GitHubMark, MoonMark } from "./Brand";
import { SaleBanner } from "./SaleBanner";

type Theme = "dark" | "light";

interface LandingProps {
  theme: Theme;
  onToggleTheme: () => void;
}

/** Adds .is-visible to .reveal elements as they scroll into view. */
function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const HERO_CODE: Array<{ text: string; kind: "comment" | "code" }> = [
  { text: "-- fibonacci.lua", kind: "comment" },
  { text: "local function fib(n)", kind: "code" },
  { text: "  if n < 2 then return n end", kind: "code" },
  { text: "  return fib(n - 1) + fib(n - 2)", kind: "code" },
  { text: "end", kind: "code" },
  { text: "", kind: "code" },
  { text: "for i = 1, 8 do", kind: "code" },
  { text: "  io.write(fib(i), \" \")", kind: "code" },
  { text: "end", kind: "code" }
];

function HeroCodeWindow() {
  const [runKey, setRunKey] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const timer = useRef<number | null>(null);

  const run = useCallback(() => {
    setShowOutput(false);
    setRunKey((key) => key + 1);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShowOutput(true), 420);
  }, []);

  useEffect(() => {
    const auto = window.setTimeout(run, 1400);
    return () => {
      window.clearTimeout(auto);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [run]);

  return (
    <div className="hero-window" role="img" aria-label="Weblua editor running a Lua fibonacci snippet">
      <div className="hero-window-bar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="hero-window-title">fibonacci.lua</span>
        <button className="hero-run" type="button" onClick={run}>
          <Play size={13} />
          Run
        </button>
      </div>
      <pre className="hero-code" aria-hidden="true">
        {HERO_CODE.map((line, index) => (
          <span
            className={`hero-line hero-line-${line.kind}`}
            style={{ animationDelay: `${index * 90}ms` }}
            key={index}
          >
            {highlightLua(line.text)}
            {"\n"}
          </span>
        ))}
      </pre>
      <div className={showOutput ? "hero-output is-live" : "hero-output"} key={runKey} aria-hidden="true">
        <span className="hero-output-label">
          <Terminal size={12} />
          output
        </span>
        <span className="hero-output-text">1 1 2 3 5 8 13 21</span>
        <span className="hero-output-meta">
          <Check size={12} />
          finished
        </span>
      </div>
    </div>
  );
}

const LUA_KEYWORDS = new Set([
  "local",
  "function",
  "if",
  "then",
  "return",
  "end",
  "for",
  "do",
  "in",
  "while",
  "and",
  "or",
  "not",
  "type"
]);

function highlightLua(line: string) {
  if (line.trimStart().startsWith("--")) {
    return <span className="tok-comment">{line}</span>;
  }

  const tokens = line.split(/(\W+)/);
  return tokens.map((token, index) => {
    if (LUA_KEYWORDS.has(token)) {
      return (
        <span className="tok-keyword" key={index}>
          {token}
        </span>
      );
    }
    if (/^\d+$/.test(token)) {
      return (
        <span className="tok-number" key={index}>
          {token}
        </span>
      );
    }
    if (token.includes('"')) {
      return (
        <span className="tok-string" key={index}>
          {token}
        </span>
      );
    }
    return <span key={index}>{token}</span>;
  });
}

const FEATURES = [
  {
    icon: Zap,
    title: "In-browser execution",
    body: "Lua and Luau run in a dedicated Web Worker through WebAssembly. A five-second timeout stops runaway programs without freezing the page."
  },
  {
    icon: Braces,
    title: "Lua 5.1–5.4 and Luau",
    body: "Choose Lua 5.1 through 5.4 or the Luau language. Luau syntax is supported, but Weblua is not Roblox Studio and does not provide Roblox APIs or static type analysis."
  },
  {
    icon: Link,
    title: "Share with a link",
    body: "Source files, the entry point, and the runtime compress into a URL fragment up to 32 KiB. Input, output, and browser-local project metadata stay out of the link."
  },
  {
    icon: Code2,
    title: "Embed anywhere",
    body: "Copy a lazy-loading iframe for documentation sites that allow embeds. Readers can edit the shared source and run it inline without an SDK or API key."
  },
  {
    icon: Lock,
    title: "Source stays local",
    body: "Normal execution has no code-upload backend. Deployments can optionally enable anonymous Plausible usage events and sanitized Sentry error reports; neither integration intentionally includes project source."
  },
  {
    icon: Keyboard,
    title: "Keyboard-first",
    body: "Ctrl+Enter to run, full CodeMirror editing with folding, bracket matching, and syntax highlighting tuned for Lua."
  }
] as const;

const STEPS = [
  {
    title: "Write",
    body: "Open the playground and start typing, or load one of thirteen examples—including a multi-file capability tour with modules and preset input."
  },
  {
    title: "Run",
    body: "A Web Worker runs the selected runtime. When the run finishes—or reaches the five-second timeout—the output pane shows stdout, stderr, status, and elapsed time."
  },
  {
    title: "Share",
    body: "Copy a source-only project link or iframe. Recipients receive the same files, entry point, and runtime; preset input, output, and saved-project metadata remain local."
  }
] as const;

const BOUNDARIES = [
  {
    title: "Language runtime, not Roblox",
    body:
      "Luau code can use language features such as annotations and generics, but Weblua does not emulate Roblox services, instances, globals, or Studio tooling."
  },
  {
    title: "Compile check, not type checking",
    body:
      "Check compiles every file and reports syntax diagnostics. It does not run Luau's static analyzer, infer types, or validate a project against Roblox APIs."
  },
  {
    title: "Purposefully bounded runs",
    body:
      "Runs stop after five seconds. Lua 5.4 also has a 32 MiB runtime memory cap, and URL sharing has a 32 KiB encoded limit; larger projects can be exported instead."
  }
] as const;

const FAQS = [
  {
    q: "Is Weblua really free?",
    a: "Yes. The hosted playground has no account or server-side run quota, and the source is MIT licensed. Individual runs stop after five seconds, and source links have a 32 KiB encoded-size limit."
  },
  {
    q: "Does my code get sent to an execution server?",
    a: "Normal execution does not upload project source to an execution backend. Sharing compresses source into the URL fragment, which is not part of the HTTP request. A deployment owner may optionally enable Plausible usage events and sanitized Sentry error reports; project source is not intentionally included."
  },
  {
    q: "Which Lua versions does Weblua support?",
    a: "Weblua runs Lua 5.1, 5.2, 5.3, and 5.4, plus the Luau language. Select one runtime per project. Luau support covers the language runtime, not Roblox APIs or the Roblox production environment."
  },
  {
    q: "Does Weblua type-check Luau?",
    a: "No. The Check action compiles every source file and reports syntax diagnostics. It does not invoke Luau's static type analyzer, even though Luau annotations and generic syntax can be compiled and executed."
  },
  {
    q: "Can I use Weblua offline?",
    a: "Weblua does not currently guarantee offline startup because it has no service worker or complete PWA cache. An already loaded session can run without an execution-server round trip, and browser HTTP caches may help, but reliable offline mode is not implemented."
  },
  {
    q: "How do embeds work?",
    a: "Weblua generates a lazy-loading iframe whose /embed#c=2… URL contains the same source-only project payload as a share link. On sites that permit iframes, readers can edit files and re-run the project inline."
  },
  {
    q: "Can I contribute?",
    a: "Absolutely — Weblua is developed in the open on GitHub. Issues, feature requests, and pull requests are all welcome."
  }
] as const;

const ACCESS_OPTIONS = [
  {
    name: "Hosted playground",
    price: "$0",
    period: "no account",
    tagline: "Use the public browser playground.",
    cta: "Start coding",
    href: "/playground",
    features: [
      "No server-side run quota",
      "Lua 5.1–5.4 and Luau runtimes",
      "Shareable multi-file projects",
      "Source-only links and iframe embeds"
    ]
  },
  {
    name: "Self-host",
    price: "MIT",
    period: "your infrastructure",
    tagline: "Build the static app and serve it yourself.",
    cta: "Deployment guide",
    href: "https://github.com/PytechNo/Weblua/blob/main/docs/coolify-deployment.md",
    features: [
      "Dockerfile and nginx configuration",
      "No database or execution backend",
      "Optional telemetry stays opt-in",
      "Static-host compatible routes"
    ]
  },
  {
    name: "Source code",
    price: "Open",
    period: "MIT licensed",
    tagline: "Inspect, fork, and contribute on GitHub.",
    cta: "View repository",
    href: "https://github.com/PytechNo/Weblua",
    features: [
      "Complete React and worker source",
      "Versioned project export format",
      "Tests for codecs, storage, and runtimes",
      "Public issue tracker"
    ]
  }
] as const;

export function Landing({ theme, onToggleTheme }: LandingProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"run" | "share" | "embed">("run");

  useScrollReveal();

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

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing">
      <SaleBanner />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className={scrolled ? "nav is-scrolled" : "nav"}>
        <div className="nav-inner">
          <a className="nav-brand" href="/" aria-label="Weblua home">
            <MoonMark />
            <span>Weblua</span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#access">Access</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="nav-actions">
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
            <a className="btn btn-primary nav-cta" href="/playground">
              Launch playground
              <ArrowRight size={15} />
            </a>
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
            <a href="#features" onClick={closeMenu}>
              Features
            </a>
            <a href="#how" onClick={closeMenu}>
              How it works
            </a>
            <a href="#access" onClick={closeMenu}>
              Access
            </a>
            <a href="#faq" onClick={closeMenu}>
              FAQ
            </a>
            <a className="btn btn-primary" href="/playground">
              Launch playground
              <ArrowRight size={15} />
            </a>
          </nav>
        )}
      </header>

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="ambient" aria-hidden="true">
            <span className="orb orb-a" />
            <span className="orb orb-b" />
            <span className="orb orb-c" />
            <span className="hero-grid" />
          </div>

          <div className="hero-inner">
            <div className="hero-copy">
              <span className="badge reveal">
                <Sparkles size={13} />
                Now running Lua 5.1–5.4 <em>and</em> Luau
              </span>
              <h1 id="hero-title" className="reveal" style={{ transitionDelay: "60ms" }}>
                The Lua playground that lives in <span className="grad-text">your browser</span>
              </h1>
              <p className="hero-sub reveal" style={{ transitionDelay: "120ms" }}>
                Write, run, and share multi-file Lua and Luau projects directly in your browser.
                No local toolchain, execution backend, or account is required.
              </p>
              <div className="hero-ctas reveal" style={{ transitionDelay: "180ms" }}>
                <a className="btn btn-primary btn-lg" href="/playground">
                  <Play size={17} />
                  Open the playground
                </a>
                <a
                  className="btn btn-ghost btn-lg"
                  href="https://github.com/PytechNo/Weblua"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubMark size={17} />
                  Star on GitHub
                </a>
              </div>
              <ul className="hero-meta reveal" style={{ transitionDelay: "240ms" }}>
                <li>
                  <Check size={14} /> Free and MIT licensed
                </li>
                <li>
                  <Check size={14} /> Client-side execution
                </li>
                <li>
                  <Check size={14} /> Open source
                </li>
              </ul>
            </div>

            <div className="hero-visual reveal" style={{ transitionDelay: "160ms" }}>
              <HeroCodeWindow />
            </div>
          </div>
        </section>

        {/* ---------- Social proof ---------- */}
        <section className="proof" aria-label="Built with trusted technology">
          <p className="proof-label reveal">Built on a stack Lua developers already trust</p>
          <ul className="proof-logos reveal" style={{ transitionDelay: "80ms" }}>
            <li>Lua 5.1–5.4</li>
            <li>Luau</li>
            <li>WebAssembly</li>
            <li>CodeMirror</li>
            <li>React</li>
          </ul>
          <dl className="stats reveal" style={{ transitionDelay: "140ms" }}>
            <div className="stat">
              <dt>Run timeout</dt>
              <dd>5 s</dd>
            </div>
            <div className="stat">
              <dt>Runtimes</dt>
              <dd>5</dd>
            </div>
            <div className="stat">
              <dt>Share payload limit</dt>
              <dd>32 KiB</dd>
            </div>
            <div className="stat">
              <dt>Account required</dt>
              <dd>No</dd>
            </div>
          </dl>
        </section>

        {/* ---------- Features ---------- */}
        <section className="section" id="features" aria-labelledby="features-title">
          <div className="section-head reveal">
            <span className="eyebrow">Features</span>
            <h2 id="features-title">
              Everything a scratchpad should be. <span className="grad-text">Nothing it shouldn't.</span>
            </h2>
            <p>
              Weblua is deliberately small: a fast editor, real runtimes, and frictionless sharing.
              No accounts, no project setup, no build steps.
            </p>
          </div>

          <div className="feature-grid">
            {FEATURES.map((feature, index) => (
              <article
                className="card feature-card reveal"
                style={{ transitionDelay: `${(index % 3) * 80}ms` }}
                key={feature.title}
              >
                <span className="feature-icon">
                  <feature.icon size={19} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Product showcase ---------- */}
        <section className="section showcase" aria-labelledby="showcase-title">
          <div className="section-head reveal">
            <span className="eyebrow">Showcase</span>
            <h2 id="showcase-title">
              From idea to shared link in <span className="grad-text">under ten seconds</span>
            </h2>
          </div>

          <div className="showcase-panel reveal" style={{ transitionDelay: "80ms" }}>
            <div className="showcase-tabs" role="tablist" aria-label="Playground capabilities">
              <button
                role="tab"
                type="button"
                id="tab-run"
                aria-selected={activeTab === "run"}
                aria-controls="panel-run"
                className={activeTab === "run" ? "is-active" : ""}
                onClick={() => setActiveTab("run")}
              >
                <Play size={14} />
                Run
              </button>
              <button
                role="tab"
                type="button"
                id="tab-share"
                aria-selected={activeTab === "share"}
                aria-controls="panel-share"
                className={activeTab === "share" ? "is-active" : ""}
                onClick={() => setActiveTab("share")}
              >
                <Share2 size={14} />
                Share
              </button>
              <button
                role="tab"
                type="button"
                id="tab-embed"
                aria-selected={activeTab === "embed"}
                aria-controls="panel-embed"
                className={activeTab === "embed" ? "is-active" : ""}
                onClick={() => setActiveTab("embed")}
              >
                <Code2 size={14} />
                Embed
              </button>
            </div>

            {activeTab === "run" && (
              <div className="showcase-body" role="tabpanel" id="panel-run" aria-labelledby="tab-run">
                <div className="showcase-text">
                  <h3>Real runtimes, real output</h3>
                  <p>
                    Weblua executes Lua 5.1 through 5.4 and Luau through WebAssembly rather than
                    simulating output. Language behavior comes from the selected runtime, while the
                    browser host supplies a virtual project filesystem and preset input.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> stdout, stderr, and timing per run
                    </li>
                    <li>
                      <Check size={15} /> Worker isolation and a five-second execution timeout
                    </li>
                    <li>
                      <Check size={15} /> Ctrl+Enter to start another run
                    </li>
                  </ul>
                </div>
                <div className="showcase-mock" aria-hidden="true">
                  <div className="mock-terminal">
                    <span className="mock-line tok-comment">$ weblua run</span>
                    <span className="mock-line">
                      <span className="tok-keyword">for</span> fruit, count <span className="tok-keyword">in</span>{" "}
                      pairs(counts) <span className="tok-keyword">do</span>
                    </span>
                    <span className="mock-line">
                      {"  "}print(fruit .. <span className="tok-string">": "</span> .. count)
                    </span>
                    <span className="mock-line">
                      <span className="tok-keyword">end</span>
                    </span>
                    <span className="mock-divider" />
                    <span className="mock-line mock-out">apples: 4</span>
                    <span className="mock-line mock-out">oranges: 7</span>
                    <span className="mock-line mock-out">pears: 2</span>
                    <span className="mock-line mock-ok">✓ finished — timing shown in the output pane</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "share" && (
              <div className="showcase-body" role="tabpanel" id="panel-share" aria-labelledby="tab-share">
                <div className="showcase-text">
                  <h3>The whole source project, inside the URL</h3>
                  <p>
                    Your code is compressed straight into the link — no database, no backend, no
                    sign-up. One click copies it to your clipboard, ready to paste anywhere.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> Links preserve files, entry point, and runtime choice
                    </li>
                    <li>
                      <Check size={15} /> One link for chat, commits, and reviews
                    </li>
                    <li>
                      <Check size={15} /> Input, output, and local metadata remain browser-local
                    </li>
                  </ul>
                </div>
                <div className="showcase-mock" aria-hidden="true">
                  <div className="mock-terminal mock-share">
                    <span className="mock-chip">
                      <Link size={13} />
                      weblua.com/playground#c=2…
                    </span>
                    <span className="mock-line mock-ok">✓ Share link copied to clipboard</span>
                    <span className="mock-divider" />
                    <span className="mock-line tok-comment">-- the source-only project restores:</span>
                    <span className="mock-line">
                      <span className="tok-keyword">local</span> greeting = <span className="tok-string">"hello, reviewer"</span>
                    </span>
                    <span className="mock-line">print(greeting)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "embed" && (
              <div className="showcase-body" role="tabpanel" id="panel-embed" aria-labelledby="tab-embed">
                <div className="showcase-text">
                  <h3>Live code blocks for your docs</h3>
                  <p>
                    Replace static code samples with playgrounds your readers can actually run.
                    The generated iframe is fully interactive and uses the same source-only URL
                    payload as a normal share link.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> Works on sites that permit iframe embeds
                    </li>
                    <li>
                      <Check size={15} /> Readers edit and re-run inline
                    </li>
                    <li>
                      <Check size={15} /> loading="lazy" defers runtime work until the embed is near view
                    </li>
                  </ul>
                </div>
                <div className="showcase-mock" aria-hidden="true">
                  <div className="mock-terminal">
                    <span className="mock-line tok-comment">&lt;!-- your-tutorial.html --&gt;</span>
                    <span className="mock-line">
                      <span className="tok-keyword">&lt;iframe</span>
                    </span>
                    <span className="mock-line">
                      {"  "}src=<span className="tok-string">"https://weblua.com/embed#c=2…"</span>
                    </span>
                    <span className="mock-line">
                      {"  "}width=<span className="tok-string">"100%"</span> height=<span className="tok-string">"420"</span>
                    </span>
                    <span className="mock-line">
                      {"  "}loading=<span className="tok-string">"lazy"</span>
                    </span>
                    <span className="mock-line">
                      <span className="tok-keyword">/&gt;</span>
                    </span>
                    <span className="mock-divider" />
                    <span className="mock-line mock-ok">✓ Live playground, embedded</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="section" id="how" aria-labelledby="how-title">
          <div className="section-head reveal">
            <span className="eyebrow">How it works</span>
            <h2 id="how-title">
              Three steps. <span className="grad-text">Zero setup.</span>
            </h2>
          </div>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li className="step reveal" style={{ transitionDelay: `${index * 100}ms` }} key={step.title}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Boundaries ---------- */}
        <section className="section" aria-labelledby="boundaries-title">
          <div className="section-head reveal">
            <span className="eyebrow">Scope</span>
            <h2 id="boundaries-title">
              Clear boundaries, <span className="grad-text">fewer surprises</span>
            </h2>
            <p>Weblua is a focused browser playground, not a replacement for a full local or Roblox toolchain.</p>
          </div>
          <div className="testimonial-grid">
            {BOUNDARIES.map((boundary, index) => (
              <article
                className="card testimonial reveal"
                style={{ transitionDelay: `${index * 90}ms` }}
                key={boundary.title}
              >
                <h3>{boundary.title}</h3>
                <p>{boundary.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Access ---------- */}
        <section className="section" id="access" aria-labelledby="access-title">
          <div className="section-head reveal">
            <span className="eyebrow">Access</span>
            <h2 id="access-title">
              Free to use. <span className="grad-text">Straightforward to self-host.</span>
            </h2>
            <p>
              There are no paid plans advertised here. Use the hosted playground, deploy the static
              app yourself, or work directly from the MIT-licensed source.
            </p>
          </div>

          <div className="pricing-grid">
            {ACCESS_OPTIONS.map((tier, index) => (
              <article
                className="card price-card reveal"
                style={{ transitionDelay: `${index * 90}ms` }}
                key={tier.name}
              >
                <h3>{tier.name}</h3>
                <p className="price-tagline">{tier.tagline}</p>
                <p className="price-value">
                  <strong>{tier.price}</strong>
                  <span>{tier.period}</span>
                </p>
                <ul className="check-list">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  className="btn btn-ghost"
                  href={tier.href}
                  {...(tier.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {tier.cta}
                  <ArrowRight size={15} />
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section section-narrow" id="faq" aria-labelledby="faq-title">
          <div className="section-head reveal">
            <span className="eyebrow">FAQ</span>
            <h2 id="faq-title">
              Questions, <span className="grad-text">answered</span>
            </h2>
          </div>
          <div className="faq-list">
            {FAQS.map((faq, index) => (
              <details className="faq reveal" style={{ transitionDelay: `${index * 50}ms` }} key={faq.q}>
                <summary>
                  {faq.q}
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="cta-band reveal" aria-labelledby="cta-title">
          <div className="cta-inner">
            <span className="cta-glow" aria-hidden="true" />
            <Cpu size={22} aria-hidden="true" className="cta-icon" />
            <h2 id="cta-title">Your next Lua idea is one tab away</h2>
            <p>Open the playground, choose a built-in example, or load the multi-file capability tour.</p>
            <div className="hero-ctas">
              <a className="btn btn-invert btn-lg" href="/playground">
                <Play size={17} />
                Start coding — it's free
              </a>
            </div>
            <small className="cta-hint">
              <Gauge size={13} /> Every run is capped at five seconds to protect the tab
            </small>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="footer" aria-label="Footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="nav-brand" href="/" aria-label="Weblua home">
              <MoonMark size={24} />
              <span>Weblua</span>
            </a>
            <p>
              A fast, client-side Lua and Luau playground. Run multi-file projects, test Luau
              snippets, and share source straight from the browser.
            </p>
          </div>
          <nav className="footer-col" aria-label="Product">
            <h4>Product</h4>
            <a href="/playground">Playground</a>
            <a href="#features">Features</a>
            <a href="#access">Access</a>
            <a href="#faq">FAQ</a>
          </nav>
          <nav className="footer-col" aria-label="Resources">
            <h4>Resources</h4>
            <a href="https://www.lua.org/manual/5.4/" target="_blank" rel="noreferrer">
              Lua 5.4 manual
            </a>
            <a href="https://luau.org/" target="_blank" rel="noreferrer">
              Luau docs
            </a>
            <a href="https://github.com/PytechNo/Weblua#readme" target="_blank" rel="noreferrer">
              Documentation
            </a>
          </nav>
          <nav className="footer-col" aria-label="Community">
            <h4>Community</h4>
            <a href="https://github.com/PytechNo/Weblua" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://github.com/PytechNo/Weblua/issues" target="_blank" rel="noreferrer">
              Report an issue
            </a>
            <a href="https://github.com/PytechNo/Weblua/blob/main/LICENSE" target="_blank" rel="noreferrer">
              MIT License
            </a>
          </nav>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} Weblua. Open source under the MIT license.</span>
          <span className="footer-moon">
            Lua means “moon” in Portuguese <Moon size={13} aria-hidden="true" />
          </span>
        </div>
      </footer>
    </div>
  );
}
