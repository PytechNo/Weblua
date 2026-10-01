import type { Lua } from "@luau-rs/luau";
import type { BytecodeOptions, BytecodeResult } from "../lib/types";

/**
 * Lists the bytecode Luau compiles `source` to. Remarks (inlining, allocations)
 * are always on. `locals` adds nothing below debug level 2, the level that keeps
 * local names, so the debug level alone decides whether they appear.
 */
export function dumpBytecode(lua: Lua, source: string, options: BytecodeOptions): BytecodeResult {
  try {
    const listing = lua.dump(source, {
      optimizationLevel: options.optimizationLevel,
      debugLevel: options.debugLevel,
      code: true,
      lines: true,
      source: options.source,
      locals: true,
      remarks: true
    });
    return { ok: true, listing: listing.trimEnd(), compiler: lua.version };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
