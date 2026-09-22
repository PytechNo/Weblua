import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RUN_TIMEOUT_MS,
  EXTENDED_RUN_TIMEOUT_MS,
  type ProjectPayload,
  type RunResult
} from "../lib/types";
import {
  buildLua54Bootstrap,
  buildModuleAliases,
  buildStaticCompileScript,
  buildStaticProjectBootstrap,
  createByteReader,
  createByteSink,
  createStdinReader,
  createTextSink,
  diagnosticFromError,
  engineTimeout,
  findDiagnosticFile,
  formatValue,
  handleRun,
  isInitModule,
  isProjectPath,
  isRuntimeFlavor,
  luaLongString,
  normalizeProjectError,
  normalizeRequest,
  processRequest,
  projectEntries,
  requestFlavor,
  safeVirtualDirectory,
  validateProject,
  type RuntimeDependencies
} from "./projectRuntime";

function project(files: Record<string, string>, entry = "main.lua"): ProjectPayload {
  return { flavor: "lua54", entry, files };
}

/** Dependencies that fail loudly: used to prove failures become results. */
const failingDependencies = {
  lua54Factory: {
    createEngine: () => Promise.reject(new Error("engine unavailable")),
    mountFile: () => Promise.reject(new Error("engine unavailable"))
  },
  loadStaticLuaAssets: () => Promise.reject(new Error("glue unavailable"))
} as unknown as RuntimeDependencies;

describe("request normalization", () => {
  it("passes a project request through with its entry, files, and input", () => {
    const normalized = normalizeRequest({
      id: "abc",
      project: project({ "main.lua": "print(1)" }),
      stdin: "input",
      activeFile: "main.lua"
    });

    expect(normalized).toEqual({
      id: "abc",
      mode: "run",
      project: { flavor: "lua54", entry: "main.lua", files: { "main.lua": "print(1)" } },
      stdin: "input",
      activeFile: "main.lua",
      timeoutMs: DEFAULT_RUN_TIMEOUT_MS
    });
  });

  it("carries an explicit execution budget through", () => {
    const normalized = normalizeRequest({
      id: "abc",
      project: project({ "main.lua": "" }),
      timeoutMs: EXTENDED_RUN_TIMEOUT_MS
    });

    expect(normalized.timeoutMs).toBe(EXTENDED_RUN_TIMEOUT_MS);
  });

  it("falls back to the default budget when one is missing or nonsensical", () => {
    const base = { id: "abc", project: project({ "main.lua": "" }) };

    expect(normalizeRequest(base).timeoutMs).toBe(DEFAULT_RUN_TIMEOUT_MS);
    expect(normalizeRequest({ ...base, timeoutMs: 0 }).timeoutMs).toBe(DEFAULT_RUN_TIMEOUT_MS);
    expect(normalizeRequest({ ...base, timeoutMs: Number.NaN }).timeoutMs).toBe(DEFAULT_RUN_TIMEOUT_MS);
  });

  it("keeps the engine budget short of the host deadline, with a floor", () => {
    expect(engineTimeout(DEFAULT_RUN_TIMEOUT_MS)).toBe(4500);
    expect(engineTimeout(EXTENDED_RUN_TIMEOUT_MS)).toBe(29500);
    // A budget too small to subtract from still has to leave the engine time
    // to raise its own error rather than none at all.
    expect(engineTimeout(200)).toBe(500);
  });

  it("defaults a missing mode to run and missing input to an empty string", () => {
    const normalized = normalizeRequest({ id: "abc", project: project({ "main.lua": "" }) });

    expect(normalized.mode).toBe("run");
    expect(normalized.stdin).toBe("");
  });

  it("keeps an explicit check mode", () => {
    expect(normalizeRequest({ id: "a", project: project({ "main.lua": "" }), mode: "check" }).mode).toBe("check");
  });

  it("wraps a legacy snippet request in a one-file project", () => {
    expect(normalizeRequest({ id: "a", code: "print(1)", flavor: "lua53" }).project).toEqual({
      flavor: "lua53",
      entry: "main.lua",
      files: { "main.lua": "print(1)" }
    });
  });

  it("gives a legacy Luau snippet the .luau entry extension", () => {
    expect(normalizeRequest({ id: "a", code: "print(1)", flavor: "luau" }).project.entry).toBe("main.luau");
  });

  it("reads the flavor from either request shape", () => {
    expect(requestFlavor({ id: "a", code: "", flavor: "lua51" })).toBe("lua51");
    expect(requestFlavor({ id: "a", project: project({ "main.lua": "" }) })).toBe("lua54");
  });
});

describe("worker-side project validation", () => {
  it("accepts a valid project and sorts its files", () => {
    const validated = validateProject(project({ "z.lua": "z", "a.lua": "a", "main.lua": "m" }));

    expect(Object.keys(validated.files)).toEqual(["a.lua", "main.lua", "z.lua"]);
  });

  it("rejects an unsupported runtime", () => {
    expect(() =>
      validateProject({ ...project({ "main.lua": "" }), flavor: "python" as never })
    ).toThrow("Unsupported Lua runtime.");
  });

  it("rejects an entry that names no file", () => {
    expect(() => validateProject(project({ "main.lua": "" }, "other.lua"))).toThrow(
      "The entry file other.lua does not exist."
    );
  });

  it.each([
    ["a parent traversal", "../escape.lua"],
    ["a current-directory segment", "./main.lua"],
    ["an absolute path", "/etc/passwd"],
    ["a Windows separator", "lib\\mod.lua"],
    ["an empty segment", "lib//mod.lua"]
  ])("rejects %s", (_label, path) => {
    expect(() => validateProject(project({ "main.lua": "", [path]: "" }))).toThrow(/Invalid project path/);
  });

  it("rejects a source containing a null byte", () => {
    expect(() => validateProject(project({ "main.lua": "print(1)\0" }))).toThrow(/null byte/);
  });

  it("rejects a non-string source", () => {
    expect(() =>
      validateProject(project({ "main.lua": 42 as unknown as string }))
    ).toThrow(/must contain text source/);
  });

  it("recognizes exactly the five supported runtimes", () => {
    for (const flavor of ["lua51", "lua52", "lua53", "lua54", "luau"]) {
      expect(isRuntimeFlavor(flavor)).toBe(true);
    }
    expect(isRuntimeFlavor("lua55")).toBe(false);
    expect(isRuntimeFlavor(undefined)).toBe(false);
  });

  it("accepts nested relative paths and rejects escapes", () => {
    expect(isProjectPath("lib/math/stats.lua")).toBe(true);
    expect(isProjectPath("..")).toBe(false);
    expect(isProjectPath("")).toBe(false);
    expect(isProjectPath(42)).toBe(false);
  });
});

describe("module alias resolution", () => {
  it("maps a file to its path, extension-less, and dotted names", () => {
    expect(buildModuleAliases({ "lib/greet.lua": "" })).toEqual({
      "lib/greet.lua": "lib/greet.lua",
      "lib/greet": "lib/greet.lua",
      "lib.greet": "lib/greet.lua"
    });
  });

  it("lets a directory init module answer to the directory name", () => {
    const aliases = buildModuleAliases({ "lib/config/init.lua": "" });

    expect(aliases["lib/config"]).toBe("lib/config/init.lua");
    expect(aliases["lib.config"]).toBe("lib/config/init.lua");
  });

  it("prefers a direct module file over a same-named directory init module", () => {
    const aliases = buildModuleAliases({ "lib/config.lua": "", "lib/config/init.lua": "" });

    expect(aliases["lib.config"]).toBe("lib/config.lua");
    expect(aliases["lib/config/init.lua"]).toBe("lib/config/init.lua");
  });

  it("handles .luau modules the same way", () => {
    expect(buildModuleAliases({ "lib/greet.luau": "" })["lib.greet"]).toBe("lib/greet.luau");
  });

  it("identifies init modules in either extension and only at a path end", () => {
    expect(isInitModule("init.lua")).toBe(true);
    expect(isInitModule("lib/init.luau")).toBe(true);
    expect(isInitModule("lib/initial.lua")).toBe(false);
    expect(isInitModule("init/main.lua")).toBe(false);
  });

  it("orders project entries by path so generated code is deterministic", () => {
    expect(projectEntries(project({ "z.lua": "z", "a.lua": "a" })).map(([path]) => path)).toEqual([
      "a.lua",
      "z.lua"
    ]);
  });
});

describe("generated Lua bootstraps", () => {
  it("puts the mount root on package.path and redirects standard I/O", () => {
    const bootstrap = buildLua54Bootstrap("/weblua/run-1");

    expect(bootstrap).toContain("/weblua/run-1");
    expect(bootstrap).toContain("?.lua;");
    expect(bootstrap).toContain("?/init.lua;");
    expect(bootstrap).toContain("io.read");
    expect(bootstrap).toContain("__weblua_read");
    expect(bootstrap).toContain("io.write");
    expect(bootstrap).toContain("__weblua_write_stdout");
    expect(bootstrap).toContain("__weblua_file_methods.write");
  });

  it("rewrites require's loader data so the mount root cannot reach output", () => {
    const bootstrap = buildLua54Bootstrap("/weblua/run-1");

    expect(bootstrap).toContain("__weblua_prefix");
    expect(bootstrap).toContain("table.unpack(results, 1, results.n)");
  });

  it("preloads every module alias for the static runtimes", () => {
    const bootstrap = buildStaticProjectBootstrap(
      project({ "lib/greet.lua": "return {}", "main.lua": 'require("lib.greet")' })
    );

    expect(bootstrap).toContain("package.preload");
    expect(bootstrap).toContain("lib.greet");
    expect(bootstrap).toContain("lib/greet");
    expect(bootstrap).toContain("__weblua_entry()");
  });

  it("compiles under the project file name so errors carry it", () => {
    const script = buildStaticCompileScript("local x =", "lib/broken.lua");

    expect(script).toContain("lib/broken.lua");
    expect(script).toContain("loadstring");
    expect(script).toContain("load(");
  });

  it("embeds source that itself contains long-bracket delimiters", () => {
    const source = 'local s = [[nested]]\nprint(s)';
    const bootstrap = buildStaticProjectBootstrap(project({ "main.lua": source }));

    expect(bootstrap).toContain(source);
  });
});

describe("long string quoting", () => {
  it("uses the plain form when the source has no closing delimiter", () => {
    expect(luaLongString("print(1)")).toBe("[[print(1)]]");
  });

  it("raises the level until the delimiter is unambiguous", () => {
    expect(luaLongString("a ]] b")).toBe("[=[a ]] b]=]");
    expect(luaLongString("a ]] b ]=] c")).toBe("[==[a ]] b ]=] c]==]");
  });

  it("quotes an empty source", () => {
    expect(luaLongString("")).toBe("[[]]");
  });
});

describe("virtual mount directory naming", () => {
  it("keeps safe characters and replaces the rest", () => {
    expect(safeVirtualDirectory("a1-b_2")).toBe("a1-b_2");
    expect(safeVirtualDirectory("../../etc/passwd")).toBe("______etc_passwd");
  });

  it("falls back to a fixed name when nothing survives", () => {
    expect(safeVirtualDirectory("///")).toBe("___");
    expect(safeVirtualDirectory("")).toBe("run");
  });
});

describe("preset input reader", () => {
  it("reads successive lines without their terminators", () => {
    const reader = createStdinReader("one\ntwo\nthree");

    expect(reader.read("*l")).toBe("one");
    expect(reader.read("*l")).toBe("two");
    expect(reader.read("*l")).toBe("three");
  });

  it("defaults to line reads", () => {
    const reader = createStdinReader("one\ntwo");

    expect(reader.read()).toBe("one");
    expect(reader.read(null)).toBe("two");
  });

  it("keeps the terminator for *L", () => {
    expect(createStdinReader("one\ntwo").read("*L")).toBe("one\n");
  });

  it("returns everything that is left for *a", () => {
    const reader = createStdinReader("one\ntwo\nthree");

    expect(reader.read("*l")).toBe("one");
    expect(reader.read("*a")).toBe("two\nthree");
    expect(reader.read("*a")).toBe("");
  });

  it("returns undefined once the input is exhausted", () => {
    const reader = createStdinReader("only");

    expect(reader.read("*l")).toBe("only");
    expect(reader.read("*l")).toBeUndefined();
  });

  it("treats a trailing newline as the end of the input", () => {
    const reader = createStdinReader("only\n");

    expect(reader.read("*l")).toBe("only");
    expect(reader.read("*l")).toBeUndefined();
  });

  it("reports an empty preset input rather than hanging", () => {
    expect(createStdinReader("").read("*l")).toBeUndefined();
    expect(createStdinReader("").read("*a")).toBe("");
  });

  it("rejects numeric and unsupported read formats", () => {
    const reader = createStdinReader("42");

    expect(() => reader.read("*n")).toThrow(/only \*l, \*L, and \*a/);
    expect(() => reader.read(5)).toThrow(/only \*l, \*L, and \*a/);
  });
});

describe("byte-level input for the static runtimes", () => {
  it("delivers UTF-8 bytes and then null", () => {
    const reader = createByteReader("hi");

    expect([reader.read(), reader.read(), reader.read()]).toEqual([104, 105, null]);
  });

  it("encodes multi-byte characters as multiple bytes", () => {
    const reader = createByteReader("é");

    expect([reader.read(), reader.read(), reader.read()]).toEqual([195, 169, null]);
  });
});

describe("byte-level output for the static runtimes", () => {
  function sink() {
    const chunks: Array<{ kind: string; text: string }> = [];
    const write = createByteSink("stdout", (kind, values) =>
      chunks.push({ kind, text: values.map(formatValue).join("\t") })
    );
    return { chunks, ...write };
  }

  it("emits one chunk per newline", () => {
    const out = sink();
    for (const byte of new TextEncoder().encode("one\ntwo\n")) out.write(byte);

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["one", "two"]);
  });

  it("strips a carriage return before the newline", () => {
    const out = sink();
    for (const byte of new TextEncoder().encode("line\r\n")) out.write(byte);

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["line"]);
  });

  it("emits an empty chunk for a blank line", () => {
    const out = sink();
    out.write(10);

    expect(out.chunks.map((chunk) => chunk.text)).toEqual([""]);
  });

  it("flushes a trailing line that has no newline", () => {
    const out = sink();
    for (const byte of new TextEncoder().encode("partial")) out.write(byte);
    expect(out.chunks).toEqual([]);

    out.flush();
    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["partial"]);
  });

  it("does not emit anything when there is nothing buffered", () => {
    const out = sink();
    out.flush();

    expect(out.chunks).toEqual([]);
  });

  it("decodes multi-byte characters split across writes", () => {
    const out = sink();
    for (const byte of new TextEncoder().encode("café\n")) out.write(byte);

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["café"]);
  });

  it("ignores a non-integer byte", () => {
    const out = sink();
    out.write(1.5);
    out.flush();

    expect(out.chunks).toEqual([]);
  });
});

describe("text output for Lua 5.4", () => {
  function sink() {
    const chunks: Array<{ kind: string; text: string }> = [];
    const output = createTextSink("stdout", (kind, values) =>
      chunks.push({ kind, text: values.map(formatValue).join("\t") })
    );
    return { chunks, ...output };
  }

  it("joins partial writes to the next complete line", () => {
    const out = sink();
    out.write("prefix ");
    out.write("value\n");

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["prefix value"]);
  });

  it("emits every newline-delimited line and strips a carriage return", () => {
    const out = sink();
    out.write("one\r\ntwo\n\n");

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["one", "two", ""]);
  });

  it("flushes a trailing partial line only once", () => {
    const out = sink();
    out.write("partial");
    out.flush();
    out.flush();

    expect(out.chunks.map((chunk) => chunk.text)).toEqual(["partial"]);
  });
});

describe("output value formatting", () => {
  it("renders nil for null and undefined", () => {
    expect(formatValue(null)).toBe("nil");
    expect(formatValue(undefined)).toBe("nil");
  });

  it("renders primitives without quoting", () => {
    expect(formatValue("text")).toBe("text");
    expect(formatValue(42)).toBe("42");
    expect(formatValue(true)).toBe("true");
    expect(formatValue(10n)).toBe("10");
  });

  it("serializes tables as JSON", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });

  it("falls back for values JSON cannot represent", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(formatValue(cyclic)).toBe("[object Object]");
  });
});

describe("error normalization", () => {
  const sample = project({ "lib/greet.lua": "", "main.lua": "" });

  it("removes the virtual mount root from a message", () => {
    expect(
      normalizeProjectError("/weblua/9f2c/main.lua:3: attempt to call a nil value", sample)
    ).toBe("main.lua:3: attempt to call a nil value");
  });

  it("removes every occurrence in a multi-frame message", () => {
    const raw = "/weblua/9f2c/main.lua:3: oops\n\tin /weblua/9f2c/lib/greet.lua:1";

    expect(normalizeProjectError(raw, sample)).toBe("main.lua:3: oops\n\tin lib/greet.lua:1");
  });

  it("drops a chunk-name marker in front of a project path", () => {
    expect(normalizeProjectError("@lib/greet.lua:2: bad", sample)).toBe("lib/greet.lua:2: bad");
  });

  it("leaves an unrelated message untouched", () => {
    expect(normalizeProjectError("something failed", sample)).toBe("something failed");
  });
});

describe("diagnostic attribution", () => {
  const sample = project({ "lib/greet.lua": "", "main.lua": "" });

  it("attributes a diagnostic to the file named in the message", () => {
    const diagnostic = diagnosticFromError("lib/greet.lua:4: unexpected symbol", "main.lua", sample);

    expect(diagnostic.file).toBe("lib/greet.lua");
    expect(diagnostic.filename).toBe("lib/greet.lua");
    expect(diagnostic.line).toBe(4);
  });

  it("falls back to the compiled file when the message names none", () => {
    expect(diagnosticFromError("something failed", "main.lua", sample).file).toBe("main.lua");
  });

  it("omits the file when there is no fallback either", () => {
    const diagnostic = diagnosticFromError("something failed");

    expect(diagnostic.file).toBeUndefined();
    expect(diagnostic.severity).toBe("error");
  });

  it("prefers the longest matching path so nested files win", () => {
    const nested = project({ "greet.lua": "", "lib/greet.lua": "", "main.lua": "" });

    expect(findDiagnosticFile("lib/greet.lua:1: bad", nested)).toBe("lib/greet.lua");
  });

  it("matches a path that a runtime quoted instead of suffixing", () => {
    expect(findDiagnosticFile('module "lib/greet.lua" failed', sample)).toBe("lib/greet.lua");
  });
});

describe("failures become results", () => {
  it("returns an error result when the runtime cannot start", async () => {
    const result = await handleRun(
      { id: "a", project: project({ "main.lua": "print(1)" }) },
      failingDependencies
    );

    expect(result.status).toBe("error");
    expect(result.flavor).toBe("lua54");
    expect(result.chunks.at(-1)).toEqual({ kind: "stderr", text: "engine unavailable" });
  });

  it("returns an error result for an invalid project instead of throwing", async () => {
    const result = (await processRequest(
      { id: "a", project: project({ "main.lua": "" }, "missing.lua") },
      failingDependencies
    )) as RunResult;

    expect(result.status).toBe("error");
    expect(result.chunks.at(-1)?.text).toContain("The entry file missing.lua does not exist.");
  });

  it("returns a diagnostic when a check cannot start", async () => {
    const result = await processRequest(
      { id: "a", project: project({ "main.lua": "" }, "missing.lua"), mode: "check" },
      failingDependencies
    );

    expect("diagnostics" in result).toBe(true);
    if (!("diagnostics" in result)) return;
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("The entry file missing.lua does not exist.");
  });

  it("carries the request id back on every result", async () => {
    const result = await processRequest(
      { id: "request-42", project: project({ "main.lua": "" }) },
      failingDependencies
    );

    expect(result.id).toBe("request-42");
  });

  it("routes a check request to the check path", async () => {
    const deps = {
      ...failingDependencies,
      loadLuauModule: vi.fn().mockRejectedValue(new Error("luau unavailable"))
    } as unknown as RuntimeDependencies;

    const result = await processRequest(
      { id: "a", project: { flavor: "luau", entry: "main.luau", files: { "main.luau": "" } }, mode: "check" },
      deps
    );

    expect("diagnostics" in result).toBe(true);
  });
});
