import type { ProjectPayload, RunRequest, RunResult, RuntimeFlavor } from "./types";

const RUN_TIMEOUT_MS = 5000;

export function runSnippet(
  code: string,
  flavor: RuntimeFlavor,
  timeoutMs = RUN_TIMEOUT_MS
): Promise<RunResult> {
  return runRequest({
    id: crypto.randomUUID(),
    code,
    flavor
  }, timeoutMs);
}

/**
 * Run a complete in-browser project. `stdin` is copied into the message so a
 * run always observes the exact input that existed when the Run button was
 * pressed, even if the user edits the drawer while the worker is starting.
 */
export function runProject(
  project: ProjectPayload,
  stdin = "",
  timeoutMs = RUN_TIMEOUT_MS
): Promise<RunResult> {
  return runRequest(
    {
      id: crypto.randomUUID(),
      project,
      stdin
    },
    timeoutMs
  );
}

function runRequest(request: RunRequest, timeoutMs: number): Promise<RunResult> {
  const id = request.id;
  const flavor = "project" in request ? request.project.flavor : request.flavor;
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

    worker.postMessage(request);
  });
}
