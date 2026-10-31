// @vitest-environment node
//
// The pattern tester and table converter generate Lua and read what it prints,
// so they are tested on the real runtimes.
import { describe, expect, it } from "vitest";
import { buildPatternScript, parsePatternOutput, type PatternReport } from "../lib/patternTester";
import { buildLuaToJsonScript, jsonToLua, parseLuaToJsonOutput } from "../lib/tableJson";
import type { RuntimeFlavor } from "../lib/types";
import { runProjectForTest } from "./runtimeTestHost";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

async function runScript(code: string, flavor: RuntimeFlavor) {
  const entry = flavor === "luau" ? "main.luau" : "main.lua";
  return runProjectForTest({ flavor, entry, files: { [entry]: code } });
}

async function test(pattern: string, subject: string, flavor: RuntimeFlavor = "lua54", replacement = "") {
  const report = parsePatternOutput(await runScript(buildPatternScript(pattern, subject, replacement), flavor));
  return report as Extract<PatternReport, { ok: true }>;
}

describe("the pattern tester", () => {
  it("lists every match with positions and captures", async () => {
    const report = await test("(%w+)=(%w+)", "a=1, bb=22", "lua54", "%2=%1");
    expect(report.matches.map(({ first, last }) => [first, last])).toEqual([[1, 3], [6, 10]]);
    expect(report.matches[1].captures.map((capture) => capture.kind === "string" && decode(capture.bytes))).toEqual(["bb", "22"]);
    expect(report.gsub.count).toBe(2);
    expect(decode(report.gsub.bytes)).toBe("1=a, 22=bb");
  });

  it("reports position captures as numbers", async () => {
    const report = await test("()ll()", "hello");
    expect(report.matches[0].captures).toEqual([{ kind: "position", value: 3 }, { kind: "position", value: 5 }]);
  });

  it.each([
    ["lua51", 4],
    ["luau", 4],
    ["lua53", 2],
    ["lua55", 2]
  ] as const)("follows %s's gmatch on empty matches after a match", async (flavor, count) => {
    const report = await test("%a*", "abc d", flavor);
    expect(report.matches).toHaveLength(count);
    expect(report.gsub.count).toBe(count);
  });

  it("treats a leading ^ as an anchor with one match", async () => {
    expect((await test("^%a", "abc")).matches).toHaveLength(1);
  });

  it("passes any bytes through, including quotes and backslashes", async () => {
    const report = await test('"\\', 'say "\\hi"');
    expect(report.matches.map((match) => match.first)).toEqual([5]);
  });

  it("returns Lua's error for a malformed pattern", async () => {
    const report = parsePatternOutput(await runScript(buildPatternScript("[a", "x", ""), "lua54"));
    expect(report).toEqual({ ok: false, error: "malformed pattern (missing ']')" });
  });
});

describe("Lua table to JSON", () => {
  const convert = async (source: string) => parseLuaToJsonOutput(await runScript(buildLuaToJsonScript(source), "lua54"));

  it("turns sequences into arrays and other tables into sorted objects", async () => {
    expect(await convert(`{ name = "weblua", tags = { "lua", "luau" }, [2] = true, version = 1.5, count = 3, empty = {} }`)).toEqual({
      ok: true,
      json: [
        "{",
        '  "2": true,',
        '  "count": 3,',
        '  "empty": [],',
        '  "name": "weblua",',
        '  "tags": [',
        '    "lua",',
        '    "luau"',
        "  ],",
        '  "version": 1.5',
        "}"
      ].join("\n")
    });
  });

  it("escapes strings and keeps floats exact", async () => {
    expect(await convert(`{ 'quote " backslash \\\\ newline \\n', 0.1, -0.0, 1e300 }`)).toEqual({
      ok: true,
      json: '[\n  "quote \\" backslash \\\\ newline \\n",\n  0.1,\n  -0,\n  1e+300\n]'
    });
  });

  it("accepts a chunk that returns the table", async () => {
    expect(await convert("local t = {}\nfor i = 1, 3 do t[i] = i * i end\nreturn t")).toEqual({ ok: true, json: "[\n  1,\n  4,\n  9\n]" });
  });

  it.each([
    ["{ f = print }", "a function has no JSON form"],
    ["{ 1 / 0 }", "JSON has no NaN or infinity, so inf cannot be converted"],
    ["(function() local t = {} t.self = t return t end)()", "the table contains itself, which JSON cannot represent"],
    ['{ [1] = "a", ["1"] = "b", x = 1 }', 'two keys both become "1" in JSON'],
    ["{ ", "table:1: unexpected symbol near <eof>"]
  ])("reports %s as an error", async (source, error) => {
    expect(await convert(source)).toEqual({ ok: false, error });
  });
});

describe("JSON to a Lua table", () => {
  it("writes a constructor that Lua reads back to the same JSON", async () => {
    const json = '{"name":"weblua","end":true,"list":[1,2.5,null],"nested":{"a b":"line\\nbreak"},"empty":{}}';
    const lua = jsonToLua(json);
    expect(lua).toBe(
      [
        "{",
        '  name = "weblua",',
        '  ["end"] = true,',
        "  list = {",
        "    1,",
        "    2.5,",
        "    nil",
        "  },",
        "  nested = {",
        '    ["a b"] = "line\\nbreak"',
        "  },",
        "  empty = {}",
        "}"
      ].join("\n")
    );
    expect(await (async () => {
      const result = await runScript(`local t = ${lua}\nprint(t.name, t["end"], t.list[2], t.nested["a b"])`, "lua51");
      return result.chunks.map((chunk) => chunk.text);
    })()).toEqual(["weblua\ttrue\t2.5\tline", "break"]);
  });

  it("escapes control characters so a following digit stays separate", () => {
    expect(jsonToLua('"\\u00011"')).toBe('"\\0011"');
  });
});
