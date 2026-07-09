export type AppRoute =
  | { mode: "landing" }
  | { mode: "playground" }
  | { mode: "embed" };

export function getAppRoute(
  pathname = window.location.pathname,
  hash = window.location.hash
): AppRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "embed") {
    return { mode: "embed" };
  }

  if (parts.length === 0) {
    // Share links point at "/" only in the legacy `#share=` form; the current
    // `#c=` codec targets /playground directly. Recognize both here so a bare
    // "/" that carries a snippet opens the playground rather than the landing page.
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    return params.has("share") || params.has("c") ? { mode: "playground" } : { mode: "landing" };
  }

  return { mode: "playground" };
}
