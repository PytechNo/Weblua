// @vitest-environment node
//
// Luau execution lives in its own file because each state intentionally owns
// an isolated Asyncify instance. luau-web@1.4.0 retains native maps keyed by a
// closed lua_State pointer; a shared instance can therefore bind stale
// references when that address is reused. The repeated test below guards the
// worker-reuse case that originally failed on run three and aborted thereafter.
import { describe, expect, it } from "vitest";
import { examples, projectForExample } from "../lib/examples";
import type { ProjectPayload } from "../lib/types";
import { runProjectForTest, stderrOf, stdoutOf } from "./runtimeTestHost";

const project: ProjectPayload = {
  flavor: "luau",
  entry: "main.luau",
  files: {
    "lib/config/init.luau": `return { label = "weblua" }`,
    "lib/greet.luau": `
      local greet = {}
      function greet.hello(name: string): string
        return "hello, " .. name
      end
      return greet
    `,
    // Mutated once per execution of lib/counter, so a second execution of that
    // module would show up as a count of 2.
    "lib/registry.luau": `return { count = 0 }`,
    "lib/counter.luau": `
      local registry = require("lib.registry")
      registry.count = registry.count + 1
      return registry
    `,
    "main.luau": `
      local config = require("lib.config")
      local greet = require("lib/greet")
      local first = require("lib.counter")
      local second = require("lib.counter")

      print(greet.hello(read("*l")))
      print(config.label)
      print(first == second, first.count)
      print(read("*a"))
      warn("careful")
    `
  }
};

describe("luau end-to-end execution", () => {
  it("repeatedly runs a multi-file project with requires, input, print, and warn", async () => {
    for (let iteration = 1; iteration <= 4; iteration += 1) {
      const result = await runProjectForTest(project, "ada\nremaining input");

      expect(result.status, `run ${iteration}`).toBe("ok");
      expect(result.flavor).toBe("luau");
      expect(stdoutOf(result)).toEqual([
        "hello, ada",
        "weblua",
        "true\t1",
        "remaining input"
      ]);
      expect(stderrOf(result)).toEqual(["careful"]);
    }
  });
});

describe("luau task library", () => {
  function luau(main: string, files: Record<string, string> = {}): ProjectPayload {
    return { flavor: "luau", entry: "main.luau", files: { "main.luau": main, ...files } };
  }

  it("orders spawn, defer, delay, and wait like Roblox", async () => {
    const result = await runProjectForTest(
      luau(`
        task.defer(function() print("deferred") end)
        task.spawn(function()
          print("spawned")
          task.wait(0.02)
          print("spawned after wait")
        end)
        task.delay(0.05, function(value) print("delayed", value) end, 42)
        print("main")
        local waited = task.wait(0.03)
        print("main after wait", waited >= 0.03)
      `)
    );

    expect(stderrOf(result)).toEqual([]);
    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual([
      "spawned",
      "main",
      "deferred",
      "spawned after wait",
      "main after wait\ttrue",
      "delayed\t42"
    ]);
  });

  it("waits at least one frame and returns the time waited", async () => {
    const result = await runProjectForTest(
      luau(`
        local waited = task.wait()
        print(waited >= 1 / 60 - 0.002, waited < 1)
      `)
    );
    expect(stdoutOf(result)).toEqual(["true\ttrue"]);
  });

  it("reports an error in a task and keeps the others running", async () => {
    const result = await runProjectForTest(
      luau(`
        task.spawn(function() error("task failed") end)
        task.delay(0.01, function() print("still running") end)
        task.wait(0.03)
        print("main done")
      `)
    );

    expect(result.status).toBe("ok");
    expect(stderrOf(result).join("\n")).toContain("task failed");
    expect(stdoutOf(result)).toEqual(["still running", "main done"]);
  });

  it("fails the run when the main thread errors after waiting", async () => {
    const result = await runProjectForTest(
      luau(`
        task.wait(0.01)
        error("main failed")
      `)
    );
    expect(result.status).toBe("error");
    expect(stderrOf(result).join("\n")).toContain("main failed");
  });

  it("cancels delayed and waiting tasks", async () => {
    const result = await runProjectForTest(
      luau(`
        local delayed = task.delay(0.02, function() print("delayed ran") end)
        task.cancel(delayed)
        local waiting = task.spawn(function()
          task.wait(0.02)
          print("waiter ran")
        end)
        task.cancel(waiting)
        print(pcall(task.cancel, coroutine.running()))
        task.wait(0.05)
        print("done")
      `)
    );

    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual([
      "false\ttask.cancel cannot cancel the running thread",
      "done"
    ]);
  });

  it("resumes a waiting user coroutine after its caller moves on", async () => {
    const result = await runProjectForTest(
      luau(`
        local step = coroutine.wrap(function()
          print("a")
          task.wait(0.01)
          print("c")
        end)
        step()
        print("b")
        task.wait(0.05)
        print("d")
      `)
    );
    expect(stdoutOf(result)).toEqual(["a", "b", "c", "d"]);
  });

  it("streams output printed before a wait while the run continues", async () => {
    let printedAt = 0;
    const result = await runProjectForTest(
      luau(`
        print("before")
        task.wait(0.25)
        print("after")
      `),
      "",
      {
        chunk(chunks) {
          if (!printedAt && chunks.some((chunk) => chunk.text === "before")) printedAt = performance.now();
        }
      }
    );
    const finishedAt = performance.now();

    expect(stdoutOf(result)).toEqual(["before", "after"]);
    expect(printedAt).toBeGreaterThan(0);
    expect(finishedAt - printedAt).toBeGreaterThan(150);
  });

  it("runs the built-in tasks example in its documented order", async () => {
    const example = examples.find((candidate) => candidate.id === "luau-tasks");
    expect(example).toBeDefined();
    if (!example) return;

    const result = await runProjectForTest(projectForExample(example));
    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual([
      "rocket: 3",
      "main waits",
      "deferred until main yields",
      "rocket: 2",
      "delayed half a second",
      "rocket: 1",
      "main resumed after 1.0s",
      "rocket: liftoff"
    ]);
  });

  it("runs the built-in typed modules example", async () => {
    const example = examples.find((candidate) => candidate.id === "luau-typed-modules");
    expect(example).toBeDefined();
    if (!example) return;

    const result = await runProjectForTest(projectForExample(example));
    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual(["potion now: 5", "arrow\t12", "potion\t5"]);
  });

  it("keeps relative requires working inside tasks", async () => {
    const result = await runProjectForTest(
      luau(`require("./lib/worker").start()`, {
        "lib/worker.luau": `
          return {
            start = function()
              task.spawn(function()
                task.wait(0.01)
                print(require("./value"))
              end)
            end
          }
        `,
        "lib/value.luau": `return "lib value"`
      })
    );
    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual(["lib value"]);
  });
});

describe("luau require-by-string", () => {
  function luau(files: Record<string, string>): ProjectPayload {
    return { flavor: "luau", entry: "main.luau", files };
  }

  it("resolves ./ and ../ against the requiring module and shares the cache", async () => {
    const result = await runProjectForTest(
      luau({
        "main.luau": `
          local a = require("./lib/a")
          print(a.name, a.sibling.name, a.parent.name)
          print(a.sibling == require("lib.b"), a.sibling == require("lib/b"))
        `,
        "lib/a.luau": `
          return { name = "a", sibling = require("./b"), parent = require("../top") }
        `,
        "lib/b.luau": `return { name = "b" }`,
        "top.luau": `return { name = "top" }`
      })
    );

    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual(["a\tb\ttop", "true\ttrue"]);
  });

  it("gives init files the folder semantics of the RFC", async () => {
    const result = await runProjectForTest(
      luau({
        "main.luau": `
          local pkg = require("./pkg")
          print(pkg.child, pkg.sibling)
        `,
        "pkg/init.luau": `
          return { child = require("@self/child").name, sibling = require("./helper").name }
        `,
        "pkg/child.luau": `return { name = "pkg/child" }`,
        "helper.luau": `return { name = "helper beside pkg" }`
      })
    );

    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual(["pkg/child\thelper beside pkg"]);
  });

  it("finds the calling module through pcall and helper functions", async () => {
    const result = await runProjectForTest(
      luau({
        "main.luau": `
          local loader = require("./lib/loader")
          print(loader.load())
          print(pcall(require, "./lib/value"))
        `,
        "lib/loader.luau": `
          local function load() return require("./value") end
          return { load = load }
        `,
        "lib/value.luau": `return "from lib"`,
        "value.luau": `return "from root"`
      })
    );

    expect(stderrOf(result)).toEqual([]);
    expect(stdoutOf(result)).toEqual(["from lib", "true\tfrom lib"]);
  });

  it("explains relative paths that do not resolve", async () => {
    const missing = await runProjectForTest(
      luau({ "main.luau": `require("./lib/missing")` })
    );
    expect(missing.status).toBe("error");
    expect(stderrOf(missing).join("\n")).toContain(
      "module './lib/missing' not found (looked for 'lib/missing')"
    );

    const above = await runProjectForTest(luau({ "main.luau": `require("../outside")` }));
    expect(above.status).toBe("error");
    expect(stderrOf(above).join("\n")).toContain("reaches above the project root");

    const alias = await runProjectForTest(luau({ "main.luau": `require("@lune/fs")` }));
    expect(alias.status).toBe("error");
    expect(stderrOf(alias).join("\n")).toContain("unknown require alias '@lune'");
  });
});

// The bytecode view tells people runs compile at level 1 and that a
// --!optimize comment changes it; luau-web exposes no compiler options, so
// these pin both claims to observable behavior.
describe("luau optimization level", () => {
  const project = (main: string, files: Record<string, string> = {}): ProjectPayload => ({
    flavor: "luau",
    entry: "main.luau",
    files: { "main.luau": main, ...files }
  });

  it("compiles runs at level 1 unless the file sets --!optimize", async () => {
    // From level 1 up, math.floor is an import resolved when main loads, so a
    // module that replaces math afterwards does not reach it. Level 0 looks the
    // global up at the call.
    const patch = { "patch.luau": `math = { floor = function() return "patched" end }\nreturn nil` };
    const main = `require("./patch")\nprint(math.floor(1.5))`;

    for (const [header, expected] of [["", "1"], ["--!optimize 0\n", "patched"], ["--!optimize 1\n", "1"]]) {
      const result = await runProjectForTest(project(header + main, patch));
      expect(stdoutOf(result), header || "no hot comment").toEqual([expected]);
    }
  });

  it("inlines local functions under --!optimize 2", async () => {
    // An inlined function leaves no frame of its own in the traceback.
    const main = [
      "local function trace(): string",
      "  local s = debug.traceback()",
      "  return s",
      "end",
      "local s = trace()",
      "print(s)"
    ].join("\n");

    const level1 = stdoutOf(await runProjectForTest(project(main))).join("\n");
    const level2 = stdoutOf(await runProjectForTest(project(`--!optimize 2\n${main}`))).join("\n");

    expect(level1).toContain("function trace");
    expect(level2).not.toContain("function trace");
  });
});
