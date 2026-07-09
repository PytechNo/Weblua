import { describe, expect, it } from "vitest";
import { parseCompileError } from "./diagnostics";

describe("parseCompileError", () => {
  it("parses Luau compile errors with chunk name and line", () => {
    const diagnostic = parseCompileError(
      "main.luau:3: Expected identifier when parsing expression, got '='"
    );

    expect(diagnostic).toEqual({
      line: 3,
      message: "Expected identifier when parsing expression, got '='",
      severity: "error"
    });
  });

  it("parses Lua 5.4 errors with a [string ...] chunk name", () => {
    const diagnostic = parseCompileError('[string "main.lua"]:7: unexpected symbol near \'=\'');

    expect(diagnostic.line).toBe(7);
    expect(diagnostic.message).toBe("unexpected symbol near '='");
  });

  it("parses errors whose chunk name is a plain file name", () => {
    const diagnostic = parseCompileError("main.lua:2: '(' expected near 'x'");

    expect(diagnostic.line).toBe(2);
    expect(diagnostic.message).toBe("'(' expected near 'x'");
  });

  it("keeps colons inside the message intact", () => {
    const diagnostic = parseCompileError("main.luau:5: Expected ':' or '=', got <eof>");

    expect(diagnostic.line).toBe(5);
    expect(diagnostic.message).toBe("Expected ':' or '=', got <eof>");
  });

  it("falls back to line 1 for messages without a location", () => {
    const diagnostic = parseCompileError("something went wrong");

    expect(diagnostic).toEqual({
      line: 1,
      message: "something went wrong",
      severity: "error"
    });
  });

  it("never returns a line below 1", () => {
    const diagnostic = parseCompileError("chunk:0: weird location");

    expect(diagnostic.line).toBe(1);
  });

  it("handles empty input", () => {
    const diagnostic = parseCompileError("   ");

    expect(diagnostic.message).toBe("Unknown compile error.");
    expect(diagnostic.line).toBe(1);
  });
});
