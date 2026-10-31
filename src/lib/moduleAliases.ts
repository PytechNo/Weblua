import { isSourcePath } from "./project";

/**
 * Every name `require` accepts for each project source file, mapped to that
 * file's path. Shared by the runtimes and the Luau analyzer so both agree on
 * what a require string refers to.
 */
export function buildModuleAliases(files: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  const entries = Object.keys(files).filter(isSourcePath).sort((a, b) => a.localeCompare(b));

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

/**
 * The aliases each `.luaurc` defines, keyed by the folder that holds it ("" for
 * the root): lowercase alias name to the project path it names.
 */
export type LuaurcAliases = Record<string, Record<string, string>>;

export interface LuaurcReport {
  aliases: LuaurcAliases;
  /** A `.luaurc` that is not JSON, or an alias that is not a path inside the project. */
  errors: Array<{ file: string; message: string }>;
}

/** Reads every `.luaurc` in the project. Alias paths are relative to the file's folder. */
export function readLuaurcAliases(files: Record<string, string>): LuaurcReport {
  const report: LuaurcReport = { aliases: {}, errors: [] };
  for (const [file, text] of Object.entries(files)) {
    if (file !== ".luaurc" && !file.endsWith("/.luaurc")) continue;
    const folder = file.slice(0, -".luaurc".length).replace(/\/$/, "");

    let config: unknown;
    try {
      config = JSON.parse(text);
    } catch (error) {
      report.errors.push({ file, message: `is not valid JSON: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }
    const defined = typeof config === "object" && config !== null ? (config as { aliases?: unknown }).aliases : undefined;
    if (defined === undefined) continue;
    if (typeof defined !== "object" || defined === null || Array.isArray(defined)) {
      report.errors.push({ file, message: '"aliases" must map names to paths' });
      continue;
    }

    const aliases: Record<string, string> = {};
    for (const [name, target] of Object.entries(defined)) {
      const path = typeof target === "string" ? joinProjectPath(folder, target) : undefined;
      if (path === undefined) {
        report.errors.push({ file, message: `alias "${name}" must be a relative path inside the project` });
      } else {
        aliases[name.toLowerCase()] = path;
      }
    }
    report.aliases[folder] = aliases;
  }
  return report;
}

/** `folder/relative`, with `.` and `..` resolved; undefined if it is absolute or climbs above the root. */
function joinProjectPath(folder: string, relative: string): string | undefined {
  if (relative.startsWith("/")) return undefined;
  const parts = folder ? folder.split("/") : [];
  for (const part of relative.split("/")) {
    if (part === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
    } else if (part && part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

const RELATIVE_REQUIRE = /^(?:\.\.?|@self)\//;
/** What the runtime tries after a relative path, in order. */
const MODULE_SUFFIXES = ["", ".luau", ".lua", "/init.luau", "/init.lua"];

/**
 * The project file `require(name)` loads when `from` calls it, mirroring
 * `resolveModule` in the Luau require bootstrap (projectRuntime.ts): `./`,
 * `../`, and `@self/` paths relative to the caller; other `@` names through the
 * nearest `.luaurc`; otherwise an exact alias, then the name with every dot
 * read as a slash.
 */
export function resolveLuauRequire(
  aliases: Record<string, string>,
  exists: (path: string) => boolean,
  from: string,
  name: string,
  luaurc: LuaurcAliases = {}
): string | undefined {
  if (RELATIVE_REQUIRE.test(name)) return resolveRelativeRequire(exists, from, name);
  if (name.startsWith("@")) {
    const target = resolveAliasPath(luaurc, from, name);
    return target === undefined ? undefined : MODULE_SUFFIXES.map((suffix) => target + suffix).find(exists);
  }
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

/**
 * `@alias/rest` as a path: the alias from the nearest `.luaurc` in the folder of
 * `from` or above it, as Luau's own resolver looks it up, then `rest`.
 */
export function resolveAliasPath(luaurc: LuaurcAliases, from: string, name: string): string | undefined {
  const match = /^@([^/]+)\/?(.*)$/.exec(name);
  if (!match) return undefined;
  const alias = match[1].toLowerCase();
  let folder = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  for (;;) {
    const defined = luaurc[folder];
    if (defined && Object.hasOwn(defined, alias)) return joinProjectPath(defined[alias], match[2]);
    if (folder === "") return undefined;
    folder = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
  }
}

/** A module's place in the require tree: its path without the extension, and an init file stands for its folder. */
function moduleLocation(path: string): string[] {
  return path
    .replace(/\.luau?$/, "")
    .replace(/(?:^|\/)init$/, "")
    .split("/")
    .filter(Boolean);
}
