import { renderToStaticMarkup } from "react-dom/server";
import { Landing } from "./components/Landing";

/**
 * Build-time entry used by scripts/postbuild.mjs to bake the landing page
 * into dist/index.html so crawlers get real HTML without executing JS.
 * The client re-renders over it with createRoot, so no hydration is needed.
 */
export function renderLanding(): string {
  return renderToStaticMarkup(<Landing theme="dark" onToggleTheme={() => {}} />);
}
