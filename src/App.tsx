import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Landing } from "./components/Landing";
import { getAppRoute } from "./lib/routes";

type Theme = "dark" | "light";

/**
 * The playground pulls in CodeMirror, the lint extensions, and the runtime
 * plumbing -- together the bulk of the main bundle. Visitors landing on "/"
 * never touch any of it, and evaluating it anyway is what pushed the hero
 * CTAs to 648ms and 264ms INP in the field data: the clicks arrive while the
 * main thread is still compiling code for a page the visitor isn't on.
 */
const Playground = lazy(() => import("./Playground"));

export function App() {
  const route = useMemo(() => getAppRoute(), []);
  const isEmbed = route.mode === "embed";
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

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

  return (
    <Suspense fallback={<div className={isEmbed ? "app app-embed" : "app"} />}>
      <Playground theme={theme} onToggleTheme={toggleTheme} isEmbed={isEmbed} />
    </Suspense>
  );
}
