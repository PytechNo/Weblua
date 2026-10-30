/** Playground routes that open on one tool, each with its own prerendered page text. */
export type ToolPage = "formatter" | "type-checker";

export const TOOL_PATHS: Record<ToolPage, string> = {
  formatter: "lua-formatter",
  "type-checker": "luau-type-checker"
};

export type AppRoute =
  | { mode: "landing" }
  | { mode: "playground"; tool?: ToolPage }
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

  const tool = (Object.keys(TOOL_PATHS) as ToolPage[]).find((page) => TOOL_PATHS[page] === parts[0]);
  return tool ? { mode: "playground", tool } : { mode: "playground" };
}
