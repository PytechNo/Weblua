import { ExternalTokenizer, type InputStream } from "@lezer/lr";
import { BlockComment, closeAngle, Label, LineComment, LongString } from "./lua.grammar.terms";

const NEWLINE = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const TAB = 9;
const DASH = 45;
const COLON = 58;
const EQUALS = 61;
const GREATER_THAN = 62;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const UNDERSCORE = 95;

function isIdentifierStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === UNDERSCORE;
}

function isIdentifierChar(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57);
}

function isInlineSpace(code: number): boolean {
  return code === SPACE || code === TAB;
}

/** The level of a `[`, `=`*, `[` opener at `offset`, or -1 when there is none. */
function longBracketLevel(input: InputStream, offset: number): number {
  if (input.peek(offset) !== OPEN_BRACKET) return -1;
  let level = 0;
  while (input.peek(offset + 1 + level) === EQUALS) level += 1;
  return input.peek(offset + 1 + level) === OPEN_BRACKET ? level : -1;
}

/**
 * Consumes a long-bracket body through its matching closer. An unclosed one
 * runs to the end of the document, which is also how Lua reads it.
 */
function consumeLongBracket(input: InputStream, level: number): void {
  input.advance(level + 2);
  while (input.next >= 0) {
    if (input.next === CLOSE_BRACKET) {
      let equals = 0;
      while (input.peek(1 + equals) === EQUALS) equals += 1;
      if (equals === level && input.peek(1 + equals) === CLOSE_BRACKET) {
        input.advance(equals + 2);
        return;
      }
    }
    input.advance();
  }
}

/** `--` line comments and `--[==[ ... ]==]` block comments. */
export const comments = new ExternalTokenizer((input) => {
  if (input.next !== DASH || input.peek(1) !== DASH) return;
  input.advance(2);

  const level = longBracketLevel(input, 0);
  if (level >= 0) {
    consumeLongBracket(input, level);
    input.acceptToken(BlockComment);
    return;
  }

  for (let next: number = input.next; next >= 0 && next !== NEWLINE && next !== CARRIAGE_RETURN; ) {
    next = input.advance();
  }
  input.acceptToken(LineComment);
});

/** `[[ ... ]]` and `[==[ ... ]==]` strings. Lua lexes these anywhere a `[[` appears. */
export const longStrings = new ExternalTokenizer((input) => {
  const level = longBracketLevel(input, 0);
  if (level < 0) return;
  consumeLongBracket(input, level);
  input.acceptToken(LongString);
});

/**
 * `::name::` goto labels, read as one token so the grammar never has to choose
 * between a label and Luau's `::` type assertion. Only offered where a
 * statement may start, and only on one line, so a cast that ends a line is not
 * joined to a label that starts the next.
 */
export const labels = new ExternalTokenizer(
  (input, stack) => {
    if (input.next !== COLON || input.peek(1) !== COLON || !stack.canShift(Label)) return;

    let offset = 2;
    while (isInlineSpace(input.peek(offset))) offset += 1;
    if (!isIdentifierStart(input.peek(offset))) return;
    while (isIdentifierChar(input.peek(offset))) offset += 1;
    while (isInlineSpace(input.peek(offset))) offset += 1;
    if (input.peek(offset) !== COLON || input.peek(offset + 1) !== COLON) return;

    input.acceptToken(Label, offset + 2);
  },
  { contextual: true }
);

/**
 * A lone `>` closing generics or a `<const>` attribute, so `Map<K, Array<V>>`
 * is not read as a shift operator and `x <const>= 1` not as `>=`.
 */
export const angles = new ExternalTokenizer(
  (input, stack) => {
    if (input.next === GREATER_THAN && stack.canShift(closeAngle)) {
      input.acceptToken(closeAngle, 1);
    }
  },
  { contextual: true }
);
