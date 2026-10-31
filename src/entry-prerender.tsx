import { renderToStaticMarkup } from "react-dom/server";
import { Article, Compare, ToolGuide } from "./components/Articles";
import { plainText } from "./components/Code";
import { Landing } from "./components/Landing";
import { PlaygroundShell } from "./components/PlaygroundShell";
import Tools from "./components/Tools";
import { type ArticleHub, type ArticlePage, articleHubs, CONTENT_UPDATED, guidePages } from "./lib/articles";
import { type ArticleSection, isComparePage, isStandaloneTool, TOOL_PATHS, type ToolPage } from "./lib/routes";

export { articleHubs, guidePages, TOOL_PATHS };

const noop = () => {};

/**
 * Build-time entry used by scripts/postbuild.mjs to bake the landing page
 * into dist/index.html so crawlers get real HTML without executing JS.
 * The client re-renders over it with createRoot, so no hydration is needed.
 */
export function renderLanding(): string {
  return renderToStaticMarkup(<Landing theme="dark" onToggleTheme={noop} />);
}

/** The playground's header, <h1>, and about text around an empty workspace, for dist/playground/index.html. */
export function renderPlaygroundShell(): string {
  return renderToStaticMarkup(<PlaygroundShell theme="dark" onToggleTheme={noop} isEmbed={false} />);
}

/**
 * A tool page for dist/<tool path>/index.html: a comparison article, a
 * standalone tool with its guide, or the playground's frame with the guide
 * below it (the editor itself only renders client-side).
 */
export function renderToolPage(tool: ToolPage): string {
  if (isComparePage(tool)) return renderToStaticMarkup(<Compare page={tool} theme="dark" onToggleTheme={noop} />);
  if (isStandaloneTool(tool)) return renderToStaticMarkup(<Tools tool={tool} theme="dark" onToggleTheme={noop} />);
  return renderToStaticMarkup(<PlaygroundShell theme="dark" onToggleTheme={noop} isEmbed={false} tool={tool} guide={<ToolGuide tool={tool} />} />);
}

/** An /examples or /learn-luau page, or its hub when `slug` is absent. */
export function renderArticle(section: ArticleSection, slug?: string): string {
  return renderToStaticMarkup(<Article section={section} slug={slug} theme="dark" onToggleTheme={noop} />);
}

// ---------------------------------------------------------------------------
// Structured data: what each page is, for search and answer engines
// ---------------------------------------------------------------------------

const SITE = "https://weblua.com";
/** When the article pages first went up. */
const PUBLISHED = "2026-10-30";
const publisher = { "@type": "Organization", "@id": `${SITE}/#organization`, name: "Weblua", url: `${SITE}/`, logo: `${SITE}/icon-512.png` };

type Node = Record<string, unknown>;

function breadcrumbs(trail: Array<[name: string, path: string]>): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Weblua", "/"], ...trail].map(([name, path], index) => ({ "@type": "ListItem", position: index + 1, name, item: `${SITE}${path}` }))
  };
}

function faqPage(faq: ArticlePage["faq"]): Node[] {
  if (!faq?.length) return [];
  return [
    {
      "@type": "FAQPage",
      mainEntity: faq.map(([question, answer]) => ({ "@type": "Question", name: plainText(question), acceptedAnswer: { "@type": "Answer", text: plainText(answer) } }))
    }
  ];
}

function techArticle(page: ArticlePage, path: string, type = "TechArticle"): Node {
  const url = `${SITE}${path}`;
  return {
    "@type": type,
    "@id": `${url}#article`,
    headline: page.title,
    description: page.description,
    abstract: plainText(page.answer),
    url,
    mainEntityOfPage: url,
    inLanguage: "en",
    datePublished: PUBLISHED,
    dateModified: CONTENT_UPDATED,
    author: publisher,
    publisher,
    ...(page.minutes ? { timeRequired: `PT${page.minutes}M` } : {})
  };
}

function itemList(hub: ArticleHub, section: string): Node {
  return {
    "@type": "ItemList",
    itemListElement: hub.pages.map((page, index) => ({ "@type": "ListItem", position: index + 1, name: page.title, url: `${SITE}/${section}/${page.slug}` }))
  };
}

const course = (hub: ArticleHub): Node => ({
  "@type": "Course",
  "@id": `${SITE}/learn-luau#course`,
  name: "Learn Luau",
  description: hub.description,
  url: `${SITE}/learn-luau`,
  provider: publisher,
  inLanguage: "en",
  isAccessibleForFree: true,
  educationalLevel: "Beginner",
  teaches: "Luau programming: variables, control flow, functions, tables, strings, metatables, types, and coroutines",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
  hasCourseInstance: {
    "@type": "CourseInstance",
    courseMode: "Online",
    courseWorkload: `PT${hub.pages.reduce((total, page) => total + (page.minutes ?? 0), 0)}M`
  },
  syllabusSections: hub.pages.map((page) => ({ "@type": "Syllabus", name: page.title, description: plainText(page.answer), timeRequired: `PT${page.minutes}M` }))
});

function graph(nodes: Node[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
}

/** JSON-LD for /examples, /learn-luau, and the pages under them. */
export function articleSchema(section: ArticleSection, slug?: string): string {
  const hub = articleHubs[section];
  const page = hub.pages.find((candidate) => candidate.slug === slug);
  const label = section === "examples" ? "Examples" : "Learn Luau";
  if (!page) {
    return graph([
      section === "learn-luau" ? course(hub) : { "@type": "CollectionPage", name: hub.title, description: hub.description, url: `${SITE}/${section}`, publisher },
      itemList(hub, section),
      breadcrumbs([[label, `/${section}`]]),
      ...faqPage(hub.faq)
    ]);
  }
  const path = `/${section}/${page.slug}`;
  const article =
    section === "learn-luau"
      ? { ...techArticle(page, path, "LearningResource"), name: page.title, learningResourceType: "Lesson", educationalLevel: "Beginner", isPartOf: { "@id": `${SITE}/learn-luau#course` }, teaches: page.outcomes?.map(plainText) }
      : techArticle(page, path);
  return graph([article, breadcrumbs([[label, `/${section}`], [page.title, path]]), ...faqPage(page.faq)]);
}

/** JSON-LD for a tool or comparison page. */
export function toolSchema(tool: ToolPage): string {
  const page = guidePages[tool];
  const path = `/${TOOL_PATHS[tool]}`;
  const nodes: Node[] = [techArticle(page, path)];
  if (!isComparePage(tool)) {
    nodes.push({
      "@type": "WebApplication",
      name: page.metaTitle.split(/ [|—] /)[0],
      url: `${SITE}${path}`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript and WebAssembly",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      publisher
    });
  }
  return graph([...nodes, breadcrumbs([[page.title.split(":")[0], path]]), ...faqPage(page.faq)]);
}
