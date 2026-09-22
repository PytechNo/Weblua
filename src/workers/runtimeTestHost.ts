// Node host for the execution suites. It supplies the same runtime dependencies
// the browser worker does; only asset loading differs, because Node reads the
// WebAssembly from node_modules while the worker fetches Vite's emitted URL.
import { readFile } from "node:fs/promises";
import { LuaFactory } from "wasmoon";
import type { CheckResult, ProjectPayload, RunResult } from "../lib/types";
import {
  asStaticLuaGlueFactory,
  processRequest,
  type RunObserver,
  type RuntimeDependencies,
  type StaticLuaAssets,
  type StaticLuaFlavor
} from "./projectRuntime";

const STATIC_WASM: Record<StaticLuaFlavor, string> = {
  lua51: "node_modules/lua-wasm-bindings/dist/glue/glue-lua-5.1.5.wasm",
  lua52: "node_modules/lua-wasm-bindings/dist/glue/glue-lua-5.2.4.wasm",
  lua53: "node_modules/lua-wasm-bindings/dist/glue/glue-lua-5.3.6.wasm"
};

// Literal specifiers, exactly as the worker uses: a computed one is unresolvable.
function importStaticLuaGlue(flavor: StaticLuaFlavor): Promise<unknown> {
  switch (flavor) {
    case "lua51":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.1.5.js");
    case "lua52":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js");
    case "lua53":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.3.6.js");
  }
}

async function loadStaticLuaAssets(flavor: StaticLuaFlavor): Promise<StaticLuaAssets> {
  const [module, wasm] = await Promise.all([
    importStaticLuaGlue(flavor),
    readFile(STATIC_WASM[flavor])
  ]);

  return {
    factory: asStaticLuaGlueFactory(module, flavor),
    wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer
  };
}

export const testDependencies: RuntimeDependencies = {
  lua54Factory: new LuaFactory(),
  loadStaticLuaAssets
};

/** Fresh per request, exactly as runner.ts and checker.ts do in the app. */
export async function runProjectForTest(
  project: ProjectPayload,
  stdin = "",
  observer?: RunObserver
): Promise<RunResult> {
  return (await processRequest(
    { id: crypto.randomUUID(), project, stdin },
    testDependencies,
    observer
  )) as RunResult;
}

export async function checkProjectForTest(project: ProjectPayload): Promise<CheckResult> {
  return (await processRequest(
    { id: crypto.randomUUID(), project, mode: "check" },
    testDependencies
  )) as CheckResult;
}

export function stdoutOf(result: RunResult): string[] {
  return result.chunks.filter((chunk) => chunk.kind === "stdout").map((chunk) => chunk.text);
}

export function stderrOf(result: RunResult): string[] {
  return result.chunks.filter((chunk) => chunk.kind === "stderr").map((chunk) => chunk.text);
}
