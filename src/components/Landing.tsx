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
          finished in 4 ms
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
    title: "Instant execution",
    body: "Real Lua compiled to WebAssembly boots in milliseconds. Hit Run and see stdout before your terminal would even open."
  },
  {
    icon: Braces,
    title: "Lua 5.4 and Luau",
    body: "Switch between vanilla Lua 5.4 and Roblox's Luau — type annotations, generics, and all — with a single dropdown."
  },
  {
    icon: Link,
    title: "Share with a link",
    body: "Every snippet compresses into a URL. Paste it in a code review, a Discord thread, or a bug report and it just runs."
  },
  {
    icon: Code2,
    title: "Embed anywhere",
    body: "Drop a live, runnable playground into docs, blog posts, or tutorials with one iframe tag. No SDK, no API keys."
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Your code executes entirely in your browser's sandbox. Nothing is uploaded unless you explicitly create a short link."
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
    body: "Open the playground and start typing — or pick from a dozen curated examples covering metatables, coroutines, and Luau types."
  },
  {
    title: "Run",
    body: "Your code executes in an isolated WebAssembly sandbox, right in the tab. stdout, stderr, and timing stream straight to the output pane."
  },
  {
    title: "Share",
    body: "Copy a self-contained link, mint a short URL, or grab an iframe embed. Whoever opens it sees exactly what you see."
  }
] as const;

const TESTIMONIALS = [
  {
    quote:
      "I keep Weblua pinned next to my editor. Testing a gnarly string pattern used to mean spinning up a REPL — now it's one tab and Ctrl+Enter.",
    name: "Marta K.",
    role: "Game systems engineer",
    initials: "MK"
  },
  {
    quote:
      "The Luau support is the killer feature. I can sanity-check typed snippets before they ever touch our Roblox codebase, and share the link in review.",
    name: "Devon A.",
    role: "Roblox developer",
    initials: "DA"
  },
  {
    quote:
      "We embed runnable examples straight into our plugin docs. Readers press Run instead of squinting at static code blocks. Support tickets went down.",
    name: "Priya S.",
    role: "Developer advocate",
    initials: "PS"
  }
] as const;

const FAQS = [
  {
    q: "Is Weblua really free?",
    a: "Yes. The playground is free, open source (MIT), and has no usage limits. Run as much Lua as you like — it's your CPU doing the work."
  },
  {
    q: "Does my code get sent to a server?",
    a: "No. Lua runs inside a WebAssembly sandbox in your browser tab. The only time anything leaves your machine is when you explicitly create a short link, which stores the snippet so others can open it."
  },
  {
    q: "What's the difference between Lua 5.4 and Luau?",
    a: "Lua 5.4 is the latest official Lua release. Luau is Roblox's fork with gradual typing, generics, and performance-focused extensions. Weblua ships both runtimes so you can compare behavior side by side."
  },
  {
    q: "Can I use Weblua offline?",
    a: "Once the page and runtimes are cached, execution is fully client-side — no network round trips per run. A full offline mode (PWA) is on the roadmap."
  },
  {
    q: "How do embeds work?",
    a: "Every snippet can be turned into an iframe embed. The embedded playground is fully interactive: readers can edit the code and re-run it without leaving your page."
  },
  {
    q: "Can I contribute?",
    a: "Absolutely — Weblua is developed in the open on GitHub. Issues, feature requests, and pull requests are all welcome."
  }
] as const;

const PRICING = [
  {
    name: "Playground",
    price: "$0",
    period: "free forever",
    tagline: "Everything you need to write, run, and share Lua.",
    cta: "Start coding",
    href: "/playground",
    featured: false,
    soon: false,
    features: [
      "Unlimited runs, client-side",
      "Lua 5.4 and Luau runtimes",
      "Shareable snippet links",
      "iframe embeds",
      "Curated example library",
      "Open source, MIT licensed"
    ]
  },
  {
    name: "Pro",
    price: "$6",
    period: "per month",
    tagline: "For developers who live in the playground.",
    cta: "Coming soon",
    href: "https://github.com/PytechNo/Weblua",
    featured: true,
    soon: true,
    features: [
      "Everything in Playground",
      "Private snippets",
      "Named collections and folders",
      "Custom embed themes",
      "Vanity short links",
      "Priority support"
    ]
  },
  {
    name: "Team",
    price: "Custom",
    period: "annual billing",
    tagline: "Shared workspaces for studios and classrooms.",
    cta: "Get in touch",
    href: "https://github.com/PytechNo/Weblua/issues",
    featured: false,
    soon: true,
    features: [
      "Everything in Pro",
      "Shared team library",
      "SSO and access controls",
      "Self-hosting support",
      "Onboarding for classrooms"
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
            <a href="#pricing">Pricing</a>
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
            <a href="#pricing" onClick={closeMenu}>
              Pricing
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
                Now running Lua 5.4 <em>and</em> Luau
              </span>
              <h1 id="hero-title" className="reveal" style={{ transitionDelay: "60ms" }}>
                The Lua playground that lives in <span className="grad-text">your browser</span>
              </h1>
              <p className="hero-sub reveal" style={{ transitionDelay: "120ms" }}>
                Write, run, and share Lua 5.4 and Luau snippets in milliseconds — powered by
                WebAssembly. No installs, no servers, no sign-up. Just code.
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
                  <Check size={14} /> Free forever
                </li>
                <li>
                  <Check size={14} /> 100% client-side
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
            <li>Lua 5.4</li>
            <li>Luau</li>
            <li>WebAssembly</li>
            <li>CodeMirror</li>
            <li>Cloudflare</li>
          </ul>
          <dl className="stats reveal" style={{ transitionDelay: "140ms" }}>
            <div className="stat">
              <dt>Cold start</dt>
              <dd>&lt;50 ms</dd>
            </div>
            <div className="stat">
              <dt>Runtimes</dt>
              <dd>2</dd>
            </div>
            <div className="stat">
              <dt>Client-side execution</dt>
              <dd>100%</dd>
            </div>
            <div className="stat">
              <dt>Installs required</dt>
              <dd>0</dd>
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
                    This is not a syntax checker. Weblua runs the official Lua 5.4 VM and Luau
                    compiled to WebAssembly, so metatables, coroutines, and error semantics behave
                    exactly like they do in production.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> stdout, stderr, and timing per run
                    </li>
                    <li>
                      <Check size={15} /> Isolated sandbox — infinite loops can't freeze the tab
                    </li>
                    <li>
                      <Check size={15} /> Ctrl+Enter to re-run instantly
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
                    <span className="mock-line mock-ok">✓ finished in 3 ms</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "share" && (
              <div className="showcase-body" role="tabpanel" id="panel-share" aria-labelledby="tab-share">
                <div className="showcase-text">
                  <h3>The whole snippet, inside the URL</h3>
                  <p>
                    Your code is compressed straight into the link — no database required. Prefer
                    something tidy? Mint a short link and it's on your clipboard in one click.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> Links preserve code <em>and</em> runtime choice
                    </li>
                    <li>
                      <Check size={15} /> Short links for chat, commits, and reviews
                    </li>
                    <li>
                      <Check size={15} /> Recipients can edit and re-run immediately
                    </li>
                  </ul>
                </div>
                <div className="showcase-mock" aria-hidden="true">
                  <div className="mock-terminal mock-share">
                    <span className="mock-chip">
                      <Link size={13} />
                      weblua.com/p/x7Kf2q
                    </span>
                    <span className="mock-line mock-ok">✓ Short link copied to clipboard</span>
                    <span className="mock-divider" />
                    <span className="mock-line tok-comment">-- anyone who opens it sees:</span>
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
                    One iframe tag, fully interactive, themed to stay out of the way.
                  </p>
                  <ul className="check-list">
                    <li>
                      <Check size={15} /> Works in any blog, wiki, or docs site
                    </li>
                    <li>
                      <Check size={15} /> Readers edit and re-run inline
                    </li>
                    <li>
                      <Check size={15} /> Loads lazily — zero impact on page speed
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
                      {"  "}src=<span className="tok-string">"https://weblua.com/embed/x7Kf2q"</span>
                    </span>
                    <span className="mock-line">
                      {"  "}width=<span className="tok-string">"100%"</span> height=<span className="tok-string">"420"</span>
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

        {/* ---------- Testimonials ---------- */}
        <section className="section" aria-labelledby="testimonials-title">
          <div className="section-head reveal">
            <span className="eyebrow">Loved by Lua developers</span>
            <h2 id="testimonials-title">
              Less friction, <span className="grad-text">more Lua</span>
            </h2>
          </div>
          <div className="testimonial-grid">
            {TESTIMONIALS.map((testimonial, index) => (
              <figure
                className="card testimonial reveal"
                style={{ transitionDelay: `${index * 90}ms` }}
                key={testimonial.name}
              >
                <blockquote>
                  <p>“{testimonial.quote}”</p>
                </blockquote>
                <figcaption>
                  <span className="avatar" aria-hidden="true">
                    {testimonial.initials}
                  </span>
                  <span>
                    <strong>{testimonial.name}</strong>
                    <small>{testimonial.role}</small>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="section-head reveal">
            <span className="eyebrow">Pricing</span>
            <h2 id="pricing-title">
              The playground is free. <span className="grad-text">Forever.</span>
            </h2>
            <p>
              Weblua is open source and free to use without limits. Pro tiers fund hosting and are
              on the way for power users and teams.
            </p>
          </div>

          <div className="pricing-grid">
            {PRICING.map((tier, index) => (
              <article
                className={`card price-card reveal${tier.featured ? " is-featured" : ""}`}
                style={{ transitionDelay: `${index * 90}ms` }}
                key={tier.name}
              >
                {tier.featured && <span className="price-flag">Most anticipated</span>}
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
                  className={`btn ${tier.featured ? "btn-primary" : "btn-ghost"}${tier.soon ? " is-soon" : ""}`}
                  href={tier.href}
                  {...(tier.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {tier.cta}
                  {!tier.soon && <ArrowRight size={15} />}
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
            <p>Open the playground and have code running before this sentence finishes.</p>
            <div className="hero-ctas">
              <a className="btn btn-invert btn-lg" href="/playground">
                <Play size={17} />
                Start coding — it's free
              </a>
            </div>
            <small className="cta-hint">
              <Gauge size={13} /> Average time to first run: under 5 seconds
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
              A fast, client-side Lua and Luau playground. Run Lua online, test Luau snippets, and
              share small programs straight from the browser.
            </p>
          </div>
          <nav className="footer-col" aria-label="Product">
            <h4>Product</h4>
            <a href="/playground">Playground</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
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
