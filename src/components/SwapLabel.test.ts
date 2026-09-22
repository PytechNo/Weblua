// @vitest-environment node
//
// The slot only holds its width if the markup stacks both copies in one grid
// cell, so the structure is asserted from the component and the stacking rules
// from the stylesheet source.
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { SwapLabel } from "./SwapLabel";

type Rendered = {
  props: {
    className: string;
    children: Array<{ props: { children: string; "aria-hidden"?: string | boolean } }>;
  };
};

let stylesheet = "";
let app = "";

beforeAll(async () => {
  const decoder = new TextDecoder();
  stylesheet = decoder.decode(await readFile("src/styles.css"));
  app = decoder.decode(await readFile("src/App.tsx"));
});

describe("the swapping button label", () => {
  it("renders the current word beside a hidden copy of the widest one", () => {
    const label = SwapLabel({ children: "Run", widest: "Running" }) as Rendered;
    const [current, ghost] = label.props.children;

    expect(label.props.className).toBe("swap-label");
    expect(current.props.children).toBe("Run");
    expect(ghost.props.children).toBe("Running");
  });

  it("keeps the ghost out of the accessibility tree", () => {
    const label = SwapLabel({ children: "Check", widest: "Checking" }) as Rendered;
    const [current, ghost] = label.props.children;

    expect(current.props["aria-hidden"]).toBeUndefined();
    expect(ghost.props["aria-hidden"]).toBe("true");
  });

  it("stacks both copies in a single grid cell", () => {
    expect(stylesheet).toMatch(/\.swap-label\s*\{[^}]*display:\s*grid/);
    expect(stylesheet).toMatch(/\.swap-label > span\s*\{[^}]*grid-area:\s*1 \/ 1/);
    expect(stylesheet).toMatch(/\.swap-label > span \+ span\s*\{[^}]*visibility:\s*hidden/);
  });

  it("gives every toolbar call site a widest word no shorter than its states", () => {
    const callSites = [...app.matchAll(
      /<SwapLabel widest="(\w+)">\{\w+ \? "(\w+)" : "(\w+)"\}<\/SwapLabel>/g
    )];

    expect(callSites.length).toBeGreaterThan(0);
    for (const [, widest, busy, idle] of callSites) {
      expect(widest.length).toBeGreaterThanOrEqual(busy.length);
      expect(widest.length).toBeGreaterThanOrEqual(idle.length);
    }
  });
});
