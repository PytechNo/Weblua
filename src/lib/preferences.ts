import type { BytecodeOptions, CompilerLevel, LuauTypeMode } from "./types";

const LUAU_TYPE_MODE_KEY = "weblua:luau-type-mode";
const BYTECODE_OPTIONS_KEY = "weblua:bytecode-options";

/**
 * Strict by default: it is the mode that reports annotation mismatches, which
 * is what someone choosing Luau in a playground is usually testing. Nonstrict
 * only reports code that would certainly fail at runtime.
 */
export const DEFAULT_LUAU_TYPE_MODE: LuauTypeMode = "strict";

function isLuauTypeMode(value: unknown): value is LuauTypeMode {
  return value === "strict" || value === "nonstrict" || value === "off";
}

/** A per-browser preference. Shared projects choose per file with hot comments. */
export function readLuauTypeMode(): LuauTypeMode {
  try {
    const stored = window.localStorage.getItem(LUAU_TYPE_MODE_KEY);
    return isLuauTypeMode(stored) ? stored : DEFAULT_LUAU_TYPE_MODE;
  } catch {
    return DEFAULT_LUAU_TYPE_MODE;
  }
}

export function storeLuauTypeMode(mode: LuauTypeMode): void {
  try {
    window.localStorage.setItem(LUAU_TYPE_MODE_KEY, mode);
  } catch {
    // Private windows and blocked storage simply forget the choice.
  }
}

/** Luau's own defaults, which are also the levels runs compile at. */
export const DEFAULT_BYTECODE_OPTIONS: BytecodeOptions = {
  optimizationLevel: 1,
  debugLevel: 1,
  source: true
};

function isCompilerLevel(value: unknown): value is CompilerLevel {
  return value === 0 || value === 1 || value === 2;
}

export function readBytecodeOptions(): BytecodeOptions {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(BYTECODE_OPTIONS_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null) return DEFAULT_BYTECODE_OPTIONS;
    const { optimizationLevel, debugLevel, source } = stored as Record<string, unknown>;
    return {
      optimizationLevel: isCompilerLevel(optimizationLevel)
        ? optimizationLevel
        : DEFAULT_BYTECODE_OPTIONS.optimizationLevel,
      debugLevel: isCompilerLevel(debugLevel) ? debugLevel : DEFAULT_BYTECODE_OPTIONS.debugLevel,
      source: typeof source === "boolean" ? source : DEFAULT_BYTECODE_OPTIONS.source
    };
  } catch {
    return DEFAULT_BYTECODE_OPTIONS;
  }
}

export function storeBytecodeOptions(options: BytecodeOptions): void {
  try {
    window.localStorage.setItem(BYTECODE_OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // As above: the choice lasts until the page closes.
  }
}
