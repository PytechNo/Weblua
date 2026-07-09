import type { CheckResult, RunRequest, RuntimeFlavor } from "./types";

const CHECK_TIMEOUT_MS = 4000;

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

  worker.onmessage = (event: MessageEvent<CheckResult>) => {
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
  const id = crypto.randomUUID();

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

    const request: RunRequest = { id, code, flavor, mode: "check" };
    getWorker().postMessage(request);
  });
}
