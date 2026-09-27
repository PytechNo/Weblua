// @vitest-environment node
import { readFile } from "node:fs/promises";
import * as stylua from "@johnnymorganz/stylua/web";
import { beforeAll, describe, expect, it } from "vitest";
import { formatWith, minimalChange } from "./formatter";

beforeAll(async () => {
  stylua.initSync({ module: await readFile("node_modules/@johnnymorganz/stylua/stylua_lib_bg.wasm") });
});

describe("formatter", () => {
  it("formats Lua with two-space indents", () => {
    const result = formatWith(stylua, "local t={1,2}\nif t then\nprint( t[1] )\nend", "lua54");
    expect(result).toEqual({ ok: true, code: "local t = { 1, 2 }\nif t then\n  print(t[1])\nend\n" });
  });

  it("formats Luau syntax", () => {
    const result = formatWith(
      stylua,
      "type Point={x:number}\nlocal p:Point={x=1}\nlocal s=`x is {p.x}`\np.x+=1",
      "luau"
    );
    expect(result).toEqual({
      ok: true,
      code: "type Point = { x: number }\nlocal p: Point = { x = 1 }\nlocal s = `x is {p.x}`\np.x += 1\n"
    });
  });

  it("reports parse failures in one line, with a hint for Lua 5.5", () => {
    const broken = formatWith(stylua, "local = 1", "lua54");
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.message).toMatch(/^Format failed: /);
      expect(broken.message).not.toContain("\n");
    }

    const lua55 = formatWith(stylua, "global x = 1", "lua55");
    expect(lua55.ok).toBe(false);
    if (!lua55.ok) expect(lua55.message).toContain("does not support Lua 5.5");
  });
});

describe("minimalChange", () => {
  it("replaces only the differing middle", () => {
    expect(minimalChange("a  = 1\nprint(a)\n", "a = 1\nprint(a)\n")).toEqual({ from: 2, to: 3, insert: "" });
    expect(minimalChange("same", "same")).toBeNull();
    expect(minimalChange("abc", "abXc")).toEqual({ from: 2, to: 2, insert: "X" });
  });
});
