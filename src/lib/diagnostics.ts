import type { Diagnostic } from "./types";

// Compile errors arrive as plain strings in two shapes:
//   Luau:    `Weblua:3: Expected identifier when parsing expression, got '='`
//   Lua 5.4: `main.lua:3: unexpected symbol near '='` or `[string "..."]:3: ...`
const LOCATION_PATTERN = /^(?:\[string "[^"]*"\]|[^:\r\n]{1,64}?):(\d+):\s*(.+)$/s;

export function parseCompileError(raw: string): Diagnostic {
  const text = raw.trim();
  const match = LOCATION_PATTERN.exec(text);

  if (match) {
    return {
      line: Math.max(1, Number.parseInt(match[1], 10)),
      message: match[2].trim(),
      severity: "error"
    };
  }

  return {
    line: 1,
    message: text || "Unknown compile error.",
    severity: "error"
  };
}
