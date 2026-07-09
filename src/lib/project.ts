import { runtimeFlavors } from "./types";
import type { ProjectPayload, RuntimeFlavor, SnippetPayload, Workspace } from "./types";

export const DEFAULT_LUA_ENTRY_PATH = "main.lua";
export const DEFAULT_LUAU_ENTRY_PATH = "main.luau";

export interface ProjectFile {
  path: string;
  code: string;
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

const runtimeFlavorSet = new Set<string>(runtimeFlavors);
const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedFiles(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.keys(files)
      .sort(comparePaths)
      .map((path) => [path, files[path]])
  );
}

/** Returns whether a value names one of the runtimes Weblua can select. */
export function isRuntimeFlavor(value: unknown): value is RuntimeFlavor {
  return typeof value === "string" && runtimeFlavorSet.has(value);
}

/** File extension used when the workspace creates a new source file. */
export function runtimeFileExtension(flavor: RuntimeFlavor): ".lua" | ".luau" {
  return flavor === "luau" ? ".luau" : ".lua";
}

/** Default executable source path for a fresh project. */
export function defaultEntryPath(flavor: RuntimeFlavor): string {
  return flavor === "luau" ? DEFAULT_LUAU_ENTRY_PATH : DEFAULT_LUA_ENTRY_PATH;
}

/**
 * Accept only an already-normalized relative POSIX path. This intentionally
 * does not repair paths: accepting `lib/../main.lua` and silently rewriting it
 * would make duplicate files and share payloads ambiguous.
 */
export function normalizeProjectPath(path: string): string | null {
  if (
    path.length === 0 ||
    path.trim().length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return null;
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }

  return path;
}

export function isNormalizedProjectPath(value: unknown): value is string {
  return typeof value === "string" && normalizeProjectPath(value) === value;
}

/**
 * Validates and canonicalizes source-only project data. File keys are sorted
 * so serializations are stable and callers never retain a mutable input map.
 */
export function assertProjectPayload(value: unknown): ProjectPayload {
  if (!isRecord(value)) {
    throw new ProjectValidationError("Project data must be an object.");
  }

  if (!isRuntimeFlavor(value.flavor)) {
    throw new ProjectValidationError("Project runtime is not supported.");
  }

  if (!isNormalizedProjectPath(value.entry)) {
    throw new ProjectValidationError("Project entry must be a normalized relative POSIX path.");
  }

  if (!isRecord(value.files)) {
    throw new ProjectValidationError("Project files must be a path-to-source map.");
  }

  const files: Record<string, string> = {};
  const paths = Object.keys(value.files);
  if (paths.length === 0) {
    throw new ProjectValidationError("A project must contain at least one source file.");
  }

  for (const path of paths) {
    if (!isNormalizedProjectPath(path)) {
      throw new ProjectValidationError(`Invalid project path: ${JSON.stringify(path)}.`);
    }

    const code = value.files[path];
    if (typeof code !== "string") {
      throw new ProjectValidationError(`Source for ${JSON.stringify(path)} must be text.`);
    }

    // Object keys are unique by construction. createProjectPayload below also
    // checks duplicate keys before it turns an iterable into this map.
    Object.defineProperty(files, path, {
      configurable: true,
      enumerable: true,
      value: code,
      writable: true
    });
  }

  if (!hasOwn(files, value.entry)) {
    throw new ProjectValidationError("Project entry must refer to an existing source file.");
  }

  return {
    flavor: value.flavor,
    entry: value.entry,
    files: sortedFiles(files)
  };
}

/** Safe nullable counterpart for parsing untrusted data. */
export function validateProjectPayload(value: unknown): ProjectPayload | null {
  try {
    return assertProjectPayload(value);
  } catch {
    return null;
  }
}

/**
 * Constructs a project from file entries and rejects duplicate paths before a
 * JavaScript object could overwrite one of them.
 */
export function createProjectPayload(
  flavor: RuntimeFlavor,
  entry: string,
  sourceFiles: Iterable<ProjectFile>
): ProjectPayload {
  const seen = new Set<string>();
  const files: Record<string, string> = {};

  for (const source of sourceFiles) {
    if (!source || !isNormalizedProjectPath(source.path)) {
      throw new ProjectValidationError("Each source file needs a normalized relative POSIX path.");
    }
    if (seen.has(source.path)) {
      throw new ProjectValidationError(`Duplicate project path: ${JSON.stringify(source.path)}.`);
    }
    if (typeof source.code !== "string") {
      throw new ProjectValidationError(`Source for ${JSON.stringify(source.path)} must be text.`);
    }

    seen.add(source.path);
    Object.defineProperty(files, source.path, {
      configurable: true,
      enumerable: true,
      value: source.code,
      writable: true
    });
  }

  return assertProjectPayload({ flavor, entry, files });
}

export function createDefaultProject(flavor: RuntimeFlavor = "lua54", code = ""): ProjectPayload {
  if (!isRuntimeFlavor(flavor)) {
    throw new ProjectValidationError("Project runtime is not supported.");
  }
  if (typeof code !== "string") {
    throw new ProjectValidationError("Project source must be text.");
  }
  const entry = defaultEntryPath(flavor);
  return { flavor, entry, files: { [entry]: code } };
}

export function createDefaultWorkspace(
  flavor: RuntimeFlavor = "lua54",
  code = ""
): Workspace {
  const project = createDefaultProject(flavor, code);
  return { project, activeFile: project.entry, stdin: "" };
}

export function projectFromSnippet(snippet: SnippetPayload): ProjectPayload {
  if (!isRuntimeFlavor(snippet.flavor) || typeof snippet.code !== "string") {
    throw new ProjectValidationError("Snippet data is invalid.");
  }
  return createDefaultProject(snippet.flavor, snippet.code);
}

export function snippetFromProject(project: ProjectPayload): SnippetPayload {
  const normalized = assertProjectPayload(project);
  return { flavor: normalized.flavor, code: normalized.files[normalized.entry] };
}

export function setProjectEntry(project: ProjectPayload, entry: string): ProjectPayload {
  const normalized = assertProjectPayload(project);
  if (!isNormalizedProjectPath(entry) || !hasOwn(normalized.files, entry)) {
    throw new ProjectValidationError("Project entry must refer to an existing source file.");
  }

  return { ...normalized, entry };
}

export function upsertProjectFile(project: ProjectPayload, path: string, code: string): ProjectPayload {
  const normalized = assertProjectPayload(project);
  if (!isNormalizedProjectPath(path)) {
    throw new ProjectValidationError("Project file path must be normalized and relative.");
  }
  if (typeof code !== "string") {
    throw new ProjectValidationError("Project source must be text.");
  }

  return assertProjectPayload({
    ...normalized,
    files: { ...normalized.files, [path]: code }
  });
}

export function renameProjectFile(project: ProjectPayload, from: string, to: string): ProjectPayload {
  const normalized = assertProjectPayload(project);
  if (!isNormalizedProjectPath(from) || !hasOwn(normalized.files, from)) {
    throw new ProjectValidationError("The source file to rename does not exist.");
  }
  if (!isNormalizedProjectPath(to)) {
    throw new ProjectValidationError("Project file path must be normalized and relative.");
  }
  if (from === to) return normalized;
  if (hasOwn(normalized.files, to)) {
    throw new ProjectValidationError("A source file already uses that path.");
  }

  const files = Object.fromEntries(
    Object.entries(normalized.files).map(([path, code]) => [path === from ? to : path, code])
  );
  return assertProjectPayload({
    ...normalized,
    entry: normalized.entry === from ? to : normalized.entry,
    files
  });
}

/** Removes a non-entry file. Select a different entry before deleting the current one. */
export function deleteProjectFile(project: ProjectPayload, path: string): ProjectPayload {
  const normalized = assertProjectPayload(project);
  if (!isNormalizedProjectPath(path) || !hasOwn(normalized.files, path)) {
    throw new ProjectValidationError("The source file to delete does not exist.");
  }
  if (path === normalized.entry) {
    throw new ProjectValidationError("Choose another entry file before deleting this one.");
  }

  const files = Object.fromEntries(
    Object.entries(normalized.files).filter(([currentPath]) => currentPath !== path)
  );
  return assertProjectPayload({ ...normalized, files });
}
