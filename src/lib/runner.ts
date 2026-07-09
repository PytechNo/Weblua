import type { RunRequest, RunResult, RuntimeFlavor } from "./types";

const RUN_TIMEOUT_MS = 5000;

export function runSnippet(
  code: string,
  flavor: RuntimeFlavor,
  timeoutMs = RUN_TIMEOUT_MS
): Promise<RunResult> {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL("../workers/runWorker.ts", import.meta.url), {
    type: "module"
  });
  const startedAt = performance.now();

  return new Promise<RunResult>((resolve) => {
    let settled = false;

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    };

    const timeout = window.setTimeout(() => {
      finish({
        id,
        flavor,
        status: "timeout",
        durationMs: performance.now() - startedAt,
        chunks: [
          {
            kind: "stderr",
            text: `Execution stopped after ${Math.round(timeoutMs / 1000)} seconds.`
          }
        ]
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<RunResult>) => {
      finish(event.data);
    };

    worker.onerror = (event) => {
      finish({
        id,
        flavor,
        status: "error",
        durationMs: performance.now() - startedAt,
        chunks: [
          {
            kind: "stderr",
            text: event.message || "The runtime worker failed before returning a result."
          }
        ]
      });
    };

    const request: RunRequest = { id, code, flavor };
    worker.postMessage(request);
  });
}
