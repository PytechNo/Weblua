import { describe, expect, it } from "vitest";
import { exampleMatchesProject, examples, projectForExample } from "./examples";

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
});
