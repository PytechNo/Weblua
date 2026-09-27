import type { RuntimeFlavor } from "./types";

type StyLua = typeof import("@johnnymorganz/stylua/web");

export type FormatResult = { ok: true; code: string } | { ok: false; message: string };

let styluaPromise: Promise<StyLua> | null = null;

/**
 * Loads StyLua's WebAssembly build on first use. It is several times larger
 * than the rest of the editor, so nothing fetches it until someone formats.
 */
function loadStylua(): Promise<StyLua> {
  styluaPromise ??= (async () => {
    const [stylua, { default: wasmUrl }] = await Promise.all([
      import("@johnnymorganz/stylua/web"),
      import("@johnnymorganz/stylua/stylua_lib_bg.wasm?url")
    ]);
    await stylua.default({ module_or_path: wasmUrl });
    return stylua;
  })().catch((error: unknown) => {
    styluaPromise = null;
    throw error;
  });
  return styluaPromise;
}

/** StyLua has no Lua 5.5 mode yet; 5.4 covers everything but 5.5's new syntax. */
function syntaxFor(stylua: StyLua, flavor: RuntimeFlavor): StyLua["LuaVersion"][keyof StyLua["LuaVersion"]] {
  switch (flavor) {
    case "lua51":
      return stylua.LuaVersion.Lua51;
    case "lua52":
      return stylua.LuaVersion.Lua52;
    case "lua53":
      return stylua.LuaVersion.Lua53;
    case "lua54":
    case "lua55":
      return stylua.LuaVersion.Lua54;
    case "luau":
      return stylua.LuaVersion.Luau;
  }
}

/** StyLua's parse errors run to several lines; the first names the problem and position. */
function formatError(error: unknown, flavor: RuntimeFlavor): string {
  const detail = String(error instanceof Error ? error.message : error)
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^failed to format from stylua:\s*/i, "");
  const reason = detail ? `: ${detail}` : ".";
  const hint =
    flavor === "lua55" ? " StyLua does not support Lua 5.5 syntax such as global declarations yet." : "";
  return `Format failed${reason}${hint}`;
}

/**
 * Formats with an already initialized StyLua module. Two-space indents, like
 * the examples. formatCode takes ownership of the config, so it is not freed here.
 */
export function formatWith(stylua: StyLua, code: string, flavor: RuntimeFlavor): FormatResult {
  const config = stylua.Config.new();
  try {
    config.syntax = syntaxFor(stylua, flavor);
    config.indent_type = stylua.IndentType.Spaces;
    config.indent_width = 2;
    config.line_endings = stylua.LineEndings.Unix;
    return { ok: true, code: stylua.formatCode(code, config, undefined, stylua.OutputVerification.None) };
  } catch (error) {
    return { ok: false, message: formatError(error, flavor) };
  }
}

export async function formatLua(code: string, flavor: RuntimeFlavor): Promise<FormatResult> {
  let stylua: StyLua;
  try {
    stylua = await loadStylua();
  } catch {
    return { ok: false, message: "The formatter could not be loaded. Check your connection and try again." };
  }
  return formatWith(stylua, code, flavor);
}

/**
 * The smallest single replacement that turns `before` into `after`. Applying
 * only the changed middle keeps the cursor and scroll position where they were
 * whenever formatting leaves that part of the file alone.
 */
export function minimalChange(before: string, after: string): { from: number; to: number; insert: string } | null {
  if (before === after) return null;
  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before[start] === after[start]) start += 1;
  let end = 0;
  while (
    end < shortest - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}
