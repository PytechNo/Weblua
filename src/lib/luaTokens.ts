export type LuaTokenKind = "comment" | "string" | "number" | "keyword" | "builtin";

export interface LuaToken {
  text: string;
  kind?: LuaTokenKind;
}

const KEYWORDS =
  "and|break|continue|do|else|elseif|end|export|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|type|typeof|until|while";
const BUILTINS =
  "assert|coroutine|error|getmetatable|ipairs|math|next|os|pairs|pcall|print|rawequal|rawget|rawset|require|select|self|setmetatable|string|table|task|tonumber|tostring|utf8|xpcall";

// One alternative per token kind; long brackets close with the same number of = signs.
const TOKEN = new RegExp(
  [
    "(--\\[(=*)\\[[\\s\\S]*?\\]\\2\\]|--[^\\n]*)",
    "(\"(?:\\\\[\\s\\S]|[^\"\\\\\\n])*\"|'(?:\\\\[\\s\\S]|[^'\\\\\\n])*'|`(?:\\\\[\\s\\S]|[^`\\\\])*`|\\[(=*)\\[[\\s\\S]*?\\]\\4\\])",
    "\\b(0[xXbB][\\da-fA-F_]+|\\d[\\d_]*(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)\\b",
    `\\b(${KEYWORDS})\\b`,
    `\\b(${BUILTINS})\\b`
  ].join("|"),
  "g"
);

/**
 * Splits Lua or Luau source for colouring. A pattern, not a parser, because
 * the article pages should not load the editor's grammar for read-only code.
 * shortcut: an interpolated string is one string token, so its {expressions}
 * stay string-coloured; use the Lezer grammar if that ever matters.
 */
export function tokenizeLua(code: string): LuaToken[] {
  const tokens: LuaToken[] = [];
  let cursor = 0;
  for (const match of code.matchAll(TOKEN)) {
    if (match.index > cursor) tokens.push({ text: code.slice(cursor, match.index) });
    const kind: LuaTokenKind = match[1] ? "comment" : match[3] ? "string" : match[5] ? "number" : match[6] ? "keyword" : "builtin";
    tokens.push({ text: match[0], kind });
    cursor = match.index + match[0].length;
  }
  if (cursor < code.length) tokens.push({ text: code.slice(cursor) });
  return tokens;
}
