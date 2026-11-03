import { ArrowRight, Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ALL_PASSED, exerciseId, exerciseSource } from "../lib/articles";
import type { ArticlePage, Lookup, Quiz, Trace, TraceValue } from "../lib/articleTypes";
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
// The exercise: an embedded editor whose passing run completes the lesson
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  page: ArticlePage;
  next?: ArticlePage;
}

export function ExerciseCard({ page, next }: ExerciseCardProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const results = useRef(new Set<string>());
  const done = useLessonsDone().includes(page.slug);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only this page's own embed, served from this origin, can complete the lesson.
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const { type, output } = data as { type?: unknown; output?: unknown };
      if (type === "weblua:run" && typeof output === "string") {
        const passed = output.includes(ALL_PASSED);
        const status = passed ? "passed" : "failed";
        if (!results.current.has(status)) {
          results.current.add(status);
          trackEvent("exercise_result", { lesson: page.slug, status });
          if (passed) markDone(page.slug);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [page.slug]);

  if (!page.exercise) return null;
  return (
    <section className={`exercise${done ? " is-done" : ""}`} id="exercise" data-read="exercise" aria-labelledby="exercise-title">
      <p className="exercise-kicker">Your turn</p>
      <h2 id="exercise-title">Exercise</h2>
      <p>
        Fill in the function in the editor, then press <strong>Run</strong>. The checks at the bottom of the file print ✓ for each
        one your answer passes. Pass them all to complete the lesson; your progress stays in this browser.
      </p>
      <iframe ref={frame} src={`/embed#example=${encodeURIComponent(exerciseId(page.slug))}`} title={`${page.title} exercise`} loading="lazy" width="100%" height="540" />
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
          <span>Not passed yet. Run your code to check it.</span>
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
          <code>{exerciseSource(page.exercise)}</code>
        </pre>
      </noscript>
    </section>
  );
}
