import { mergeDiagnostics } from "./diagnostics";
import { analyzeLuauProject } from "./luauAnalysis";
import {
  isRunProgress,
  type CheckResult,
  type LuauTypeMode,
  type ProjectPayload,
  type RunRequest,
  type RuntimeFlavor,
  type WorkerMessage
} from "./types";

const CHECK_TIMEOUT_MS = 4000;

export interface ProjectCheckOptions {
  /** Luau only. Absent or "off" checks syntax alone. */
  typeMode?: LuauTypeMode;
  /** Type-check just this file rather than every project file. */
  typeCheckFile?: string;
  /**
   * Leave types out instead of waiting while the analyzer is still loading.
   * The live linter sets this; it re-runs once the analyzer is ready.
   */
  background?: boolean;
  timeoutMs?: number;
}

// Unlike runs, checks reuse one long-lived worker so the wasm runtimes stay
// warm between keystrokes. The worker is replaced if it errors or hangs.
let worker: Worker | null = null;
const pending = new Map<string, (result: CheckResult | null) => void>();

function resetWorker(): void {
  worker?.terminate();
  worker = null;
  for (const resolve of pending.values()) {
    resolve(null);
  }
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("../workers/runWorker.ts", import.meta.url), {
    type: "module"
  });

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    // Checks never stream, but this worker is the run worker's module and a
    // stray progress message must not be mistaken for a result.
    if (isRunProgress(event.data) || !("diagnostics" in event.data)) return;

    const resolve = pending.get(event.data.id);
    if (resolve) {
      pending.delete(event.data.id);
      resolve(event.data);
    }
  };

  worker.onerror = () => {
    resetWorker();
  };

  return worker;
}

/**
 * Compile without executing. Resolves to null when the checker itself fails
 * (worker crash or timeout) so callers can keep previous diagnostics instead
 * of showing spurious ones.
 */
export function checkSnippet(
  code: string,
  flavor: RuntimeFlavor,
  timeoutMs = CHECK_TIMEOUT_MS
): Promise<CheckResult | null> {
  return checkRequest(
    {
      id: crypto.randomUUID(),
      code,
      flavor,
      mode: "check"
    },
    timeoutMs
  );
}

/**
 * Compile every source file in a project without executing it. `activeFile`
 * travels with the request so consumers can associate returned file-aware
 * diagnostics with the currently visible editor while still showing a full
 * result for an explicit Check action.
 *
 * Luau projects are also type-checked and linted unless `typeMode` is off.
 * The compile pass still runs: it is the runtime that will execute the code,
 * so its verdict on syntax is the one that counts.
 */
export async function checkProject(
  project: ProjectPayload,
  activeFile?: string,
  options: ProjectCheckOptions = {}
): Promise<CheckResult | null> {
  const compiled = checkRequest(
    {
      id: crypto.randomUUID(),
      project,
      activeFile,
      mode: "check"
    },
    options.timeoutMs ?? CHECK_TIMEOUT_MS
  );

  const { typeMode } = options;
  if (project.flavor !== "luau" || !typeMode || typeMode === "off") {
    return compiled;
  }

  const files = options.typeCheckFile ? [options.typeCheckFile] : Object.keys(project.files);
  const [compileResult, analysis] = await Promise.all([
    compiled,
    analyzeLuauProject(project, typeMode, files, { skipCold: options.background })
  ]);
  if (!compileResult) return null;

  return analysis
    ? { ...compileResult, diagnostics: mergeDiagnostics(compileResult.diagnostics, analysis), typeChecked: true }
    : { ...compileResult, typeChecked: false };
}

function checkRequest(request: RunRequest, timeoutMs: number): Promise<CheckResult | null> {
  const id = request.id;

  return new Promise<CheckResult | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resetWorker();
        resolve(null);
      }
    }, timeoutMs);

    pending.set(id, (result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });

    getWorker().postMessage(request);
  });
}
