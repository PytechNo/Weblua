import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProjectShareUrl,
  PROJECT_EXPORT_EXTENSION,
  readProjectShareHash,
  tryBuildProjectShareUrl
} from "./codec";
import { getAppRoute } from "./routes";
import type { ProjectPayload } from "./types";

const project: ProjectPayload = {
  flavor: "luau",
  entry: "main.luau",
  files: {
    "lib/greet.luau": "return {}",
    "main.luau": 'local greet = require("lib.greet")\nprint(greet)'
  }
};

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

beforeEach(() => {
  window.history.replaceState(null, "", "/playground?utm_source=newsletter#c=stale");
});

describe("Copy link", () => {
  it("points at /playground and drops any query string", async () => {
    const url = new URL(await buildProjectShareUrl(project));

    expect(url.pathname).toBe("/playground");
    expect(url.search).toBe("");
    expect(url.hash).toMatch(/^#c=2/);
  });

  it("round trips every file, the entry, and the runtime", async () => {
    const url = new URL(await buildProjectShareUrl(project));

    expect(await readProjectShareHash(url.hash)).toEqual(project);
  });

  it("replaces a stale hash rather than appending to it", async () => {
    const url = new URL(await buildProjectShareUrl(project));

    expect(url.hash.split("#").length).toBe(2);
    expect(url.hash).not.toContain("stale");
  });

  it("carries no preset input, which stays local to the browser", async () => {
    const url = new URL(await buildProjectShareUrl(project));
    const restored = await readProjectShareHash(url.hash);

    expect(restored).not.toBeNull();
    expect(restored && "stdin" in restored).toBe(false);
  });
});

describe("Copy iframe embed", () => {
  it("points at /embed with the same payload", async () => {
    const url = new URL(await buildProjectShareUrl(project, true));

    expect(url.pathname).toBe("/embed");
    expect(await readProjectShareHash(url.hash)).toEqual(project);
  });

  it("produces a URL the app resolves to embed mode", async () => {
    const url = new URL(await buildProjectShareUrl(project, true));

    expect(getAppRoute(url.pathname, url.hash)).toEqual({ mode: "embed" });
  });

  it("produces a Copy link URL the app resolves to the playground", async () => {
    const url = new URL(await buildProjectShareUrl(project));

    expect(getAppRoute(url.pathname, url.hash)).toEqual({ mode: "playground" });
  });
});

describe("projects too large for a link", () => {
  const oversized: ProjectPayload = {
    flavor: "lua54",
    entry: "main.lua",
    files: { "main.lua": pseudoRandomText(40_000) }
  };

  it("returns null so the UI can offer an export instead", async () => {
    expect(await tryBuildProjectShareUrl(oversized)).toBeNull();
    expect(await tryBuildProjectShareUrl(oversized, true)).toBeNull();
  });

  it("names the export extension the UI suggests", () => {
    expect(PROJECT_EXPORT_EXTENSION).toBe(".weblua.json");
  });
});
