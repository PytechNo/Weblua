import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ChevronDown, Clock, ExternalLink, Lightbulb, Play } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ArticleBlock,
  type ArticleHub,
  type ArticlePage,
  articleHubs,
  type CodeBlock,
  codeBlockId,
  CONTENT_UPDATED,
  guidePages,
  type ShownFlavor
} from "../lib/articles";
import type { ArticleSection, ComparePage, PlaygroundTool, ToolPage } from "../lib/routes";
import type { Theme } from "../lib/theme";
import { headingId, Inline, LuaCode, plainText } from "./Code";
import { ExerciseCard, LookupDemo, QuizCard, TraceStage, useLessonsDone } from "./Learn";
import { SiteFrame } from "./SiteFrame";

const FLAVOR_LABELS: Record<string, string> = { lua51: "Lua 5.1", lua52: "Lua 5.2", lua53: "Lua 5.3", lua54: "Lua 5.4", lua55: "Lua 5.5", luau: "Luau" };
const UPDATED_LABEL = new Date(`${CONTENT_UPDATED}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** An output that is a runtime error rather than printed text. */
function isErrorOutput(output: string): boolean {
  return /^main\.luau?:\d+:/.test(output);
}

function CodeBlockView({ code, id }: { code: CodeBlock; id: string }) {
  const [live, setLive] = useState(false);
  const outputs = Object.entries(code.outputs) as Array<[ShownFlavor, string]>;
  const compare = outputs.map(([flavor]) => flavor).find((flavor) => flavor !== code.flavor) ?? code.compare;
  const hash = `example=${encodeURIComponent(id)}${compare ? `&compare=${compare}` : ""}`;
  const lines = code.code.split("\n").length;

  return (
    <figure className="code-card">
      <div className="code-card-bar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="code-card-file">{code.flavor === "luau" ? "main.luau" : "main.lua"}</span>
        <span className="code-card-runtime">{FLAVOR_LABELS[code.flavor]}</span>
        <span className="code-card-actions">
          {!live && (
            <button className="button button-primary code-card-run" type="button" onClick={() => setLive(true)}>
              <Play size={14} /> Run it here
            </button>
          )}
          <a className="button code-card-open" href={`/playground#${hash}`} title="Open in the full playground">
            <ExternalLink size={14} /> <span>Playground</span>
          </a>
        </span>
      </div>
      {live ? (
        <iframe
          className="code-card-embed"
          src={`/embed#${hash}&run=1`}
          title={`Editable example: ${id}`}
          height={Math.min(620, Math.max(340, lines * 21 + 150))}
          // React's autoFocus skips iframes; this keeps keyboard focus where the button was.
          ref={(frame) => frame?.focus()}
        />
      ) : (
        <>
          <pre className="code-card-code">
            <code>
              <LuaCode code={code.code} />
            </code>
          </pre>
          {outputs.length > 0 && (
            <div className={outputs.length > 1 ? "code-outputs is-compared" : "code-outputs"}>
              {outputs.map(([flavor, output]) => (
                <div className={isErrorOutput(output) ? "code-output is-error" : "code-output"} key={flavor}>
                  <p className="code-output-label">{FLAVOR_LABELS[flavor]}</p>
                  <pre>{output}</pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </figure>
  );
}

function Cell({ text, header }: { text: string; header?: boolean }) {
  const Tag = header ? "th" : "td";
  if (text === "Yes" || text === "No") {
    return (
      <Tag>
        <span className={text === "Yes" ? "cell-mark is-yes" : "cell-mark is-no"}>{text}</span>
      </Tag>
    );
  }
  return (
    <Tag scope={header ? "row" : undefined}>
      <Inline text={text} />
    </Tag>
  );
}

function BlockView({ block, id }: { block: ArticleBlock; id: string }) {
  return (
    <section className="block" id={block.heading ? headingId(block.heading) : undefined}>
      {block.heading && <h2>{block.heading}</h2>}
      {block.text?.map((paragraph, index) => (
        <p key={index}>
          <Inline text={paragraph} />
        </p>
      ))}
      {block.list && (
        <ul className="prose-list">
          {block.list.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )}
      {block.table && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                {block.table.head.map((cell) => (
                  <th scope="col" key={cell}>
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <Cell text={cell} header={cellIndex === 0} key={cellIndex} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {block.trace && <TraceStage trace={block.trace} />}
      {block.lookup && <LookupDemo lookup={block.lookup} />}
      {block.code && <CodeBlockView code={block.code} id={id} />}
      {block.embed && (
        <figure className="embed-card">
          <iframe
            src={`/embed#example=${encodeURIComponent(block.embed.example)}${block.embed.compare ? `&compare=${block.embed.compare}` : ""}&run=1`}
            title={block.embed.title}
            loading="lazy"
            height="560"
          />
          <figcaption>
            {block.embed.title}.{" "}
            <a href={`/playground#example=${encodeURIComponent(block.embed.example)}${block.embed.compare ? `&compare=${block.embed.compare}` : ""}`}>Open it in the full playground</a>.
          </figcaption>
        </figure>
      )}
      {block.quiz && <QuizCard quiz={block.quiz} />}
      {block.note && (
        <aside className="note">
          <Lightbulb size={18} aria-hidden="true" />
          <p>
            <Inline text={block.note} />
          </p>
        </aside>
      )}
    </section>
  );
}

/** "On this page", with the section in view marked as the reader scrolls. */
function Toc({ items }: { items: Array<[id: string, label: string]> }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    for (const [id] of items) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ol>
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id ? "location" : undefined}>
              <Inline text={label} />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function tocItems(page: Pick<ArticlePage, "blocks" | "exercise" | "faq">): Array<[string, string]> {
  return [
    ...page.blocks.filter((block) => block.heading).map((block): [string, string] => [headingId(block.heading!), block.heading!]),
    ...(page.exercise ? [["exercise", "Exercise"] as [string, string]] : []),
    ...(page.faq?.length ? [["faq", "Questions"] as [string, string]] : [])
  ];
}

function Faq({ items }: { items: NonNullable<ArticlePage["faq"]> }) {
  return (
    <section id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
      <div className="faq-list">
        {items.map(([question, answer]) => (
          <details className="faq" key={question}>
            <summary>
              {/* One flex item, or inline code would split the question into columns. */}
              <span>
                <Inline text={question} />
              </span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>
              <Inline text={answer} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Everything below the blocks: summary, questions, sources, and where to go next. */
function PageEnd({ page }: { page: ArticlePage }) {
  return (
    <>
      {page.recap && (
        <section className="recap" aria-labelledby="recap-title">
          <h2 id="recap-title">Recap</h2>
          <ul>
            {page.recap.map((item, index) => (
              <li key={index}>
                <Check size={16} aria-hidden="true" />
                <span>
                  <Inline text={item} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {page.faq && <Faq items={page.faq} />}
      {page.related && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">Keep going</h2>
          <div className="related-grid">
            {page.related.map(([label, href]) => (
              <a className="related-card" href={href} key={href}>
                <span>{label}</span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </section>
      )}
      {page.sources && (
        <section className="sources" aria-labelledby="sources-title">
          <h2 id="sources-title">Sources</h2>
          <ul>
            {page.sources.map(([label, url]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PageMeta({ minutes }: { minutes?: number }) {
  return (
    <p className="page-meta">
      {minutes && (
        <span>
          <Clock size={14} /> {minutes} min
        </span>
      )}
      <span>Updated {UPDATED_LABEL}</span>
      <span>
        <BadgeCheck size={14} /> Every output here comes from a real run
      </span>
    </p>
  );
}

/** The blocks of a page, then its end, with ids for the playground's `#example=` links. */
function PageBlocks({ page, prefix }: { page: ArticlePage; prefix: string }) {
  return (
    <>
      {page.blocks.map((block, index) => (
        <BlockView block={block} id={codeBlockId(prefix, page.slug, index)} key={index} />
      ))}
    </>
  );
}

function Crumbs({ trail }: { trail: Array<[label: string, href: string]> }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a href="/">Weblua</a>
        </li>
        {trail.map(([label, href]) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Examples, comparisons, and tool guides: an article with a contents rail
// ---------------------------------------------------------------------------

interface ReadingPageProps {
  page: ArticlePage;
  prefix: string;
  kicker: string;
  trail: Array<[string, string]>;
  pager?: { previous?: [string, string]; next?: [string, string] };
}

function ReadingPage({ page, prefix, kicker, trail, pager }: ReadingPageProps) {
  return (
    <main className="page" id="content">
      <header className="page-hero">
        <Crumbs trail={trail} />
        <p className="page-kicker">{kicker}</p>
        <h1>{page.title}</h1>
        <div className="answer">
          <p className="answer-label">Short answer</p>
          <p>
            <Inline text={page.answer} />
          </p>
        </div>
        <PageMeta />
      </header>
      <div className="page-columns">
        <article className="prose">
          <PageBlocks page={page} prefix={prefix} />
          <PageEnd page={page} />
          {pager && (
            <nav className="pager" aria-label="More pages">
              {pager.previous ? (
                <a href={pager.previous[1]}>
                  <span>Previous</span>
                  <strong>
                    <ArrowLeft size={15} /> {pager.previous[0]}
                  </strong>
                </a>
              ) : (
                <span />
              )}
              {pager.next && (
                <a className="is-next" href={pager.next[1]}>
                  <span>Next</span>
                  <strong>
                    {pager.next[0]} <ArrowRight size={15} />
                  </strong>
                </a>
              )}
            </nav>
          )}
        </article>
        <aside className="page-aside">
          <Toc items={tocItems(page)} />
        </aside>
      </div>
    </main>
  );
}

/** A tool's guide, under the tool: the tool page's <h1> is above it, so this starts at <h2>. */
export function GuideContent({ tool }: { tool: ToolPage }) {
  const page = guidePages[tool];
  return (
    <div className="page-columns guide" id="guide">
      <article className="prose">
        <h2 className="guide-title">{page.title}</h2>
        <div className="answer">
          <p className="answer-label">Short answer</p>
          <p>
            <Inline text={page.answer} />
          </p>
        </div>
        <PageMeta />
        <PageBlocks page={page} prefix="guide" />
        <PageEnd page={page} />
      </article>
      <aside className="page-aside">
        <Toc items={tocItems(page)} />
      </aside>
    </div>
  );
}

/** The guide below a playground tool page's editor. */
export function ToolGuide({ tool }: { tool: PlaygroundTool }) {
  return (
    <div className="site-below">
      <main className="page">
        <GuideContent tool={tool} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lessons: the course rail, the lesson, and the exercise
// ---------------------------------------------------------------------------

function CourseRail({ pages, current }: { pages: ArticlePage[]; current: number }) {
  const done = useLessonsDone();
  const count = pages.filter((page) => done.includes(page.slug)).length;
  return (
    <nav className="course-rail" aria-label="Lessons">
      <p className="course-rail-title">
        <BookOpen size={15} /> Learn Luau
      </p>
      <div className="course-progress" role="progressbar" aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={count} aria-label="Lessons done">
        <span style={{ width: `${(count / pages.length) * 100}%` }} />
      </div>
      <p className="course-progress-label">
        {count} of {pages.length} done
      </p>
      <ol>
        {pages.map((page, index) => (
          <li key={page.slug} className={done.includes(page.slug) ? "is-done" : undefined}>
            <a href={`/learn-luau/${page.slug}`} aria-current={index === current ? "page" : undefined}>
              <span className="course-dot">{done.includes(page.slug) ? <Check size={12} /> : index + 1}</span>
              {page.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function LessonPage({ hub, index }: { hub: ArticleHub; index: number }) {
  const page = hub.pages[index];
  const previous = hub.pages[index - 1];
  const next = hub.pages[index + 1];
  return (
    <main className="page lesson" id="content">
      <div className="lesson-layout">
        <aside className="lesson-aside">
          <CourseRail pages={hub.pages} current={index} />
        </aside>
        <article className="prose">
          <header className="page-hero lesson-hero">
            <Crumbs trail={[["Learn Luau", "/learn-luau"]]} />
            <p className="page-kicker">
              Lesson {index + 1} of {hub.pages.length}
            </p>
            <h1>{page.title}</h1>
            <p className="page-lead">
              <Inline text={page.answer} />
            </p>
            <PageMeta minutes={page.minutes} />
            {page.outcomes && (
              <div className="outcomes">
                <p className="answer-label">You'll learn to</p>
                <ul>
                  {page.outcomes.map((outcome) => (
                    <li key={outcome}>
                      <Check size={15} aria-hidden="true" /> <Inline text={outcome} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </header>
          <PageBlocks page={page} prefix="learn-luau" />
          <ExerciseCard page={page} next={next} />
          <PageEnd page={page} />
          <nav className="pager" aria-label="Lessons">
            {previous ? (
              <a href={`/learn-luau/${previous.slug}`}>
                <span>Previous lesson</span>
                <strong>
                  <ArrowLeft size={15} /> {previous.title}
                </strong>
              </a>
            ) : (
              <a href="/learn-luau">
                <span>Course</span>
                <strong>
                  <ArrowLeft size={15} /> All lessons
                </strong>
              </a>
            )}
            {next && (
              <a className="is-next" href={`/learn-luau/${next.slug}`}>
                <span>Next lesson</span>
                <strong>
                  {next.title} <ArrowRight size={15} />
                </strong>
              </a>
            )}
          </nav>
        </article>
      </div>
    </main>
  );
}

/** A lesson's topics, from its meta description: "Lesson 1 of …: numbers, strings, …" becomes "Numbers, strings, …". */
function lessonTopics(page: ArticlePage): string {
  const topics = page.description.replace(/^Lesson \d+ of [^:]+: /, "").replace(/, (with|animated) [^,]+$/, ".");
  return topics.charAt(0).toUpperCase() + topics.slice(1);
}

/** What a lesson has in it, counted from its blocks. */
function lessonParts(page: ArticlePage): string {
  const traces = page.blocks.filter((block) => block.trace || block.lookup).length;
  const quizzes = page.blocks.filter((block) => block.quiz).length;
  return [
    `${traces} animated walkthrough${traces === 1 ? "" : "s"}`,
    `${quizzes} quiz${quizzes === 1 ? "" : "zes"}`,
    page.exercise ? "1 exercise" : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

function CourseHub({ hub }: { hub: ArticleHub }) {
  const done = useLessonsDone();
  const resume = hub.pages.find((page) => !done.includes(page.slug)) ?? hub.pages[0];
  const minutes = hub.pages.reduce((total, page) => total + (page.minutes ?? 0), 0);
  const preview = hub.pages[0].blocks.find((block) => block.trace)?.trace;
  return (
    <main className="page" id="content">
      <header className="page-hero course-hero">
        <div>
          <Crumbs trail={[["Learn Luau", "/learn-luau"]]} />
          <p className="page-kicker">Free course · {hub.pages.length} lessons · about {Math.round(minutes / 5) * 5} minutes</p>
          <h1>
            Learn <span className="gradient-text">Luau</span>, one line at a time
          </h1>
          {hub.intro.map((paragraph, index) => (
            <p className={index === 0 ? "page-lead" : undefined} key={index}>
              <Inline text={paragraph} />
            </p>
          ))}
          <div className="hero-actions">
            <a className="button button-primary button-large" href={`/learn-luau/${resume.slug}`}>
              {done.length === 0 ? "Start lesson 1" : done.length === hub.pages.length ? "Review the course" : `Continue: ${resume.title}`}
              <ArrowRight size={17} />
            </a>
            <a className="button button-large" href="/luau">
              Open the Luau playground
            </a>
          </div>
        </div>
        {preview && (
          <div className="course-preview">
            <TraceStage trace={preview} />
          </div>
        )}
      </header>

      <section className="course-map" aria-labelledby="lessons-title">
        <h2 id="lessons-title">The lessons</h2>
        <ol>
          {hub.pages.map((page, index) => (
            <li key={page.slug} className={done.includes(page.slug) ? "is-done" : undefined}>
              <a href={`/learn-luau/${page.slug}`}>
                <span className="course-node">{done.includes(page.slug) ? <Check size={18} /> : index + 1}</span>
                <span className="course-node-body">
                  <strong>{page.title}</strong>
                  <span>{lessonTopics(page)}</span>
                  <small>
                    {page.minutes} min · {lessonParts(page)}
                  </small>
                </span>
                <ArrowRight className="course-node-go" size={18} />
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="page-columns is-narrow">
        <article className="prose">
          {hub.blocks?.map((block, index) => (
            <BlockView block={block} id={`learn-luau/hub/${index}`} key={index} />
          ))}
          {hub.faq && <Faq items={hub.faq} />}
        </article>
      </div>
    </main>
  );
}

function ExamplesHub({ hub }: { hub: ArticleHub }) {
  return (
    <main className="page" id="content">
      <header className="page-hero">
        <Crumbs trail={[["Examples", "/examples"]]} />
        <p className="page-kicker">Runnable examples · Lua 5.1, 5.4, and Luau</p>
        <h1>{hub.title}</h1>
        {hub.intro.map((paragraph, index) => (
          <p className={index === 0 ? "page-lead" : undefined} key={index}>
            <Inline text={paragraph} />
          </p>
        ))}
      </header>
      <ol className="example-grid">
        {hub.pages.map((page) => {
          const first = page.blocks.find((block) => block.code)?.code;
          return (
            <li key={page.slug}>
              <a className="example-card" href={`/examples/${page.slug}`}>
                <strong>{page.title}</strong>
                <span>{plainText(page.answer)}</span>
                {first && (
                  <pre aria-hidden="true">
                    <code>
                      <LuaCode code={first.code.split("\n").slice(0, 6).join("\n")} />
                    </code>
                  </pre>
                )}
                <span className="example-card-runs">
                  {(Object.keys(first?.outputs ?? {}) as ShownFlavor[]).map((flavor) => (
                    <span key={flavor}>{FLAVOR_LABELS[flavor]}</span>
                  ))}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <div className="page-columns is-narrow">
        <article className="prose">
          {hub.blocks?.map((block, index) => (
            <BlockView block={block} id={`examples/hub/${index}`} key={index} />
          ))}
          {hub.faq && <Faq items={hub.faq} />}
        </article>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Route components
// ---------------------------------------------------------------------------

interface ArticleProps {
  section: ArticleSection;
  slug?: string;
  theme: Theme;
  onToggleTheme: () => void;
}

/** The /examples and /learn-luau pages, prerendered by the build. An unknown slug shows the hub. */
export function Article({ section, slug, theme, onToggleTheme }: ArticleProps) {
  const hub = articleHubs[section];
  const index = hub.pages.findIndex((page) => page.slug === slug);
  const page = hub.pages[index];

  let body;
  if (section === "learn-luau") {
    body = index >= 0 ? <LessonPage hub={hub} index={index} /> : <CourseHub hub={hub} />;
  } else if (index < 0) {
    body = <ExamplesHub hub={hub} />;
  } else {
    const previous = hub.pages[index - 1];
    const next = hub.pages[index + 1];
    body = (
      <ReadingPage
        page={page}
        prefix={section}
        kicker="Runnable example"
        trail={[["Examples", "/examples"]]}
        pager={{
          previous: previous ? [previous.title, `/examples/${previous.slug}`] : ["All examples", "/examples"],
          next: next ? [next.title, `/examples/${next.slug}`] : undefined
        }}
      />
    );
  }

  return (
    <SiteFrame theme={theme} onToggleTheme={onToggleTheme} current={`/${section}`}>
      {body}
    </SiteFrame>
  );
}

interface CompareProps {
  page: ComparePage;
  theme: Theme;
  onToggleTheme: () => void;
}

/** /lua-vs-luau and /lua-5-1-vs-5-4: the comparison, with both runtimes live on the page. */
export function Compare({ page, theme, onToggleTheme }: CompareProps) {
  const other: ComparePage = page === "lua-vs-luau" ? "lua51-vs-lua54" : "lua-vs-luau";
  return (
    <SiteFrame theme={theme} onToggleTheme={onToggleTheme} current={page === "lua-vs-luau" ? "/lua-vs-luau" : undefined}>
      <ReadingPage
        page={guidePages[page]}
        prefix="guide"
        kicker="Language comparison"
        trail={[[guidePages[page].title.split(":")[0], `/${guidePages[page].slug}`]]}
        pager={{ next: [guidePages[other].title.split(":")[0], `/${guidePages[other].slug}`] }}
      />
    </SiteFrame>
  );
}
