import { describe, expect, it } from "vitest";
import { linkLocations } from "./outputLinks";

const files = new Set(["main.lua", "lib/util.luau"]);

describe("output links", () => {
  it("links runtime errors, tracebacks, and Check results to project files", () => {
    expect(linkLocations("main.lua:3: attempt to call a nil value", files)).toEqual([
      { text: "main.lua:3", file: "main.lua", line: 3 },
      ": attempt to call a nil value"
    ]);
    expect(linkLocations("\tlib/util.luau:12:5: warning: unused", files)).toEqual([
      "\t",
      { text: "lib/util.luau:12:5", file: "lib/util.luau", line: 12, column: 5 },
      ": warning: unused"
    ]);
  });

  it("leaves names that are not project files as text", () => {
    expect(linkLocations("other.lua:1: nope, and 3:4", files)).toEqual(["other.lua:1: nope, and 3:4"]);
  });
});
