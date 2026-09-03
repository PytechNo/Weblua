// @vitest-environment node
//
// Luau execution lives in its own file because each state intentionally owns
// an isolated Asyncify instance. luau-web@1.4.0 retains native maps keyed by a
// closed lua_State pointer; a shared instance can therefore bind stale
// references when that address is reused. The repeated test below guards the
// worker-reuse case that originally failed on run three and aborted thereafter.
import { describe, expect, it } from "vitest";
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
