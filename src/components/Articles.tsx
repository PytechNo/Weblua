import { ArrowLeft, ArrowRight, Moon, Play, Sun } from "lucide-react";
import type { ReactNode } from "react";
import {
  type ArticleHub,
  type ArticlePage,
  articleHubs,
  type CodeBlock,
  codeBlockId,
  exerciseId,
  exerciseSource,
  type ShownFlavor
} from "../lib/articles";
import type { ArticleSection } from "../lib/routes";
import type { Theme } from "../lib/theme";
import { GitHubMark, MoonMark } from "./Brand";

const SECTION_LABELS: Record<ArticleSection, string> = { examples: "Examples", "learn-luau": "Learn Luau" };
const FLAVOR_LABELS: Record<ShownFlavor, string> = { lua51: "Lua 5.1", lua54: "Lua 5.4", luau: "Luau" };

/** Prose with `backticks` around inline code. */
function inline(text: string): ReactNode[] {
  return text.split(/`([^`]+)`/).map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));
}

function playgroundLink(id: string): string {
  return `/playground#example=${encodeURIComponent(id)}`;
}

function CodeBlockView({ code, id }: { code: CodeBlock; id: string }) {
  const outputs = Object.entries(code.outputs) as Array<[ShownFlavor, string]>;
  return (
    <figure className="article-code">
      <pre>
        <code>{code.code}</code>
      </pre>
      <div className={outputs.length > 1 ? "article-outputs is-compared" : "article-outputs"}>
        {outputs.map(([flavor, output]) => (
          <div className="article-output" key={flavor}>
            <p className="article-output-label">{FLAVOR_LABELS[flavor]} output</p>
            <pre>{output}</pre>
          </div>
        ))}
      </div>
      <a className="button article-run" href={playgroundLink(id)}>
        <Play size={15} /> Open in the playground
      </a>
    </figure>
  );
}

function PageBody({ section, page, index }: { section: ArticleSection; page: ArticlePage; index: number }) {
  const hub = articleHubs[section];
  const previous = hub.pages[index - 1];
  const next = hub.pages[index + 1];
  const isLesson = section === "learn-luau";

  return (
    <>
      {isLesson && <p className="article-kicker">Lesson {index + 1} of {hub.pages.length}</p>}
      <h1>{page.title}</h1>
      {page.blocks.map((block, blockIndex) => (
        <section key={blockIndex}>
          {block.heading && <h2>{block.heading}</h2>}
          {block.text.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>{inline(paragraph)}</p>
          ))}
          {block.code && <CodeBlockView code={block.code} id={codeBlockId(section, page.slug, blockIndex)} />}
        </section>
      ))}

      {page.exercise && (
        <section className="article-exercise">
          <h2>Exercise</h2>
          <p>
            Fill in the function, then press Run. The checks at the bottom of the file print a ✓ for each one your
            answer passes.
          </p>
          <iframe
            src={`/embed#example=${encodeURIComponent(exerciseId(page.slug))}`}
            title={`${page.title} exercise`}
            loading="lazy"
            width="100%"
            height="520"
          />
          <details>
            <summary>Show a solution</summary>
            <pre className="article-solution">
              <code>{page.exercise.solution}</code>
            </pre>
          </details>
          <noscript>
            <pre className="article-solution">
              <code>{exerciseSource(page.exercise)}</code>
            </pre>
          </noscript>
        </section>
      )}

      <nav className="article-pager" aria-label={isLesson ? "Lessons" : "Examples"}>
        {previous ? (
          <a href={`/${section}/${previous.slug}`}>
            <ArrowLeft size={15} /> {previous.title}
          </a>
        ) : (
          <a href={`/${section}`}>
            <ArrowLeft size={15} /> All {isLesson ? "lessons" : "examples"}
          </a>
        )}
        {next && (
          <a href={`/${section}/${next.slug}`}>
            {next.title} <ArrowRight size={15} />
          </a>
        )}
      </nav>
    </>
  );
}

function HubBody({ section, hub }: { section: ArticleSection; hub: ArticleHub }) {
  return (
    <>
      <h1>{hub.title}</h1>
      {hub.intro.map((paragraph, index) => (
        <p key={index}>{inline(paragraph)}</p>
      ))}
      <ol className={section === "learn-luau" ? "article-list is-numbered" : "article-list"}>
        {hub.pages.map((page) => (
          <li key={page.slug}>
            <a href={`/${section}/${page.slug}`}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

interface ArticleProps {
  section: ArticleSection;
  slug?: string;
  theme: Theme;
  onToggleTheme: () => void;
}

/** The /examples and /learn-luau pages: static text, prerendered by the build. An unknown slug shows the hub. */
export function Article({ section, slug, theme, onToggleTheme }: ArticleProps) {
  const hub = articleHubs[section];
  const index = hub.pages.findIndex((page) => page.slug === slug);

  return (
    <div className="app article-app">
      <header className="app-header">
        <div className="app-heading">
          <a className="brand" href="/" aria-label="Weblua home">
            <MoonMark size={26} />
            <span className="brand-name">Weblua</span>
          </a>
          <nav className="article-nav" aria-label="Sections">
            <a href="/playground">Playground</a>
            <a href="/examples" aria-current={section === "examples" ? "page" : undefined}>Examples</a>
            <a href="/learn-luau" aria-current={section === "learn-luau" ? "page" : undefined}>Learn Luau</a>
          </nav>
        </div>
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

      <main className="article">
        <nav className="article-crumbs" aria-label="Breadcrumb">
          <a href="/">Weblua</a> / <a href={`/${section}`}>{SECTION_LABELS[section]}</a>
        </nav>
        {index >= 0 ? <PageBody section={section} page={hub.pages[index]} index={index} /> : <HubBody section={section} hub={hub} />}
      </main>

      <footer className="article-footer">
        <a href="/playground">Playground</a>
        <a href="/lua-vs-luau">Lua vs Luau</a>
        <a href="/lua-5-1-vs-5-4">Lua 5.1 vs 5.4</a>
        <a href="/lua-pattern-tester">Pattern tester</a>
        <a href="/lua-table-to-json">Table to JSON</a>
        <a href="/lua-formatter">Formatter</a>
        <a href="/luau-type-checker">Type checker</a>
      </footer>
    </div>
  );
}
