import type { RunResult } from "./types";

const encoder = new TextEncoder();

/**
 * A Lua string literal holding `text`'s UTF-8 bytes. Every byte is a
 * three-digit decimal escape, which every Lua version and Luau read the same
 * way, so no input can end the literal early.
 */
export function luaStringLiteral(text: string): string {
  return `"${Array.from(encoder.encode(text), (byte) => `\\${String(byte).padStart(3, "0")}`).join("")}"`;
}

/** Bytes from the lowercase hex a generated script prints, so binary captures survive. */
export function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** Lua's own error text from a failed generated script, without the script's file, line, and traceback. */
export function scriptError(result: RunResult): string {
  const text = result.chunks
    .filter((chunk) => chunk.kind === "stderr")
    .map((chunk) => chunk.text)
    .join("\n")
    .split("\nstack traceback:")[0];
  return text.replace(/^(?:\[string "[^"]*"\]|[\w./]+\.luau?):\d+: /gm, "").trim() || "The script failed without a message.";
}

/** The lines a generated script printed. */
export function stdoutLines(result: RunResult): string[] {
  return result.chunks.filter((chunk) => chunk.kind === "stdout").map((chunk) => chunk.text);
}
