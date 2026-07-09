export type RuntimeFlavor = "lua54" | "luau";

export interface SnippetPayload {
  code: string;
  flavor: RuntimeFlavor;
}

export type OutputKind = "stdout" | "stderr" | "system";

export interface OutputChunk {
  kind: OutputKind;
  text: string;
}

export interface RunRequest extends SnippetPayload {
  id: string;
  mode?: "run" | "check";
}

export type RunStatus = "ok" | "error" | "timeout";

export interface Diagnostic {
  /** 1-based source line the compiler reported. */
  line: number;
  message: string;
  severity: "error" | "warning";
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
