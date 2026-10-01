// @vitest-environment node
//
// Runs the real analyzer wasm. These pin down the behavior Weblua depends on
// from @luau-rs/luau, including the internal require-resolution hooks, so a
// dependency upgrade that changes any of it fails here first.
import { Analysis } from "@luau-rs/luau/analysis";
import { describe, expect, it } from "vitest";
import { mergeDiagnostics } from "../lib/diagnostics";
import { examples, projectForExample } from "../lib/examples";
import type { Diagnostic, ProjectPayload } from "../lib/types";
import {
  handleAnalysisRequest,
  LuauAnalysisSession,
  WEBLUA_LUAU_DEFINITIONS
} from "./luauAnalysisSession";
import { checkProjectForTest } from "./runtimeTestHost";

async function createSession(): Promise<LuauAnalysisSession> {
  const analysis = await Analysis.create({
    mode: "strict",
    lint: true,
    definitions: [{ name: "weblua", source: WEBLUA_LUAU_DEFINITIONS }]
  });
  return new LuauAnalysisSession(analysis);
}

function luauProject(files: Record<string, string>, entry = "main.luau"): ProjectPayload {
  return { flavor: "luau", entry, files };
}

async function check(
  files: Record<string, string>,
  mode: "strict" | "nonstrict" = "strict",
  checked = Object.keys(files)
): Promise<Diagnostic[]> {
  const session = await createSession();
  session.sync(luauProject(files), mode);
  return session.check(checked);
}

const messages = (diagnostics: Diagnostic[]) => diagnostics.map((diagnostic) => diagnostic.message);
const errorsOnly = (diagnostics: Diagnostic[]) =>
  diagnostics.filter((diagnostic) => diagnostic.severity === "error");

describe("LuauAnalysisSession diagnostics", () => {
  it("reports type errors with one-based column spans", async () => {
    const diagnostics = await check({
      "main.luau": `local label = "count"\nlocal n: number = "two"\nprint(label, n)\n`
    });

    expect(diagnostics).toEqual([
      {
        file: "main.luau",
        filename: "main.luau",
        line: 2,
        column: 19,
        endLine: 2,
        endColumn: 24,
        message: "Expected this to be 'number', but got 'string'",
        severity: "error",
        source: "type",
        code: expect.any(String)
      }
    ]);
  });

  it("reports lints as warnings named by their lint code", async () => {
    const diagnostics = await check({ "main.luau": "local unused = 1\n" });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        line: 1,
        severity: "warning",
        source: "lint",
        code: "LocalUnused"
      })
    ]);
  });

  it("knows the read() global the Weblua runtime adds", async () => {
    const accepted = await check({
      "main.luau": `local line: string? = read()\nlocal rest = read("*a")\nprint(line, rest)\n`
    });
    expect(accepted).toEqual([]);

    const rejected = await check({ "main.luau": `print(read(5))\n` });
    expect(errorsOnly(rejected)).toHaveLength(1);
  });

  it("resolves requires the way the Weblua runtime does", async () => {
    const diagnostics = await check(
      {
        "main.luau": [
          `local dotted = require("lib.util")`,
          `local slashed = require("lib/util")`,
          `local config = require("lib.config")`,
          `local a: string = dotted.value`,
          `local b: string = slashed.value`,
          `local c: number = config.name`,
          `print(a, b, c)`
        ].join("\n"),
        "lib/util.luau": `return { value = 1 }\n`,
        "lib/config/init.luau": `return { name = "weblua" }\n`
      },
      "strict",
      ["main.luau"]
    );

    expect(diagnostics.map((diagnostic) => [diagnostic.line, diagnostic.message])).toEqual([
      [4, "Expected this to be 'string', but got 'number'"],
      [5, "Expected this to be 'string', but got 'number'"],
      [6, "Expected this to be 'number', but got 'string'"]
    ]);
  });

  it("resolves root-relative requires from a nested file", async () => {
    const diagnostics = await check(
      {
        "main.luau": `require("lib.a")\n`,
        "lib/a.luau": `local util = require("util")\nlocal n: string = util.kind\nreturn n\n`,
        "util.luau": `return { kind = 1 }\n`,
        "lib/util.luau": `return { kind = "nested" }\n`
      },
      "strict",
      ["lib/a.luau"]
    );

    // Weblua resolves "util" from the project root, never beside lib/a.luau.
    expect(messages(diagnostics)).toEqual(["Expected this to be 'string', but got 'number'"]);
  });

  it("resolves ./, ../, and @self requires the way the Weblua runtime does", async () => {
    const diagnostics = await check({
      "main.luau": [
        `local a = require("./lib/a")`,
        `local c = require("./lib/c")`,
        `local x: number = a.value`,
        `local y: number = c.value`,
        `print(x, y)`
      ].join("\n"),
      "lib/a.luau": `local b = require("../b")\nlocal s: string = b.value\nreturn { value = s }\n`,
      "b.luau": `return { value = 1 }\n`,
      // In an init file, ./ is the folder holding its folder, and @self/ is its own.
      "lib/c/init.luau": [
        `local d = require("@self/d")`,
        `local e = require("./e")`,
        `local t: string = d.value`,
        `local u: string = e.value`,
        `return { value = t .. u }`
      ].join("\n"),
      "lib/c/d.luau": `return { value = 2 }\n`,
      "lib/e.luau": `return { value = 3 }\n`
    });

    expect(diagnostics.map((diagnostic) => [diagnostic.file, diagnostic.line, diagnostic.message])).toEqual([
      ["lib/a.luau", 2, "Expected this to be 'string', but got 'number'"],
      ["lib/c/init.luau", 3, "Expected this to be 'string', but got 'number'"],
      ["lib/c/init.luau", 4, "Expected this to be 'string', but got 'number'"],
      ["main.luau", 3, "Expected this to be 'number', but got 'string'"],
      ["main.luau", 4, "Expected this to be 'number', but got 'string'"]
    ]);
  });

  it("rejects the requires the runtime rejects", async () => {
    const diagnostics = await check({
      "main.luau": `local a = require("@lib/a")\nlocal b = require("../b")\nprint(a, b)\n`,
      "lib/a.luau": `return 1\n`,
      "b.luau": `return 1\n`
    });

    // No @ aliases besides @self, and nothing above the project root.
    expect(errorsOnly(diagnostics).map((diagnostic) => [diagnostic.line, diagnostic.message])).toEqual([
      [1, expect.stringContaining("Unknown require")],
      [2, expect.stringContaining("Unknown require")]
    ]);
  });

  it("knows the task library the Weblua runtime adds", async () => {
    const diagnostics = await check({
      "main.luau": [
        `local function greet(name: string, times: number) print(name, times) end`,
        `local thread = task.spawn(greet, "spawned", 1)`,
        `task.defer(greet, "deferred", 2)`,
        `task.delay(0.5, greet, "delayed", 3)`,
        `local waited: number = task.wait()`,
        `task.cancel(thread)`,
        `print(waited)`
      ].join("\n")
    });
    expect(diagnostics).toEqual([]);

    const misuse = await check({ "main.luau": `task.wait("soon")\ntask.cancel(1)\n` });
    expect(errorsOnly(misuse).map((diagnostic) => diagnostic.line)).toEqual([1, 2]);
  });

  it("finds no type errors in the built-in Luau examples", async () => {
    const session = await createSession();
    for (const example of examples) {
      const project = projectForExample(example);
      if (project.flavor !== "luau") continue;

      session.sync(project, "strict");
      const errors = errorsOnly(session.check(Object.keys(project.files)));
      expect({ example: example.id, errors: messages(errors) }).toEqual({ example: example.id, errors: [] });
    }
  });

  it("reports a require that names no project file", async () => {
    const diagnostics = await check({ "main.luau": `local missing = require("lib.missing")\nprint(missing)\n` });

    expect(errorsOnly(diagnostics)).toEqual([
      expect.objectContaining({ line: 1, source: "type", message: expect.stringContaining("Unknown require") })
    ]);
  });

  it("follows edits, renames, and deletions between requests", async () => {
    const session = await createSession();
    const main = `local util = require("lib.util")\nlocal n: number = util.value\nprint(n)\n`;

    session.sync(luauProject({ "main.luau": main, "lib/util.luau": "return { value = 1 }\n" }), "strict");
    expect(session.check(["main.luau"])).toEqual([]);

    session.sync(luauProject({ "main.luau": main, "lib/util.luau": `return { value = "one" }\n` }), "strict");
    expect(messages(session.check(["main.luau"]))).toEqual(["Expected this to be 'number', but got 'string'"]);

    session.sync(luauProject({ "main.luau": main, "lib/helpers.luau": "return { value = 1 }\n" }), "strict");
    expect(messages(errorsOnly(session.check(["main.luau"])))).toEqual([
      expect.stringContaining("Unknown require")
    ]);
  });

  it("lets hot comments override the default mode", async () => {
    const mismatch = `local n: number = "two"\nprint(n)\n`;

    expect(await check({ "main.luau": `--!nocheck\n${mismatch}` }, "strict")).toEqual([]);
    expect(await check({ "main.luau": mismatch }, "nonstrict")).toEqual([]);
    expect(errorsOnly(await check({ "main.luau": `--!strict\n${mismatch}` }, "nonstrict"))).toHaveLength(1);
  });

  it("collapses repeated reports of one problem at one span", async () => {
    const diagnostics = await check({
      "main.luau": [
        "local vector = {}",
        "vector.__index = vector",
        "function vector.new(x, y)",
        "  return setmetatable({ x = x, y = y }, vector)",
        "end",
        "function vector:len()",
        "  return math.sqrt(self.x * self.x + self.y * self.y)",
        "end",
        "print(vector.new(3, 4):len())"
      ].join("\n")
    });

    const spans = diagnostics.map((diagnostic) =>
      [diagnostic.line, diagnostic.column, diagnostic.endColumn, diagnostic.message].join(":")
    );
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(new Set(spans).size).toBe(spans.length);
  });

  it("drops type errors about names the parser could not read", async () => {
    const diagnostics = await check({
      "main.luau": `type Item = { name: string }\nlocal item: Item = { name = "a" }\nprint(item.)\n`
    });

    expect(messages(diagnostics)).toEqual(["Expected identifier, got ')'"]);
  });

  it("checks only the files it is asked about", async () => {
    const diagnostics = await check(
      {
        "main.luau": `local n: number = "two"\nprint(n)\n`,
        "other.luau": `local s: string = 1\nreturn s\n`
      },
      "strict",
      ["other.luau", "missing.luau"]
    );

    expect(diagnostics.map((diagnostic) => diagnostic.file)).toEqual(["other.luau"]);
  });
});

describe("LuauAnalysisSession editor queries", () => {
  it("completes table fields after a dot", async () => {
    const session = await createSession();
    const source = `local point = { x = 1, label = "origin" }\nprint(point.)\n`;
    session.sync(luauProject({ "main.luau": source }), "strict");

    const entries = session.complete("main.luau", { line: 1, column: 12 });

    expect(entries.map((entry) => [entry.label, entry.kind, entry.type])).toEqual(
      expect.arrayContaining([
        ["x", "property", "number"],
        ["label", "property", "string"]
      ])
    );
  });

  it("marks callable completions with the parentheses to insert", async () => {
    const session = await createSession();
    session.sync(luauProject({ "main.luau": `local s = "weblua"\nprint(s:)\n` }), "strict");

    const upper = session.complete("main.luau", { line: 1, column: 8 }).find((entry) => entry.label === "upper");

    expect(upper).toMatchObject({ kind: "property", parentheses: "cursorAfter", type: "(string) -> string" });
  });

  it("leaves the solver's @checked marker out of builtin types", async () => {
    const session = await createSession();
    session.sync(luauProject({ "main.luau": `print(math.floor(2.5))\n` }), "strict");

    expect(session.inspect("main.luau", { line: 0, column: 12 })).toEqual({ type: "(number) -> number" });
  });

  it("describes the symbol under the cursor", async () => {
    const session = await createSession();
    const source = `local function greet(name: string): string\n  return "hello, " .. name\nend\nprint(greet("luau"))\n`;
    session.sync(luauProject({ "main.luau": source }), "strict");

    expect(session.inspect("main.luau", { line: 3, column: 8 })).toEqual({
      name: "greet",
      type: "(string) -> string"
    });
    expect(session.inspect("main.luau", { line: 1, column: 23 })).toEqual({ name: "name", type: "string" });
    expect(session.inspect("missing.luau", { line: 0, column: 0 })).toBeNull();
  });

  it("answers worker requests by type", async () => {
    const session = await createSession();
    const project = luauProject({ "main.luau": `local n: number = "two"\nprint(n)\n` });

    expect(handleAnalysisRequest(session, { id: "1", type: "init" })).toBe(true);
    expect(
      handleAnalysisRequest(session, { id: "2", type: "check", project, mode: "strict", files: ["main.luau"] })
    ).toHaveLength(1);
    expect(
      handleAnalysisRequest(session, { id: "3", type: "check", project, mode: "nonstrict", files: ["main.luau"] })
    ).toEqual([]);
  });
});

describe("compile and analysis agreement", () => {
  it("keeps one copy of a syntax error both report, the analyzer's", async () => {
    const project = luauProject({ "main.luau": "local x = = 1\nprint(x)\n" });
    const compiled = await checkProjectForTest(project);
    const session = await createSession();
    session.sync(project, "strict");
    const analyzed = session.check(["main.luau"]);

    const syntax = (diagnostics: Diagnostic[]) =>
      diagnostics.filter((diagnostic) => diagnostic.message.startsWith("Expected identifier"));
    expect(syntax(compiled.diagnostics)).toHaveLength(1);
    expect(syntax(analyzed)).toHaveLength(1);

    const merged = syntax(mergeDiagnostics(compiled.diagnostics, analyzed));
    expect(merged).toEqual([expect.objectContaining({ line: 1, column: 11, source: "type" })]);
  });
});
