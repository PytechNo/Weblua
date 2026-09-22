export const runtimeFlavors = ["lua51", "lua52", "lua53", "lua54", "lua55", "luau"] as const;

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
  /** Wall-clock budget for execution. Defaults to DEFAULT_RUN_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface ProjectRunRequest {
  id: string;
  project: ProjectPayload;
  /** Immutable preset input captured when the run/check begins. */
  stdin?: string;
  /** File whose editor diagnostics should be surfaced first. */
  activeFile?: string;
  mode?: "run" | "check";
  /** Wall-clock budget for execution. Defaults to DEFAULT_RUN_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * The legacy shape is kept while callers migrate to project-based execution.
 * Workers should normalize either shape at their boundary.
 */
export type RunRequest = LegacyRunRequest | ProjectRunRequest;

/** "stopped" is a run the user ended; "timeout" is one the budget ended. */
export type RunStatus = "ok" | "error" | "timeout" | "stopped";

/** Default execution budget. Long-run mode trades it for the extended one. */
export const DEFAULT_RUN_TIMEOUT_MS = 5000;
export const EXTENDED_RUN_TIMEOUT_MS = 30000;

/**
 * Messages a run worker posts before its final result.
 *
 * "started" fires once the runtime is loaded and user code is about to
 * execute, so wasm boot time is not charged to the execution budget. "chunk"
 * forwards output as it is produced, which is what lets a stopped or timed-out
 * run still show everything it printed; that output previously died with the
 * terminated worker, exactly when it was most worth reading.
 *
 * Only runs emit progress; checks post a single result.
 */
export type RunProgress =
  | { type: "started"; id: string }
  | { type: "chunk"; id: string; chunks: OutputChunk[] };

export type WorkerMessage = RunProgress | RunResult | CheckResult;

export function isRunProgress(message: WorkerMessage): message is RunProgress {
  return "type" in message;
}

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

export interface ExampleProject {
  id: string;
  title: string;
  project: ProjectPayload;
  /** Optional preset input loaded with the example. */
  stdin?: string;
}

export type PlaygroundExample = ExampleSnippet | ExampleProject;
