// Guards for the article pages: enough text to answer the query they target,
// search snippets that fit, and no links to pages that don't exist.
import { describe, expect, it } from "vitest";
import { type ArticlePage, articleHubs, guidePages, pagesWithCode } from "./articles";
import { TOOL_PATHS, type ToolPage } from "./routes";

/** Every piece of prose a page renders, including widgets' text; code and outputs aren't counted. */
function pageText(page: ArticlePage): string {
  return [
    page.answer,
    ...(page.outcomes ?? []),
    ...page.blocks.flatMap((block) => [
      block.heading ?? "",
      ...(block.text ?? []),
      ...(block.list ?? []),
      ...(block.table ? [...block.table.head, ...block.table.rows.flat()] : []),
      block.note ?? "",
      ...(block.trace?.steps.map((step) => step.say) ?? []),
      ...(block.quiz ? [block.quiz.question, block.quiz.why] : [])
    ]),
    ...(page.recap ?? []),
    ...(page.faq?.flat() ?? [])
  ].join(" ");
}

const words = (text: string) => text.split(/\s+/).filter((word) => /[a-z]/i.test(word)).length;

const allPages: Array<{ path: string; page: ArticlePage; minimum: number }> = [
  // Floors sit a little under what each kind of page has today, so a page can't quietly go thin again.
  ...articleHubs.examples.pages.map((page) => ({ path: `/examples/${page.slug}`, page, minimum: 300 })),
  ...articleHubs["learn-luau"].pages.map((page) => ({ path: `/learn-luau/${page.slug}`, page, minimum: 650 })),
  ...(Object.keys(guidePages) as ToolPage[]).map((tool) => ({
    path: `/${TOOL_PATHS[tool]}`,
    page: guidePages[tool],
    minimum: tool === "lua-vs-luau" || tool === "lua51-vs-lua54" || tool === "pattern-tester" ? 750 : tool === "table-to-json" ? 600 : 350
  }))
];

const knownPaths = new Set([
  "/",
  "/playground",
  ...Object.values(TOOL_PATHS).map((path) => `/${path}`),
  ...Object.entries(articleHubs).flatMap(([section, hub]) => [`/${section}`, ...hub.pages.map((page) => `/${section}/${page.slug}`)])
]);

describe("article pages", () => {
  it.each(allPages)("$path has enough text to answer its query", ({ page, minimum }) => {
    expect(words(pageText(page))).toBeGreaterThanOrEqual(minimum);
  });

  it.each(allPages)("$path has a title and description that fit in search results", ({ page }) => {
    expect(page.metaTitle.length).toBeLessThanOrEqual(66);
    expect(page.description.length).toBeGreaterThanOrEqual(110);
    expect(page.description.length).toBeLessThanOrEqual(170);
  });

  it("gives every page its own title and description", () => {
    const pages = [...allPages.map(({ page }) => page), ...Object.values(articleHubs)];
    expect(new Set(pages.map((page) => page.metaTitle)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
  });

  it("links only to pages that exist", () => {
    const texts = [
      ...allPages.flatMap(({ page }) => [pageText(page), ...(page.related ?? []).map(([, href]) => `[x](${href})`)]),
      ...Object.values(articleHubs).flatMap((hub) => [...hub.intro, ...(hub.blocks ?? []).flatMap((block) => [...(block.text ?? []), ...(block.list ?? [])]), ...(hub.faq?.flat() ?? [])])
    ];
    const internal = texts.flatMap((text) => [...text.matchAll(/\]\((\/[^)#\s]*)/g)].map((match) => match[1]));
    expect(internal.length).toBeGreaterThan(40);
    expect(internal.filter((path) => !knownPaths.has(path))).toEqual([]);
  });

  it("gives each guide the slug its route serves", () => {
    for (const tool of Object.keys(guidePages) as ToolPage[]) expect(guidePages[tool].slug).toBe(TOOL_PATHS[tool]);
  });

  it("keeps quiz answers and headings well formed", () => {
    for (const { page } of pagesWithCode()) {
      const headings = page.blocks.flatMap((block) => (block.heading ? [block.heading] : []));
      expect(new Set(headings).size).toBe(headings.length);
      for (const block of page.blocks) {
        if (block.quiz) expect(block.quiz.options[block.quiz.answer]).toBeDefined();
      }
    }
  });
});
