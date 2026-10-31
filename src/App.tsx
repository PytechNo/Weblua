import { Suspense, lazy, useEffect, useMemo } from "react";
import { Landing } from "./components/Landing";
import { PlaygroundShell } from "./components/PlaygroundShell";
import { getAppRoute, isStandaloneTool } from "./lib/routes";
import { useTheme } from "./lib/theme";

/**
 * The playground pulls in CodeMirror, the lint extensions, and the runtime
 * plumbing -- together the bulk of the main bundle. Visitors landing on "/"
 * never touch any of it, and evaluating it anyway is what pushed the hero
 * CTAs to 648ms and 264ms INP in the field data: the clicks arrive while the
 * main thread is still compiling code for a page the visitor isn't on.
 */
const Playground = lazy(() => import("./Playground"));
/** The pattern tester and table converter: small, but no reason to load them on "/". */
const Tools = lazy(() => import("./components/Tools"));
/** The examples and lessons: mostly text, which every landing visit would otherwise download. */
const Article = lazy(() => import("./components/Articles").then((module) => ({ default: module.Article })));

interface AppProps {
  /** What the build prerendered into #root, if anything, before React replaced it. */
  prerendered?: string;
}

export function App({ prerendered = "" }: AppProps) {
  const route = useMemo(() => getAppRoute(), []);
  const isEmbed = route.mode === "embed";
  const tool = route.mode === "playground" ? route.tool : undefined;
  const { theme, toggleTheme } = useTheme();

  // Fetch the playground chunk once the landing page is idle, so the hero CTA
  // still navigates into a warm cache without competing for the main thread
  // while the visitor is reading.
  useEffect(() => {
    if (route.mode !== "landing") return;
    const warm = () => void import("./Playground");

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(handle);
  }, [route.mode]);

  if (route.mode === "landing") {
    return <Landing theme={theme} onToggleTheme={toggleTheme} />;
  }

  // The fallback is the page the build prerendered, so nothing moves while the article code loads.
  if (route.mode === "article") {
    return (
      <Suspense fallback={<div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: prerendered }} />}>
        <Article section={route.section} slug={route.slug} theme={theme} onToggleTheme={toggleTheme} />
      </Suspense>
    );
  }

  // The fallback matches the shell prerendered into /playground's HTML, so the
  // header and about text stay put while the editor chunk loads.
  const fallback = <PlaygroundShell theme={theme} onToggleTheme={toggleTheme} isEmbed={isEmbed} tool={tool} />;
  if (tool && isStandaloneTool(tool)) {
    return (
      <Suspense fallback={fallback}>
        <Tools tool={tool} theme={theme} onToggleTheme={toggleTheme} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={fallback}>
      <Playground theme={theme} onToggleTheme={toggleTheme} isEmbed={isEmbed} tool={tool} />
    </Suspense>
  );
}
