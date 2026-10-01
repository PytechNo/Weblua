import type {
  AnalysisRequest,
  AnalysisResponse,
  Diagnostic,
  LuauCompletionEntry,
  LuauInspection,
  LuauTypeMode,
  ProjectPayload,
  SourcePosition
} from "./types";

/** The first request downloads and compiles the analyzer (~1.7 MB gzipped). */
const LOAD_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;
/**
 * After a failed load or a hung request, background callers (the live linter,
 * completion, hover) leave the analyzer alone for this long. Without it, code
 * that hangs the checker would restart the worker on every keystroke.
 */
const RETRY_AFTER_MS = 60_000;

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type AnalysisRequestBody = WithoutId<AnalysisRequest>;

interface Analyzer {
  worker: Worker;
  pending: Map<string, (response: AnalysisResponse | null) => void>;
  ready: Promise<boolean>;
  warm: boolean;
}

export interface AnalysisCallOptions {
  /**
   * Resolve to null rather than wait while the analyzer is still loading.
   * The call still starts the load. For editor features that must stay
   * responsive; an explicit Check waits instead.
   */
  skipCold?: boolean;
}

let analyzer: Analyzer | null = null;
let failedAt = Number.NEGATIVE_INFINITY;
const readyListeners = new Set<() => void>();

export function isLuauAnalysisWarm(): boolean {
  return analyzer?.warm ?? false;
}

/** Starts loading the analyzer if needed; resolves to whether it is usable. */
export async function warmLuauAnalysis(): Promise<boolean> {
  return (await readyAnalyzer(false)) !== null;
}

/** Called each time an analyzer finishes loading, including after a restart. */
export function onLuauAnalysisReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

/** Type-checks and lints `files`. Null when the analyzer is unavailable. */
export async function analyzeLuauProject(
  project: ProjectPayload,
  mode: LuauTypeMode,
  files: string[],
  options?: AnalysisCallOptions
): Promise<Diagnostic[] | null> {
  if (mode === "off") return null;
  return (await call({ type: "check", project, mode, files }, options)) as Diagnostic[] | null;
}

export async function completeLuau(
  project: ProjectPayload,
  mode: LuauTypeMode,
  file: string,
  position: SourcePosition,
  options?: AnalysisCallOptions
): Promise<LuauCompletionEntry[] | null> {
  if (mode === "off") return null;
  return (await call({ type: "complete", project, mode, file, position }, options)) as
    | LuauCompletionEntry[]
    | null;
}

export async function inspectLuau(
  project: ProjectPayload,
  mode: LuauTypeMode,
  file: string,
  position: SourcePosition,
  options?: AnalysisCallOptions
): Promise<LuauInspection | null> {
  if (mode === "off") return null;
  return (await call({ type: "inspect", project, mode, file, position }, options)) as
    | LuauInspection
    | null;
}

async function call(body: AnalysisRequestBody, options: AnalysisCallOptions = {}): Promise<unknown> {
  if (options.skipCold && !isLuauAnalysisWarm()) {
    void warmLuauAnalysis();
    return null;
  }

  const current = await readyAnalyzer(!options.skipCold);
  if (!current) return null;

  const response = await send(current, { ...body, id: crypto.randomUUID() } as AnalysisRequest, REQUEST_TIMEOUT_MS);
  return response?.ok ? response.result : null;
}

async function readyAnalyzer(force: boolean): Promise<Analyzer | null> {
  if (!analyzer && !force && performance.now() - failedAt < RETRY_AFTER_MS) return null;
  const current = ensureAnalyzer();
  return current && (await current.ready) ? current : null;
}

function ensureAnalyzer(): Analyzer | null {
  if (analyzer) return analyzer;

  let worker: Worker;
  try {
    worker = new Worker(new URL("../workers/luauAnalysisWorker.ts", import.meta.url), {
      type: "module",
      name: "luau-analysis"
    });
  } catch {
    // No module workers, or a content policy forbids them: check syntax only.
    failedAt = performance.now();
    return null;
  }
  const current: Analyzer = { worker, pending: new Map(), ready: Promise.resolve(false), warm: false };

  worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
    const resolve = current.pending.get(event.data.id);
    if (resolve) {
      current.pending.delete(event.data.id);
      resolve(event.data);
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    fail(current);
  };

  analyzer = current;
  current.ready = send(current, { id: crypto.randomUUID(), type: "init" }, LOAD_TIMEOUT_MS).then(
    (response) => {
      if (!response?.ok) {
        fail(current);
        return false;
      }
      current.warm = true;
      for (const listener of readyListeners) listener();
      return true;
    }
  );
  return current;
}

function send(current: Analyzer, request: AnalysisRequest, timeoutMs: number): Promise<AnalysisResponse | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      if (current.pending.has(request.id)) fail(current);
    }, timeoutMs);

    current.pending.set(request.id, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
    current.worker.postMessage(request);
  });
}

/** Ends a crashed, hung, or unloadable analyzer and answers its callers with null. */
function fail(current: Analyzer): void {
  failedAt = performance.now();
  current.worker.terminate();
  if (analyzer === current) analyzer = null;

  for (const resolve of current.pending.values()) resolve(null);
  current.pending.clear();
}
