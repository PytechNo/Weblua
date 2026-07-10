// Post-build SEO pass:
//  1. Prerenders the landing page into dist/index.html so crawlers that don't
//     execute JS still see the full marketing content.
//  2. Emits dist/playground/index.html and dist/embed/index.html with
//     route-specific <title>/description/canonical tags (nginx's
//     `try_files $uri $uri/` picks them up), instead of every route claiming
//     to be the homepage. The embed route is marked noindex.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(repoRoot, "dist");
const template = readFileSync(path.join(dist, "index.html"), "utf8");

function replaceOnce(html, pattern, replacement, label) {
  let found = false;
  const next = html.replace(pattern, () => {
    found = true;
    return replacement;
  });
  if (!found) throw new Error(`postbuild: could not find ${label} in dist/index.html`);
  return next;
}

function routeHtml({ title, description, canonical, noindex }) {
  let html = template;
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
  return html;
}

const routes = [
  {
    dir: "playground",
    title: "Lua 5.1–5.4 &amp; Luau Online Playground — Weblua",
    description:
      "Write, run, and share multi-file Lua 5.1–5.4 and Luau projects directly in your browser without an account or execution backend.",
    canonical: "https://weblua.com/playground",
    noindex: false
  },
  {
    dir: "embed",
    title: "Weblua Embed — Runnable Lua &amp; Luau Project",
    description: "An interactive source-only Lua 5.1–5.4 and Luau project embed powered by Weblua.",
    canonical: "https://weblua.com/embed",
    noindex: true
  }
];

for (const route of routes) {
  const outDir = path.join(dist, route.dir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), routeHtml(route));
  console.log(`postbuild: wrote dist/${route.dir}/index.html`);
}

const server = await createServer({
  configFile: path.join(repoRoot, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const { renderLanding } = await server.ssrLoadModule("/src/entry-prerender.tsx");
  const markup = renderLanding();
  if (!markup.includes("<h1")) {
    throw new Error("postbuild: prerendered landing markup is missing its <h1>");
  }
  const prerendered = replaceOnce(
    template,
    '<div id="root"></div>',
    `<div id="root">${markup}</div>`,
    '<div id="root">'
  );
  writeFileSync(path.join(dist, "index.html"), prerendered);
  console.log(`postbuild: prerendered landing into dist/index.html (${(markup.length / 1024).toFixed(1)} kB of markup)`);
} finally {
  await server.close();
}
