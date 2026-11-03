import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_PASSED } from "../lib/articles";
import { lessonPages } from "../lib/lessonPages";
import { runSnippet } from "../lib/runner";
import { trackEvent } from "../lib/telemetry";
import type { RunResult } from "../lib/types";
import { ExerciseCard, QuizCard } from "./Learn";
import Tools from "./Tools";

vi.mock("../lib/telemetry", () => ({ trackEvent: vi.fn() }));
vi.mock("../lib/runner", () => ({ runSnippet: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
let status: RunResult["status"];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  status = "ok";
  vi.mocked(trackEvent).mockClear();
  vi.mocked(runSnippet).mockImplementation((_code, flavor) => ({
    id: "test", stop: vi.fn(), result: Promise.resolve({ id: "test", flavor, status, durationMs: 1,
      chunks: [{ kind: "stdout", text: '{"private":"content"}' }] })
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function settle() { await act(() => vi.advanceTimersByTimeAsync(300)); }
async function click(element: Element) { await act(() => (element as HTMLElement).click()); }
function events(name: string) { return vi.mocked(trackEvent).mock.calls.filter(([event]) => event === name); }

describe("feature adoption telemetry", () => {
  it("distinguishes real pattern-tool use from the initial demo and limits automatic result events", async () => {
    await act(() => root.render(<StrictMode><Tools tool="pattern-tester" theme="dark" onToggleTheme={() => {}} /></StrictMode>));
    await settle();
    expect(events("tool_use")).toHaveLength(0);
    expect(events("tool_result")).toHaveLength(0);
    const presets = container.querySelectorAll(".tool-presets button");
    await click(presets[1]);
    await settle();
    await click(presets[2]);
    await settle();
    expect(events("tool_use")).toHaveLength(1);
    expect(events("tool_result")).toHaveLength(1);
    status = "error";
    await click(presets[3]);
    await settle();
    expect(events("tool_result")).toHaveLength(2);
    expect(events("tool_result")[1][1]).toMatchObject({ status: "error", tool: "pattern-tester" });
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/private|content/);
  });

  it("tracks conversion direction and reports clipboard failures without exposing the converted text", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await act(() => root.render(<Tools tool="table-to-json" theme="dark" onToggleTheme={() => {}} />));
    await settle();
    const swap = container.querySelector(".tool-heading-row .button")!;
    await click(swap);
    expect(events("tool_direction")[0][1]).toMatchObject({ direction: "json-to-lua" });
    expect(events("tool_result")[0][1]).toMatchObject({ direction: "json-to-lua", status: "ok" });
    await click(container.querySelector('[aria-label="Copy Lua table"]')!);
    expect(events("action_failed")[0][1]).toMatchObject({ action: "tool_copy", reason: "clipboard" });
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/private|content/);
  });

  it("attributes a first runtime selection only to the chosen runtime", async () => {
    await act(() => root.render(<Tools tool="pattern-tester" theme="dark" onToggleTheme={() => {}} />));
    await settle();
    const select = container.querySelector("select")!;
    await act(() => {
      select.value = "luau";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    expect(events("tool_use").map(([, data]) => data?.flavor)).toEqual(["luau"]);
    expect(events("tool_result")[0][1]).toMatchObject({ flavor: "luau", status: "ok" });
  });

  it("tracks copying a default conversion as real use and contains a worker startup failure", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await act(() => root.render(<Tools tool="table-to-json" theme="dark" onToggleTheme={() => {}} />));
    await settle();
    await click(container.querySelector('[aria-label="Copy JSON"]')!);
    expect(events("tool_use")).toHaveLength(1);
    expect(events("tool_result")[0][1]).toMatchObject({ status: "ok", direction: "lua-to-json" });
    vi.mocked(runSnippet).mockImplementation(() => { throw new Error("worker refused"); });
    await click(container.querySelectorAll(".tool-presets button")[1]);
    await settle();
    expect(events("tool_result")[1][1]).toMatchObject({ status: "error" });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("runtime could not start");
  });

  it("records quiz outcomes without answer text or duplicate attempts", async () => {
    await act(() => root.render(<QuizCard id="learn-luau/tables/2" quiz={{ question: "Private text", options: ["wrong", "correct"], answer: 1, why: "Because" }} />));
    const options = container.querySelectorAll(".quiz-option");
    await click(options[0]);
    await click(options[0]);
    await click(options[1]);
    expect(events("quiz_attempt").map(([, data]) => data?.result)).toEqual(["incorrect", "correct"]);
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/Private text|Because/);
  });

  it("accepts only the lesson's own iframe and counts a completion once", async () => {
    const page = lessonPages[0];
    await act(() => root.render(<StrictMode><ExerciseCard page={page} /></StrictMode>));
    const frame = container.querySelector("iframe")!;
    async function message(output: string, origin = location.origin, source: Window | null = frame.contentWindow) {
      await act(() => window.dispatchEvent(new MessageEvent("message", { origin, source, data: { type: "weblua:run", output } })));
    }
    await message(ALL_PASSED, "https://other.example");
    await message(ALL_PASSED, location.origin, window);
    expect(events("lesson_complete")).toHaveLength(0);
    await message("Not yet");
    await message(ALL_PASSED);
    await message(ALL_PASSED);
    expect(events("exercise_result").map(([, data]) => data?.status)).toEqual(["failed", "passed"]);
    expect(events("lesson_complete")).toEqual([["lesson_complete", { lesson: page.slug }]]);
    expect(JSON.parse(localStorage.getItem("weblua:learn-done")!)).toEqual([page.slug]);
  });

  it("counts a lesson completion once even when saving browser progress is refused", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage refused"); });
    await act(() => root.render(<ExerciseCard page={lessonPages[0]} />));
    const frame = container.querySelector("iframe")!;
    for (let i = 0; i < 2; i++) await act(() => window.dispatchEvent(new MessageEvent("message", {
      origin: location.origin, source: frame.contentWindow, data: { type: "weblua:run", output: ALL_PASSED }
    })));
    expect(events("lesson_complete")).toHaveLength(1);
    expect(container.textContent).toContain("Lesson complete");
  });
});
