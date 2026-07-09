export const runtimeFlavors = ["lua51", "lua52", "lua53", "lua54", "luau"] as const;

export type RuntimeFlavor = (typeof runtimeFlavors)[number];

export interface SnippetPayload {
  code: string;
  flavor: RuntimeFlavor;
}

/** Source-only data that can safely be put in a share link or project export. */
export interface ProjectPayload {
  flavor: RuntimeFlavor;
  /** Normalized relative POSIX path of the file to execute. */
  entry: string;
  /** Normalized relative POSIX paths mapped to source text. */
  files: Record<string, string>;
}

/** Browser-local state. Only `project` is suitable for sharing or export. */
export interface Workspace {
  project: ProjectPayload;
  activeFile: string;
  stdin: string;
  activeProjectId?: string;
}

export type OutputKind = "stdout" | "stderr" | "system";

export interface OutputChunk {
  kind: OutputKind;
  text: string;
}

export interface LegacyRunRequest extends SnippetPayload {
  id: string;
  mode?: "run" | "check";
}

export interface ProjectRunRequest {
  id: string;
  project: ProjectPayload;
  /** Immutable preset input captured when the run/check begins. */
  stdin?: string;
  /** File whose editor diagnostics should be surfaced first. */
  activeFile?: string;
  mode?: "run" | "check";
}

/**
 * The legacy shape is kept while callers migrate to project-based execution.
 * Workers should normalize either shape at their boundary.
 */
export type RunRequest = LegacyRunRequest | ProjectRunRequest;

export type RunStatus = "ok" | "error" | "timeout";

export interface Diagnostic {
  /** 1-based source line the compiler reported. */
  line: number;
  message: string;
  severity: "error" | "warning";
  /** Normalized project path, when the diagnostic comes from a project file. */
  file?: string;
  /** Compatibility alias for consumers that historically used this name. */
  filename?: string;
}

export interface CheckResult {
  id: string;
  flavor: RuntimeFlavor;
  durationMs: number;
  diagnostics: Diagnostic[];
}

export interface RunResult {
  id: string;
  status: RunStatus;
  flavor: RuntimeFlavor;
  durationMs: number;
  chunks: OutputChunk[];
}

export interface ExampleSnippet extends SnippetPayload {
  id: string;
  title: string;
}
