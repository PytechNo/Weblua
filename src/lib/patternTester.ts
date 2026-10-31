import { bytesFromHex, luaStringLiteral, scriptError, stdoutLines } from "./luaSource";
import type { RunResult } from "./types";

export type PatternCapture = { kind: "string"; bytes: Uint8Array } | { kind: "position"; value: number };

export interface PatternMatch {
  /** 1-based byte positions, as string.find returns them; `last < first` for an empty match. */
  first: number;
  last: number;
  captures: PatternCapture[];
}

export type PatternReport =
  | {
      ok: true;
      matches: PatternMatch[];
      /** More matches exist than MAX_MATCHES. */
      truncated: boolean;
      gsub: { count: number; bytes: Uint8Array };
    }
  | { ok: false; error: string };

export const MAX_MATCHES = 500;

/**
 * A script that lists every match as string.gmatch finds it, with positions,
 * which gmatch alone cannot give: string.find is called from each start, and the
 * runtime's own gmatch decides whether an empty match right after a match counts
 * (5.1, 5.2, and Luau keep it; 5.3 and later skip it).
 */
export function buildPatternScript(pattern: string, subject: string, replacement: string): string {
  return `
local find, format, byte, concat = string.find, string.format, string.byte, table.concat
local function hex(s)
  return (s:gsub(".", function(c) return format("%02x", byte(c)) end))
end
local subject, pattern = ${luaStringLiteral(subject)}, ${luaStringLiteral(pattern)}

local probes = 0
for _ in ("a"):gmatch("a*") do probes = probes + 1 end
local skipsRepeat = probes == 1

-- gmatch reads a leading ^ literally; find and match anchor on it, so report their one match.
local anchored = pattern:sub(1, 1) == "^"
local init, previousLast, count = 1, -1, 0
while init <= #subject + 1 do
  local found = { find(subject, pattern, init) }
  local first, last = found[1], found[2]
  if not first then break end
  if skipsRepeat and last == previousLast then
    init = first + 1
  else
    if count == ${MAX_MATCHES} then
      print("T")
      break
    end
    count = count + 1
    local line = { "M", first, last }
    for index = 3, #found do
      local value = found[index]
      line[#line + 1] = type(value) == "number" and ("p" .. value) or ("s" .. hex(value))
    end
    print(concat(line, " "))
    if anchored then break end
    previousLast = last
    init = last >= first and last + 1 or first + 1
  end
end

local replaced, replacements = string.gsub(subject, pattern, ${luaStringLiteral(replacement)})
print("G " .. replacements .. " " .. hex(replaced))
`;
}

export function parsePatternOutput(result: RunResult): PatternReport {
  if (result.status !== "ok") return { ok: false, error: scriptError(result) };

  const matches: PatternMatch[] = [];
  let truncated = false;
  let gsub: { count: number; bytes: Uint8Array } = { count: 0, bytes: new Uint8Array() };
  for (const line of stdoutLines(result)) {
    const [tag, ...fields] = line.split(" ");
    if (tag === "M") {
      const [first, last, ...captures] = fields;
      matches.push({
        first: Number(first),
        last: Number(last),
        captures: captures.map((field) =>
          field.startsWith("p")
            ? { kind: "position", value: Number(field.slice(1)) }
            : { kind: "string", bytes: bytesFromHex(field.slice(1)) }
        )
      });
    } else if (tag === "T") {
      truncated = true;
    } else if (tag === "G") {
      gsub = { count: Number(fields[0]), bytes: bytesFromHex(fields[1] ?? "") };
    }
  }
  return { ok: true, matches, truncated, gsub };
}
