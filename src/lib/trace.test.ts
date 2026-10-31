import { describe, expect, it } from "vitest";
import type { Trace } from "./articleTypes";
import { traceStates } from "./trace";

const trace: Trace = {
  title: "calls",
  code: "",
  steps: [
    { line: 1, say: "", set: { x: 1 } },
    { line: 2, say: "", enter: "f", set: { a: 2 } },
    { line: 3, say: "", leave: "kept" },
    { line: 4, say: "", set: { x: 3 }, print: "3" },
    { line: 5, say: "", enter: "g", set: { b: 4 } },
    { line: 6, say: "", leave: true, print: "done" }
  ]
};

describe("traceStates", () => {
  const states = traceStates(trace);

  it("writes variables into the innermost running frame", () => {
    expect(states[1].frames.map((frame) => [frame.name, frame.vars])).toEqual([
      ["Variables", [["x", 1]]],
      ["f", [["a", 2]]]
    ]);
  });

  it("keeps a frame a closure holds, and writes past it", () => {
    expect(states[3].frames.map((frame) => [frame.name, frame.kept])).toEqual([
      ["Variables", false],
      ["f", true]
    ]);
    expect(states[3].frames[0].vars).toEqual([["x", 3]]);
  });

  it("drops a finished frame and collects output", () => {
    expect(states[5].frames.map((frame) => frame.name)).toEqual(["Variables", "f"]);
    expect(states[5].output).toEqual(["3", "done"]);
  });

  it("writes into a kept frame by name and drops variables", () => {
    const [state] = traceStates({
      title: "",
      code: "",
      scope: "Types",
      steps: [{ line: 1, say: "", enter: "make", set: { count: 0 }, leave: "kept" }]
    });
    expect(state.frames[0].name).toBe("Types");
    const [, second] = traceStates({
      title: "",
      code: "",
      steps: [
        { line: 1, say: "", enter: "make", set: { count: 0 }, leave: "kept" },
        { line: 2, say: "", frame: "make", set: { count: 1 } },
        { line: 3, say: "", set: { i: 1 } }
      ]
    }).slice(1);
    expect(second.frames[1].vars).toEqual([["count", 1]]);
    const dropped = traceStates({ title: "", code: "", steps: [{ line: 1, say: "", set: { i: 1, t: 2 } }, { line: 2, say: "", drop: ["i"] }] });
    expect(dropped[1].frames[0].vars).toEqual([["t", 2]]);
  });

  it("leaves earlier states untouched", () => {
    expect(states[0].frames).toHaveLength(1);
    expect(states[0].output).toEqual([]);
  });
});
