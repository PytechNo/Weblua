import { LuaFactory } from "wasmoon";
import wasmoonWasmUrl from "wasmoon/dist/glue.wasm?url";
import { parseCompileError } from "../lib/diagnostics";
import type {
  CheckResult,
  Diagnostic,
  OutputChunk,
  ProjectPayload,
  RunRequest,
  RunResult,
  RuntimeFlavor
} from "../lib/types";

const ctx: Worker = self as unknown as Worker;

const LUA_OK = 0;
const LUA_MEMORY_LIMIT = 32 * 1024 * 1024;

// Passing Vite's emitted asset URL keeps the Lua 5.4 runtime entirely
// same-origin. Wasmoon's default browser constructor otherwise points at unpkg.
const lua54Factory = new LuaFactory(wasmoonWasmUrl);

type LuaFlavor = "lua51" | "lua52" | "lua53" | "lua54";

interface NormalizedRequest {
  id: string;
  mode: "run" | "check";
  project: ProjectPayload;
  stdin: string;
  activeFile?: string;
}

interface StaticLuaGlue {
  ready?: Promise<unknown>;
  cwrap(
    name: string,
    returnType: "number" | "string" | null,
    argTypes?: Array<"number" | "string">
  ): (...args: Array<number | string>) => unknown;
}

interface StaticLuaRuntime {
  newState(): number;
  openLibs(state: number): void;
  loadString(state: number, source: string): number;
  pcall(state: number, nargs: number, nresults: number, errfunc: number): number;
  toString(state: number, index: number): string;
  close(state: number): void;
}

ctx.onmessage = async (event: MessageEvent<RunRequest>) => {
  const request = event.data;

  if (request.mode === "check") {
    await handleCheck(request);
    return;
  }

  await handleRun(request);
};

async function handleCheck(request: RunRequest): Promise<void> {
  const startedAt = performance.now();
  const fallbackFlavor = requestFlavor(request);
  let flavor = fallbackFlavor;
  let diagnostics: Diagnostic[] = [];

  try {
    const normalized = normalizeRequest(request);
    flavor = normalized.project.flavor;
    diagnostics = await checkProject(normalized.project);
  } catch (error) {
    diagnostics = [diagnosticFromError(normalizeError(error))];
  }

  const result: CheckResult = {
    id: request.id,
    flavor,
    durationMs: performance.now() - startedAt,
    diagnostics
  };
  ctx.postMessage(result);
}

async function handleRun(request: RunRequest): Promise<void> {
  const startedAt = performance.now();
  const chunks: OutputChunk[] = [];
  let flavor = requestFlavor(request);
  let project: ProjectPayload | undefined;

  const push = (kind: OutputChunk["kind"], values: unknown[]) => {
    chunks.push({
      kind,
      text: values.map(formatValue).join("\t")
    });
  };

  try {
    const normalized = normalizeRequest(request);
    project = normalized.project;
    flavor = project.flavor;
    await runProject(normalized, push);

    const result: RunResult = {
      id: request.id,
      flavor,
      status: "ok",
      durationMs: performance.now() - startedAt,
      chunks: chunks.length ? chunks : [{ kind: "system", text: "Finished with no output." }]
    };
    ctx.postMessage(result);
  } catch (error) {
    const rawError = project ? normalizeProjectError(normalizeError(error), project) : normalizeError(error);
    const result: RunResult = {
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
    ctx.postMessage(result);
  }
}

function normalizeRequest(request: RunRequest): NormalizedRequest {
  if ("project" in request) {
    return {
      id: request.id,
      mode: request.mode ?? "run",
      project: validateProject(request.project),
      stdin: typeof request.stdin === "string" ? request.stdin : "",
      activeFile: request.activeFile
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
    stdin: ""
  };
}

function requestFlavor(request: RunRequest): RuntimeFlavor {
  return "project" in request ? request.project.flavor : request.flavor;
}

function validateProject(project: ProjectPayload): ProjectPayload {
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

function isRuntimeFlavor(flavor: unknown): flavor is RuntimeFlavor {
  return flavor === "lua51" || flavor === "lua52" || flavor === "lua53" || flavor === "lua54" || flavor === "luau";
}

function isProjectPath(path: unknown): path is string {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return false;
  }

  return path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

async function checkProject(project: ProjectPayload): Promise<Diagnostic[]> {
  switch (project.flavor) {
    case "lua54":
      return checkLua54(project);
    case "luau":
      return checkLuau(project);
    case "lua51":
    case "lua52":
    case "lua53":
      return checkStaticLua(project);
  }
}

async function runProject(
  request: NormalizedRequest,
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  switch (request.project.flavor) {
    case "lua54":
      return runLua54(request, push);
    case "luau":
      return runLuau(request, push);
    case "lua51":
    case "lua52":
    case "lua53":
      return runStaticLua(request, push);
  }
}

async function checkLua54(project: ProjectPayload): Promise<Diagnostic[]> {
  const engine = await lua54Factory.createEngine();
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
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  const engine = await lua54Factory.createEngine({
    functionTimeout: 4500,
    traceAllocations: true
  });
  const reader = createStdinReader(request.stdin);
  const root = `/weblua/${safeVirtualDirectory(request.id)}`;

  try {
    engine.global.setMemoryMax(LUA_MEMORY_LIMIT);
    engine.global.set("print", (...args: unknown[]) => push("stdout", args));
    engine.global.set("warn", (...args: unknown[]) => push("stderr", args));
    engine.global.set("__weblua_read", (format?: unknown) => reader.read(format));

    // The mounted root is unique to this request. A run worker is normally
    // short-lived, and this additionally keeps a reused worker from observing
    // source files mounted by an earlier run.
    for (const [path, source] of projectEntries(request.project)) {
      await lua54Factory.mountFile(`${root}/${path}`, source);
    }

    await engine.doString(buildLua54Bootstrap(root));
    await engine.doFile(`${root}/${request.project.entry}`);
  } finally {
    engine.global.close();
  }
}

function buildLua54Bootstrap(root: string): string {
  const rootLiteral = luaLongString(root);
  return `
    local __weblua_root = ${rootLiteral}
    package.path = __weblua_root .. "/?.lua;" .. __weblua_root .. "/?/init.lua;" .. package.path
    io.read = function(format)
      return __weblua_read(format)
    end
  `;
}

async function checkStaticLua(project: ProjectPayload): Promise<Diagnostic[]> {
  const runtime = await createStaticLuaRuntime(project.flavor);
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
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  const reader = createByteReader(request.stdin);
  const stdout = createByteSink("stdout", push);
  const stderr = createByteSink("stderr", push);
  const runtime = await createStaticLuaRuntime(request.project.flavor, {
    stdin: reader.read,
    stdout: stdout.write,
    stderr: stderr.write,
    print: (value) => push("stdout", [value]),
    printErr: (value) => push("stderr", [value])
  });

  try {
    const error = executeStaticLua(runtime, buildStaticProjectBootstrap(request.project));
    if (error) {
      throw new Error(normalizeProjectError(error, request.project));
    }
  } finally {
    stdout.flush();
    stderr.flush();
  }
}

function buildStaticCompileScript(source: string, filename: string): string {
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

function buildStaticProjectBootstrap(project: ProjectPayload): string {
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

async function createStaticLuaRuntime(
  flavor: RuntimeFlavor,
  io: {
    stdin?: () => number | null | undefined;
    stdout?: (byte: number) => void;
    stderr?: (byte: number) => void;
    print?: (value: unknown) => void;
    printErr?: (value: unknown) => void;
  } = {}
): Promise<StaticLuaRuntime> {
  if (flavor !== "lua51" && flavor !== "lua52" && flavor !== "lua53") {
    throw new Error(`${flavor} is not a static Lua 5.1–5.3 runtime.`);
  }

  const { factory, wasmUrl } = await loadStaticLuaAssets(flavor);
  const wasmBinary = await loadStaticLuaWasm(wasmUrl, flavor);
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

async function loadStaticLuaAssets(flavor: Exclude<LuaFlavor, "lua54">): Promise<{
  factory: (options: Record<string, unknown>) => StaticLuaGlue;
  wasmUrl: string;
}> {
  const module = await loadStaticLuaGlueFactory(flavor);
  const factoryCandidate =
    typeof module === "object" && module && "default" in module
      ? (module as { default: unknown }).default
      : module;
  if (typeof factoryCandidate !== "function") {
    throw new Error(`The ${flavor} WebAssembly loader is unavailable.`);
  }

  return {
    factory: factoryCandidate as (options: Record<string, unknown>) => StaticLuaGlue,
    wasmUrl: await loadStaticLuaWasmUrl(flavor)
  };
}

async function loadStaticLuaWasm(
  wasmUrl: string,
  flavor: Exclude<LuaFlavor, "lua54">
): Promise<ArrayBuffer> {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Could not load the self-hosted ${flavor} runtime (${response.status}).`);
  }
  return response.arrayBuffer();
}

async function loadStaticLuaGlueFactory(flavor: Exclude<LuaFlavor, "lua54">): Promise<unknown> {
  switch (flavor) {
    case "lua51":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.1.5.js");
    case "lua52":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js");
    case "lua53":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.3.6.js");
  }
}

async function loadStaticLuaWasmUrl(flavor: Exclude<LuaFlavor, "lua54">): Promise<string> {
  switch (flavor) {
    case "lua51":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.1.5.wasm?url")).default;
    case "lua52":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.wasm?url")).default;
    case "lua53":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.3.6.wasm?url")).default;
  }
}

function executeStaticLua(runtime: StaticLuaRuntime, source: string): string | null {
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

async function checkLuau(project: ProjectPayload): Promise<Diagnostic[]> {
  const { LuauState } = await loadLuauModule();
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

async function loadLuauModule() {
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
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  const { LuauState, InternalLuauWasmModule } = await loadLuauModule();
  const state = await LuauState.createAsync({});
  const reader = createStdinReader(request.stdin);

  try {
    const print = (...args: unknown[]) => push("stdout", args);
    const warn = (...args: unknown[]) => push("stderr", args);

    InternalLuauWasmModule.fprint = print;
    InternalLuauWasmModule.fprintwarn = warn;
    InternalLuauWasmModule.fprinterr = warn;
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

const LUAU_REQUIRE_BOOTSTRAP = `
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

function buildModuleAliases(files: Record<string, string>): Record<string, string> {
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

function isInitModule(path: string): boolean {
  return /(?:^|\/)init\.(?:lua|luau)$/i.test(path);
}

function projectEntries(project: ProjectPayload): Array<[string, string]> {
  return Object.entries(project.files).sort(([a], [b]) => a.localeCompare(b));
}

function safeVirtualDirectory(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_") || "run";
}

function luaLongString(value: string): string {
  for (let level = 0; ; level += 1) {
    const equals = "=".repeat(level);
    const close = `]${equals}]`;
    if (!value.includes(close)) {
      return `[${equals}[${value}]${equals}]`;
    }
  }

}

function createStdinReader(input: string): { read(format?: unknown): string | undefined } {
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

function createByteReader(input: string): { read: () => number | null } {
  const bytes = new TextEncoder().encode(input);
  let offset = 0;

  return {
    read: () => (offset < bytes.length ? bytes[offset++] : null)
  };
}

function createByteSink(
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

function normalizeProjectError(raw: string, project: ProjectPayload): string {
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

function diagnosticFromError(raw: string, fallbackFile?: string, project?: ProjectPayload): Diagnostic {
  const diagnostic = parseCompileError(raw);
  const file = project ? findDiagnosticFile(raw, project) ?? fallbackFile : fallbackFile;
  if (!file) return diagnostic;

  return {
    ...diagnostic,
    file,
    filename: file
  };
}

function findDiagnosticFile(raw: string, project: ProjectPayload): string | undefined {
  const paths = Object.keys(project.files).sort((a, b) => b.length - a.length);
  return paths.find((path) => raw.includes(`${path}:`) || raw.includes(`\"${path}\"`));
}

function formatValue(value: unknown): string {
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  return String(error);
}
