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
//  3. Adds a modulepreload for the lazily-imported chunk each app route needs
//     (the playground's or the standalone tools'), so splitting it out of the
//     landing bundle doesn't cost those routes an extra round trip.
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

const chunkHrefs = { Playground: lazyChunk("Playground"), Tools: lazyChunk("Tools"), Articles: lazyChunk("Articles") };

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

function routeHtml({ title, description, canonical, noindex, markup, chunk = "Playground" }) {
  let html = chunk
    ? replaceOnce(
        template,
        "</head>",
        `  <link rel="modulepreload" crossorigin href="${chunkHrefs[chunk]}" />
  </head>`,
        "</head> (modulepreload insert)"
      )
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
let toolPaths;
let toolMarkup;
let articles;
try {
  const prerender = await server.ssrLoadModule("/src/entry-prerender.tsx");
  landingMarkup = prerender.renderLanding();
  playgroundMarkup = prerender.renderPlaygroundShell();
  toolPaths = prerender.TOOL_PATHS;
  toolMarkup = Object.fromEntries(Object.keys(toolPaths).map((tool) => [tool, prerender.renderPlaygroundShell(tool)]));
  // Each hub, then each page under it.
  articles = Object.entries(prerender.articleHubs).flatMap(([section, hub]) => [
    { dir: section, title: hub.metaTitle, description: hub.description, markup: prerender.renderArticle(section) },
    ...hub.pages.map((page) => ({
      dir: `${section}/${page.slug}`,
      title: page.metaTitle,
      description: page.description,
      markup: prerender.renderArticle(section, page.slug)
    }))
  ]);
} finally {
  await server.close();
}
for (const [label, markup] of [
  ["landing", landingMarkup],
  ["playground", playgroundMarkup],
  ...Object.entries(toolMarkup),
  ...articles.map((article) => [article.dir, article.markup])
]) {
  if (!markup.includes("<h1")) {
    throw new Error(`postbuild: prerendered ${label} markup is missing its <h1>`);
  }
}

/** Search text for each tool page, keyed like TOOL_PATHS; a missing entry fails the build below. */
const toolMeta = {
  formatter: {
    title: "Lua &amp; Luau Formatter Online (StyLua) — Weblua",
    description:
      "Format Lua 5.1–5.5 and Luau code online with StyLua, in your browser. Paste code, press Format, and copy the result. Free, with no install or account."
  },
  "type-checker": {
    title: "Luau Type Checker Online — Strict Mode in Your Browser | Weblua",
    description:
      "Type-check Luau code online in strict or nonstrict mode. Errors appear as you type, with hover details and types that cross require. Free, no Roblox Studio needed."
  },
  bytecode: {
    title: "Luau Bytecode Viewer — See What the Compiler Emits | Weblua",
    description:
      "View Luau bytecode online. The Luau compiler runs in your browser and lists each instruction under its source line, at optimization levels 0 to 2."
  },
  lua: {
    title: "Lua Playground — Run Lua 5.1 to 5.5 Online | Weblua",
    description:
      "A free Lua playground: run Lua 5.1, 5.2, 5.3, 5.4, and 5.5 online with the real interpreters, compare versions side by side, and share code as a link."
  },
  luau: {
    title: "Luau Playground — Run and Type-Check Luau Online | Weblua",
    description:
      "A free Luau playground: run Luau online with type checking as you type, string interpolation, generics, and the task library. No Roblox Studio or install."
  },
  "lua-vs-luau": {
    title: "Lua vs Luau — Run Both Side by Side | Weblua",
    description:
      "Lua 5.1 vs Luau: run the same code on both and compare the output. See the syntax, library, and behavior differences that matter for Roblox scripts."
  },
  "lua51-vs-lua54": {
    title: "Lua 5.1 vs 5.4 — Run Both Side by Side | Weblua",
    description:
      "Lua 5.1 vs Lua 5.4: run the same code on both real interpreters and compare. Integers, table.unpack, _ENV, goto, bitwise operators, and more."
  },
  "pattern-tester": {
    title: "Lua Pattern Tester — Test string.match and gsub Online | Weblua",
    description:
      "Test Lua patterns online: see every match, its position, and its captures highlighted, plus string.gsub's result, on Lua 5.1 to 5.5 or Luau."
  },
  "table-to-json": {
    title: "Lua Table to JSON Converter (and JSON to Lua) | Weblua",
    description:
      "Convert a Lua table to JSON, or JSON to a Lua table, in your browser. Lua 5.4 evaluates the table, so expressions and nested tables work."
  }
};

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
  ...Object.entries(toolPaths).map(([tool, dir]) => ({
    dir,
    ...toolMeta[tool],
    canonical: `https://weblua.com/${dir}`,
    noindex: false,
    markup: toolMarkup[tool],
    chunk: tool === "pattern-tester" || tool === "table-to-json" ? "Tools" : "Playground"
  })),
  ...articles.map((article) => ({
    dir: article.dir,
    title: escapeHtml(article.title),
    description: escapeHtml(article.description),
    canonical: `https://weblua.com/${article.dir}`,
    noindex: false,
    markup: article.markup,
    chunk: "Articles"
  })),
  {
    dir: "embed",
    title: "Weblua Embed — Runnable Lua &amp; Luau Project",
    description: "An interactive source-only Lua 5.1–5.5 and Luau project embed powered by Weblua.",
    canonical: "https://weblua.com/embed",
    noindex: true
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

const prerendered = replaceOnce(
  template,
  '<div id="root"></div>',
  `<div id="root">${landingMarkup}</div>`,
  '<div id="root">'
);
writeFileSync(path.join(dist, "index.html"), prerendered);
console.log(`postbuild: prerendered landing into dist/index.html (${(landingMarkup.length / 1024).toFixed(1)} kB of markup)`);
