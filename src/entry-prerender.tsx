import { renderToStaticMarkup } from "react-dom/server";
import { Article } from "./components/Articles";
import { Landing } from "./components/Landing";
import { PlaygroundShell } from "./components/PlaygroundShell";
import type { ArticleSection, ToolPage } from "./lib/routes";

export { articleHubs } from "./lib/articles";
export { TOOL_PATHS } from "./lib/routes";

/**
 * Build-time entry used by scripts/postbuild.mjs to bake the landing page
 * into dist/index.html so crawlers get real HTML without executing JS.
 * The client re-renders over it with createRoot, so no hydration is needed.
 */
export function renderLanding(): string {
  return renderToStaticMarkup(<Landing theme="dark" onToggleTheme={() => {}} />);
}

/**
 * The playground's header, <h1>, and about text around an empty workspace,
 * for dist/playground/index.html, or a tool page's for dist/<tool path>/index.html.
 * The editor itself only renders client-side.
 */
export function renderPlaygroundShell(tool?: ToolPage): string {
  return renderToStaticMarkup(<PlaygroundShell theme="dark" onToggleTheme={() => {}} isEmbed={false} tool={tool} />);
}

/** An /examples or /learn-luau page, or its hub when `slug` is absent. */
export function renderArticle(section: ArticleSection, slug?: string): string {
  return renderToStaticMarkup(<Article section={section} slug={slug} theme="dark" onToggleTheme={() => {}} />);
}
