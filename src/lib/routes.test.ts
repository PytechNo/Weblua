import { describe, expect, it } from "vitest";
import { getAppRoute } from "./routes";

describe("app routes", () => {
  it("serves the landing page at the root", () => {
    expect(getAppRoute("/", "")).toEqual({ mode: "landing" });
  });

  it("keeps legacy share links on the playground", () => {
    expect(getAppRoute("/", "#share=abc").mode).toBe("playground");
  });

  it("serves the playground at /playground", () => {
    expect(getAppRoute("/playground", "").mode).toBe("playground");
  });

  it("resolves snippet routes", () => {
    expect(getAppRoute("/p/x7Kf2q", "")).toEqual({ mode: "snippet", id: "x7Kf2q" });
  });

  it("resolves embed routes with and without an id", () => {
    expect(getAppRoute("/embed/x7Kf2q", "")).toEqual({ mode: "embed", id: "x7Kf2q" });
    expect(getAppRoute("/embed", "")).toEqual({ mode: "embed", id: undefined });
  });
});
