import { describe, expect, it } from "vitest";
import {
  ProjectValidationError,
  createDefaultProject,
  createDefaultWorkspace,
  createProjectPayload,
  deleteProjectFile,
  normalizeProjectPath,
  renameProjectFile,
  setProjectEntry,
  validateProjectPayload
} from "./project";
import { deserializeProject, serializeProject } from "./codec";

describe("project domain", () => {
  it("creates runtime-appropriate default projects and workspaces", () => {
    expect(createDefaultProject("lua51", "print(_VERSION)")).toEqual({
      flavor: "lua51",
      entry: "main.lua",
      files: { "main.lua": "print(_VERSION)" }
    });
    expect(createDefaultWorkspace("luau")).toEqual({
      project: { flavor: "luau", entry: "main.luau", files: { "main.luau": "" } },
      activeFile: "main.luau",
      stdin: ""
    });
  });

  it("requires normalized relative POSIX source paths", () => {
    for (const invalid of ["", "   ", "/main.lua", "lib\\math.lua", "lib//math.lua", "./main.lua", "a/../b.lua", "a/./b.lua", "a/"]) {
      expect(normalizeProjectPath(invalid)).toBeNull();
    }
    expect(normalizeProjectPath("lib/math.lua")).toBe("lib/math.lua");

    expect(
      validateProjectPayload({
        flavor: "lua54",
        entry: "missing.lua",
        files: { "main.lua": "print('x')" }
      })
    ).toBeNull();
  });

  it("rejects duplicate source paths before constructing a file map", () => {
    expect(() =>
      createProjectPayload("lua54", "main.lua", [
        { path: "main.lua", code: "print(1)" },
        { path: "main.lua", code: "print(2)" }
      ])
    ).toThrow(ProjectValidationError);
  });

  it("does not allow deleting the entry until another entry is selected", () => {
    const project = createProjectPayload("lua54", "main.lua", [
      { path: "main.lua", code: "require('lib.helper')" },
      { path: "lib/helper.lua", code: "return {}" }
    ]);

    expect(() => deleteProjectFile(project, "main.lua")).toThrow(ProjectValidationError);
    const movedEntry = setProjectEntry(project, "lib/helper.lua");
    expect(deleteProjectFile(movedEntry, "main.lua").files).toEqual({ "lib/helper.lua": "return {}" });
  });

  it("keeps the entry path valid when its file is renamed", () => {
    const project = createDefaultProject("luau", "return 42");
    expect(renameProjectFile(project, "main.luau", "src/main.luau")).toEqual({
      flavor: "luau",
      entry: "src/main.luau",
      files: { "src/main.luau": "return 42" }
    });
  });
});

describe("project export codec", () => {
  it("exports a versioned source-only document and restores it", () => {
    const project = createProjectPayload("lua54", "main.lua", [
      { path: "main.lua", code: "local value = require('lib.value')" },
      { path: "lib/value.lua", code: "return 42" }
    ]);
    const serialized = serializeProject(project);

    expect(JSON.parse(serialized)).toEqual({
      format: "weblua-project",
      version: 1,
      project
    });
    expect(deserializeProject(serialized)).toEqual(project);
  });

  it("rejects malformed, unsupported, and duplicate-file import documents", () => {
    expect(deserializeProject("not json")).toBeNull();
    expect(
      deserializeProject(
        JSON.stringify({
          format: "weblua-project",
          version: 2,
          project: createDefaultProject()
        })
      )
    ).toBeNull();
    expect(
      deserializeProject(
        '{"format":"weblua-project","version":1,"project":{"flavor":"lua54","entry":"main.lua","files":{"main.lua":"one","main.lua":"two"}}}'
      )
    ).toBeNull();
  });
});
