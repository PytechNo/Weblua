import type {
  Analysis,
  AnalysisDiagnostic,
  AnalysisModuleKind,
  AutocompleteEntry
} from "@luau-rs/luau/analysis";
import { dedupeDiagnostics } from "../lib/diagnostics";
import { buildModuleAliases, resolveLuauRequire } from "../lib/moduleAliases";
import type {
  AnalysisRequest,
  AnalysisResults,
  Diagnostic,
  LuauCompletionEntry,
  LuauInspection,
  LuauTypeMode,
  ProjectPayload,
  SourcePosition
} from "../lib/types";

/**
 * Globals the Weblua Luau runtime adds to the standard library: `read` (see
 * runLuau) and `task` (LUAU_TASK_BOOTSTRAP), both in projectRuntime.ts.
 * `print`, `warn`, and `require` are already standard.
 */
export const WEBLUA_LUAU_DEFINITIONS = `
declare function read(format: ("*l" | "*L" | "*a")?): string?

declare task: {
  spawn: <A..., R...>(f: thread | ((A...) -> R...), A...) -> thread,
  defer: <A..., R...>(f: thread | ((A...) -> R...), A...) -> thread,
  delay: <A..., R...>(seconds: number?, f: thread | ((A...) -> R...), A...) -> thread,
  wait: (seconds: number?) -> number,
  cancel: (thread: thread) -> (),
}
`;

type CheckMode = Exclude<LuauTypeMode, "off">;

interface ModuleRequest {
  from: string;
  specifier: string;
}

interface ResolvedModule {
  name: string;
  source: string;
  kind: AnalysisModuleKind;
}

/**
 * The analyzer resolves slash paths and most relative ones itself, but asks
 * its host about anything else: Weblua's dotted names like
 * `require("lib.util")`, `@self/` paths, and relative paths from an init
 * file. These are the calls the package's own worker uses to answer;
 * `Analysis` marks them internal, so they are feature-detected, the
 * dependency is pinned to an exact version, and tests cover each such require.
 */
interface ModuleResolutionHooks {
  beginOperation(): void;
  takeModuleRequests(): ModuleRequest[];
  resolveModuleRequest(request: ModuleRequest, module?: ResolvedModule): void;
}

/** Each round can only discover requires inside the modules the last one resolved. */
const MAX_RESOLUTION_ROUNDS = 16;

/**
 * One project's view of a long-lived analyzer. Requests carry the whole
 * project; only files whose text changed are handed to the analyzer again, so
 * its per-module caches survive between keystrokes.
 */
export class LuauAnalysisSession {
  readonly #analysis: Analysis;
  readonly #sources = new Map<string, string>();
  #entry = "";
  #mode: CheckMode | undefined;
  #aliases: Record<string, string> = {};

  constructor(analysis: Analysis) {
    this.#analysis = analysis;
  }

  sync(project: ProjectPayload, mode: CheckMode): void {
    if (mode !== this.#mode) {
      this.#analysis.setMode(mode);
      this.#mode = mode;
    }

    const previousEntry = this.#entry;
    this.#entry = project.entry;
    let pathsChanged = false;

    for (const name of [...this.#sources.keys()]) {
      if (!Object.hasOwn(project.files, name)) {
        this.#analysis.deleteModule(name);
        this.#sources.delete(name);
        pathsChanged = true;
      }
    }

    for (const [name, source] of Object.entries(project.files)) {
      const kindChanged =
        previousEntry !== project.entry && (name === project.entry || name === previousEntry);
      if (this.#sources.get(name) === source && !kindChanged) continue;

      pathsChanged ||= !this.#sources.has(name);
      this.#analysis.setModule(name, source, this.#kindOf(name));
      this.#sources.set(name, source);
    }

    if (pathsChanged) {
      this.#aliases = buildModuleAliases(project.files);
    }
  }

  check(files: readonly string[]): Diagnostic[] {
    const names = files.filter((file) => this.#sources.has(file));
    if (names.length === 0) return [];

    const results = this.#resolving(() => this.#analysis.checkModules(names));
    const diagnostics: Diagnostic[] = [];
    for (const { result } of results) {
      for (const diagnostic of result.diagnostics) {
        if (!isSyntaxErrorEcho(diagnostic)) diagnostics.push(toDiagnostic(diagnostic));
      }
      diagnostics.push(...result.timeoutModules.map(timeoutDiagnostic));
    }
    return dedupeDiagnostics(diagnostics);
  }

  complete(file: string, position: SourcePosition): LuauCompletionEntry[] {
    if (!this.#sources.has(file)) return [];
    const result = this.#resolving(() => this.#analysis.autocomplete(file, position));
    return result.entries.map(toCompletionEntry);
  }

  inspect(file: string, position: SourcePosition): LuauInspection | null {
    if (!this.#sources.has(file)) return null;

    const inspection = this.#resolving(() => this.#analysis.inspectAt(file, position));
    if (inspection) {
      const type = displayType(inspection.type);
      return inspection.name === undefined ? { type } : { name: inspection.name, type };
    }

    const type = this.#analysis.typeAt(file, position);
    return type === undefined ? null : { type: displayType(type) };
  }

  #kindOf(name: string): AnalysisModuleKind {
    return name === this.#entry ? "script" : "module";
  }

  #resolving<T>(operation: () => T): T {
    const hooks = resolutionHooks(this.#analysis);
    if (!hooks) return operation();

    hooks.beginOperation();
    let result = operation();
    for (let round = 0; round < MAX_RESOLUTION_ROUNDS; round += 1) {
      const requests = hooks.takeModuleRequests();
      if (requests.length === 0) break;

      let resolvedAny = false;
      for (const request of requests) {
        const module = this.#resolve(request);
        hooks.resolveModuleRequest(request, module);
        resolvedAny ||= module !== undefined;
      }
      if (!resolvedAny) break;
      result = operation();
    }
    return result;
  }

  #resolve({ from, specifier }: ModuleRequest): ResolvedModule | undefined {
    const path = resolveLuauRequire(this.#aliases, (name) => this.#sources.has(name), from, specifier);
    const source = path === undefined ? undefined : this.#sources.get(path);
    return path === undefined || source === undefined
      ? undefined
      : { name: path, source, kind: this.#kindOf(path) };
  }
}

function resolutionHooks(analysis: Analysis): ModuleResolutionHooks | undefined {
  const candidate = analysis as unknown as Partial<ModuleResolutionHooks>;
  return typeof candidate.beginOperation === "function" &&
    typeof candidate.takeModuleRequests === "function" &&
    typeof candidate.resolveModuleRequest === "function"
    ? (candidate as ModuleResolutionHooks)
    : undefined;
}

export function handleAnalysisRequest(
  session: LuauAnalysisSession,
  request: AnalysisRequest
): AnalysisResults[keyof AnalysisResults] {
  if (request.type === "init") return true;

  session.sync(request.project, request.mode);
  switch (request.type) {
    case "check":
      return session.check(request.files);
    case "complete":
      return session.complete(request.file, request.position);
    case "inspect":
      return session.inspect(request.file, request.position);
  }
}

/**
 * The parser stands `%error-id%` in for a name it could not read, and the
 * type checker then reports on that placeholder ("Key '%error-id%' not
 * found"). The syntax error itself is already reported; the echo only adds
 * noise.
 */
function isSyntaxErrorEcho(diagnostic: AnalysisDiagnostic): boolean {
  return diagnostic.message.includes("%error-id%");
}

/** The analyzer counts lines and columns from zero; Weblua diagnostics from one. */
export function toDiagnostic(diagnostic: AnalysisDiagnostic): Diagnostic {
  const { begin, end } = diagnostic.location;
  return {
    file: diagnostic.module,
    filename: diagnostic.module,
    line: begin.line + 1,
    column: begin.column + 1,
    endLine: end.line + 1,
    endColumn: end.column + 1,
    message: diagnostic.message,
    severity: diagnostic.severity,
    source: diagnostic.kind === "lint" ? "lint" : "type",
    code: String(diagnostic.code)
  };
}

function timeoutDiagnostic(file: string): Diagnostic {
  return {
    file,
    filename: file,
    line: 1,
    message: "Type checking stopped early for this file, so some errors may be missing.",
    severity: "warning",
    source: "type"
  };
}

/**
 * The new solver tags builtins `@checked` for its own nonstrict-mode
 * bookkeeping. It says nothing about how to call them, so it is left out of
 * what the editor shows.
 */
export function displayType(type: string): string {
  return type.replace(/@checked\s*/g, "");
}

function toCompletionEntry(entry: AutocompleteEntry): LuauCompletionEntry {
  return {
    label: entry.label,
    kind: entry.kind,
    ...(entry.type === undefined ? {} : { type: displayType(entry.type) }),
    ...(entry.insertText === undefined ? {} : { insertText: entry.insertText }),
    parentheses: entry.parentheses,
    deprecated: entry.deprecated,
    typeMatch: entry.typeCorrect !== "none",
    wrongIndexType: entry.wrongIndexType,
    replaceDotWithColon: entry.replaceDotWithColon
  };
}
