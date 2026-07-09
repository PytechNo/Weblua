import { LuaFactory } from "wasmoon";
import { parseCompileError } from "../lib/diagnostics";
import type { CheckResult, Diagnostic, OutputChunk, RunRequest, RunResult } from "../lib/types";

const ctx: Worker = self as unknown as Worker;

// One factory per worker so repeated checks reuse the fetched glue wasm.
const luaFactory = new LuaFactory();

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
  let diagnostics: Diagnostic[] = [];

  try {
    diagnostics =
      request.flavor === "lua54" ? await checkLua54(request.code) : await checkLuau(request.code);
  } catch (error) {
    diagnostics = [parseCompileError(normalizeError(error))];
  }

  const result: CheckResult = {
    id: request.id,
    flavor: request.flavor,
    durationMs: performance.now() - startedAt,
    diagnostics
  };
  ctx.postMessage(result);
}

async function handleRun(request: RunRequest): Promise<void> {
  const startedAt = performance.now();
  const chunks: OutputChunk[] = [];

  const push = (kind: OutputChunk["kind"], values: unknown[]) => {
    chunks.push({
      kind,
      text: values.map(formatValue).join("\t")
    });
  };

  try {
    if (request.flavor === "lua54") {
      await runLua54(request.code, push);
    } else {
      await runLuau(request.code, push);
    }

    const result: RunResult = {
      id: request.id,
      flavor: request.flavor,
      status: "ok",
      durationMs: performance.now() - startedAt,
      chunks: chunks.length ? chunks : [{ kind: "system", text: "Finished with no output." }]
    };
    ctx.postMessage(result);
  } catch (error) {
    const result: RunResult = {
      id: request.id,
      flavor: request.flavor,
      status: "error",
      durationMs: performance.now() - startedAt,
      chunks: [
        ...chunks,
        {
          kind: "stderr",
          text: normalizeError(error)
        }
      ]
    };
    ctx.postMessage(result);
  }
}

async function checkLua54(code: string): Promise<Diagnostic[]> {
  const engine = await luaFactory.createEngine();

  try {
    engine.global.loadString(code, "main.lua");
    return [];
  } catch (error) {
    return [parseCompileError(normalizeError(error))];
  } finally {
    engine.global.close();
  }
}

async function checkLuau(code: string): Promise<Diagnostic[]> {
  const { LuauState } = await loadLuauModule();
  const state = await LuauState.createAsync({});

  try {
    const loaded = state.loadstring(code, "main.luau", false);
    if (typeof loaded === "string") {
      return [parseCompileError(loaded)];
    }
    return [];
  } finally {
    state.destroy();
  }
}

async function runLua54(
  code: string,
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  const engine = await luaFactory.createEngine({
    functionTimeout: 4500,
    traceAllocations: true
  });

  try {
    engine.global.setMemoryMax(32 * 1024 * 1024);
    engine.global.set("print", (...args: unknown[]) => push("stdout", args));
    engine.global.set("warn", (...args: unknown[]) => push("stderr", args));
    await engine.doString(code);
  } finally {
    engine.global.close();
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
  code: string,
  push: (kind: OutputChunk["kind"], values: unknown[]) => void
): Promise<void> {
  const { LuauState, InternalLuauWasmModule } = await loadLuauModule();
  const state = await LuauState.createAsync({});

  try {
    const print = (...args: unknown[]) => push("stdout", args);
    const warn = (...args: unknown[]) => push("stderr", args);

    InternalLuauWasmModule.fprint = print;
    InternalLuauWasmModule.fprintwarn = warn;
    InternalLuauWasmModule.fprinterr = warn;
    state.env.set("print", print, true);
    state.env.set("warn", warn, true);

    const runnable = state.loadstring(code, "Weblua", true);
    if (typeof runnable !== "function") {
      throw new Error(runnable);
    }
    // luau-web executes via Asyncify, so runnable() returns a promise.
    // Awaiting it lets print() fire before the state is destroyed below.
    await runnable();
  } finally {
    state.destroy();
  }
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
