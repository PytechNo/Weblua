import { describe, expect, it } from "vitest";
import { decodeSnippet, encodeSnippet, makeShareHash, readShareHash } from "./codec";

describe("snippet codec", () => {
  it("round trips code and flavor", () => {
    const snippet = {
      flavor: "lua54" as const,
      code: "local x = 41\nprint(x + 1)"
    };

    expect(decodeSnippet(encodeSnippet(snippet))).toEqual(snippet);
  });

  it("reads share hashes", () => {
    const snippet = {
      flavor: "luau" as const,
      code: "local value: number = 12\nprint(value)"
    };

    expect(readShareHash(makeShareHash(snippet))).toEqual(snippet);
  });

  it("rejects invalid payloads", () => {
    expect(decodeSnippet("not-a-share")).toBeNull();
  });
});
