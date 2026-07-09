import { describe, expect, it } from "vitest";
import { getAppRoute } from "./routes";

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

  it("resolves embed routes", () => {
    expect(getAppRoute("/embed", "")).toEqual({ mode: "embed" });
    expect(getAppRoute("/embed/anything", "")).toEqual({ mode: "embed" });
  });
});
