/**
 * Every name `require` accepts for each project file, mapped to that file's
 * path. Shared by the runtimes and the Luau analyzer so both agree on what a
 * require string refers to.
 */
export function buildModuleAliases(files: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  const entries = Object.keys(files).sort((a, b) => a.localeCompare(b));

  // Direct module files take precedence over directory index modules.
  for (const path of entries.filter((file) => !isInitModule(file))) {
    addModuleAliases(aliases, path, false);
  }
  for (const path of entries.filter(isInitModule)) {
    addModuleAliases(aliases, path, true);
  }

  return aliases;
}

function addModuleAliases(aliases: Record<string, string>, path: string, isInit: boolean): void {
  const withoutExtension = path.replace(/\.(?:lua|luau)$/i, "");
  const candidates = new Set([path, withoutExtension, withoutExtension.replaceAll("/", ".")]);

  if (isInit) {
    const parent = withoutExtension.replace(/\/init$/i, "");
    candidates.add(parent);
    candidates.add(parent.replaceAll("/", "."));
  }

  for (const candidate of candidates) {
    if (candidate && !Object.hasOwn(aliases, candidate)) {
      aliases[candidate] = path;
    }
  }
}

export function isInitModule(path: string): boolean {
  return /(?:^|\/)init\.(?:lua|luau)$/i.test(path);
}

const RELATIVE_REQUIRE = /^(?:\.\.?|@self)\//;
/** What the runtime tries after a relative path, in order. */
const MODULE_SUFFIXES = ["", ".luau", ".lua", "/init.luau", "/init.lua"];

/**
 * The project file `require(name)` loads when `from` calls it, mirroring
 * `resolveModule` in the Luau require bootstrap (projectRuntime.ts): `./`,
 * `../`, and `@self/` paths relative to the caller; no other `@` aliases;
 * otherwise an exact alias, then the name with every dot read as a slash.
 */
export function resolveLuauRequire(
  aliases: Record<string, string>,
  exists: (path: string) => boolean,
  from: string,
  name: string
): string | undefined {
  if (RELATIVE_REQUIRE.test(name)) return resolveRelativeRequire(exists, from, name);
  if (name.startsWith("@")) return undefined;
  if (Object.hasOwn(aliases, name)) return aliases[name];

  const slashed = name.replaceAll(".", "/");
  return Object.hasOwn(aliases, slashed) ? aliases[slashed] : undefined;
}

/**
 * `./` is the caller's folder (for an init file, the folder that holds its
 * folder) and `@self/` is the caller itself. A path that climbs above the
 * project root resolves to nothing, as it fails at runtime.
 */
function resolveRelativeRequire(
  exists: (path: string) => boolean,
  from: string,
  name: string
): string | undefined {
  const base = moduleLocation(from);
  let rest = name;
  if (name.startsWith("@self/")) {
    rest = name.slice("@self/".length);
  } else {
    base.pop();
  }

  for (const part of rest.split("/")) {
    if (part === "..") {
      if (base.length === 0) return undefined;
      base.pop();
    } else if (part && part !== ".") {
      base.push(part);
    }
  }

  const target = base.join("/");
  return MODULE_SUFFIXES.map((suffix) => target + suffix).find(exists);
}

/** A module's place in the require tree: its path without the extension, and an init file stands for its folder. */
function moduleLocation(path: string): string[] {
  return path
    .replace(/\.luau?$/, "")
    .replace(/(?:^|\/)init$/, "")
    .split("/")
    .filter(Boolean);
}
