import { describe, expect, it } from "vitest";
import { createMemoryWorkspaceStore, createWorkspaceStore } from "./workspaceStore";

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    project: {
      flavor: "lua54" as const,
      entry: "main.lua",
      files: {
        "lib/math.lua": "return 40 + 2",
        "main.lua": "print(require('lib.math'))"
      }
    },
    activeFile: "main.lua",
    stdin: "first line\nsecond line",
    ...overrides
  };
}

describe("workspace store", () => {
  it("uses an isolated memory backend when IndexedDB is unavailable", async () => {
    const store = createWorkspaceStore({ indexedDB: null });
    const draft = workspace({ activeProjectId: "project-1" });

    expect(store.mode).toBe("memory");
    expect(await store.saveDraft(draft)).toBe(true);
    expect(await store.getDraft()).toEqual(draft);
  });

  it("falls back safely when a browser exposes IndexedDB but opening it fails", async () => {
    const unavailableIndexedDB = {
      open() {
        throw new DOMException("Storage is disabled", "SecurityError");
      }
    } as unknown as IDBFactory;
    const store = createWorkspaceStore({ indexedDB: unavailableIndexedDB });

    expect(await store.saveDraft(workspace())).toBe(true);
    expect(store.mode).toBe("memory");
    expect(await store.getDraft()).toMatchObject({ activeFile: "main.lua" });
  });

  it("persists and defensively clones recovery drafts", async () => {
    const store = createMemoryWorkspaceStore();
    const draft = workspace();

    await store.saveDraft(draft);
    draft.project.files["main.lua"] = "mutated outside storage";

    const restored = await store.getDraft();
    expect(restored?.project.files["main.lua"]).toBe("print(require('lib.math'))");

    expect(await store.clearDraft()).toBe(true);
    expect(await store.getDraft()).toBeNull();
  });

  it("creates named projects with active IDs and supports autosave updates", async () => {
    let now = 100;
    let number = 0;
    const store = createMemoryWorkspaceStore({
      now: () => now,
      createId: () => `project-${++number}`
    });

    const created = await store.createProject("  Module demo  ", workspace());
    expect(created).toMatchObject({
      id: "project-1",
      name: "Module demo",
      createdAt: 100,
      updatedAt: 100,
      workspace: { activeProjectId: "project-1" }
    });

    now = 250;
    const edited = {
      ...created!.workspace,
      stdin: "new stdin",
      project: {
        ...created!.workspace.project,
        files: { ...created!.workspace.project.files, "main.lua": "print('updated')" }
      }
    };
    expect(await store.saveWorkspace(edited)).toBe(true);

    expect(await store.getDraft()).toEqual(edited);
    expect(await store.getProject("project-1")).toMatchObject({
      updatedAt: 250,
      workspace: {
        stdin: "new stdin",
        project: { files: { "main.lua": "print('updated')" } },
        activeProjectId: "project-1"
      }
    });
  });

  it("lists, renames, and deletes named projects", async () => {
    let now = 0;
    let number = 0;
    const store = createMemoryWorkspaceStore({
      now: () => ++now,
      createId: () => `id-${++number}`
    });

    const first = await store.createProject("First", workspace());
    const second = await store.createProject("Second", workspace({ stdin: "two" }));

    expect((await store.listProjects()).map((project) => project.id)).toEqual([second!.id, first!.id]);
    expect(await store.renameProject(first!.id, "  Renamed  ")).toMatchObject({
      name: "Renamed",
      createdAt: first!.createdAt,
      updatedAt: 3
    });
    expect((await store.listProjects()).map((project) => project.name)).toEqual(["Renamed", "Second"]);

    expect(await store.deleteProject(second!.id)).toBe(true);
    expect(await store.deleteProject(second!.id)).toBe(false);
    expect((await store.listProjects()).map((project) => project.id)).toEqual([first!.id]);
  });

  it("rejects malformed workspaces without throwing", async () => {
    const store = createMemoryWorkspaceStore();
    const malformed = workspace({
      project: {
        flavor: "lua54",
        entry: "../main.lua",
        files: { "main.lua": "print('nope')" }
      }
    });

    expect(await store.saveDraft(malformed)).toBe(false);
    expect(await store.createProject("Broken", malformed)).toBeNull();
    expect(await store.getDraft()).toBeNull();
  });
});
