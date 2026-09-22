import type { LuaFactory } from "wasmoon";
import { parseCompileError } from "../lib/diagnostics";
import { DEFAULT_RUN_TIMEOUT_MS } from "../lib/types";
import type {
  CheckResult,
  Diagnostic,
  OutputChunk,
  ProjectPayload,
  RunRequest,
  RunResult,
  RuntimeFlavor
} from "../lib/types";

const LUA_OK = 0;
const LUA_MEMORY_LIMIT = 32 * 1024 * 1024;

/** Runtimes served by the statically compiled `lua-wasm-bindings` glue. */
export type StaticLuaFlavor = "lua51" | "lua52" | "lua53";

export interface NormalizedRequest {
  id: string;
  mode: "run" | "check";
  project: ProjectPayload;
  stdin: string;
  activeFile?: string;
  /** Wall-clock budget the host will enforce by terminating this worker. */
  timeoutMs: number;
}

export interface StaticLuaGlue {
  ready?: Promise<unknown>;
  cwrap(
    name: string,
    returnType: "number" | "string" | null,
    argTypes?: Array<"number" | "string">
  ): (...args: Array<number | string>) => unknown;
}

export interface StaticLuaRuntime {
  newState(): number;
  openLibs(state: number): void;
  loadString(state: number, source: string): number;
  pcall(state: number, nargs: number, nresults: number, errfunc: number): number;
  toString(state: number, index: number): string;
  close(state: number): void;
}

/**
 * A glue factory paired with its already-loaded WebAssembly binary. Locating
 * those bytes is the only part of execution that differs between the browser
 * worker (Vite asset URLs plus `fetch`) and any other host.
 */
export interface StaticLuaAssets {
  factory: (options: Record<string, unknown>) => StaticLuaGlue;
  wasmBinary: ArrayBuffer;
}

export interface StaticLuaIo {
  stdin?: () => number | null | undefined;
  stdout?: (byte: number) => void;
  stderr?: (byte: number) => void;
  print?: (value: unknown) => void;
  printErr?: (value: unknown) => void;
}

export type LuauModule = typeof import("../lib/luauWebAsyncify");

/** Everything execution needs from its host in order to reach a wasm build. */
export interface RuntimeDependencies {
  lua54Factory: LuaFactory;
  loadStaticLuaAssets(flavor: StaticLuaFlavor): Promise<StaticLuaAssets>;
  /** Defaults to the isolated Asyncify Luau bridge. */
  loadLuauModule?: () => Promise<LuauModule>;
}

export type OutputPush = (kind: OutputChunk["kind"], values: unknown[]) => void;

/**
 * Optional host hooks for a run in flight. A host that terminates a worker on
 * a deadline needs both: "executing" tells it when to start counting, and
 * "chunk" gives it output worth keeping when it does terminate.
 */
export interface RunObserver {
  /** Called once the wasm runtime is up and user code is about to execute. */
  executing?(): void;
  /** Called synchronously as output is produced, before user code resumes. */
  chunk?(chunks: OutputChunk[]): void;
}

/**
 * The engine-level budget, kept short of the host deadline so the runtime
 * raises its own error -- which names a line -- before the worker is killed.
 */
export function engineTimeout(timeoutMs: number): number {
  return Math.max(500, timeoutMs - 500);
}

/**
 * Runs or checks one request and resolves to the message a worker posts back.
 * Failures become results rather than exceptions so a request always answers.
 */
export function processRequest(
  request: RunRequest,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<RunResult | CheckResult> {
  return request.mode === "check" ? handleCheck(request, deps) : handleRun(request, deps, observer);
}

export async function handleCheck(
  request: RunRequest,
  deps: RuntimeDependencies
): Promise<CheckResult> {
  const startedAt = performance.now();
  const fallbackFlavor = requestFlavor(request);
  let flavor = fallbackFlavor;
  let diagnostics: Diagnostic[] = [];

  try {
    const normalized = normalizeRequest(request);
    flavor = normalized.project.flavor;
    diagnostics = await checkProject(normalized.project, deps);
  } catch (error) {
    diagnostics = [diagnosticFromError(normalizeError(error))];
  }

  return {
    id: request.id,
    flavor,
    durationMs: performance.now() - startedAt,
    diagnostics
  };
}

export async function handleRun(
  request: RunRequest,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<RunResult> {
  const startedAt = performance.now();
  const chunks: OutputChunk[] = [];
  let flavor = requestFlavor(request);
  let project: ProjectPayload | undefined;

  const push: OutputPush = (kind, values) => {
    const chunk = { kind, text: values.map(formatValue).join("\t") };
    chunks.push(chunk);
    // A timer in this worker cannot fire during a synchronous Lua loop.
    // Transfer output before returning to user code; the host batches renders.
    observer?.chunk?.([chunk]);
  };

  try {
    const normalized = normalizeRequest(request);
    project = normalized.project;
    flavor = project.flavor;
    await runProject(normalized, push, deps, observer);

    return {
      id: request.id,
      flavor,
      status: "ok",
      durationMs: performance.now() - startedAt,
      chunks: chunks.length ? chunks : [{ kind: "system", text: "Finished with no output." }]
    };
  } catch (error) {
    const rawError = project ? normalizeProjectError(normalizeError(error), project) : normalizeError(error);
    return {
      id: request.id,
      flavor,
      status: "error",
      durationMs: performance.now() - startedAt,
      chunks: [
        ...chunks,
        {
          kind: "stderr",
          text: rawError
        }
      ]
    };
  }
}

export function normalizeRequest(request: RunRequest): NormalizedRequest {
  const timeoutMs = normalizeTimeout(request.timeoutMs);

  if ("project" in request) {
    return {
      id: request.id,
      mode: request.mode ?? "run",
      project: validateProject(request.project),
      stdin: typeof request.stdin === "string" ? request.stdin : "",
      activeFile: request.activeFile,
      timeoutMs
    };
  }

  const flavor = request.flavor;
  const entry = flavor === "luau" ? "main.luau" : "main.lua";
  return {
    id: request.id,
    mode: request.mode ?? "run",
    project: {
      flavor,
      entry,
      files: { [entry]: request.code }
    },
    stdin: "",
    timeoutMs
  };
}

/** A missing or nonsensical budget falls back to the default rather than
 * leaving a runtime with no engine-level timeout at all. */
function normalizeTimeout(timeoutMs: unknown): number {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_RUN_TIMEOUT_MS;
}

export function requestFlavor(request: RunRequest): RuntimeFlavor {
  return "project" in request ? request.project.flavor : request.flavor;
}

export function validateProject(project: ProjectPayload): ProjectPayload {
  if (!isRuntimeFlavor(project.flavor)) {
    throw new Error("Unsupported Lua runtime.");
  }

  if (!project.files || typeof project.files !== "object" || Array.isArray(project.files)) {
    throw new Error("Project files must be a path-to-source map.");
  }

  if (!isProjectPath(project.entry)) {
    throw new Error("The project entry must be a normalized relative POSIX path.");
  }

  const files: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [path, source] of Object.entries(project.files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isProjectPath(path)) {
      throw new Error(`Invalid project path: ${String(path)}`);
    }
    if (seen.has(path)) {
      throw new Error(`Duplicate project path: ${path}`);
    }
    if (typeof source !== "string") {
      throw new Error(`Project file ${path} must contain text source.`);
    }
    if (source.includes("\0")) {
      throw new Error(`Project file ${path} contains a null byte.`);
    }

    seen.add(path);
    files[path] = source;
  }

  if (!Object.hasOwn(files, project.entry)) {
    throw new Error(`The entry file ${project.entry} does not exist.`);
  }

  return {
    flavor: project.flavor,
    entry: project.entry,
    files
  };
}

export function isRuntimeFlavor(flavor: unknown): flavor is RuntimeFlavor {
  return flavor === "lua51" || flavor === "lua52" || flavor === "lua53" || flavor === "lua54" || flavor === "luau";
}

export function isProjectPath(path: unknown): path is string {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return false;
  }

  return path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export async function checkProject(
  project: ProjectPayload,
  deps: RuntimeDependencies
): Promise<Diagnostic[]> {
  switch (project.flavor) {
    case "lua54":
      return checkLua54(project, deps);
    case "luau":
      return checkLuau(project, deps);
    case "lua51":
    case "lua52":
    case "lua53":
      return checkStaticLua(project, deps);
  }
}

export async function runProject(
  request: NormalizedRequest,
  push: OutputPush,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<void> {
  switch (request.project.flavor) {
    case "lua54":
      return runLua54(request, push, deps, observer);
    case "luau":
      return runLuau(request, push, deps, observer);
    case "lua51":
    case "lua52":
    case "lua53":
      return runStaticLua(request, push, deps, observer);
  }
}

async function checkLua54(project: ProjectPayload, deps: RuntimeDependencies): Promise<Diagnostic[]> {
  const engine = await deps.lua54Factory.createEngine();
  const diagnostics: Diagnostic[] = [];

  try {
    for (const [path, source] of projectEntries(project)) {
      try {
        engine.global.loadString(source, path);
      } catch (error) {
        diagnostics.push(diagnosticFromError(normalizeProjectError(normalizeError(error), project), path, project));
      }
    }
    return diagnostics;
  } finally {
    engine.global.close();
  }
}

async function runLua54(
  request: NormalizedRequest,
  push: OutputPush,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<void> {
  const engine = await deps.lua54Factory.createEngine({
    functionTimeout: engineTimeout(request.timeoutMs),
    traceAllocations: true
  });
  const reader = createStdinReader(request.stdin);
  const stdout = createTextSink("stdout", push);
  const stderr = createTextSink("stderr", push);
  const root = `/weblua/${safeVirtualDirectory(request.id)}`;

  try {
    engine.global.setMemoryMax(LUA_MEMORY_LIMIT);
    engine.global.set("print", (...args: unknown[]) => {
      stdout.write(`${args.map(formatValue).join("\t")}\n`);
    });
    engine.global.set("warn", (...args: unknown[]) => {
      stderr.write(`${args.map(formatValue).join("\t")}\n`);
    });
    engine.global.set("__weblua_read", (format?: unknown) => reader.read(format));
    engine.global.set("__weblua_write_stdout", (value: unknown) => {
      stdout.write(formatValue(value));
    });
    engine.global.set("__weblua_write_stderr", (value: unknown) => {
      stderr.write(formatValue(value));
    });
    engine.global.set("__weblua_flush_stdout", stdout.flush);
    engine.global.set("__weblua_flush_stderr", stderr.flush);

    // The mounted root is unique to this request. A run worker is normally
    // short-lived, and this additionally keeps a reused worker from observing
    // source files mounted by an earlier run.
    for (const [path, source] of projectEntries(request.project)) {
      await deps.lua54Factory.mountFile(`${root}/${path}`, source);
    }

    observer?.executing?.();
    await engine.doString(buildLua54Bootstrap(root));
    await engine.doFile(`${root}/${request.project.entry}`);
  } finally {
    stdout.flush();
    stderr.flush();
    engine.global.close();
  }
}

export function buildLua54Bootstrap(root: string): string {
  const rootLiteral = luaLongString(root);
  return `
    local __weblua_root = ${rootLiteral}
    package.path = __weblua_root .. "/?.lua;" .. __weblua_root .. "/?/init.lua;" .. package.path
    io.read = function(format)
      return __weblua_read(format)
    end

    -- Wasmoon leaves the real Lua stdout/stderr handles connected to the
    -- worker's Emscripten console instead of the result stream. Patch the
    -- shared file methods while retaining the userdata themselves, so
    -- io.type, equality, return values, and writes to ordinary files keep
    -- their native behavior.
    local __weblua_stdout = io.stdout
    local __weblua_stderr = io.stderr
    local __weblua_file_methods = getmetatable(__weblua_stdout).__index
    local __weblua_original_write = __weblua_file_methods.write
    local __weblua_original_flush = __weblua_file_methods.flush
    local __weblua_io_type = io.type
    local __weblua_error = error
    local __weblua_select = select
    local __weblua_type = type
    local __weblua_tostring = tostring

    __weblua_file_methods.write = function(file, ...)
      local sink
      if file == __weblua_stdout and __weblua_io_type(file) == "file" then
        sink = __weblua_write_stdout
      elseif file == __weblua_stderr and __weblua_io_type(file) == "file" then
        sink = __weblua_write_stderr
      else
        return __weblua_original_write(file, ...)
      end

      for index = 1, __weblua_select("#", ...) do
        local value = __weblua_select(index, ...)
        local valueType = __weblua_type(value)
        if valueType ~= "string" and valueType ~= "number" then
          __weblua_error(
            "bad argument #" .. index .. " to 'write' (string expected, got " .. valueType .. ")",
            2
          )
        end
        sink(__weblua_tostring(value))
      end

      return file
    end

    __weblua_file_methods.flush = function(file)
      if file == __weblua_stdout and __weblua_io_type(file) == "file" then
        __weblua_flush_stdout()
        return true
      elseif file == __weblua_stderr and __weblua_io_type(file) == "file" then
        __weblua_flush_stderr()
        return true
      end
      return __weblua_original_flush(file)
    end

    io.write = function(...)
      return io.output():write(...)
    end

    io.flush = function()
      return io.output():flush()
    end

    -- Lua 5.4 returns the loader data as require's second result, which here is
    -- the absolute path inside the virtual mount. Rewrite it to the portable
    -- project-relative path so the mount root never reaches user output, and
    -- keep the original result count so require's arity is unchanged.
    local __weblua_prefix = __weblua_root .. "/"
    local __weblua_prefix_length = #__weblua_prefix
    local __weblua_require = require
    require = function(...)
      local results = table.pack(__weblua_require(...))
      local loaderdata = results[2]
      if
        type(loaderdata) == "string"
        and string.sub(loaderdata, 1, __weblua_prefix_length) == __weblua_prefix
      then
        results[2] = string.sub(loaderdata, __weblua_prefix_length + 1)
      end
      return table.unpack(results, 1, results.n)
    end
  `;
}

async function checkStaticLua(
  project: ProjectPayload,
  deps: RuntimeDependencies
): Promise<Diagnostic[]> {
  const runtime = await createStaticLuaRuntime(project.flavor, deps);
  const diagnostics: Diagnostic[] = [];

  try {
    for (const [path, source] of projectEntries(project)) {
      const error = executeStaticLua(runtime, buildStaticCompileScript(source, path));
      if (error) {
        diagnostics.push(diagnosticFromError(normalizeProjectError(error, project), path, project));
      }
    }
  } finally {
    // Static glue owns no long-lived state outside the Lua states that
    // executeStaticLua closes. Let the worker and module GC reclaim it.
  }

  return diagnostics;
}

async function runStaticLua(
  request: NormalizedRequest,
  push: OutputPush,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<void> {
  const reader = createByteReader(request.stdin);
  const stdout = createByteSink("stdout", push);
  const stderr = createByteSink("stderr", push);
  const runtime = await createStaticLuaRuntime(request.project.flavor, deps, {
    stdin: reader.read,
    stdout: stdout.write,
    stderr: stderr.write,
    print: (value) => push("stdout", [value]),
    printErr: (value) => push("stderr", [value])
  });

  try {
    observer?.executing?.();
    const error = executeStaticLua(runtime, buildStaticProjectBootstrap(request.project));
    if (error) {
      throw new Error(normalizeProjectError(error, request.project));
    }
  } finally {
    stdout.flush();
    stderr.flush();
  }
}

export function buildStaticCompileScript(source: string, filename: string): string {
  const sourceLiteral = luaLongString(source);
  const filenameLiteral = luaLongString(filename);
  return `
    local __weblua_source = ${sourceLiteral}
    local __weblua_filename = ${filenameLiteral}
    local __weblua_chunk, __weblua_error
    if _VERSION == "Lua 5.1" then
      __weblua_chunk, __weblua_error = loadstring(__weblua_source, "@" .. __weblua_filename)
    else
      __weblua_chunk, __weblua_error = load(__weblua_source, "@" .. __weblua_filename, "t", _G)
    end
    if not __weblua_chunk then error(__weblua_error, 0) end
  `;
}

export function buildStaticProjectBootstrap(project: ProjectPayload): string {
  const sourceDefinitions = projectEntries(project)
    .map(([path, source]) => `__weblua_sources[ ${luaLongString(path)} ] = ${luaLongString(source)}`)
    .join("\n");
  const preloadDefinitions = Object.entries(buildModuleAliases(project.files))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([alias, path]) =>
        `package.preload[ ${luaLongString(alias)} ] = __weblua_make_loader(${luaLongString(path)})`
    )
    .join("\n");

  return `
    local __weblua_sources = {}
    ${sourceDefinitions}

    package.path = "?.lua;?/init.lua;" .. package.path

    local function __weblua_compile(source, filename)
      local chunk, compileError
      if _VERSION == "Lua 5.1" then
        chunk, compileError = loadstring(source, "@" .. filename)
      else
        chunk, compileError = load(source, "@" .. filename, "t", _G)
      end
      if not chunk then error(compileError, 0) end
      return chunk
    end

    local function __weblua_make_loader(filename)
      return function(...)
        local chunk = __weblua_compile(__weblua_sources[filename], filename)
        return chunk(...)
      end
    end

    ${preloadDefinitions}

    local __weblua_entry = __weblua_compile(
      __weblua_sources[ ${luaLongString(project.entry)} ],
      ${luaLongString(project.entry)}
    )
    return __weblua_entry()
  `;
}

export async function createStaticLuaRuntime(
  flavor: RuntimeFlavor,
  deps: RuntimeDependencies,
  io: StaticLuaIo = {}
): Promise<StaticLuaRuntime> {
  if (flavor !== "lua51" && flavor !== "lua52" && flavor !== "lua53") {
    throw new Error(`${flavor} is not a static Lua 5.1–5.3 runtime.`);
  }

  const { factory, wasmBinary } = await deps.loadStaticLuaAssets(flavor);
  const glue = factory({
    wasmBinary,
    stdin: io.stdin,
    stdout: io.stdout,
    stderr: io.stderr,
    print: io.print,
    printErr: io.printErr
  });
  await glue.ready;

  const wrap = (
    name: string,
    returnType: "number" | "string" | null,
    argTypes: Array<"number" | "string">
  ) => glue.cwrap(name, returnType, argTypes);
  const isLua51 = flavor === "lua51";
  const call = isLua51
    ? (wrap("lua_pcall", "number", ["number", "number", "number", "number"]) as StaticLuaRuntime["pcall"])
    : (wrap("lua_pcallk", "number", ["number", "number", "number", "number", "number", "number"]) as (...args: number[]) => number);

  return {
    newState: wrap("luaL_newstate", "number", []) as StaticLuaRuntime["newState"],
    openLibs: wrap("luaL_openlibs", null, ["number"]) as StaticLuaRuntime["openLibs"],
    loadString: wrap("luaL_loadstring", "number", ["number", "string"]) as StaticLuaRuntime["loadString"],
    pcall: isLua51
      ? call
      : (state, nargs, nresults, errfunc) =>
          call(state, nargs, nresults, errfunc, 0, 0) as unknown as number,
    toString: wrap("lua_tolstring", "string", ["number", "number", "number"]) as StaticLuaRuntime["toString"],
    close: wrap("lua_close", null, ["number"]) as StaticLuaRuntime["close"]
  };
}

/**
 * Normalizes a glue module's default/namespace export into a callable factory.
 * Hosts differ in whether the CommonJS interop wrapper is applied.
 */
export function asStaticLuaGlueFactory(
  module: unknown,
  flavor: StaticLuaFlavor
): (options: Record<string, unknown>) => StaticLuaGlue {
  const candidate =
    typeof module === "object" && module && "default" in module
      ? (module as { default: unknown }).default
      : module;
  if (typeof candidate !== "function") {
    throw new Error(`The ${flavor} WebAssembly loader is unavailable.`);
  }

  return candidate as (options: Record<string, unknown>) => StaticLuaGlue;
}

export function executeStaticLua(runtime: StaticLuaRuntime, source: string): string | null {
  const state = runtime.newState();
  if (!state) {
    throw new Error("The Lua runtime could not allocate a state.");
  }

  try {
    runtime.openLibs(state);
    let status = runtime.loadString(state, source);
    if (status === LUA_OK) {
      status = runtime.pcall(state, 0, 0, 0);
    }

    return status === LUA_OK ? null : runtime.toString(state, -1) || "Unknown Lua error.";
  } finally {
    runtime.close(state);
  }
}

async function checkLuau(project: ProjectPayload, deps: RuntimeDependencies): Promise<Diagnostic[]> {
  const { LuauState } = await resolveLuauModule(deps);
  const state = await LuauState.createAsync({});
  const diagnostics: Diagnostic[] = [];

  try {
    for (const [path, source] of projectEntries(project)) {
      const loaded = state.loadstring(source, path, false);
      if (typeof loaded === "string") {
        diagnostics.push(diagnosticFromError(loaded, path, project));
      }
    }
    return diagnostics;
  } finally {
    state.destroy();
  }
}

function resolveLuauModule(deps: RuntimeDependencies): Promise<LuauModule> {
  return (deps.loadLuauModule ?? loadLuauModule)();
}

export async function loadLuauModule(): Promise<LuauModule> {
  const globalRef = globalThis as Record<string, unknown>;

  if (typeof globalRef.window === "undefined") {
    globalRef.window = globalRef;
  }

  try {
    Object.defineProperty(globalRef, "WorkerGlobalScope", {
      configurable: true,
      value: undefined
    });
  } catch {
    // luau-web currently ships a browser build. If the shim is blocked, report a runtime error.
  }

  return import("../lib/luauWebAsyncify");
}

async function runLuau(
  request: NormalizedRequest,
  push: OutputPush,
  deps: RuntimeDependencies,
  observer?: RunObserver
): Promise<void> {
  const { LuauState } = await resolveLuauModule(deps);
  const state = await LuauState.createAsync({});
  const reader = createStdinReader(request.stdin);

  try {
    observer?.executing?.();
    const print = (...args: unknown[]) => push("stdout", args);
    const warn = (...args: unknown[]) => push("stderr", args);

    state.setOutputHandlers(print, warn, warn);
    state.env.set("print", print, true);
    state.env.set("warn", warn, true);
    state.env.set("read", (format?: unknown) => reader.read(format), true);

    // Compile every source file before executing the entry. The require
    // bootstrap below only talks to these Luau functions and Lua tables, not
    // to a JavaScript resolver on each module load.
    const modules: Record<string, unknown> = {};
    for (const [path, source] of projectEntries(request.project)) {
      const compiled = state.loadstring(source, path, false);
      if (typeof compiled === "string") {
        throw new Error(compiled);
      }
      modules[path] = compiled;
    }

    state.env.set("__weblua_modules", modules, true);
    state.env.set("__weblua_module_aliases", buildModuleAliases(request.project.files), true);

    const bootstrap = state.loadstring(LUAU_REQUIRE_BOOTSTRAP, "__weblua_require", true);
    await bootstrap();

    // Executing the entry through require gives it the same cache and cycle
    // semantics as all other modules. The only JS-to-Luau call is this single
    // project start; nested module resolution remains inside the VM.
    const entry = state.loadstring(
      `return require(${luaLongString(request.project.entry)})`,
      request.project.entry,
      true
    );
    await entry();
  } finally {
    state.destroy();
  }
}

export const LUAU_REQUIRE_BOOTSTRAP = `
  local moduleFunctions = __weblua_modules
  local moduleAliases = __weblua_module_aliases
  local moduleCache = {}
  local moduleLoading = {}

  local function resolveModule(name)
    local direct = moduleAliases[name]
    if direct then return direct end

    local dotted = string.gsub(name, "%.", "/")
    return moduleAliases[dotted]
  end

  local function loadModule(path)
    local cached = moduleCache[path]
    if cached ~= nil then return cached end
    if moduleLoading[path] then
      error("cyclic require detected for '" .. path .. "'", 3)
    end

    local moduleFunction = moduleFunctions[path]
    if type(moduleFunction) ~= "function" then
      error("module source is unavailable for '" .. path .. "'", 3)
    end

    moduleLoading[path] = true
    local ok, value = pcall(moduleFunction)
    moduleLoading[path] = nil
    if not ok then error(value, 3) end

    if value == nil then value = true end
    moduleCache[path] = value
    return value
  end

  function require(name)
    if type(name) ~= "string" then
      error("require expects a module path string", 2)
    end

    local path = resolveModule(name)
    if not path then
      error("module '" .. name .. "' not found", 2)
    end
    return loadModule(path)
  end
`;

export function buildModuleAliases(files: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  const entries = Object.keys(files).sort((a, b) => a.localeCompare(b));

  // Direct module files take precedence over directory index modules.
  for (const path of entries.filter((file) => !isInitModule(file))) {
    addModuleAliases(aliases, path, false);
  }
  for (const path of entries.filter(isInitModule)) {
    addModuleAliases(aliases, path, true);
  }

  return aliases;
}

function addModuleAliases(aliases: Record<string, string>, path: string, isInit: boolean): void {
  const withoutExtension = path.replace(/\.(?:lua|luau)$/i, "");
  const candidates = new Set([path, withoutExtension, withoutExtension.replaceAll("/", ".")]);

  if (isInit) {
    const parent = withoutExtension.replace(/\/init$/i, "");
    candidates.add(parent);
    candidates.add(parent.replaceAll("/", "."));
  }

  for (const candidate of candidates) {
    if (candidate && !Object.hasOwn(aliases, candidate)) {
      aliases[candidate] = path;
    }
  }
}

export function isInitModule(path: string): boolean {
  return /(?:^|\/)init\.(?:lua|luau)$/i.test(path);
}

export function projectEntries(project: ProjectPayload): Array<[string, string]> {
  return Object.entries(project.files).sort(([a], [b]) => a.localeCompare(b));
}

export function safeVirtualDirectory(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_") || "run";
}

export function luaLongString(value: string): string {
  for (let level = 0; ; level += 1) {
    const equals = "=".repeat(level);
    const close = `]${equals}]`;
    if (!value.includes(close)) {
      return `[${equals}[${value}]${equals}]`;
    }
  }

}

export function createStdinReader(input: string): { read(format?: unknown): string | undefined } {
  let offset = 0;

  return {
    read(format?: unknown): string | undefined {
      const mode = format === undefined || format === null ? "*l" : format;
      if (mode !== "*l" && mode !== "*L" && mode !== "*a") {
        throw new Error("stdin supports only *l, *L, and *a reads.");
      }

      if (mode === "*a") {
        const remaining = input.slice(offset);
        offset = input.length;
        return remaining;
      }

      if (offset >= input.length) {
        return undefined;
      }

      const newline = input.indexOf("\n", offset);
      if (newline === -1) {
        const line = input.slice(offset);
        offset = input.length;
        return line;
      }

      const end = mode === "*L" ? newline + 1 : newline;
      const line = input.slice(offset, end);
      offset = newline + 1;
      return line;
    }
  };
}

export function createByteReader(input: string): { read: () => number | null } {
  const bytes = new TextEncoder().encode(input);
  let offset = 0;

  return {
    read: () => (offset < bytes.length ? bytes[offset++] : null)
  };
}

export function createByteSink(
  kind: OutputChunk["kind"],
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): { write: (byte: number) => void; flush: () => void } {
  let bytes: number[] = [];

  const emit = () => {
    if (bytes.length === 0) {
      push(kind, [""]);
      return;
    }
    push(kind, [new TextDecoder().decode(new Uint8Array(bytes))]);
    bytes = [];
  };

  return {
    write(byte: number) {
      if (!Number.isInteger(byte)) return;
      if (byte === 10) {
        if (bytes[bytes.length - 1] === 13) bytes.pop();
        emit();
        return;
      }
      bytes.push(byte);
    },
    flush() {
      if (bytes.length > 0) emit();
    }
  };
}

export function createTextSink(
  kind: OutputChunk["kind"],
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): { write: (value: string) => void; flush: () => void } {
  let buffer = "";

  const emitCompleteLines = () => {
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      let line = buffer.slice(0, newline);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      push(kind, [line]);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  };

  return {
    write(value) {
      buffer += value;
      emitCompleteLines();
    },
    flush() {
      if (!buffer) return;
      push(kind, [buffer]);
      buffer = "";
    }
  };
}

export function normalizeProjectError(raw: string, project: ProjectPayload): string {
  // Wasmoon reports its mounted absolute path. Output and diagnostics should
  // always use the portable project-relative source paths.
  const rootMatch = raw.match(/\/weblua\/[^/\\:\s]+\//g);
  let normalized = raw;
  for (const root of rootMatch ?? []) {
    normalized = normalized.replaceAll(root, "");
  }

  // Do not leak an implementation chunk name if a runtime places one around
  // an otherwise valid project file name.
  for (const path of Object.keys(project.files)) {
    normalized = normalized.replaceAll(`@${path}:`, `${path}:`);
  }
  return normalized;
}

export function diagnosticFromError(raw: string, fallbackFile?: string, project?: ProjectPayload): Diagnostic {
  const diagnostic = parseCompileError(raw);
  const file = project ? findDiagnosticFile(raw, project) ?? fallbackFile : fallbackFile;
  if (!file) return diagnostic;

  return {
    ...diagnostic,
    file,
    filename: file
  };
}

export function findDiagnosticFile(raw: string, project: ProjectPayload): string | undefined {
  const paths = Object.keys(project.files).sort((a, b) => b.length - a.length);
  return paths.find((path) => raw.includes(`${path}:`) || raw.includes(`\"${path}\"`));
}

export function formatValue(value: unknown): string {
  if (value === null) return "nil";
  if (value === undefined) return "nil";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  return String(error);
}
