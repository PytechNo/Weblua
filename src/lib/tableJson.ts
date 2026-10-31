import { luaStringLiteral, scriptError, stdoutLines } from "./luaSource";
import type { RunResult } from "./types";

/**
 * A Lua 5.4 script that evaluates `source` -- a table constructor, any
 * expression, or a chunk that returns a value -- and prints it as JSON.
 */
export function buildLuaToJsonScript(source: string): string {
  return `
local source = ${luaStringLiteral(source)}
local expression, expressionError = load("return " .. source, "=table")
local chunk = expression
if not chunk then
  local statements, statementsError = load(source, "=table")
  chunk = statements
  if not chunk then
    error(source:match("^%s*{") and expressionError or statementsError, 0)
  end
end

local mathType, format, concat, sort = math.type, string.format, table.concat, table.sort
local escapes = { ['"'] = '\\\\"', ["\\\\"] = "\\\\\\\\", ["\\b"] = "\\\\b", ["\\f"] = "\\\\f", ["\\n"] = "\\\\n", ["\\r"] = "\\\\r", ["\\t"] = "\\\\t" }

local function quote(text)
  return '"' .. text:gsub('[%c"\\\\]', function(c) return escapes[c] or format("\\\\u%04x", c:byte()) end) .. '"'
end

local function number(n)
  if n ~= n or n == math.huge or n == -math.huge then
    error("JSON has no NaN or infinity, so " .. tostring(n) .. " cannot be converted", 0)
  end
  if mathType(n) == "integer" then return format("%d", n) end
  -- The shortest form that reads back as the same float.
  for digits = 15, 17 do
    local text = format("%." .. digits .. "g", n)
    if tonumber(text) == n then return text end
  end
end

local function encode(value, indent, seen)
  local kind = type(value)
  if kind == "nil" then return "null" end
  if kind == "boolean" then return tostring(value) end
  if kind == "number" then return number(value) end
  if kind == "string" then return quote(value) end
  if kind ~= "table" then error("a " .. kind .. " has no JSON form", 0) end
  if seen[value] then error("the table contains itself, which JSON cannot represent", 0) end
  seen[value] = true

  local keys, count, isArray = {}, 0, true
  for key in pairs(value) do
    local keyType = type(key)
    if keyType ~= "string" and keyType ~= "number" then
      error("a " .. keyType .. " key has no JSON form", 0)
    end
    count = count + 1
    keys[count] = key
    if mathType(key) ~= "integer" or key < 1 then isArray = false end
  end
  for index = 1, isArray and count or 0 do
    if value[index] == nil then isArray = false break end
  end

  local inner = indent .. "  "
  local parts = {}
  if isArray then
    seen[value] = nil
    if count == 0 then return "[]" end
    for index = 1, count do parts[index] = inner .. encode(value[index], inner, seen) end
    return "[\\n" .. concat(parts, ",\\n") .. "\\n" .. indent .. "]"
  end

  sort(keys, function(a, b)
    if type(a) ~= type(b) then return type(a) == "number" end
    return a < b
  end)
  local names = {}
  for index, key in ipairs(keys) do
    local name = type(key) == "string" and key or number(key)
    if names[name] then error("two keys both become " .. quote(name) .. " in JSON", 0) end
    names[name] = true
    parts[index] = inner .. quote(name) .. ": " .. encode(value[key], inner, seen)
  end
  seen[value] = nil
  return "{\\n" .. concat(parts, ",\\n") .. "\\n" .. indent .. "}"
end

print(encode(chunk(), "", {}))
`;
}

export function parseLuaToJsonOutput(result: RunResult): { ok: true; json: string } | { ok: false; error: string } {
  return result.status === "ok" ? { ok: true, json: stdoutLines(result).join("\n") } : { ok: false, error: scriptError(result) };
}

const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"
]);

/** A Lua table constructor for parsed JSON. Throws JSON.parse's SyntaxError on bad input. */
export function jsonToLua(text: string): string {
  return luaValue(JSON.parse(text), "");
}

function luaValue(value: unknown, indent: string): string {
  if (value === null) return "nil";
  if (typeof value === "string") return luaQuote(value);
  if (typeof value !== "object") return String(value);

  const inner = `${indent}  `;
  const items = Array.isArray(value)
    ? value.map((item) => `${inner}${luaValue(item, inner)}`)
    : Object.entries(value).map(([key, item]) => `${inner}${luaKey(key)} = ${luaValue(item, inner)}`);
  return items.length === 0 ? "{}" : `{\n${items.join(",\n")}\n${indent}}`;
}

function luaKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_KEYWORDS.has(key) ? key : `[${luaQuote(key)}]`;
}

const LUA_ESCAPES: Record<string, string> = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" };

function luaQuote(text: string): string {
  // Three-digit escapes, so a following digit can't extend one.
  return `"${text.replace(/[\\"\u0000-\u001f\u007f]/g, (char) => LUA_ESCAPES[char] ?? `\\${String(char.charCodeAt(0)).padStart(3, "0")}`)}"`;
}
