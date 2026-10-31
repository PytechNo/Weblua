import { describe, expect, it } from "vitest";
import { tokenizeLua } from "./luaTokens";

const kinds = (code: string) => tokenizeLua(code).filter((token) => token.kind).map((token) => [token.kind, token.text]);

describe("tokenizeLua", () => {
  it("keeps every character, in order", () => {
    const code = 'local x = "a" -- note\nprint(x, 0x1F, 1_000, 2.5e3)';
    expect(tokenizeLua(code).map((token) => token.text).join("")).toBe(code);
  });

  it("names keywords, builtins, numbers, strings, and comments", () => {
    expect(kinds('local n = 1 -- one\nprint("hi")')).toEqual([
      ["keyword", "local"],
      ["number", "1"],
      ["comment", "-- one"],
      ["builtin", "print"],
      ["string", '"hi"']
    ]);
  });

  it("does not look for keywords inside strings, comments, or longer names", () => {
    expect(kinds('"end" --[[ end\nend ]] ending')).toEqual([
      ["string", '"end"'],
      ["comment", "--[[ end\nend ]]"]
    ]);
  });

  it("handles long strings, escapes, and backtick strings", () => {
    expect(kinds('[==[a]]b]==] "a\\"b" `x{1}`')).toEqual([
      ["string", "[==[a]]b]==]"],
      ["string", '"a\\"b"'],
      ["string", "`x{1}`"]
    ]);
  });
});
