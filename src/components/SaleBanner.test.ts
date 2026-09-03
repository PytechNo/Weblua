// @vitest-environment node
//
// The domain notice is desktop-only. jsdom does not apply media queries to
// stylesheets, so the breakpoint rule is asserted against the stylesheet source
// instead; the element structure is asserted from the component itself.
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { SaleBanner } from "./SaleBanner";

/** Width below which the landing page switches to its mobile layout. */
const MOBILE_BREAKPOINT = 880;

let stylesheet = "";

/** Returns the body of `@media (max-width: <width>px)`, or null if absent. */
function mediaBlock(css: string, width: number): string | null {
  const header = `@media (max-width: ${width}px) {`;
  const start = css.indexOf(header);
  if (start === -1) return null;

  let depth = 0;
  for (let index = start + header.length - 1; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start + header.length, index);
    }
  }
  return null;
}

/** Every `--sale-banner-height` value declared inside media queries at or below `width`. */
function narrowBannerHeights(css: string, width: number): string[] {
  const values: string[] = [];
  for (const match of css.matchAll(/@media \(max-width: (\d+)px\)/g)) {
    const breakpoint = Number(match[1]);
    if (breakpoint > width) continue;

    const block = mediaBlock(css, breakpoint) ?? "";
    for (const declaration of block.matchAll(/--sale-banner-height:\s*([^;]+);/g)) {
      values.push(declaration[1].trim());
    }
  }
  return values;
}

beforeAll(async () => {
  stylesheet = new TextDecoder().decode(await readFile("src/styles.css"));
});

describe("the domain sale banner", () => {
  it("renders a labelled banner with an inquiry link on desktop", () => {
    const banner = SaleBanner() as {
      props: { className: string; "aria-label": string; children: unknown[] };
    };

    expect(banner.props.className).toBe("sale-banner");
    expect(banner.props["aria-label"]).toBe("Domain sale notice");
    expect(banner.props.children).toHaveLength(2);
  });

  it("is hidden at the mobile breakpoint", () => {
    const block = mediaBlock(stylesheet, MOBILE_BREAKPOINT);

    expect(block).not.toBeNull();
    expect(block).toMatch(/\.sale-banner\s*\{[^}]*display:\s*none/);
  });

  it("collapses its reserved height so the nav sits at the viewport top", () => {
    const block = mediaBlock(stylesheet, MOBILE_BREAKPOINT);

    expect(block).toMatch(/--sale-banner-height:\s*0px/);
  });

  it("is not given a height again by any narrower breakpoint", () => {
    for (const value of narrowBannerHeights(stylesheet, MOBILE_BREAKPOINT)) {
      expect(value).toBe("0px");
    }
  });

  it("still reserves space on desktop", () => {
    expect(stylesheet).toMatch(/:root\s*\{[^}]*--sale-banner-height:\s*40px/);
  });

  it("keeps the layout tied to the variable rather than a hard-coded offset", () => {
    // The nav, the skip link, and section scroll offsets all follow the
    // variable, so zeroing it on mobile is enough to reclaim the space.
    expect(stylesheet).toMatch(/\.nav\s*\{[^}]*inset:\s*var\(--sale-banner-height\)/);
    expect(stylesheet).toContain("top: calc(var(--sale-banner-height) + 12px)");
    expect(stylesheet).toContain(
      "scroll-margin-top: calc(var(--sale-banner-height) + var(--nav-height))"
    );
  });
});
