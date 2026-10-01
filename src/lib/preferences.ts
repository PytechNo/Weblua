import type { LuauTypeMode } from "./types";

const LUAU_TYPE_MODE_KEY = "weblua:luau-type-mode";

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
