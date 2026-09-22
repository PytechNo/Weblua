import { LuaFactory } from "wasmoon";
import wasmoonWasmUrl from "wasmoon/dist/glue.wasm?url";
import {
  asStaticLuaGlueFactory,
  processRequest,
  type RunObserver,
  type RuntimeDependencies,
  type StaticLuaAssets,
  type StaticLuaFlavor
} from "./projectRuntime";
import type { RunProgress, RunRequest } from "../lib/types";

const ctx: Worker = self as unknown as Worker;

// Passing Vite's emitted asset URL keeps the Lua 5.4 runtime entirely
// same-origin. Wasmoon's default browser constructor otherwise points at unpkg.
const lua54Factory = new LuaFactory(wasmoonWasmUrl);

const browserDependencies: RuntimeDependencies = {
  lua54Factory,
  loadStaticLuaAssets
};

ctx.onmessage = async (event: MessageEvent<RunRequest>) => {
  const request = event.data;
  ctx.postMessage(await processRequest(request, browserDependencies, runObserver(request)));
};

/**
 * Progress is only useful for runs: a check compiles without executing and
 * produces no output. Posting during a run matters even when the worker is
 * blocked in synchronous Lua, because each postMessage is queued on the page
 * as it is called rather than when this worker next yields.
 */
function runObserver(request: RunRequest): RunObserver | undefined {
  if (request.mode === "check") return undefined;

  const post = (message: RunProgress) => ctx.postMessage(message);
  return {
    executing: () => post({ type: "started", id: request.id }),
    chunk: (chunks) => post({ type: "chunk", id: request.id, chunks })
  };
}

async function loadStaticLuaAssets(flavor: StaticLuaFlavor): Promise<StaticLuaAssets> {
  const [module, wasmUrl] = await Promise.all([
    loadStaticLuaGlueFactory(flavor),
    loadStaticLuaWasmUrl(flavor)
  ]);

  return {
    factory: asStaticLuaGlueFactory(module, flavor),
    wasmBinary: await loadStaticLuaWasm(wasmUrl, flavor)
  };
}

async function loadStaticLuaWasm(wasmUrl: string, flavor: StaticLuaFlavor): Promise<ArrayBuffer> {
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Could not load the self-hosted ${flavor} runtime (${response.status}).`);
  }
  return response.arrayBuffer();
}

async function loadStaticLuaGlueFactory(flavor: StaticLuaFlavor): Promise<unknown> {
  switch (flavor) {
    case "lua51":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.1.5.js");
    case "lua52":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js");
    case "lua53":
      return import("lua-wasm-bindings/dist/glue/glue-lua-5.3.6.js");
  }
}

async function loadStaticLuaWasmUrl(flavor: StaticLuaFlavor): Promise<string> {
  switch (flavor) {
    case "lua51":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.1.5.wasm?url")).default;
    case "lua52":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.2.4.wasm?url")).default;
    case "lua53":
      return (await import("lua-wasm-bindings/dist/glue/glue-lua-5.3.6.wasm?url")).default;
  }
}
