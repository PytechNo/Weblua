import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_DECOMPRESSED_BYTES,
  SharePayloadTooLargeError,
  decodeProject,
  decodeSnippet,
  encodeProject,
  encodeSnippet,
  makeProjectShareHash,
  makeShareHash,
  readProjectShareHash,
  readShareHash,
  tryMakeProjectShareHash
} from "./codec";

function pseudoRandomText(length: number): string {
  let state = 0x6d2b79f5;
  const characters = new Array<string>(length);
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    characters[index] = String.fromCharCode(33 + (state % 94));
  }
  return characters.join("");
}

async function deflateRaw(input: string): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(new TextEncoder().encode(input)).then(() => writer.close());
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

describe("project share codec", () => {
  it("round trips all project files, entry path, and runtime through v2", async () => {
    const project = {
      flavor: "lua53" as const,
      entry: "main.lua",
      files: {
        "lib/math.lua": "return { answer = 42 }",
        "main.lua": "local math = require('lib.math')\nprint(math.answer)"
      }
    };

    expect(await decodeProject(await encodeProject(project))).toEqual(project);
    expect(await readProjectShareHash(await makeProjectShareHash(project))).toEqual(project);
  });

  it("serializes v2 projects deterministically regardless of source-map insertion order", async () => {
    const first = {
      flavor: "luau" as const,
      entry: "main.luau",
      files: { "z.luau": "return 3", "main.luau": "return require('z')", "a.luau": "return 1" }
    };
    const second = {
      flavor: "luau" as const,
      entry: "main.luau",
      files: { "a.luau": "return 1", "main.luau": "return require('z')", "z.luau": "return 3" }
    };

    expect(await encodeProject(first)).toBe(await encodeProject(second));
  });

  it("upgrades raw-DEFLATE v1 snippets to one-file projects", async () => {
    const snippet = { flavor: "lua52" as const, code: "print('v1 link')" };
    const encodedV1 = await encodeSnippet(snippet);

    expect(await decodeProject(encodedV1)).toEqual({
      flavor: "lua52",
      entry: "main.lua",
      files: { "main.lua": snippet.code }
    });
    expect(await decodeSnippet(encodedV1)).toEqual(snippet);
  });

  it("keeps legacy lz-string hashes readable as snippets and projects", async () => {
    const snippet = { flavor: "lua54" as const, code: "print('legacy link')" };
    const legacyHash =
      "#share=" +
      compressToEncodedURIComponent(JSON.stringify({ v: 1, code: snippet.code, flavor: snippet.flavor }));

    expect(await readShareHash(legacyHash)).toEqual(snippet);
    expect(await readProjectShareHash(legacyHash)).toEqual({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": snippet.code }
    });
  });

  it("keeps the snippet compatibility API while writing a v2 one-file share", async () => {
    const snippet = { flavor: "luau" as const, code: "print('still supported')" };
    const hash = await makeShareHash(snippet);

    expect(hash).toMatch(/^#c=2/);
    expect(await readShareHash(hash)).toEqual(snippet);
  });

  it("rejects invalid payloads and decompression bombs", async () => {
    expect(await decodeProject("not-a-share")).toBeNull();
    expect(await decodeProject("2not-base64!")).toBeNull();

    const bombProject = JSON.stringify({
      v: 2,
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": "x".repeat(MAX_SHARE_DECOMPRESSED_BYTES + 1) }
    });
    const bomb = "2" + toBase64Url(await deflateRaw(bombProject));
    expect(bomb.length).toBeLessThan(32 * 1024);
    expect(await decodeProject(bomb)).toBeNull();
  });

  it("caps newly encoded links and exposes a non-throwing UI helper", async () => {
    const project = {
      flavor: "lua54" as const,
      entry: "main.lua",
      files: { "main.lua": pseudoRandomText(40_000) }
    };

    await expect(encodeProject(project)).rejects.toBeInstanceOf(SharePayloadTooLargeError);
    await expect(tryMakeProjectShareHash(project)).resolves.toBeNull();
  });
});
