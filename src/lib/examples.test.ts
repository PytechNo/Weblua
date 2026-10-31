import { describe, expect, it } from "vitest";
import { exampleMatchesProject, examples, findExample, projectForExample } from "./examples";

describe("playground examples", () => {
  it("includes the multi-file capability tour as a selectable project", () => {
    const example = examples.find((candidate) => candidate.id === "capability-tour");

    expect(example).toBeDefined();
    if (!example) return;

    const project = projectForExample(example);
    expect(project.entry).toBe("main.lua");
    expect(Object.keys(project.files)).toEqual([
      "lib/config/init.lua",
      "lib/format.lua",
      "lib/math/stats.lua",
      "lib/require_probe.lua",
      "main.lua"
    ]);
    expect(exampleMatchesProject(example, project)).toBe(true);
  });

  it("includes a Luau project that uses task and relative requires", () => {
    const example = examples.find((candidate) => candidate.id === "luau-tasks");
    expect(example).toBeDefined();
    if (!example) return;

    const project = projectForExample(example);
    expect(project.flavor).toBe("luau");
    expect(Object.keys(project.files)).toEqual(["lib/countdown.luau", "lib/log.luau", "main.luau"]);
  });

  it("includes a Luau project whose module exports types", () => {
    const example = examples.find((candidate) => candidate.id === "luau-typed-modules");
    expect(example).toBeDefined();
    if (!example) return;

    const project = projectForExample(example);
    expect(project.flavor).toBe("luau");
    expect(Object.keys(project.files)).toEqual(["lib/inventory.luau", "main.luau"]);
    expect(project.files["lib/inventory.luau"]).toContain("export type Item");
  });
});

describe("example links", () => {
  it("opens picker examples, tool demos, and article blocks by id", async () => {
    expect((await findExample("#example=metatables"))?.title).toBe("Metatables");
    expect((await findExample("#example=lua-vs-luau-demo"))?.title).toBe("Lua 5.1 vs Luau");
    expect((await findExample(`#example=${encodeURIComponent("learn-luau/tables/exercise")}`))?.title).toBe("Tables: arrays and dictionaries exercise");
    expect(await findExample("#example=missing")).toBeUndefined();
    expect(await findExample("#c=abc")).toBeUndefined();
  });
});
