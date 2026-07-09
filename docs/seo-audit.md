# SEO Audit — weblua.com

Date: 2026-07-09

## What's already good

- Clean single `<h1>`, logical `<h2>`/`<h3>` hierarchy, ARIA labels, skip link, semantic `<nav>`/`<main>`/`<footer>` ([src/components/Landing.tsx](../src/components/Landing.tsx))
- Meta description, OG tags, Twitter card, canonical link all present and reasonable length ([index.html](../index.html))
- FAQ content is real, crawlable text (native `<details>`/`<summary>`)

## Gaps, ranked by impact

1. **Pure client-rendered SPA, no prerendering/SSR.**
   `dist/index.html` ships an empty `<div id="root"></div>` — all content, including the `<h1>` and FAQ text, only exists after JS executes ([dist/index.html:42-44](../dist/index.html#L42-L44)). Googlebot can render this, but it's a second-pass, delayed render, and Bing/other crawlers/link-unfurlers often won't. This is the biggest structural risk for a marketing-focused landing page.
   - Fix: prerender/SSG (e.g. `vite-plugin-ssr` or a prerender plugin) so crawlers get real HTML on first fetch.

2. **Every route shares one static `<title>`/description/canonical.**
   `/playground` and `/embed` serve the exact same `index.html` as the homepage, so the canonical tag claims every shared snippet page *is* the homepage ([index.html:31](../index.html#L31)). Shared snippets live entirely in the URL fragment (`#c=...`), which servers and crawlers never see, so social previews can't reflect a snippet's content and always show generic Weblua copy.
   - Fix: per-route meta injection via prerendering/SSR (there is no backend to inject it at request time).

3. **No `robots.txt` or `sitemap.xml`** in `public/` — neither file exists.
   - Fix: add both; sitemap should list `/` and `/playground` at minimum.

4. **No structured data (JSON-LD).**
   The FAQ section gets zero rich-result credit without `FAQPage` schema, and there's no `SoftwareApplication`/`WebSite` schema either.
   - Fix: add JSON-LD blocks for `FAQPage` and `SoftwareApplication`.

5. **`og:image`/`twitter:image` point to an SVG** ([index.html:21](../index.html#L21), [index.html:28](../index.html#L28)).
   Facebook, LinkedIn, Slack, and Discord unfurlers frequently fail to render SVG for social cards.
   - Fix: generate a PNG/JPG (1200×630) and add explicit `og:image:width`/`og:image:height` meta tags.

6. **No `apple-touch-icon` or web manifest.**
   Minor, but Lighthouse SEO/PWA checks flag it.
   - Fix: add `apple-touch-icon.png` and a `site.webmanifest`.

## Suggested next step

Highest-leverage, lowest-risk wins: #3, #4, and #5 (robots.txt + sitemap + JSON-LD + a real PNG og-image). #1 and #2 are architectural changes worth scoping separately.
