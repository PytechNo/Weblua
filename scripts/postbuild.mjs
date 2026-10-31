// Post-build SEO pass:
//  1. Prerenders the landing page into dist/index.html so crawlers that don't
//     execute JS still see the full marketing content.
//  2. Emits dist/playground/index.html, the tool pages (dist/lua-formatter/
//     and the rest of TOOL_PATHS), the /examples and /learn-luau pages, and
//     dist/embed/index.html with route-specific <title>/description/canonical
//     tags (nginx's `try_files $uri $uri/index.html` picks them up), instead of
//     every route claiming to be the homepage. The embed route is marked
//     noindex. Every other route also gets its prerendered markup: the
//     playground shell's header, <h1>, and about text, or the whole article.
//  3. Adds a modulepreload for the lazily-imported chunks each app route needs
//     (the playground's, the standalone tools', the articles'), so splitting
//     them out of the landing bundle doesn't cost those routes a round trip.
//  4. Gives every article and tool page its own JSON-LD (TechArticle, Course,
//     LearningResource, WebApplication, FAQPage, BreadcrumbList), and writes
//     dist/llms.txt, a plain index of those pages for AI crawlers.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(repoRoot, "dist");
const template = readFileSync(path.join(dist, "index.html"), "utf8");

/** A dynamic chunk App.tsx lazy-imports; Vite names it after the module. */
function lazyChunk(name) {
  const match = readdirSync(path.join(dist, "assets")).find(
    (file) => file.startsWith(`${name}-`) && file.endsWith(".js")
  );
  if (!match) {
    throw new Error(`postbuild: no dist/assets/${name}-*.js chunk to preload`);
  }
  return `/assets/${match}`;
}

// "articles" (lower case) is the page text that Articles and Tools import; it loads with them.
const chunkHrefs = {
  Playground: lazyChunk("Playground"),
  Tools: lazyChunk("Tools"),
  Articles: lazyChunk("Articles"),
  articles: lazyChunk("articles")
};

/** Text from page data, for an attribute or element. */
function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function replaceOnce(html, pattern, replacement, label) {
  let found = false;
  const next = html.replace(pattern, () => {
    found = true;
    return replacement;
  });
  if (!found) throw new Error(`postbuild: could not find ${label} in dist/index.html`);
  return next;
}

function routeHtml({ title, description, canonical, noindex, markup, chunks = ["Playground"], jsonLd }) {
  const head = [
    ...chunks.map((chunk) => `<link rel="modulepreload" crossorigin href="${chunkHrefs[chunk]}" />`),
    // "<" escaped so text in the data can't close the script element.
    ...(jsonLd ? [`<script type="application/ld+json">${jsonLd.replaceAll("<", "\\u003c")}</script>`] : [])
  ];
  let html = head.length
    ? replaceOnce(template, "</head>", `  ${head.join("\n    ")}\n  </head>`, "</head> (head insert)")
    : template;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "<title>");
  for (const [pattern, value, label] of [
    [/(<meta name="description" content=")[^"]*(" \/>)/, description, "description"],
    [/(<meta property="og:title" content=")[^"]*(" \/>)/, title, "og:title"],
    [/(<meta property="og:description" content=")[^"]*(" \/>)/, description, "og:description"],
    [/(<meta property="og:url" content=")[^"]*(" \/>)/, canonical, "og:url"],
    [/(<meta name="twitter:title" content=")[^"]*(" \/>)/, title, "twitter:title"],
    [/(<meta name="twitter:description" content=")[^"]*(" \/>)/, description, "twitter:description"],
    [/(<link rel="canonical" href=")[^"]*(" \/>)/, canonical, "canonical"]
  ]) {
    let found = false;
    html = html.replace(pattern, (_, before, after) => {
      found = true;
      return `${before}${value}${after}`;
    });
    if (!found) throw new Error(`postbuild: could not find ${label} in dist/index.html`);
  }

  // The landing page's structured data (FAQPage etc.) doesn't apply to app routes.
  html = html.replace(/\s*<script type="application\/ld\+json" data-page="landing">[\s\S]*?<\/script>/g, "");

  if (noindex) {
    html = replaceOnce(
      html,
      /<link rel="canonical"/,
      '<meta name="robots" content="noindex" />\n    <link rel="canonical"',
      "canonical (noindex insert)"
    );
  }
  if (markup) {
    html = replaceOnce(html, '<div id="root"></div>', `<div id="root">${markup}</div>`, '<div id="root">');
  }
  return html;
}

const server = await createServer({
  configFile: path.join(repoRoot, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

let landingMarkup;
let playgroundMarkup;
let tools;
let articles;
try {
  const prerender = await server.ssrLoadModule("/src/entry-prerender.tsx");
  landingMarkup = prerender.renderLanding();
  playgroundMarkup = prerender.renderPlaygroundShell();
  tools = Object.entries(prerender.TOOL_PATHS).map(([tool, dir]) => ({
    tool,
    dir,
    title: prerender.guidePages[tool].metaTitle,
    description: prerender.guidePages[tool].description,
    markup: prerender.renderToolPage(tool),
    jsonLd: prerender.toolSchema(tool)
  }));
  // Each hub, then each page under it.
  articles = Object.entries(prerender.articleHubs).flatMap(([section, hub]) => [
    {
      dir: section,
      title: hub.metaTitle,
      description: hub.description,
      markup: prerender.renderArticle(section),
      jsonLd: prerender.articleSchema(section)
    },
    ...hub.pages.map((page) => ({
      dir: `${section}/${page.slug}`,
      title: page.metaTitle,
      description: page.description,
      markup: prerender.renderArticle(section, page.slug),
      jsonLd: prerender.articleSchema(section, page.slug)
    }))
  ]);
} finally {
  await server.close();
}
for (const [label, markup] of [
  ["landing", landingMarkup],
  ["playground", playgroundMarkup],
  ...tools.map((tool) => [tool.dir, tool.markup]),
  ...articles.map((article) => [article.dir, article.markup])
]) {
  if (!markup.includes("<h1")) {
    throw new Error(`postbuild: prerendered ${label} markup is missing its <h1>`);
  }
}

const routes = [
  {
    dir: "playground",
    title: "Online Lua Compiler &amp; Luau Playground — Weblua",
    description:
      "Run Lua 5.1–5.5 and Luau online: a free Lua compiler, interpreter, and editor in your browser. Type-check, compare runtimes, and share multi-file projects.",
    canonical: "https://weblua.com/playground",
    noindex: false,
    markup: playgroundMarkup
  },
  ...tools.map((tool) => ({
    dir: tool.dir,
    title: escapeHtml(tool.title),
    description: escapeHtml(tool.description),
    canonical: `https://weblua.com/${tool.dir}`,
    noindex: false,
    markup: tool.markup,
    jsonLd: tool.jsonLd,
    // Comparison pages are articles; standalone tools render their guide from the articles chunk.
    chunks:
      tool.tool === "lua-vs-luau" || tool.tool === "lua51-vs-lua54"
        ? ["Articles", "articles"]
        : tool.tool === "pattern-tester" || tool.tool === "table-to-json"
          ? ["Tools", "Articles", "articles"]
          : ["Playground"]
  })),
  ...articles.map((article) => ({
    dir: article.dir,
    title: escapeHtml(article.title),
    description: escapeHtml(article.description),
    canonical: `https://weblua.com/${article.dir}`,
    noindex: false,
    markup: article.markup,
    jsonLd: article.jsonLd,
    chunks: ["Articles", "articles"]
  })),
  {
    dir: "embed",
    title: "Weblua Embed — Runnable Lua &amp; Luau Project",
    description: "An interactive source-only Lua 5.1–5.5 and Luau project embed powered by Weblua.",
    canonical: "https://weblua.com/embed",
    noindex: true,
    chunks: ["Playground"]
  }
];

for (const route of routes) {
  if (!route.title || !route.description) throw new Error(`postbuild: /${route.dir} has no title or description`);
}

for (const route of routes) {
  const outDir = path.join(dist, route.dir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), routeHtml(route));
  console.log(`postbuild: wrote dist/${route.dir}/index.html`);
}

// A plain index of the content pages, for AI crawlers that read llms.txt.
const llmsSection = (heading, entries) =>
  [`## ${heading}`, "", ...entries.map((entry) => `- [${entry.title.replace(/ [|—] Weblua$/, "")}](https://weblua.com/${entry.dir}): ${entry.description}`), ""].join("\n");
writeFileSync(
  path.join(dist, "llms.txt"),
  [
    "# Weblua",
    "",
    "> Weblua runs Lua 5.1 to 5.5 and Luau in the browser through WebAssembly: a playground, tools, runnable examples, and a free interactive Luau course. Every code output shown on these pages is checked by tests against the real interpreters.",
    "",
    llmsSection("Tools and comparisons", tools),
    llmsSection("Learn Luau", articles.filter((article) => article.dir.startsWith("learn-luau"))),
    llmsSection("Examples", articles.filter((article) => article.dir.startsWith("examples")))
  ].join("\n")
);
console.log("postbuild: wrote dist/llms.txt");

const prerendered = replaceOnce(
  template,
  '<div id="root"></div>',
  `<div id="root">${landingMarkup}</div>`,
  '<div id="root">'
);
writeFileSync(path.join(dist, "index.html"), prerendered);
console.log(`postbuild: prerendered landing into dist/index.html (${(landingMarkup.length / 1024).toFixed(1)} kB of markup)`);
