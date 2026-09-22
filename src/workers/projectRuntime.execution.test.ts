// @vitest-environment node
//
// Executes real WebAssembly Lua builds through the same entry point the browser
// worker uses, so Run and Check are covered end to end rather than only at their
// seams. Luau execution and its isolated-instance reuse regression live in
// luauExecution.test.ts.
import { describe, expect, it } from "vitest";
import capabilityTour from "../../examples/weblua-capability-tour.weblua.json";
import { examples, projectForExample } from "../lib/examples";
import type { OutputChunk, ProjectPayload } from "../lib/types";
import {
  checkProjectForTest as check,
  runProjectForTest as run,
  stderrOf,
  stdoutOf
} from "./runtimeTestHost";

/** Every Lua runtime. Luau is covered separately; see the file comment. */
const luaFlavors = ["lua51", "lua52", "lua53", "lua54", "lua55"] as const;

/**
 * A project every Lua runtime can execute: a dotted require, a slashed require,
 * a directory `init` module, and a preset-input read.
 */
function portableProject(flavor: (typeof luaFlavors)[number]): ProjectPayload {
  return {
    flavor,
    entry: "main.lua",
    files: {
      "lib/config/init.lua": `return { label = "weblua" }`,
      "lib/greet.lua": `
        local greet = {}
        function greet.hello(name) return "hello, " .. name end
        return greet
      `,
      "main.lua": `
        local config = require("lib.config")
        local greet = require("lib/greet")
        print(greet.hello(io.read("*l")))
        print(config.label)
      `
    }
  };
}

describe.each(luaFlavors)("%s end-to-end execution", (flavor) => {
  it("runs a multi-file project, resolving dotted, slashed, and init requires", async () => {
    const result = await run(portableProject(flavor), "ada\n");

    expect(result.status).toBe("ok");
    expect(result.flavor).toBe(flavor);
    expect(stdoutOf(result)).toEqual(["hello, ada", "weblua"]);
  });

  /**
   * The host terminates the worker to enforce a deadline, so anything not
   * already streamed dies with it. This is the guarantee that a stopped or
   * timed-out run can still show what it printed.
   */
  it("streams output to an observer and announces when user code begins", async () => {
    const streamed: OutputChunk[] = [];
    let executingCalls = 0;
    let chunksBeforeExecuting = -1;

    const result = await run(portableProject(flavor), "ada\n", {
      executing: () => {
        executingCalls += 1;
        chunksBeforeExecuting = streamed.length;
      },
      chunk: (chunks) => streamed.push(...chunks)
    });

    expect(executingCalls).toBe(1);
    // Announced after the runtime loads but before a line can be printed, so
    // wasm boot is never charged to the execution budget.
    expect(chunksBeforeExecuting).toBe(0);
    expect(streamed.map((chunk) => chunk.text)).toEqual(["hello, ada", "weblua"]);
    // The final result stays self-contained even though the same output was
    // streamed: the host replaces what it streamed when the result lands.
    expect(result.chunks).toEqual(streamed);
  });

  it("streams the output a failing run produced before it threw", async () => {
    const streamed: OutputChunk[] = [];
    const result = await run(
      {
        flavor,
        entry: "main.lua",
        files: { "main.lua": 'print("before")\nerror("boom")' }
      },
      "",
      { chunk: (chunks) => streamed.push(...chunks) }
    );

    expect(result.status).toBe("error");
    expect(streamed.map((chunk) => chunk.text)).toEqual(["before"]);
  });

  it("reports Finished with no output when a project prints nothing", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "main.lua": "local unused = 1" }
    });

    expect(result.status).toBe("ok");
    expect(result.chunks).toEqual([{ kind: "system", text: "Finished with no output." }]);
  });

  it("caches a required module so it executes once", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: {
        "counter.lua": `
          _G.loads = (_G.loads or 0) + 1
          return { loads = _G.loads }
        `,
        "main.lua": `
          local first = require("counter")
          local second = require("counter")
          print(first == second, first.loads)
        `
      }
    });

    expect(stdoutOf(result)).toEqual(["true\t1"]);
  });

  it("never exposes the virtual mount root through require", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "m.lua": 'return "value"', "main.lua": 'print(require("m"))' }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result).join("\n")).not.toContain("/weblua/");
  });

  it("checks every file and locates a syntax error by file", async () => {
    const result = await check({
      flavor,
      entry: "main.lua",
      files: {
        "broken.lua": "local x =\n",
        "main.lua": 'print("fine")'
      }
    });

    expect(result.flavor).toBe(flavor);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].file).toBe("broken.lua");
    expect(result.diagnostics[0].filename).toBe("broken.lua");
    expect(result.diagnostics[0].severity).toBe("error");
    expect(result.diagnostics[0].message).toBeTruthy();
  });

  it("reports a syntax error on the line that contains it", async () => {
    const result = await check({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'print("one")\nprint("two")\nlocal = 3\n' }
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].line).toBe(3);
  });

  it("reports no diagnostics for a clean project", async () => {
    const result = await check(portableProject(flavor));

    expect(result.diagnostics).toEqual([]);
  });

  it("checking never executes the project", async () => {
    const result = await check({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'error("this must not run")' }
    });

    expect(result.diagnostics).toEqual([]);
  });

  it("surfaces a runtime error without leaking the mount root", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'print("before")\nerror("boom")' }
    });

    expect(result.status).toBe("error");
    expect(stdoutOf(result)).toEqual(["before"]);

    const failure = stderrOf(result).join("\n");
    expect(failure).toContain("boom");
    expect(failure).toContain("main.lua:2");
    expect(failure).not.toContain("/weblua/");
  });

  it("rejects a project whose entry file is missing", async () => {
    const result = await run({
      flavor,
      entry: "missing.lua",
      files: { "main.lua": 'print("hi")' }
    });

    expect(result.status).toBe("error");
    expect(stderrOf(result).join("\n")).toContain("The entry file missing.lua does not exist.");
  });

  it("rejects a path that escapes the project root", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'print("hi")', "../escape.lua": "return 1" }
    });

    expect(result.status).toBe("error");
    expect(stderrOf(result).join("\n")).toContain("Invalid project path");
  });

  it("runs source containing long-bracket strings that could break embedding", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'print([[a ]] .. "]]" .. [==[ b ]==])' }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual(["a ]] b "]);
  });

  it("reads preset input line by line and then the remainder", async () => {
    const result = await run(
      {
        flavor,
        entry: "main.lua",
        files: { "main.lua": 'print(io.read("*l"))\nprint((io.read("*a")))' }
      },
      "first\nsecond\nthird"
    );

    expect(result.status).toBe("ok");
    // Lua 5.4 delivers each print as one chunk; 5.1-5.3 and 5.5 stream stdout bytes and
    // therefore split the multi-line remainder at its newline.
    expect(stdoutOf(result).join("\n")).toBe("first\nsecond\nthird");
  });

  it("returns nil from a read past the end of the preset input", async () => {
    const result = await run(
      {
        flavor,
        entry: "main.lua",
        files: { "main.lua": 'print(io.read("*l"))\nprint(io.read("*l") == nil)' }
      },
      "only line"
    );

    expect(stdoutOf(result)).toEqual(["only line", "true"]);
  });

  it("captures io.write and io.stdout:write in order with print", async () => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: {
        "main.lua": `
          io.write("prefix ")
          io.write(42)
          io.stdout:write(" suffix")
          print("!")
          print(io.type(io.stdout))
        `
      }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual(["prefix 42 suffix!", "file"]);
  });
});

/**
 * The language and library changes listed at lua.org/manual/5.5/readme.html.
 * These are what distinguish the 5.5 runtime from 5.4 in user-visible ways, so
 * they are asserted directly rather than trusted to the shared portable suite.
 */
describe("Lua 5.5 language and library changes", () => {
  const evaluate = async (source: string) =>
    stdoutOf(await run({ flavor: "lua55", entry: "main.lua", files: { "main.lua": source } }));

  it("reports itself as Lua 5.5", async () => {
    expect(await evaluate("print(_VERSION)")).toEqual(["Lua 5.5"]);
  });

  /**
   * A `global` declaration puts the rest of the chunk in declared-globals-only
   * mode, so `print` has to be declared too -- that strictness is the point of
   * the feature, and `global *` is the documented way back out of it.
   */
  it("accepts global variable and global function declarations", async () => {
    const out = await evaluate(`
      global print
      global answer
      answer = 42
      global function greet() return "hi" end
      print(answer, greet())
    `);

    expect(out).toEqual(["42\thi"]);
  });

  it("reopens undeclared globals with global *", async () => {
    const out = await evaluate(`
      global *
      global answer
      answer = 42
      print(answer)
    `);

    expect(out).toEqual(["42"]);
  });

  it("reports an undeclared global as a diagnostic once a chunk declares one", async () => {
    const result = await check({
      flavor: "lua55",
      entry: "main.lua",
      files: { "main.lua": "global answer\nanswer = 42\nundeclared = 1\n" }
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].line).toBe(3);
    expect(result.diagnostics[0].message).toMatch(/variable 'undeclared' not declared/);
  });

  it("binds a named vararg to a table", async () => {
    const out = await evaluate(`
      local function tail(first, ...rest) return first, #rest, rest[2] end
      print(tail("a", "b", "c", "d"))
    `);

    expect(out).toEqual(["a\t3\tc"]);
  });

  it("creates a table with table.create", async () => {
    const out = await evaluate(`
      local t = table.create(8, 0)
      t[1] = "x"
      print(#t, t[1])
    `);

    expect(out).toEqual(["1\tx"]);
  });

  it("returns the final position of a character from utf8.offset", async () => {
    expect(await evaluate('print(utf8.offset("héllo", 3))')).toEqual(["4\t4"]);
  });

  /** 5.4 printed floats as `%.14g`, which could not always be read back exactly. */
  it("prints floats with enough digits to read them back", async () => {
    const out = await evaluate(`
      print(1 / 3)
      print(2.0 ^ 53)
    `);

    expect(out).toEqual(["0.33333333333333331", "9007199254740992.0"]);
  });

  it("rejects assignment to a for-loop variable", async () => {
    const result = await check({
      flavor: "lua55",
      entry: "main.lua",
      files: { "main.lua": "for i = 1, 3 do\n  i = i + 1\nend\n" }
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].line).toBe(2);
    expect(result.diagnostics[0].message).toMatch(/const variable 'i'/);
  });

  /** 5.5-only syntax must still be an error on the runtime the user picked. */
  it("is rejected by Lua 5.4, which has no global declarations", async () => {
    const files = { "main.lua": "global answer\nanswer = 1\n" };

    expect((await check({ flavor: "lua55", entry: "main.lua", files })).diagnostics).toEqual([]);
    expect((await check({ flavor: "lua54", entry: "main.lua", files })).diagnostics).toHaveLength(1);
  });
});

describe("stderr routing", () => {
  it.each(["lua51", "lua52", "lua53", "lua55"] as const)("streams io.stderr writes on %s", async (flavor) => {
    const result = await run({
      flavor,
      entry: "main.lua",
      files: { "main.lua": 'print("out")\nio.stderr:write("err\\n")' }
    });

    expect(stdoutOf(result)).toEqual(["out"]);
    expect(stderrOf(result)).toEqual(["err"]);
  });

  it("routes warn to stderr on lua54", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": 'print("out")\nwarn("careful")' }
    });

    expect(stdoutOf(result)).toEqual(["out"]);
    expect(stderrOf(result)).toEqual(["careful"]);
  });

  it("streams io.stderr writes on lua54", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": 'io.stderr:write("err")\nio.stderr:flush()\nprint("out")' }
    });

    expect(stdoutOf(result)).toEqual(["out"]);
    expect(stderrOf(result)).toEqual(["err"]);
  });
});

describe("Lua 5.4 file output compatibility", () => {
  it("preserves stdout identity and write return values", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: {
        "main.lua": `
          local fromIo = io.write("")
          local fromStdout = io.stdout:write("")
          print(io.type(io.stdout), fromIo == io.stdout, fromStdout == io.stdout)
        `
      }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual(["file\ttrue\ttrue"]);
  });

  it("keeps io.write directed at a selected ordinary file", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: {
        "main.lua": `
          local file = assert(io.tmpfile())
          io.output(file)
          local returned = io.write("file only")
          io.output(io.stdout)
          assert(file:seek("set"))
          print(io.type(file), returned == file, file:read("*a"))
          file:close()
        `
      }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual(["file\ttrue\tfile only"]);
  });

  it("flushes a partial stdout line without losing later output", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": 'io.write("partial")\nassert(io.flush())\nio.write("after")' }
    });

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual(["partial", "after"]);
  });

  it("reports invalid write values after preserving earlier output", async () => {
    const result = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": 'io.write("before")\nio.write({})' }
    });

    expect(result.status).toBe("error");
    expect(stdoutOf(result)).toEqual(["before"]);
    expect(stderrOf(result).join("\n")).toContain("string expected, got table");
  });
});

describe("luau compile checking", () => {
  it("accepts Luau type annotations that Lua would reject", async () => {
    const typed = 'local function double(value: number): number\n  return value * 2\nend\nprint(double(21))';

    expect((await check({ flavor: "luau", entry: "main.luau", files: { "main.luau": typed } })).diagnostics).toEqual([]);
    expect(
      (await check({ flavor: "lua54", entry: "main.lua", files: { "main.lua": typed } })).diagnostics
    ).toHaveLength(1);
  });

  it("locates a Luau syntax error by file", async () => {
    const result = await check({
      flavor: "luau",
      entry: "main.luau",
      files: { "broken.luau": "local x =\n", "main.luau": 'print("fine")' }
    });

    expect(result.flavor).toBe("luau");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].file).toBe("broken.luau");
    expect(result.diagnostics[0].severity).toBe("error");
  });

  it("reports no diagnostics for a clean Luau project", async () => {
    const result = await check({
      flavor: "luau",
      entry: "main.luau",
      files: {
        "lib/greet.luau": "return { hello = function(name: string) return name end }",
        "main.luau": 'local greet = require("lib.greet")\nprint(greet.hello("ada"))'
      }
    });

    expect(result.diagnostics).toEqual([]);
  });
});

describe("every example offered in the Example picker", () => {
  const cases = examples.map((example) => [example.id, example] as const);

  it.each(cases)("%s compiles cleanly in its declared runtime", async (_id, example) => {
    const candidate = projectForExample(example);
    const result = await check(candidate);

    expect(result.flavor).toBe(candidate.flavor);
    expect(result.diagnostics).toEqual([]);
  });

  it.each(cases)("%s uses an entry extension that matches its runtime", (_id, example) => {
    const candidate = projectForExample(example);

    expect(candidate.entry).toMatch(candidate.flavor === "luau" ? /\.luau$/ : /\.lua$/);
    expect(Object.keys(candidate.files)).toContain(candidate.entry);
  });
});

describe("the shipped capability tour example", () => {
  const project = capabilityTour.project as ProjectPayload;

  it("checks clean", async () => {
    expect((await check(project)).diagnostics).toEqual([]);
  });

  it("runs with its preset input, exercising requires, caching, and io.read", async () => {
    const result = await run(project, "Ada\nfirst note\nsecond note");

    expect(result.status).toBe("ok");
    expect(stdoutOf(result)).toEqual([
      "==========================",
      "= Weblua capability tour =",
      "==========================",
      "runtime:\tLua 5.4",
      'hello:\t"Ada"',
      "module cache loads:\t1",
      "numbers:\t4, 8, 15, 16, 23, 42",
      "sum:\t108",
      "average x multiplier:\t54",
      "notes:",
      "first note",
      "second note",
      "Capability tour finished successfully."
    ]);
  });
});

describe("run isolation", () => {
  it("does not let a Lua 5.4 run see files mounted by an earlier one", async () => {
    const first = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: {
        "secret.lua": 'return "from the first run"',
        "main.lua": 'print((require("secret")))'
      }
    });
    expect(stdoutOf(first)).toEqual(["from the first run"]);

    const second = await run({
      flavor: "lua54",
      entry: "main.lua",
      files: { "main.lua": 'print((pcall(require, "secret")))' }
    });

    expect(second.status).toBe("ok");
    expect(stdoutOf(second)).toEqual(["false"]);
  });
});
