import {
  DEFAULT_RUN_TIMEOUT_MS,
  EXTENDED_RUN_TIMEOUT_MS,
  isRunProgress,
  type OutputChunk,
  type ProjectPayload,
  type RunRequest,
  type RunResult,
  type RuntimeFlavor,
  type WorkerMessage
} from "./types";

export interface RunOptions {
  /** Wall-clock budget for execution. Boot time is not charged against it. */
  timeoutMs?: number;
  /** Receives output as the run produces it, ahead of the final result. */
  onOutput?: (chunks: OutputChunk[]) => void;
}

/**
 * A run in flight. Terminating the worker is the only way to interrupt wasm,
 * so both the deadline and `stop` go through the same path -- and both keep
 * the output streamed so far, which is the part worth reading when a run is
 * cut short.
 */
export interface RunHandle {
  /** Matches the id on every progress message and on the final result. */
  id: string;
  result: Promise<RunResult>;
  /** Ends the run now. A no-op once the run has settled. */
  stop(): void;
}

export function runSnippet(
  code: string,
  flavor: RuntimeFlavor,
  options: RunOptions = {}
): RunHandle {
  return startRun({ id: crypto.randomUUID(), code, flavor }, options);
}

/**
 * Run a complete in-browser project. `stdin` is copied into the message so a
 * run always observes the exact input that existed when the Run button was
 * pressed, even if the user edits the drawer while the worker is starting.
 */
export function runProject(
  project: ProjectPayload,
  stdin = "",
  options: RunOptions = {}
): RunHandle {
  return startRun({ id: crypto.randomUUID(), project, stdin }, options);
}

function startRun(request: RunRequest, options: RunOptions): RunHandle {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const id = request.id;
  const flavor = "project" in request ? request.project.flavor : request.flavor;
  const worker = new Worker(new URL("../workers/runWorker.ts", import.meta.url), {
    type: "module"
  });

  const streamed: OutputChunk[] = [];
  let settle: (value: RunResult) => void = () => {};
  const result = new Promise<RunResult>((resolve) => {
    settle = resolve;
  });

  let settled = false;
  let executing = false;
  // Reset when the worker reports that user code is starting, so compiling
  // and instantiating the wasm runtime is not billed to the budget. A cold
  // first run otherwise got noticeably less than its advertised seconds.
  let startedAt = performance.now();
  let timer = 0;

  const finish = (value: RunResult) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    worker.terminate();
    settle(value);
  };

  const cut = (status: "timeout" | "stopped", text: string) => {
    finish({
      id,
      flavor,
      status,
      durationMs: performance.now() - startedAt,
      chunks: [...streamed, { kind: status === "stopped" ? "system" : "stderr", text }]
    });
  };

  const arm = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      cut(
        "timeout",
        executing ? timeoutNotice(timeoutMs, streamed.length > 0) : bootNotice(timeoutMs)
      );
    }, timeoutMs);
  };

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    if (isRunProgress(message)) {
      if (message.type === "started") {
        executing = true;
        startedAt = performance.now();
        arm();
        return;
      }

      streamed.push(...message.chunks);
      options.onOutput?.(message.chunks);
      return;
    }

    // A check result cannot reach a run worker; guard the union anyway.
    if ("status" in message) finish(message);
  };

  worker.onerror = (event) => {
    finish({
      id,
      flavor,
      status: "error",
      durationMs: performance.now() - startedAt,
      chunks: [
        ...streamed,
        {
          kind: "stderr",
          text: event.message || "The runtime worker failed before returning a result."
        }
      ]
    });
  };

  arm();
  worker.postMessage({ ...request, timeoutMs });

  return {
    id,
    result,
    stop: () => cut("stopped", "Run stopped. Output above is everything it printed first.")
  };
}

function timeoutNotice(timeoutMs: number, hasOutput: boolean): string {
  const kept = hasOutput ? " Output above is everything it printed first." : "";
  const hint =
    timeoutMs >= EXTENDED_RUN_TIMEOUT_MS
      ? " Long runs is already on, and this is the longest run Weblua allows."
      : " A loop that never ends is the usual cause. Turn on Long runs for a 30-second limit.";
  return `Stopped after ${formatSeconds(timeoutMs)}: this run reached Weblua's time limit.${kept}${hint}`;
}

function bootNotice(timeoutMs: number): string {
  return `The runtime did not finish loading within ${formatSeconds(timeoutMs)}. Check your connection and run again.`;
}

function formatSeconds(timeoutMs: number): string {
  const seconds = Math.round(timeoutMs / 1000);
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}
