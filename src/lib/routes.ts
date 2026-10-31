/** Tool pages that open the playground on one tool's demo. */
export type PlaygroundTool =
  | "formatter"
  | "type-checker"
  | "bytecode"
  | "lua"
  | "luau"
  | "lua-vs-luau"
  | "lua51-vs-lua54";

/** Tool pages with their own small UI in place of the editor. */
export type StandaloneTool = "pattern-tester" | "table-to-json";

/** Routes that open on one tool, each with its own prerendered page text. */
export type ToolPage = PlaygroundTool | StandaloneTool;

export const TOOL_PATHS: Record<ToolPage, string> = {
  formatter: "lua-formatter",
  "type-checker": "luau-type-checker",
  bytecode: "luau-bytecode-viewer",
  lua: "lua",
  luau: "luau",
  "lua-vs-luau": "lua-vs-luau",
  "lua51-vs-lua54": "lua-5-1-vs-5-4",
  "pattern-tester": "lua-pattern-tester",
  "table-to-json": "lua-table-to-json"
};

export function isStandaloneTool(tool: ToolPage): tool is StandaloneTool {
  return tool === "pattern-tester" || tool === "table-to-json";
}

/** Static content pages: a hub at /<section> and one page per slug below it. */
export type ArticleSection = "examples" | "learn-luau";

export type AppRoute =
  | { mode: "landing" }
  | { mode: "playground"; tool?: ToolPage }
  | { mode: "embed" }
  | { mode: "article"; section: ArticleSection; slug?: string };

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

  if (parts[0] === "examples" || parts[0] === "learn-luau") {
    return parts[1] ? { mode: "article", section: parts[0], slug: parts[1] } : { mode: "article", section: parts[0] };
  }

  const tool = (Object.keys(TOOL_PATHS) as ToolPage[]).find((page) => TOOL_PATHS[page] === parts[0]);
  return tool ? { mode: "playground", tool } : { mode: "playground" };
}
