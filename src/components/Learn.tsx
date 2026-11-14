import { ArrowRight, Check, ChevronLeft, ChevronRight, Code2, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { createContext, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ALL_PASSED, exerciseId, exerciseTask } from "../lib/articles";
import type { ArticlePage, Exercise, Lookup, Quiz, Trace, TraceValue } from "../lib/articleTypes";
import { type TraceFrame, traceStates } from "../lib/trace";
import { Inline, LuaCode } from "./Code";
import { trackEvent } from "../lib/telemetry";

// ---------------------------------------------------------------------------
// Progress: which lessons' exercises have passed, kept in this browser
// ---------------------------------------------------------------------------

const PROGRESS_KEY = "weblua:learn-done";
const PROGRESS_EVENT = "weblua:learn-progress";

function readDone(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((slug): slug is string => typeof slug === "string") : [];
  } catch {
    // No storage (private mode, prerender): nothing is done yet.
    return [];
  }
}

function markDone(slug: string) {
  const done = readDone();
  if (done.includes(slug)) return;
  trackEvent("lesson_complete", { lesson: slug });
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done, slug]));
  } catch {
    // Storage refused: the lesson still shows as done until the page closes.
  }
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: slug }));
}

/** Slugs of the lessons whose exercise passed, kept current across tabs. */
export function useLessonsDone(): string[] {
  const [done, setDone] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDone()));
  useEffect(() => {
    const sync = (event: Event) => {
      const slug = event instanceof CustomEvent ? event.detail : null;
      setDone((current) => [...new Set([...current, ...readDone(), ...(typeof slug === "string" ? [slug] : [])])]);
    };
    window.addEventListener(PROGRESS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return done;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// TraceStage: a program animated line by line
// ---------------------------------------------------------------------------

/** Time on a step: a base plus reading time for its sentence. */
const STEP_BASE_MS = 1400;
const STEP_PER_CHAR_MS = 36;

function isRaw(value: TraceValue): value is { raw: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.raw === "string" && Object.keys(value).length === 1;
}

function isTable(value: TraceValue): value is TraceValue[] | { [key: string]: TraceValue } {
  return typeof value === "object" && value !== null && !isRaw(value);
}

function ValueView({ value }: { value: TraceValue }) {
  if (isTable(value)) {
    const entries: Array<[string, TraceValue]> = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item]) : Object.entries(value);
    return (
      <span className="trace-table">
        {entries.length === 0 && <span className="trace-cell is-empty">empty</span>}
        {entries.map(([key, item]) => (
          // Keyed by content, so a changed or new cell mounts again and animates in.
          <span className="trace-cell" key={`${key}=${JSON.stringify(item)}`}>
            <span className="trace-key">{key}</span>
            <ValueView value={item} />
          </span>
        ))}
      </span>
    );
  }
  if (isRaw(value)) return <span className="trace-value is-raw">{value.raw}</span>;
  if (value === null) return <span className="trace-value is-nil">nil</span>;
  if (typeof value === "string") return <span className="trace-value is-string">"{value}"</span>;
  return <span className={`trace-value is-${typeof value}`}>{String(value)}</span>;
}

function FrameView({ frame }: { frame: TraceFrame }) {
  const label = frame.id === 0 ? frame.name : frame.kept ? `${frame.name}, kept by a closure` : `Inside ${frame.name}`;
  return (
    <div className={`trace-frame${frame.id ? " is-call" : ""}${frame.kept ? " is-kept" : ""}`}>
      <p className="trace-label">{label}</p>
      {frame.vars.length === 0 ? (
        <p className="trace-empty">No variables yet</p>
      ) : (
        <dl className="trace-vars">
          {frame.vars.map(([name, value]) => (
            <div className="trace-var" key={name}>
              <dt>{name}</dt>
              <dd>
                <ValueView key={isTable(value) ? "table" : JSON.stringify(value)} value={value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Steps through a program: the line that ran, the variables it changed, and
 * what it printed. Plays once by itself when it scrolls into view, unless the
 * reader prefers reduced motion; every step is also listed as text below it.
 */
export function TraceStage({ trace, id = "course-preview" }: { trace: Trace; id?: string }) {
  const states = useMemo(() => traceStates(trace), [trace]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const touched = useRef(false);
  const root = useRef<HTMLElement>(null);
  const last = trace.steps.length - 1;

  useEffect(() => {
    const node = root.current;
    if (!node || !("IntersectionObserver" in window) || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (!touched.current) setPlaying(true);
      },
      { threshold: 0.55 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((current) => current + 1), STEP_BASE_MS + trace.steps[index].say.length * STEP_PER_CHAR_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, last, trace.steps]);

  const go = (next: number) => {
    if (!touched.current) trackEvent("walkthrough", { block: id, action: "step" });
    touched.current = true;
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, next)));
  };
  const toggle = () => {
    if (!touched.current) trackEvent("walkthrough", { block: id, action: "play" });
    touched.current = true;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (index >= last) setIndex(0);
    setPlaying(true);
  };

  const step = trace.steps[index];
  const state = states[index];
  const lines = trace.code.split("\n");

  return (
    <figure className={`trace${playing ? " is-playing" : ""}`} ref={root}>
      <div className="trace-bar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <figcaption>{trace.title}</figcaption>
        <span className="trace-count">
          Step {index + 1} of {last + 1}
        </span>
      </div>
      <div className="trace-body">
        <pre className="trace-code" style={{ "--line": step.line - 1 } as CSSProperties} aria-label="Code">
          <span className="trace-cursor" aria-hidden="true" />
          {lines.map((line, lineIndex) => (
            <span key={lineIndex} className={lineIndex === step.line - 1 ? "trace-line is-current" : "trace-line"}>
              <span className="trace-gutter" aria-hidden="true">
                {lineIndex + 1}
              </span>
              <LuaCode code={line} />
            </span>
          ))}
        </pre>
        <div className="trace-side">
          <div className="trace-memory">
            {state.frames.map((frame) => (
              <FrameView frame={frame} key={frame.id} />
            ))}
          </div>
          <div className="trace-console">
            <p className="trace-label">Output</p>
            {state.output.length === 0 ? (
              <p className="trace-empty">Nothing printed yet</p>
            ) : (
              state.output.map((line, lineIndex) => (
                <div className="trace-out" key={lineIndex}>
                  {line || " "}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="trace-say" aria-live={playing ? "off" : "polite"}>
        <span className="trace-say-line">Line {step.line}</span>
        <p key={index}>
          <Inline text={step.say} />
        </p>
      </div>
      <div className="trace-controls">
        <button className="icon-button" type="button" onClick={() => go(0)} title="Back to the start" aria-label="Back to the start">
          <RotateCcw size={16} />
        </button>
        <button className="icon-button" type="button" onClick={() => go(index - 1)} disabled={index === 0} title="Previous step" aria-label="Previous step">
          <ChevronLeft size={18} />
        </button>
        <button className="button button-primary trace-play" type="button" onClick={toggle}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Pause" : index >= last ? "Replay" : index === 0 ? "Play" : "Resume"}
        </button>
        <button className="icon-button" type="button" onClick={() => go(index + 1)} disabled={index === last} title="Next step" aria-label="Next step">
          <ChevronRight size={18} />
        </button>
        <input
          className="trace-scrubber"
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(event) => go(Number(event.target.value))}
          aria-label="Step"
          style={{ "--progress": last ? index / last : 1 } as CSSProperties}
        />
      </div>
      <details className="trace-text">
        <summary>Read the steps as text</summary>
        <ol>
          {trace.steps.map((item, stepIndex) => (
            <li key={stepIndex}>
              <strong>Line {item.line}.</strong> <Inline text={item.say} />
              {item.print !== undefined && (
                <>
                  {" "}
                  Prints <code>{item.print}</code>.
                </>
              )}
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// QuizCard: predict the output, with feedback
// ---------------------------------------------------------------------------

export function QuizCard({ quiz, id = "quiz" }: { quiz: Quiz; id?: string }) {
  const [picked, setPicked] = useState<number[]>([]);
  const solved = picked.includes(quiz.answer);
  const lastPick = picked.at(-1);

  return (
    <div className={`quiz${solved ? " is-solved" : ""}`}>
      <p className="quiz-kicker">
        <Sparkles size={15} /> {quiz.code ? "Predict the output" : "Quick check"}
      </p>
      <p className="quiz-question">
        <Inline text={quiz.question} />
      </p>
      {quiz.code && (
        <pre className="quiz-code">
          <code>
            <LuaCode code={quiz.code} />
          </code>
        </pre>
      )}
      <div className="quiz-options">
        {quiz.options.map((option, index) => {
          const state = !picked.includes(index) ? "" : index === quiz.answer ? " is-right" : " is-wrong";
          return (
            <button
              className={`quiz-option${state}`}
              type="button"
              key={index}
              disabled={solved && index !== quiz.answer}
              aria-pressed={picked.includes(index)}
              onClick={() => {
                if (picked.includes(index)) return;
                trackEvent("quiz_attempt", { block: id, result: index === quiz.answer ? "correct" : "incorrect", attempts: picked.length + 1 });
                setPicked((current) => [...current, index]);
              }}
            >
              <span className="quiz-letter" aria-hidden="true">
                {state === " is-right" ? <Check size={14} /> : state === " is-wrong" ? <X size={14} /> : "ABCDEF"[index]}
              </span>
              {quiz.code ? <code>{option}</code> : <span><Inline text={option} /></span>}
            </button>
          );
        })}
      </div>
      <p className="quiz-feedback" aria-live="polite">
        {solved ? "Right." : lastPick !== undefined ? "Not quite. Try another one." : ""}
      </p>
      <details className="quiz-why" open={solved} data-track={solved ? undefined : "quiz_answer"} data-track-block={id}>
        <summary>{solved ? "Why" : "Show the answer"}</summary>
        <p>
          The answer is {quiz.code ? <code>{quiz.options[quiz.answer]}</code> : <strong><Inline text={quiz.options[quiz.answer]} /></strong>}.{" "}
          <Inline text={quiz.why} />
        </p>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LookupDemo: a key lookup following __index from table to table
// ---------------------------------------------------------------------------

const HOP_MS = 950;

export function LookupDemo({ lookup, id = "lookup" }: { lookup: Lookup; id?: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [hop, setHop] = useState(-1);
  const { chain } = lookup;
  const foundAt = key === null ? -1 : chain.findIndex((table) => key in table.keys);
  const end = foundAt === -1 ? chain.length : foundAt;
  const done = key !== null && hop >= end;

  useEffect(() => {
    if (key === null || hop >= end) return;
    const timer = window.setTimeout(() => setHop((current) => current + 1), hop < 0 || prefersReducedMotion() ? 0 : HOP_MS);
    return () => window.clearTimeout(timer);
  }, [key, hop, end]);

  const start = (next: string) => {
    trackEvent("lookup_try", { block: id });
    setKey(next);
    setHop(-1);
  };

  const owner = chain[0].name;
  let message = "Pick a key to look up. Watch where Luau searches for it.";
  if (key !== null && hop >= 0) {
    const table = chain[Math.min(hop, chain.length - 1)];
    if (hop === foundAt) message = `Found \`${key}\` in \`${table.name}\`: ${table.keys[key]}.`;
    else if (hop >= chain.length) message = `No table in the chain has \`${key}\`, so \`${owner}.${key}\` is \`nil\`.`;
    else if (hop + 1 < chain.length) message = `\`${table.name}\` has no \`${key}\`. Its metatable's \`__index\` is \`${chain[hop + 1].name}\`, so Luau looks there next.`;
    else message = `\`${table.name}\` has no \`${key}\`, and no metatable to follow.`;
  }

  return (
    <div className="lookup">
      <div className="lookup-tries" role="group" aria-label="Keys to look up">
        {lookup.tries.map((name) => (
          <button className={`button${key === name ? " is-active" : ""}`} type="button" key={name} onClick={() => start(name)}>
            <code>
              {owner}.{name}
            </code>
          </button>
        ))}
      </div>
      <ol className="lookup-chain">
        {chain.map((table, index) => {
          const state = key === null || hop < index ? "" : index === foundAt ? " is-found" : hop === index && !done ? " is-searching" : " is-missed";
          return (
            <li className={`lookup-table${state}`} key={table.name}>
              {index > 0 && (
                <span className="lookup-arrow" aria-hidden="true">
                  __index <ArrowRight size={14} />
                </span>
              )}
              <div className="lookup-card">
                <p className="lookup-name">{table.name}</p>
                <dl>
                  {Object.entries(table.keys).map(([name, value]) => (
                    <div className={key === name && index === foundAt && hop >= index ? "is-hit" : undefined} key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          );
        })}
        <li className={`lookup-table lookup-nil${key !== null && foundAt === -1 && hop >= chain.length ? " is-found" : ""}`}>
          <span className="lookup-arrow" aria-hidden="true">
            <ArrowRight size={14} />
          </span>
          <div className="lookup-card">
            <p className="lookup-name">nil</p>
          </div>
        </li>
      </ol>
      <p className="lookup-say" aria-live="polite">
        <Inline text={message} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The lesson's editor: beside the lesson on wide screens, over it on phones
// ---------------------------------------------------------------------------

/** An example "Try it" sends to the lesson's editor. */
export interface TryExample {
  id: string;
  /** The `/embed` hash that opens it. */
  hash: string;
}

/** Set on lesson pages, where "Try it" opens an example in the editor beside the lesson. */
export const TryItContext = createContext<((example: TryExample) => void) | null>(null);

export interface WorkspaceView {
  tab: "exercise" | "example";
  /** Narrow screens: the editor covers the lesson. */
  open: boolean;
}

/** Wide enough for the lesson and its editor side by side. Keep in step with styles.css. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1100px)";

interface LessonWorkspaceProps {
  page: ArticlePage & { exercise: Exercise };
  example: TryExample | null;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
  /** What the exercise printed on its latest run; null after Start over. */
  onOutput: (output: string | null) => void;
}

export function LessonWorkspace({ page, example, view, onView, onOutput }: LessonWorkspaceProps) {
  const exerciseFrame = useRef<HTMLIFrameElement>(null);
  const exampleFrame = useRef<HTMLIFrameElement>(null);
  const results = useRef(new Set<string>());
  const firstView = useRef(view);
  const [live, setLive] = useState(false);
  const [resets, setResets] = useState({ exercise: 0, example: 0 });

  // Beside the lesson, the editor loads once the page has, so it never competes
  // with the page's first paint. On a phone it waits until it's opened.
  useEffect(() => {
    if (view.open) return setLive(true);
    if (!window.matchMedia?.(SIDE_BY_SIDE_QUERY).matches) return;
    if (document.readyState === "complete") return setLive(true);
    const start = () => setLive(true);
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [view.open]);

  // Asked for, not on page load: the editor takes the keyboard.
  useEffect(() => {
    if (view !== firstView.current) (view.tab === "exercise" ? exerciseFrame : exampleFrame).current?.focus();
  }, [view]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only this page's own exercise embed, served from this origin, can complete the lesson.
      if (event.origin !== window.location.origin || event.source !== exerciseFrame.current?.contentWindow) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const { type, output } = data as { type?: unknown; output?: unknown };
      if (type !== "weblua:run" || typeof output !== "string") return;
      onOutput(output);
      const passed = output.includes(ALL_PASSED);
      const status = passed ? "passed" : "failed";
      if (!results.current.has(status)) {
        results.current.add(status);
        trackEvent("exercise_result", { lesson: page.slug, status });
        if (passed) markDone(page.slug);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [page.slug, onOutput]);

  const startOver = () => {
    if (!window.confirm("Start over? This puts the starting code back.")) return;
    setResets((current) => ({ ...current, [view.tab]: current[view.tab] + 1 }));
    if (view.tab === "exercise") onOutput(null);
  };

  return (
    <>
      <button className="button button-primary lesson-code-button" type="button" onClick={() => onView({ ...view, open: true })}>
        <Code2 size={16} /> Code
      </button>
      <aside className={`lesson-workspace${view.open ? " is-open" : ""}`} aria-label="Editor">
        <div className="lesson-workspace-bar">
          <span className="output-tabs compact-tabs lesson-tabs" role="group" aria-label="Show in the editor">
            <button type="button" aria-pressed={view.tab === "exercise"} onClick={() => onView({ ...view, tab: "exercise" })}>
              Exercise
            </button>
            <button
              type="button"
              aria-pressed={view.tab === "example"}
              disabled={!example}
              title={example ? undefined : "Press Try it on an example to open it here"}
              onClick={() => onView({ ...view, tab: "example" })}
            >
              Example
            </button>
          </span>
          <button className="icon-button text-icon lesson-start-over" type="button" onClick={startOver} disabled={!live} title="Start over" aria-label="Start over">
            <RotateCcw size={16} />
          </button>
          <button className="icon-button text-icon lesson-workspace-close" type="button" onClick={() => onView({ ...view, open: false })} title="Back to the lesson" aria-label="Back to the lesson">
            <X size={18} />
          </button>
        </div>
        <div className="lesson-workspace-body">
          {live ? (
            <>
              <iframe
                ref={exerciseFrame}
                key={`exercise-${resets.exercise}`}
                src={`/embed#example=${encodeURIComponent(exerciseId(page.slug))}&lesson=1`}
                title={`${page.title} exercise`}
                hidden={view.tab !== "exercise"}
              />
              {example && (
                <iframe
                  ref={exampleFrame}
                  key={`${example.id}-${resets.example}`}
                  src={`/embed#${example.hash}&run=1&lesson=1`}
                  title={`Editable example: ${example.id}`}
                  hidden={view.tab !== "example"}
                />
              )}
            </>
          ) : (
            <div className="lesson-workspace-preview">
              <pre>
                <code>
                  <LuaCode code={page.exercise.starter} />
                </code>
              </pre>
              <button className="button button-primary" type="button" onClick={() => setLive(true)}>
                <Play size={15} /> Load the editor
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// The exercise: the task and its checks, ticked off as the editor runs them
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  page: ArticlePage;
  next?: ArticlePage;
  /** What the exercise printed on its latest run; null before the first. */
  output: string | null;
  onOpen: () => void;
}

export function ExerciseCard({ page, next, output, onOpen }: ExerciseCardProps) {
  const done = useLessonsDone().includes(page.slug);
  if (!page.exercise) return null;
  const printed = output?.split("\n");
  return (
    <section className={`exercise${done ? " is-done" : ""}`} id="exercise" data-read="exercise" aria-labelledby="exercise-title">
      <p className="exercise-kicker">Your turn</p>
      <h2 id="exercise-title">Exercise</h2>
      <p className="exercise-task">{exerciseTask(page.exercise)}</p>
      <ul className="exercise-checks" aria-label="Checks">
        {page.exercise.checks.map(([label]) => {
          const state = !printed ? "" : printed.includes(`✓ ${label}`) ? "pass" : "fail";
          return (
            <li className={state ? `exercise-check is-${state}` : "exercise-check"} key={label}>
              <span className="exercise-check-mark" aria-hidden="true">
                {state === "pass" ? <Check size={13} /> : state === "fail" ? <X size={13} /> : null}
              </span>
              <span>{label}</span>
              {state && <span className="visually-hidden">{state === "pass" ? ", passed" : ", not passed yet"}</span>}
            </li>
          );
        })}
      </ul>
      <button className="button button-primary exercise-open" type="button" onClick={onOpen}>
        <Code2 size={16} /> Write it in the editor
      </button>
      <div className="exercise-status" aria-live="polite">
        {done ? (
          <>
            <span className="exercise-badge">
              <Check size={16} />
            </span>
            <span>
              <strong>Lesson complete.</strong>{" "}
              {next ? (
                <a href={`/learn-luau/${next.slug}`}>
                  Next: {next.title} <ArrowRight size={14} />
                </a>
              ) : (
                <>That was the last lesson. <a href="/learn-luau">See your progress</a>.</>
              )}
            </span>
          </>
        ) : (
          <span>Press Run in the editor to check your code. Pass every check to complete the lesson; your progress stays in this browser.</span>
        )}
      </div>
      <details className="exercise-solution" data-track="solution_reveal" data-track-block={page.slug}>
        <summary>Show a solution</summary>
        <pre>
          <code>
            <LuaCode code={page.exercise.solution} />
          </code>
        </pre>
      </details>
      <noscript>
        <pre>
          <code>{page.exercise.starter}</code>
        </pre>
      </noscript>
    </section>
  );
}
