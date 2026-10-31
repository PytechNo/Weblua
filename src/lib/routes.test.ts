import { describe, expect, it } from "vitest";
import sitemap from "../../public/sitemap.xml?raw";
import { articleHubs } from "./articles";
import { getAppRoute, TOOL_PATHS } from "./routes";

describe("app routes", () => {
  it("serves the landing page at the root", () => {
    expect(getAppRoute("/", "")).toEqual({ mode: "landing" });
  });

  it("keeps legacy share links on the playground", () => {
    expect(getAppRoute("/", "#share=abc").mode).toBe("playground");
  });

  it("keeps deflate share links on the playground", () => {
    expect(getAppRoute("/", "#c=1Labc").mode).toBe("playground");
  });

  it("serves the playground at /playground", () => {
    expect(getAppRoute("/playground", "").mode).toBe("playground");
  });

  it("opens the tool pages on the playground", () => {
    expect(getAppRoute("/lua-formatter", "")).toEqual({ mode: "playground", tool: "formatter" });
    expect(getAppRoute("/luau-type-checker", "#c=1Labc")).toEqual({ mode: "playground", tool: "type-checker" });
    expect(getAppRoute("/playground", "")).toEqual({ mode: "playground" });
  });

  it("opens the new tool pages and article pages", () => {
    expect(getAppRoute("/lua-vs-luau", "")).toEqual({ mode: "playground", tool: "lua-vs-luau" });
    expect(getAppRoute("/lua-pattern-tester", "")).toEqual({ mode: "playground", tool: "pattern-tester" });
    expect(getAppRoute("/examples", "")).toEqual({ mode: "article", section: "examples" });
    expect(getAppRoute("/learn-luau/tables", "")).toEqual({ mode: "article", section: "learn-luau", slug: "tables" });
  });

  it("lists every tool and article page in the sitemap", () => {
    const paths = [
      ...Object.values(TOOL_PATHS),
      ...Object.entries(articleHubs).flatMap(([section, hub]) => [section, ...hub.pages.map((page) => `${section}/${page.slug}`)])
    ];
    for (const path of paths) expect(sitemap).toContain(`<loc>https://weblua.com/${path}</loc>`);
  });

  it("resolves embed routes", () => {
    expect(getAppRoute("/embed", "")).toEqual({ mode: "embed" });
    expect(getAppRoute("/embed/anything", "")).toEqual({ mode: "embed" });
  });
});
