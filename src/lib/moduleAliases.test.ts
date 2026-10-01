import { describe, expect, it } from "vitest";
import { buildModuleAliases, resolveLuauRequire } from "./moduleAliases";

describe("resolveLuauRequire", () => {
  const files = {
    "main.luau": "",
    "lib/util.luau": "",
    "lib/config/init.luau": "",
    "lib/config/defaults.luau": "",
    "lib/helpers.lua": ""
  };
  const aliases = buildModuleAliases(files);
  const exists = (path: string) => Object.hasOwn(files, path);
  const resolve = (from: string, name: string) => resolveLuauRequire(aliases, exists, from, name);

  it("resolves every root-relative form the runtime accepts", () => {
    expect(resolve("main.luau", "lib/util")).toBe("lib/util.luau");
    expect(resolve("main.luau", "lib.util")).toBe("lib/util.luau");
    expect(resolve("main.luau", "lib/util.luau")).toBe("lib/util.luau");
    expect(resolve("main.luau", "lib.config")).toBe("lib/config/init.luau");
    expect(resolve("main.luau", "lib/config")).toBe("lib/config/init.luau");
    // Root-relative names ignore where the caller sits.
    expect(resolve("lib/config/defaults.luau", "lib.util")).toBe("lib/util.luau");
  });

  it("resolves ./ and ../ against the requiring file's folder", () => {
    expect(resolve("main.luau", "./lib/util")).toBe("lib/util.luau");
    expect(resolve("main.luau", "./lib/config")).toBe("lib/config/init.luau");
    expect(resolve("lib/util.luau", "./helpers")).toBe("lib/helpers.lua");
    expect(resolve("lib/config/defaults.luau", "../util")).toBe("lib/util.luau");
    expect(resolve("lib/config/defaults.luau", "./init")).toBe("lib/config/init.luau");
  });

  it("treats an init file as its folder", () => {
    // ./ from lib/config/init.luau is lib/, and @self/ is lib/config/.
    expect(resolve("lib/config/init.luau", "./util")).toBe("lib/util.luau");
    expect(resolve("lib/config/init.luau", "@self/defaults")).toBe("lib/config/defaults.luau");
    expect(resolve("lib/util.luau", "@self/defaults")).toBeUndefined();
  });

  it("returns undefined for names that match no file", () => {
    expect(resolve("main.luau", "lib.missing")).toBeUndefined();
    expect(resolve("main.luau", "./missing")).toBeUndefined();
    expect(resolve("main.luau", "../lib/util")).toBeUndefined();
  });

  it("rejects @ aliases other than @self, as the runtime does", () => {
    expect(resolve("main.luau", "@lib/util")).toBeUndefined();
    expect(resolve("main.luau", "@self")).toBeUndefined();
  });

  it("ignores inherited object keys", () => {
    expect(resolve("main.luau", "constructor")).toBeUndefined();
    expect(resolve("main.luau", "toString")).toBeUndefined();
  });
});
