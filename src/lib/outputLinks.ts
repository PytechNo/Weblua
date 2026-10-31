export interface SourceLocation {
  /** The matched text, e.g. `lib/util.lua:12` or `main.luau:3:7`. */
  text: string;
  file: string;
  line: number;
  column?: number;
}

const LOCATION = /([\w@.\-/]+\.luau?):(\d+)(?::(\d+))?/g;

/**
 * Splits output text around `file:line[:column]` references to project files,
 * as errors, tracebacks, and Check results print them, so each can be a link.
 */
export function linkLocations(text: string, files: ReadonlySet<string>): Array<string | SourceLocation> {
  const parts: Array<string | SourceLocation> = [];
  let cursor = 0;
  for (const match of text.matchAll(LOCATION)) {
    const [whole, file, line, column] = match;
    if (!files.has(file)) continue;
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push({ text: whole, file, line: Number(line), ...(column ? { column: Number(column) } : {}) });
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
