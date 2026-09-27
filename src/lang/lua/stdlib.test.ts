// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { RuntimeFlavor } from "../../lib/types";
import { runProjectForTest, stderrOf, stdoutOf } from "../../workers/runtimeTestHost";
import { availabilityLabel, stdlibFor, stdlibGlobals, stdlibMembers } from "./stdlib";

const FLAVORS: RuntimeFlavor[] = ["lua51", "lua52", "lua53", "lua54", "lua55", "luau"];

/** Lists every global and every member of a global table, as "name" / "lib.member". */
const ENUMERATE = `
local names = {}
for key, value in pairs(_G) do
  if type(key) == "string" and key:sub(1, 9) ~= "__weblua_" then
    names[#names + 1] = key
    if type(value) == "table" and key ~= "_G" then
      for member in pairs(value) do
        if type(member) == "string" then names[#names + 1] = key .. "." .. member end
      end
    end
  end
end
table.sort(names)
for _, name in ipairs(names) do print(name) end
`;

async function runLines(flavor: RuntimeFlavor, source: string): Promise<string[]> {
  const entry = flavor === "luau" ? "main.luau" : "main.lua";
  const result = await runProjectForTest({ flavor, entry, files: { [entry]: source } });
  expect(stderrOf(result), flavor).toEqual([]);
  return stdoutOf(result);
}

describe("stdlib catalog", () => {
  it.each(FLAVORS)("lists every name the %s runtime exposes", async (flavor) => {
    const exposed = await runLines(flavor, ENUMERATE);
    const cataloged = new Set(stdlibFor(flavor).keys());
    expect(exposed.filter((name) => !cataloged.has(name))).toEqual([]);
  });

  it.each(FLAVORS)("lists nothing the %s runtime lacks", async (flavor) => {
    // Checked by direct access rather than through _G, because Weblua's own
    // globals (Luau's require, for one) are not enumerable there.
    const names = [...stdlibFor(flavor).keys()];
    const probe = names
      .map((name) => `print(${JSON.stringify(name)}, pcall(function() return ${name} ~= nil end))`)
      .join("\n");
    const missing = (await runLines(flavor, probe)).filter((line) => !line.endsWith("\ttrue\ttrue"));
    expect(missing).toEqual([]);
  });

  it("separates meanings that differ between versions", () => {
    expect(stdlibFor("lua55").get("table.create")?.params).toBe("(nseq [, nrec])");
    expect(stdlibFor("luau").get("table.create")?.params).toBe("(count [, value])");
    expect(stdlibFor("lua54").get("table.create")).toBeUndefined();
  });

  it("groups globals and library members by flavor", () => {
    expect(stdlibGlobals("lua51").map((entry) => entry.name)).not.toContain("utf8");
    expect(stdlibGlobals("lua53").map((entry) => entry.name)).toContain("utf8");
    expect(stdlibMembers("luau", "string").map((entry) => entry.name)).toContain("string.split");
    expect(stdlibMembers("lua54", "string").map((entry) => entry.name)).not.toContain("string.split");
  });

  it("labels availability with collapsed version ranges", () => {
    expect(availabilityLabel("print")).toBe("Lua 5.1–5.5, Luau");
    expect(availabilityLabel("utf8")).toBe("Lua 5.3–5.5, Luau");
    expect(availabilityLabel("math.frexp")).toBe("Lua 5.1–5.3, Lua 5.5, Luau");
    expect(availabilityLabel("typeof")).toBe("Luau");
  });
});
