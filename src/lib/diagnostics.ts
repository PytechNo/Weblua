import type { Text } from "@codemirror/state";
import type { Diagnostic } from "./types";

// Compile errors arrive as plain strings in two shapes:
//   Luau:    `Weblua:3: Expected identifier when parsing expression, got '='`
//   Lua 5.4: `main.lua:3: unexpected symbol near '='` or `[string "..."]:3: ...`
const LOCATION_PATTERN = /^(?:\[string "[^"]*"\]|[^:\r\n]{1,64}?):(\d+):\s*(.+)$/s;

export function parseCompileError(raw: string): Diagnostic {
  const text = raw.trim();
  const match = LOCATION_PATTERN.exec(text);

  if (match) {
    return {
      line: Math.max(1, Number.parseInt(match[1], 10)),
      message: match[2].trim(),
      severity: "error"
    };
  }

  return {
    line: 1,
    message: text || "Unknown compile error.",
    severity: "error"
  };
}

function diagnosticKey(diagnostic: Diagnostic): string {
  return [
    diagnostic.file ?? "",
    diagnostic.line,
    diagnostic.column ?? "",
    diagnostic.endLine ?? "",
    diagnostic.endColumn ?? "",
    diagnostic.severity,
    diagnostic.message
  ].join("\u0000");
}

function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    (a.file ?? "").localeCompare(b.file ?? "") ||
    a.line - b.line ||
    (a.column ?? 0) - (b.column ?? 0)
  );
}

/**
 * The analyzer can report one problem several times at the same span (each
 * overload it tried, for instance). Keep one of each, in source order.
 */
export function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const unique: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(diagnostic);
  }
  return unique.sort(compareDiagnostics);
}

/**
 * Combines the runtime's compile errors with the analyzer's findings. Both
 * parse with the same Luau front end, so a syntax error appears in each; the
 * analyzer's copy wins because it carries a column span.
 */
export function mergeDiagnostics(compile: Diagnostic[], analysis: Diagnostic[]): Diagnostic[] {
  const lineKey = (diagnostic: Diagnostic) =>
    [diagnostic.file ?? "", diagnostic.line, diagnostic.message.trim()].join("\u0000");
  const analyzed = new Set(analysis.map(lineKey));
  const compileOnly = compile.filter((diagnostic) => !analyzed.has(lineKey(diagnostic)));
  return dedupeDiagnostics([...compileOnly, ...analysis]);
}

/** One line of Check output, e.g. `main.luau:3:12: warning: ... (LocalUnused)`. */
export function formatDiagnostic(diagnostic: Diagnostic, fallbackFile: string): string {
  const file = diagnostic.file ?? fallbackFile;
  const location =
    diagnostic.column === undefined
      ? `${file}:${diagnostic.line}`
      : `${file}:${diagnostic.line}:${diagnostic.column}`;
  const severity = diagnostic.severity === "warning" ? "warning: " : "";
  const code = diagnostic.source === "lint" && diagnostic.code ? ` (${diagnostic.code})` : "";
  return `${location}: ${severity}${diagnostic.message}${code}`;
}

/**
 * Editor offsets for a diagnostic. Line-only diagnostics cover the whole line;
 * spans are clamped to the document so a result computed against older text
 * can never point past the end.
 */
export function diagnosticRange(doc: Text, diagnostic: Diagnostic): { from: number; to: number } {
  const lineNumber = clamp(diagnostic.line, 1, doc.lines);
  const line = doc.line(lineNumber);
  if (diagnostic.column === undefined) {
    return { from: line.from, to: line.to };
  }

  const from = Math.min(line.from + Math.max(diagnostic.column - 1, 0), line.to);
  const endLine = doc.line(clamp(diagnostic.endLine ?? lineNumber, lineNumber, doc.lines));
  const to =
    diagnostic.endColumn === undefined
      ? endLine.to
      : Math.min(endLine.from + Math.max(diagnostic.endColumn - 1, 0), endLine.to);

  if (to > from) return { from, to };
  // An empty span, like "expected ... got <eof>", would be invisible. Mark the
  // character under it, or the one before it at the end of a line.
  if (from < line.to) return { from, to: from + 1 };
  return from > line.from ? { from: from - 1, to: from } : { from, to: from };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
