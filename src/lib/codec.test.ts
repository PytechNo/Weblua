import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";
import { decodeSnippet, encodeSnippet, makeShareHash, readShareHash } from "./codec";

describe("snippet codec", () => {
  it("round trips code and flavor", async () => {
    const snippet = {
      flavor: "lua54" as const,
      code: "local x = 41\nprint(x + 1)"
    };

    expect(await decodeSnippet(await encodeSnippet(snippet))).toEqual(snippet);
  });

  it("reads share hashes", async () => {
    const snippet = {
      flavor: "luau" as const,
      code: "local value: number = 12\nprint(value)"
    };

    expect(await readShareHash(await makeShareHash(snippet))).toEqual(snippet);
  });

  it("reads legacy lz-string share hashes", async () => {
    const snippet = {
      flavor: "lua54" as const,
      code: "print('legacy link')"
    };
    const legacyHash =
      "#share=" +
      compressToEncodedURIComponent(JSON.stringify({ v: 1, code: snippet.code, flavor: snippet.flavor }));

    expect(await readShareHash(legacyHash)).toEqual(snippet);
  });

  it("rejects invalid payloads", async () => {
    expect(await decodeSnippet("not-a-share")).toBeNull();
  });
});
