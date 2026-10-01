import { describe, expect, it } from "vitest";
import { optimizeHotComment, parseBytecodeListing } from "./luauBytecode";

describe("optimizeHotComment", () => {
  it("reads the level from the comments above the first statement", () => {
    expect(optimizeHotComment("--!optimize 2\nprint(1)")).toBe(2);
    expect(optimizeHotComment("\n--!strict\n-- notes\n  --!optimize 0  \nprint(1)")).toBe(0);
  });

  it("ignores one below code, a level Luau lacks, and files without one", () => {
    expect(optimizeHotComment("print(1)\n--!optimize 2")).toBeNull();
    expect(optimizeHotComment("--!optimize 3\nprint(1)")).toBeNull();
    expect(optimizeHotComment("--!strict\nprint(1)")).toBeNull();
    expect(optimizeHotComment("")).toBeNull();
  });
});

describe("parseBytecodeListing", () => {
  it("tags headers, source, instructions with labels, remarks, and locals", () => {
    const listing = [
      "Function 1 (??):",
      "local 0 (t): reg 1, start pc 9 line 7, end pc 24 line 10",
      "    8:   print(t)",
      "8: L0: GETIMPORT R7 2 [print]",
      "REMARK inlining succeeded (cost 0, profit 3.00x, depth 0)",
      "10: RETURN R0 0",
      ""
    ].join("\n");

    expect(parseBytecodeListing(listing)).toEqual([
      { kind: "function", text: "Function 1 (??):" },
      { kind: "local", text: "local 0 (t): reg 1, start pc 9 line 7, end pc 24 line 10" },
      { kind: "source", line: "8", code: "  print(t)" },
      { kind: "instruction", line: "8", label: "L0", opcode: "GETIMPORT", operands: " R7 2 [print]" },
      { kind: "remark", text: "REMARK inlining succeeded (cost 0, profit 3.00x, depth 0)" },
      { kind: "instruction", line: "10", label: undefined, opcode: "RETURN", operands: " R0 0" },
      { kind: "other", text: "" }
    ]);
  });

  it("keeps a blank source line", () => {
    expect(parseBytecodeListing("   10: ")).toEqual([{ kind: "source", line: "10", code: "" }]);
  });
});
