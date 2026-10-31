import type { Trace, TraceValue } from "./articleTypes";

export interface TraceFrame {
  id: number;
  name: string;
  vars: Array<[name: string, value: TraceValue]>;
  /** The call returned, but a closure still holds its variables. */
  kept: boolean;
}

export interface TraceState {
  frames: TraceFrame[];
  output: string[];
}

/** The innermost frame still running; the outer one never ends. */
function liveFrame(frames: TraceFrame[]): number {
  let index = frames.length - 1;
  while (index > 0 && frames[index].kept) index--;
  return index;
}

/** The newest frame called `name`, for a closure writing to the variables it kept. */
function namedFrame(frames: TraceFrame[], name: string): number {
  for (let index = frames.length - 1; index >= 0; index--) if (frames[index].name === name) return index;
  throw new Error(`trace: no frame named ${name}`);
}

/** What the screen shows after each step: the steps replayed from the top. */
export function traceStates(trace: Trace): TraceState[] {
  let frames: TraceFrame[] = [{ id: 0, name: trace.scope ?? "Variables", vars: [], kept: false }];
  let output: string[] = [];
  let nextId = 1;

  return trace.steps.map((step) => {
    if (step.enter) frames = [...frames, { id: nextId++, name: step.enter, vars: [], kept: false }];
    if (step.set || step.drop) {
      const target = step.frame ? namedFrame(frames, step.frame) : liveFrame(frames);
      const vars = new Map(frames[target].vars);
      for (const [name, value] of Object.entries(step.set ?? {})) vars.set(name, value);
      for (const name of step.drop ?? []) vars.delete(name);
      frames = frames.map((frame, index) => (index === target ? { ...frame, vars: [...vars] } : frame));
    }
    if (step.leave) {
      const live = liveFrame(frames);
      frames = step.leave === "kept" ? frames.map((frame, index) => (index === live ? { ...frame, kept: true } : frame)) : frames.filter((_, index) => index !== live);
    }
    if (step.print !== undefined) output = [...output, step.print];
    return { frames, output };
  });
}
