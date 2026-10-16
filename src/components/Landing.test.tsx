import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { readProjectShareHash } from "../lib/codec";
import { getAppRoute } from "../lib/routes";
import { HERO_CODE, HERO_EMBED_SRC, Landing } from "./Landing";

describe("homepage hero", () => {
  it("embeds the same snippet it previews", async () => {
    const url = new URL(HERO_EMBED_SRC, "https://weblua.com");
    expect(getAppRoute(url.pathname, url.hash)).toEqual({ mode: "embed" });
    expect(await readProjectShareHash(url.hash)).toEqual({
      flavor: "lua54",
      entry: "fibonacci.lua",
      files: { "fibonacci.lua": HERO_CODE.map((line) => `${line.text}\n`).join("") }
    });
  });

  it("swaps the preview for the live editor on click", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(() => root.render(<Landing theme="dark" onToggleTheme={() => {}} />));
    expect(container.querySelector("iframe")).toBeNull();

    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Try it live");
    await act(() => button!.click());
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(HERO_EMBED_SRC);

    await act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});
