// @vitest-environment node
//
// Runs the real compiler wasm, so an @luau-rs/luau upgrade that changes the
// listing format the bytecode view parses fails here first.
import { Lua } from "@luau-rs/luau";
import { describe, expect, it } from "vitest";
import { examples, projectForExample } from "../lib/examples";
import { parseBytecodeListing } from "../lib/luauBytecode";
import type { BytecodeOptions } from "../lib/types";
import { dumpBytecode } from "./luauBytecodeDump";

const ADD = `local function add(a: number, b: number): number
  local sum = a + b
  return sum
end
print(add(2, 3))
`;

const defaults: BytecodeOptions = { optimizationLevel: 1, debugLevel: 1, source: false };

async function dump(source: string, options: Partial<BytecodeOptions> = {}) {
  const lua = await Lua.create({ libraries: "none" });
  return dumpBytecode(lua, source, { ...defaults, ...options });
}

async function listing(source: string, options: Partial<BytecodeOptions> = {}): Promise<string> {
  const result = await dump(source, options);
  if (!result.ok) throw new Error(result.message);
  return result.listing;
}

describe("luau bytecode listings", () => {
  it("names the compiler and lists each function", async () => {
    const result = await dump(ADD);

    expect(result.ok && result.compiler).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.ok && result.listing).toContain("Function 0 (add):");
    expect(result.ok && result.listing).toContain("ADD R2 R0 R1");
  });

  it("inlines small local functions only at optimization level 2", async () => {
    const level1 = await listing(ADD);
    const level2 = await listing(ADD, { optimizationLevel: 2 });

    expect(level1).not.toContain("inlining succeeded");
    expect(level1).toMatch(/CALL R2 2/);
    expect(level2).toContain("REMARK inlining succeeded");
    // add(2, 3) folds to the constant it returns.
    expect(level2).toMatch(/LOADN R\d+ 5/);
  });

  it("lets a --!optimize hot comment override the level it is given", async () => {
    expect(await listing(`--!optimize 2\n${ADD}`, { optimizationLevel: 0 })).toContain("inlining succeeded");
    expect(await listing(`--!optimize 0\n${ADD}`, { optimizationLevel: 2 })).not.toContain("inlining succeeded");
  });

  it("keeps names and lines from debug level 1, and locals from level 2", async () => {
    const none = await listing(ADD, { debugLevel: 0, source: true });
    const lines = await listing(ADD, { debugLevel: 1 });
    const full = await listing(ADD, { debugLevel: 2 });

    expect(none).toContain("Function 0 (??):");
    expect(none).toMatch(/^0: ADD/m);
    expect(parseBytecodeListing(none).some((line) => line.kind === "source")).toBe(false);
    expect(lines).toMatch(/^2: ADD/m);
    expect(lines).not.toContain("local 0 (a)");
    expect(full).toContain("local 2 (sum)");
  });

  it("produces lines the view can tag", async () => {
    const parsed = parseBytecodeListing(await listing(ADD, { optimizationLevel: 2, debugLevel: 2, source: true }));
    const kinds = new Set(parsed.map((line) => line.kind));

    expect([...kinds].sort()).toEqual(["function", "instruction", "local", "other", "remark", "source"]);
    expect(parsed).toContainEqual({ kind: "source", line: "2", code: "  local sum = a + b" });
    expect(parsed).toContainEqual({ kind: "instruction", line: "2", label: undefined, opcode: "ADD", operands: " R2 R0 R1" });
  });

  it("reports a file that does not parse instead of throwing", async () => {
    const result = await dump("local x = = 1");

    expect(result).toEqual({ ok: false, message: "Expected identifier when parsing expression, got '='" });
  });

  it("compiles every file of every built-in Luau example", async () => {
    const lua = await Lua.create({ libraries: "none" });
    const failures: string[] = [];

    for (const example of examples) {
      const project = projectForExample(example);
      if (project.flavor !== "luau") continue;
      for (const [path, source] of Object.entries(project.files)) {
        const result = dumpBytecode(lua, source, { ...defaults, source: true });
        if (!result.ok) failures.push(`${example.id}/${path}: ${result.message}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
