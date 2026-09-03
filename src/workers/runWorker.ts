import { LuaFactory } from "wasmoon";
import wasmoonWasmUrl from "wasmoon/dist/glue.wasm?url";
import {
  asStaticLuaGlueFactory,
  processRequest,
  type RuntimeDependencies,
  type StaticLuaAssets,
  type StaticLuaFlavor
} from "./projectRuntime";
import type { RunRequest } from "../lib/types";

const ctx: Worker = self as unknown as Worker;

// Passing Vite's emitted asset URL keeps the Lua 5.4 runtime entirely
// same-origin. Wasmoon's default browser constructor otherwise points at unpkg.
const lua54Factory = new LuaFactory(wasmoonWasmUrl);

const browserDependencies: RuntimeDependencies = {
  lua54Factory,
  loadStaticLuaAssets
};

ctx.onmessage = async (event: MessageEvent<RunRequest>) => {
  ctx.postMessage(await processRequest(event.data, browserDependencies));
};

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
