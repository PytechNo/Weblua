import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runProject } from "./runner";
import {
  DEFAULT_RUN_TIMEOUT_MS,
  EXTENDED_RUN_TIMEOUT_MS,
  type OutputChunk,
  type ProjectPayload,
  type RunResult,
  type WorkerMessage
} from "./types";

/**
 * The host half of a run: the deadline, Stop, and the output kept when either
 * ends a run early. A real worker cannot be interrupted mid-wasm, so these
 * paths only ever run when something has gone wrong -- which is exactly why
 * they are worth testing without one.
 */
class FakeWorker {
  static latest: FakeWorker | null = null;

  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  readonly posted: Array<Record<string, unknown>> = [];
  terminated = false;

  constructor() {
    FakeWorker.latest = this;
  }

  postMessage(message: Record<string, unknown>): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: WorkerMessage): void {
    this.onmessage?.({ data } as MessageEvent<WorkerMessage>);
  }
}

const project: ProjectPayload = {
  flavor: "lua54",
  entry: "main.lua",
  files: { "main.lua": "print(1)" }
};

function worker(): FakeWorker {
  const latest = FakeWorker.latest;
  if (!latest) throw new Error("no worker was started");
  return latest;
}

/** Resolves to the result, or to null while the run is still in flight. */
function settledValue(result: Promise<RunResult>): Promise<RunResult | null> {
  return Promise.race([result, Promise.resolve(null)]);
}

function textOf(result: RunResult): string[] {
  return result.chunks.map((chunk) => chunk.text);
}

beforeEach(() => {
  FakeWorker.latest = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("run handles", () => {
  it("sends the execution budget to the worker", () => {
    runProject(project, "", { timeoutMs: EXTENDED_RUN_TIMEOUT_MS });

    expect(worker().posted[0]).toMatchObject({ timeoutMs: EXTENDED_RUN_TIMEOUT_MS });
  });

  it("forwards streamed output and resolves with the worker's own result", async () => {
    const streamed: string[] = [];
    const handle = runProject(project, "", {
      onOutput: (chunks) => streamed.push(...chunks.map((chunk) => chunk.text))
    });

    worker().emit({ type: "started", id: handle.id });
    worker().emit({ type: "chunk", id: handle.id, chunks: [{ kind: "stdout", text: "1" }] });
    worker().emit({
      id: handle.id,
      flavor: "lua54",
      status: "ok",
      durationMs: 3,
      chunks: [{ kind: "stdout", text: "1" }]
    });

    const result = await handle.result;
    expect(streamed).toEqual(["1"]);
    expect(result.status).toBe("ok");
    expect(textOf(result)).toEqual(["1"]);
    expect(worker().terminated).toBe(true);
  });

  it("keeps what a stopped run printed", async () => {
    const handle = runProject(project);

    worker().emit({ type: "started", id: handle.id });
    worker().emit({ type: "chunk", id: handle.id, chunks: [{ kind: "stdout", text: "printed" }] });
    handle.stop();

    const result = await handle.result;
    expect(result.status).toBe("stopped");
    expect(textOf(result)[0]).toBe("printed");
    expect(textOf(result)[1]).toContain("Run stopped");
    expect(worker().terminated).toBe(true);
  });

  it("batches display updates and flushes even when the worker goes silent", async () => {
    const onOutput = vi.fn();
    const handle = runProject(project, "", { onOutput });
    const chunks: OutputChunk[] = [
      { kind: "stdout", text: "first" },
      { kind: "stderr", text: "second" }
    ];

    worker().emit({ type: "started", id: handle.id });
    for (const chunk of chunks) {
      worker().emit({ type: "chunk", id: handle.id, chunks: [chunk] });
    }
    expect(onOutput).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(onOutput).toHaveBeenCalledExactlyOnceWith(chunks);
    handle.stop();
    expect((await handle.result).chunks.slice(0, -1)).toEqual(chunks);
  });

  it.each(["stopped", "timeout"] as const)("keeps a large batch when a run is %s", async (status) => {
    const onOutput = vi.fn();
    const handle = runProject(project, "", { onOutput });
    const chunks: OutputChunk[] = Array.from({ length: 300001 }, (_, index) => ({
      kind: "stdout", text: String(index)
    }));

    worker().emit({ type: "started", id: handle.id });
    try {
      worker().emit({ type: "chunk", id: handle.id, chunks });
      if (status === "stopped") handle.stop();
      else await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS);

      const result = await handle.result;
      expect(result.status).toBe(status);
      expect(result.chunks).toHaveLength(chunks.length + 1);
      expect(chunks.every((chunk, index) => result.chunks[index] === chunk)).toBe(true);
      expect(onOutput).toHaveBeenCalledTimes(1);
      expect(onOutput.mock.calls[0][0]).toHaveLength(chunks.length);
    } finally {
      handle.stop();
    }
  });

  it("flushes display output on completion and ignores later progress", async () => {
    const onOutput = vi.fn();
    const handle = runProject(project, "", { onOutput });
    const chunks: OutputChunk[] = [{ kind: "stdout", text: "done" }];
    worker().emit({ type: "chunk", id: handle.id, chunks });
    worker().emit({ id: handle.id, flavor: "lua54", status: "ok", durationMs: 1, chunks });

    expect((await handle.result).chunks).toEqual(chunks);
    expect(onOutput).toHaveBeenCalledExactlyOnceWith(chunks);
    worker().emit({ type: "started", id: handle.id });
    worker().emit({ type: "chunk", id: handle.id, chunks });
    await vi.advanceTimersByTimeAsync(600);
    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a second stop once the run has settled", async () => {
    const handle = runProject(project);
    worker().emit({ type: "started", id: handle.id });
    worker().emit({
      id: handle.id,
      flavor: "lua54",
      status: "ok",
      durationMs: 1,
      chunks: [{ kind: "stdout", text: "done" }]
    });

    handle.stop();

    expect((await handle.result).status).toBe("ok");
  });

  it("keeps what a timed-out run printed, and points at longer runs", async () => {
    const handle = runProject(project, "", { timeoutMs: DEFAULT_RUN_TIMEOUT_MS });

    worker().emit({ type: "started", id: handle.id });
    worker().emit({ type: "chunk", id: handle.id, chunks: [{ kind: "stdout", text: "looping" }] });
    await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS);

    const result = await handle.result;
    expect(result.status).toBe("timeout");
    expect(textOf(result)[0]).toBe("looping");
    expect(textOf(result)[1]).toContain("Stopped after 5 seconds");
    expect(textOf(result)[1]).toContain("Long runs");
  });

  it("does not offer a longer run when the long budget is already in use", async () => {
    const handle = runProject(project, "", { timeoutMs: EXTENDED_RUN_TIMEOUT_MS });

    worker().emit({ type: "started", id: handle.id });
    await vi.advanceTimersByTimeAsync(EXTENDED_RUN_TIMEOUT_MS);

    expect(textOf(await handle.result)[0]).toContain("already on");
  });

  // Loading and instantiating a wasm runtime used to come out of the same
  // budget as the program, so a cold first run got noticeably less than the
  // five seconds it was promised.
  it("starts the budget when user code starts, not when the worker does", async () => {
    const handle = runProject(project, "", { timeoutMs: DEFAULT_RUN_TIMEOUT_MS });

    await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS - 500);
    worker().emit({ type: "started", id: handle.id });

    await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS - 500);
    expect(await settledValue(handle.result)).toBeNull();

    await vi.advanceTimersByTimeAsync(500);
    expect((await handle.result).status).toBe("timeout");
  });

  it("reports a runtime that never finished loading as its own failure", async () => {
    const handle = runProject(project, "", { timeoutMs: DEFAULT_RUN_TIMEOUT_MS });

    await vi.advanceTimersByTimeAsync(DEFAULT_RUN_TIMEOUT_MS);

    const result = await handle.result;
    expect(result.status).toBe("timeout");
    expect(textOf(result)[0]).toContain("did not finish loading");
  });

  it("keeps streamed output when the worker itself fails", async () => {
    const handle = runProject(project);

    worker().emit({ type: "started", id: handle.id });
    worker().emit({ type: "chunk", id: handle.id, chunks: [{ kind: "stdout", text: "partial" }] });
    worker().onerror?.({ message: "worker exploded" });

    const result = await handle.result;
    expect(result.status).toBe("error");
    expect(textOf(result)).toEqual(["partial", "worker exploded"]);
  });
});
