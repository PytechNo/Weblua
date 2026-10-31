// @vitest-environment node
//
// The example pages, lessons, and comparison demos print outputs and make
// claims about runtimes, so every block runs here and must print what its page
// shows. The Luau ones must also type-check in strict mode, which is the mode
// the playground opens them in.
import { Analysis } from "@luau-rs/luau/analysis";
import { describe, expect, it } from "vitest";
import { articleHubs, exerciseSource } from "../lib/articles";
import { projectForExample, toolExamples } from "../lib/examples";
import type { ProjectPayload, RunResult, RuntimeFlavor } from "../lib/types";
import { LuauAnalysisSession, WEBLUA_LUAU_DEFINITIONS } from "./luauAnalysisSession";
import { runProjectForTest, stdoutOf } from "./runtimeTestHost";

function snippet(code: string, flavor: RuntimeFlavor): ProjectPayload {
  const entry = flavor === "luau" ? "main.luau" : "main.lua";
  return { flavor, entry, files: { [entry]: code } };
}

/** What an article shows: program output, without Weblua's status lines. */
function shown(result: RunResult): string {
  return result.chunks.filter((chunk) => chunk.kind !== "system").map((chunk) => chunk.text).join("\n");
}

const blocks = Object.values(articleHubs).flatMap((hub) =>
  hub.pages.flatMap((page) =>
    page.blocks.flatMap((block, index) => (block.code ? [{ name: `${page.slug} block ${index + 1}`, code: block.code }] : []))
  )
);
const exercises = Object.values(articleHubs).flatMap((hub) =>
  hub.pages.flatMap((page) => (page.exercise ? [{ slug: page.slug, exercise: page.exercise }] : []))
);

describe("article code blocks", () => {
  it.each(blocks)("$name prints what its page shows", async ({ code }) => {
    for (const [flavor, expected] of Object.entries(code.outputs)) {
      const result = await runProjectForTest(snippet(code.code, flavor as RuntimeFlavor));
      expect({ flavor, output: shown(result) }).toEqual({ flavor, output: expected });
    }
  });

  it("type-checks every Luau block and exercise solution in strict mode", async () => {
    const analysis = await Analysis.create({ mode: "strict", lint: true, definitions: [{ name: "weblua", source: WEBLUA_LUAU_DEFINITIONS }] });
    const session = new LuauAnalysisSession(analysis);
    const sources = [
      ...blocks.filter(({ code }) => code.flavor === "luau").map(({ name, code }) => [name, code.code]),
      ...exercises.flatMap(({ slug, exercise }) => [
        [`${slug} starter`, exerciseSource(exercise)],
        [`${slug} solution`, exerciseSource(exercise, exercise.solution)]
      ])
    ];
    const failures: string[] = [];
    for (const [name, code] of sources) {
      session.sync(snippet(code, "luau"), "strict");
      const errors = session.check(["main.luau"]).filter((diagnostic) => diagnostic.severity === "error");
      failures.push(...errors.map((error) => `${name} ${error.line}: ${error.message}`));
    }
    expect(failures).toEqual([]);
  });
});

describe("lesson exercises", () => {
  it.each(exercises)("$slug fails as shipped and passes with its solution", async ({ exercise }) => {
    const starter = stdoutOf(await runProjectForTest(snippet(exerciseSource(exercise), "luau")));
    const solved = stdoutOf(await runProjectForTest(snippet(exerciseSource(exercise, exercise.solution), "luau")));

    expect(starter.at(-1)).toMatch(/checks passed\. Keep going!$/);
    expect(solved).toEqual([...exercise.checks.map(([label]) => `✓ ${label}`), "All checks passed. Nice work!"]);
  });
});

describe("comparison page demos", () => {
  const outputs = async (tool: "lua-vs-luau" | "lua51-vs-lua54", flavor: RuntimeFlavor) =>
    stdoutOf(await runProjectForTest({ ...projectForExample(toolExamples[tool]), flavor }));

  it("shows Luau's library additions and missing loadstring next to Lua 5.1", async () => {
    const lua = await outputs("lua-vs-luau", "lua51");
    const luau = await outputs("lua-vs-luau", "luau");
    expect(lua).toContain("string.split:\tnil");
    expect(luau).toContain("string.split:\tfunction");
    expect(lua).toContain("loadstring:\tfunction");
    expect(luau).toContain("loadstring:\tnil");
  });

  it("shows 5.4's float division and integer limits next to Lua 5.1", async () => {
    const lua51 = await outputs("lua51-vs-lua54", "lua51");
    const lua54 = await outputs("lua51-vs-lua54", "lua54");
    expect(lua51).toContain("6 / 2 =\t3");
    expect(lua54).toContain("6 / 2 =\t3.0");
    expect(lua51).toContain("math.maxinteger:\tnil");
    expect(lua54).toContain("math.maxinteger:\t9223372036854775807");
  });

  it.each(["bytecode", "lua", "luau"] as const)("runs the %s page's demo cleanly", async (tool) => {
    const result = await runProjectForTest(projectForExample(toolExamples[tool]));
    expect(result.status).toBe("ok");
  });
});
