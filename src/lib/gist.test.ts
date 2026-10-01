import { describe, expect, it, vi } from "vitest";
import { exportProjectJson } from "./codec";
import { gistHash, gistIdFrom, GistLoadError, loadGistProject, projectFromGistFiles, readGistHash } from "./gist";

const ID = "aa5a315d61ae9438b18d";
const LONG_ID = "0123456789abcdef0123456789abcdef";

function gistResponse(files: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({ id: ID, files }), { status: 200, ...init });
}

describe("gist links", () => {
  it("round-trips a gist ID through the hash", () => {
    expect(gistHash(ID)).toBe(`#gist=${ID}`);
    expect(readGistHash(gistHash(LONG_ID))).toBe(LONG_ID);
    expect(readGistHash("#c=2abc")).toBeNull();
    expect(readGistHash("#gist=../../user")).toBeNull();
  });

  it("finds the ID in whatever is pasted", () => {
    expect(gistIdFrom(` ${LONG_ID} `)).toBe(LONG_ID);
    expect(gistIdFrom(`https://gist.github.com/${LONG_ID}`)).toBe(LONG_ID);
    expect(gistIdFrom(`https://gist.github.com/someone/${LONG_ID}`)).toBe(LONG_ID);
    expect(gistIdFrom(`https://gist.github.com/someone/${LONG_ID}/7d3c1a0e`)).toBe(LONG_ID);
    expect(gistIdFrom(`https://gist.githubusercontent.com/someone/${LONG_ID}/raw/main.luau`)).toBe(LONG_ID);
    expect(gistIdFrom(`https://weblua.com/playground#gist=${LONG_ID}`)).toBe(LONG_ID);
  });

  it("rejects text that names no gist", () => {
    expect(gistIdFrom("")).toBeNull();
    expect(gistIdFrom("not a gist")).toBeNull();
    expect(gistIdFrom(`https://github.com/someone/${LONG_ID}`)).toBeNull();
    expect(gistIdFrom("https://gist.github.com/someone/project-name")).toBeNull();
  });
});

describe("projectFromGistFiles", () => {
  it("opens a .weblua.json export with its folders, entry, and runtime", () => {
    const exported = exportProjectJson({
      flavor: "lua51",
      entry: "src/app.lua",
      files: { "src/app.lua": 'print(require("lib.util"))', "lib/util.lua": "return 1" }
    });

    expect(projectFromGistFiles({ "demo.weblua.json": { content: exported }, "README.md": { content: "hi" } })).toEqual({
      flavor: "lua51",
      entry: "src/app.lua",
      files: { "lib/util.lua": "return 1", "src/app.lua": 'print(require("lib.util"))' }
    });
  });

  it("turns plain Luau files into a flat project with main as its entry", () => {
    expect(
      projectFromGistFiles({
        "util.luau": { content: "return 1" },
        "main.luau": { content: 'print(require("./util"))' },
        "notes.md": { content: "ignored" }
      })
    ).toEqual({
      flavor: "luau",
      entry: "main.luau",
      files: { "main.luau": 'print(require("./util"))', "util.luau": "return 1" }
    });
  });

  it("runs plain .lua files as Lua 5.4 and picks an entry without main", () => {
    expect(projectFromGistFiles({ "b.lua": { content: "" }, "a.lua": { content: "" } })).toMatchObject({
      flavor: "lua54",
      entry: "a.lua"
    });
    expect(projectFromGistFiles({ "b.lua": { content: "" }, "init.lua": { content: "" } }).entry).toBe("init.lua");
  });

  it("explains gists it cannot open", () => {
    expect(() => projectFromGistFiles({ "notes.md": { content: "" } })).toThrow(/no \.lua, \.luau, or \.weblua\.json/);
    expect(() => projectFromGistFiles({ "a.weblua.json": { content: "{}" } })).toThrow(/not a valid Weblua project/);
    expect(() =>
      projectFromGistFiles({ "a.weblua.json": { content: "{}" }, "b.weblua.json": { content: "{}" } })
    ).toThrow(/more than one/);
    expect(() => projectFromGistFiles({ "main.lua": { content: "", truncated: true } })).toThrow(/too large/);
    expect(() => projectFromGistFiles({ "main.lua": { content: "x".repeat(1024 * 1024 + 1) } })).toThrow(
      /too large/
    );
    expect(() => projectFromGistFiles(undefined)).toThrow(GistLoadError);
  });
});

describe("loadGistProject", () => {
  it("reads the gist from GitHub's API", async () => {
    const fetchImpl = vi.fn(async () => gistResponse({ "main.luau": { content: "print(1)" } }));

    await expect(loadGistProject(ID, fetchImpl)).resolves.toEqual({
      flavor: "luau",
      entry: "main.luau",
      files: { "main.luau": "print(1)" }
    });
    expect(fetchImpl).toHaveBeenCalledWith(`https://api.github.com/gists/${ID}`, expect.anything());
  });

  it("never sends an ID that is not one", async () => {
    const fetchImpl = vi.fn();
    await expect(loadGistProject("../user", fetchImpl)).rejects.toThrow(GistLoadError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("says why GitHub refused", async () => {
    const respond = (response: Response) => vi.fn(async () => response);

    await expect(loadGistProject(ID, respond(new Response("", { status: 404 })))).rejects.toThrow(/no gist/);
    await expect(
      loadGistProject(ID, respond(new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0" } })))
    ).rejects.toThrow(/60 anonymous gist requests an hour/);
    await expect(loadGistProject(ID, respond(new Response("", { status: 500 })))).rejects.toThrow(/HTTP 500/);
    await expect(loadGistProject(ID, respond(new Response("<html>", { status: 200 })))).rejects.toThrow(
      /could not read/
    );
    await expect(
      loadGistProject(ID, async () => {
        throw new TypeError("Failed to fetch");
      })
    ).rejects.toThrow(/Could not reach GitHub/);
  });
});
