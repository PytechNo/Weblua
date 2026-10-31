import { describe, expect, it } from "vitest";
import { buildModuleAliases, readLuaurcAliases, resolveLuauRequire } from "./moduleAliases";

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

describe(".luaurc aliases", () => {
  const files = {
    ".luaurc": JSON.stringify({ aliases: { Shared: "./lib/shared", Root: "." } }),
    "game/.luaurc": JSON.stringify({ aliases: { shared: "../vendor" } }),
    "game/main.luau": "",
    "lib/shared/init.luau": "",
    "lib/shared/math.luau": "",
    "vendor/init.luau": "",
    "main.luau": "",
    "data.json": "{}"
  };
  const { aliases: luaurc, errors } = readLuaurcAliases(files);
  const exists = (path: string) => Object.hasOwn(files, path);
  const resolve = (from: string, name: string) => resolveLuauRequire(buildModuleAliases(files), exists, from, name, luaurc);

  it("reads aliases relative to each file's folder, with names in any case", () => {
    expect(errors).toEqual([]);
    expect(luaurc).toEqual({ "": { shared: "lib/shared", root: "" }, game: { shared: "vendor" } });
  });

  it("uses the nearest .luaurc that defines the alias", () => {
    expect(resolve("main.luau", "@shared")).toBe("lib/shared/init.luau");
    expect(resolve("main.luau", "@SHARED/math")).toBe("lib/shared/math.luau");
    expect(resolve("game/main.luau", "@shared")).toBe("vendor/init.luau");
    expect(resolve("game/main.luau", "@root/main")).toBe("main.luau");
    expect(resolve("main.luau", "@missing/x")).toBeUndefined();
  });

  it("never treats project data as a module", () => {
    expect(Object.values(buildModuleAliases(files))).not.toContain("data.json");
  });

  it("reports a .luaurc that is not JSON or names a path outside the project", () => {
    expect(readLuaurcAliases({ ".luaurc": "{ aliases: }" }).errors).toEqual([
      { file: ".luaurc", message: expect.stringMatching(/^is not valid JSON/) }
    ]);
    expect(readLuaurcAliases({ "lib/.luaurc": '{"aliases":{"up":"../../x"}}' }).errors).toEqual([
      { file: "lib/.luaurc", message: 'alias "up" must be a relative path inside the project' }
    ]);
  });
});
