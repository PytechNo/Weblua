import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  dedupeDiagnostics,
  diagnosticRange,
  formatDiagnostic,
  mergeDiagnostics,
  parseCompileError
} from "./diagnostics";
import type { Diagnostic } from "./types";

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

const typeError: Diagnostic = {
  file: "main.luau",
  line: 2,
  column: 19,
  endLine: 2,
  endColumn: 24,
  message: "Expected this to be 'number', but got 'string'",
  severity: "error",
  source: "type",
  code: "1000"
};

describe("dedupeDiagnostics", () => {
  it("keeps one of each identical report and sorts by file, line, and column", () => {
    const lint: Diagnostic = { ...typeError, line: 1, column: 7, message: "unused", severity: "warning" };
    const other: Diagnostic = { ...typeError, file: "lib/a.luau" };

    expect(dedupeDiagnostics([typeError, lint, typeError, other])).toEqual([other, lint, typeError]);
  });

  it("keeps reports that differ only in their span", () => {
    const wider = { ...typeError, endColumn: 30 };

    expect(dedupeDiagnostics([typeError, wider])).toHaveLength(2);
  });
});

describe("mergeDiagnostics", () => {
  it("drops a compile error the analyzer also reported on the same line", () => {
    const compile: Diagnostic = { file: "main.luau", line: 2, message: typeError.message, severity: "error" };

    expect(mergeDiagnostics([compile], [typeError])).toEqual([typeError]);
  });

  it("keeps compile errors the analyzer did not report", () => {
    const compile: Diagnostic = { file: "main.luau", line: 4, message: "Expected 'end'", severity: "error" };

    expect(mergeDiagnostics([compile], [typeError])).toEqual([typeError, compile]);
  });

  it("matches on the file as well as the line", () => {
    const compile: Diagnostic = { file: "other.luau", line: 2, message: typeError.message, severity: "error" };

    expect(mergeDiagnostics([compile], [typeError])).toHaveLength(2);
  });
});

describe("formatDiagnostic", () => {
  it("names the line and column of an analyzer span", () => {
    expect(formatDiagnostic(typeError, "fallback.luau")).toBe(
      "main.luau:2:19: Expected this to be 'number', but got 'string'"
    );
  });

  it("marks warnings and names the lint", () => {
    const lint: Diagnostic = {
      ...typeError,
      severity: "warning",
      source: "lint",
      code: "LocalUnused",
      message: "Variable 'x' is never used"
    };

    expect(formatDiagnostic(lint, "fallback.luau")).toBe(
      "main.luau:2:19: warning: Variable 'x' is never used (LocalUnused)"
    );
  });

  it("keeps the line-only format for compile errors and falls back to the open file", () => {
    expect(formatDiagnostic({ line: 3, message: "unexpected symbol", severity: "error" }, "main.lua")).toBe(
      "main.lua:3: unexpected symbol"
    );
  });
});

describe("diagnosticRange", () => {
  const doc = Text.of(["local label = 1", 'local n: number = "two"', "", "print(n)"]);
  const lineStart = (line: number) => doc.line(line).from;

  it("covers the whole line when only a line is known", () => {
    expect(diagnosticRange(doc, { line: 2, message: "", severity: "error" })).toEqual({
      from: lineStart(2),
      to: doc.line(2).to
    });
  });

  it("maps a one-based column span to editor offsets", () => {
    expect(diagnosticRange(doc, typeError)).toEqual({ from: lineStart(2) + 18, to: lineStart(2) + 23 });
  });

  it("spans lines", () => {
    expect(
      diagnosticRange(doc, { ...typeError, line: 1, column: 7, endLine: 2, endColumn: 6 })
    ).toEqual({ from: 6, to: lineStart(2) + 5 });
  });

  it("widens an empty span to one character so it stays visible", () => {
    expect(diagnosticRange(doc, { ...typeError, endColumn: 19 })).toEqual({
      from: lineStart(2) + 18,
      to: lineStart(2) + 19
    });
    const endOfLine = doc.line(4).length + 1;
    expect(
      diagnosticRange(doc, { ...typeError, line: 4, column: endOfLine, endLine: 4, endColumn: endOfLine })
    ).toEqual({ from: doc.line(4).to - 1, to: doc.line(4).to });
  });

  it("clamps positions from a stale result to the current document", () => {
    expect(diagnosticRange(doc, { ...typeError, line: 40, column: 90, endLine: 41, endColumn: 99 })).toEqual({
      from: doc.length - 1,
      to: doc.length
    });
    expect(diagnosticRange(doc, { ...typeError, line: 3, column: 1, endLine: 3, endColumn: 1 })).toEqual({
      from: lineStart(3),
      to: lineStart(3)
    });
  });
});
