import { Lua } from "@luau-rs/luau";
import type { BytecodeRequest, BytecodeResponse } from "../lib/types";
import { dumpBytecode } from "./luauBytecodeDump";

const ctx: Worker = self as unknown as Worker;

// One state for the life of the worker. It only ever compiles; creating it is
// what downloads and instantiates the compiler, and each listing then takes a
// few milliseconds.
const compiler = Lua.create({ libraries: "none" });

// Every request reports a failed load itself; this only keeps the rejection
// from also surfacing as unhandled before the first request arrives.
compiler.catch(() => undefined);

ctx.onmessage = async (event: MessageEvent<BytecodeRequest>) => {
  const { id, source, options } = event.data;
  let response: BytecodeResponse;

  try {
    response = { id, result: dumpBytecode(await compiler, source, options) };
  } catch {
    response = { id, result: null };
  }

  ctx.postMessage(response);
};
