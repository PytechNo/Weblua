import { ArrowLeftRight, Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { buildPatternScript, MAX_MATCHES, parsePatternOutput, type PatternCapture, type PatternMatch } from "../lib/patternTester";
import { runtimeOptions } from "../lib/project";
import type { StandaloneTool } from "../lib/routes";
import { runSnippet } from "../lib/runner";
import { buildLuaToJsonScript, jsonToLua, parseLuaToJsonOutput } from "../lib/tableJson";
import type { Theme } from "../lib/theme";
import type { RunResult, RuntimeFlavor } from "../lib/types";
import { trackEvent } from "../lib/telemetry";
import { GuideContent } from "./Articles";
import { SiteFrame } from "./SiteFrame";

/** Pause after the last keystroke before the script runs again. */
const RUN_DELAY_MS = 250;

/**
 * Runs `code` on `flavor` once typing pauses, stopping the previous run, and
 * keeps the last answer on screen while the next one runs.
 */
function useScriptRun<T>(code: string | null, flavor: RuntimeFlavor, parse: (result: RunResult) => T, onResult?: (value: T) => void) {
  const [value, setValue] = useState<T | null>(null);
  const [pending, setPending] = useState(false);
  const complete = useRef(onResult);
  complete.current = onResult;

  useEffect(() => {
    if (code === null) return;
    setPending(true);
    let cancelled = false;
    let stop = () => {};
    const timer = window.setTimeout(() => {
      void (async () => {
        let result: RunResult;
        try {
          const handle = runSnippet(code, flavor);
          stop = handle.stop;
          result = await handle.result;
        } catch {
          result = { id: "failed", flavor, status: "error", durationMs: 0,
            chunks: [{ kind: "stderr", text: "The runtime could not start. Try again." }] };
        }
        if (cancelled || result.status === "stopped") return;
        const parsed = parse(result);
        setValue(parsed);
        setPending(false);
        complete.current?.(parsed);
      })();
    }, RUN_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, [code, flavor, parse]);

  return { value, pending };
}

/** Default demos are page views; actual use and each outcome count once per mode. */
function useToolTelemetry(tool: StandaloneTool) {
  const touched = useRef(false);
  const sent = useRef(new Set<string>());
  return {
    touch(flavor: RuntimeFlavor, direction?: string) {
      touched.current = true;
      const key = `use:${flavor}:${direction}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);
      trackEvent("tool_use", { tool, flavor, direction });
    },
    complete(ok: boolean, flavor: RuntimeFlavor, direction?: string) {
      if (!touched.current) return;
      const status = ok ? "ok" : "error";
      const key = `${flavor}:${direction}:${status}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);
      trackEvent("tool_result", { tool, flavor, direction, status });
    }
  };
}

const decoder = new TextDecoder();
const decode = (bytes: Uint8Array) => decoder.decode(bytes);

function RuntimeSelect({ value, onChange }: { value: RuntimeFlavor; onChange: (flavor: RuntimeFlavor) => void }) {
  return (
    <label className="tool-field tool-field-inline">
      <span>Runtime</span>
      <select value={value} onChange={(event) => onChange(event.target.value as RuntimeFlavor)}>
        {runtimeOptions.map((runtime) => (
          <option key={runtime.value} value={runtime.value}>
            {runtime.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyButton({ text, label, tool, direction, onUse }: {
  text: string; label: string; tool: StandaloneTool; direction?: string; onUse: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-button text-icon"
      type="button"
      disabled={!text}
      title={label}
      aria-label={label}
      onClick={async () => {
        onUse();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          trackEvent("tool_copy", { tool, direction, status: "ok" });
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          trackEvent("action_failed", { action: "tool_copy", tool, direction, reason: "clipboard" });
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

/** The subject with each match marked; an empty match is a thin caret. */
function highlightMatches(subject: Uint8Array, matches: PatternMatch[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.first - 1;
    const end = Math.max(start, match.last);
    if (start > cursor) nodes.push(decode(subject.slice(cursor, start)));
    nodes.push(
      end > start ? (
        <mark key={index} className={index % 2 ? "pattern-hit is-alt" : "pattern-hit"} title={`Match ${index + 1}`}>
          {decode(subject.slice(start, end))}
        </mark>
      ) : (
        <span key={index} className="pattern-empty" title={`Match ${index + 1}: empty, at ${match.first}`} />
      )
    );
    cursor = Math.max(cursor, end);
  });
  nodes.push(decode(subject.slice(cursor)));
  return nodes;
}

function captureText(capture: PatternCapture): string {
  return capture.kind === "position" ? String(capture.value) : JSON.stringify(decode(capture.bytes));
}

/** Ready-made patterns; the guide's cheat sheet links here the same way, through the hash. */
const PATTERN_PRESETS: Array<{ label: string; pattern: string; text: string; replacement: string }> = [
  { label: "key=value pairs", pattern: "(%w+)=(%w+)", text: "name=weblua, runtime=luau, year=2026", replacement: "%1: %2" },
  { label: "Words", pattern: "%a+", text: "The quick brown fox jumps over the lazy dog.", replacement: "<%0>" },
  { label: "Numbers", pattern: "%-?%d+%.?%d*", text: "x = 42, y = -3.5, z = 0.25", replacement: "[%0]" },
  { label: "Trim spaces", pattern: "^%s*(.-)%s*$", text: "   padded text   ", replacement: "%1" },
  { label: "Balanced ()", pattern: "%b()", text: "print(math.max(1, 2), (3 + 4))", replacement: "(...)" },
  { label: "Whole words", pattern: "%f[%a]the%f[%A]", text: "the theme of the other thesis", replacement: "THE" },
  { label: "Dates", pattern: "(%d%d%d%d)-(%d%d)-(%d%d)", text: "Released 2026-10-31, patched 2026-11-02", replacement: "%3/%2/%1" }
];

const RUNTIME_VALUES = new Set<string>(runtimeOptions.map((runtime) => runtime.value));

/** `#p=…&s=…&r=…&v=…` sets the pattern, text, replacement, and runtime, so a test can be linked. */
function readPatternHash(): Partial<{ pattern: string; text: string; replacement: string; flavor: RuntimeFlavor }> {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const flavor = params.get("v");
  return {
    ...(params.has("p") ? { pattern: params.get("p")! } : {}),
    ...(params.has("s") ? { text: params.get("s")! } : {}),
    ...(params.has("r") ? { replacement: params.get("r")! } : {}),
    ...(flavor && RUNTIME_VALUES.has(flavor) ? { flavor: flavor as RuntimeFlavor } : {})
  };
}

function PatternTester() {
  const telemetry = useToolTelemetry("pattern-tester");
  const [initial] = useState(() => (typeof window === "undefined" ? {} : readPatternHash()));
  const [pattern, setPattern] = useState(initial.pattern ?? PATTERN_PRESETS[0].pattern);
  const [subject, setSubject] = useState(initial.text ?? PATTERN_PRESETS[0].text);
  const [replacement, setReplacement] = useState(initial.replacement ?? PATTERN_PRESETS[0].replacement);
  const [flavor, setFlavor] = useState<RuntimeFlavor>(initial.flavor ?? "lua54");
  const code = useMemo(() => buildPatternScript(pattern, subject, replacement), [pattern, subject, replacement]);
  const { value: report, pending } = useScriptRun(code, flavor, parsePatternOutput, (value) => telemetry.complete(value.ok, flavor));
  const subjectBytes = useMemo(() => new TextEncoder().encode(subject), [subject]);
  const root = useRef<HTMLDivElement>(null);

  // The cheat sheet's "Try it" links change only the hash; load what they name and bring the tester into view.
  useEffect(() => {
    const onHash = () => {
      const linked = readPatternHash();
      if (linked.pattern === undefined) return;
      telemetry.touch(linked.flavor ?? flavor);
      trackEvent("tool_preset", { tool: "pattern-tester", preset: "guide" });
      setPattern(linked.pattern);
      setSubject(linked.text ?? "");
      setReplacement(linked.replacement ?? "");
      if (linked.flavor) setFlavor(linked.flavor);
      root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [flavor]);

  const applyPreset = (preset: (typeof PATTERN_PRESETS)[number]) => {
    telemetry.touch(flavor);
    trackEvent("tool_preset", { tool: "pattern-tester", preset: PATTERN_PRESETS.indexOf(preset) + 1 });
    setPattern(preset.pattern);
    setSubject(preset.text);
    setReplacement(preset.replacement);
  };

  return (
    <div className="tool-stage" ref={root}>
      <div className="tool-presets" role="group" aria-label="Example patterns">
        <span>Try</span>
        {PATTERN_PRESETS.map((preset) => (
          <button className={`chip${preset.pattern === pattern ? " is-active" : ""}`} type="button" key={preset.label} onClick={() => applyPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="tool-grid">
        <section className="tool-panel" aria-label="Pattern and text">
          <label className="tool-field">
            <span>Pattern</span>
            <input className="tool-mono" value={pattern} onChange={(event) => { telemetry.touch(flavor); setPattern(event.target.value); }} spellCheck={false} autoCapitalize="off" autoComplete="off" />
          </label>
          <label className="tool-field">
            <span>Text</span>
            <textarea className="tool-mono" value={subject} onChange={(event) => { telemetry.touch(flavor); setSubject(event.target.value); }} rows={6} spellCheck={false} />
          </label>
          <label className="tool-field">
            <span>Replacement, for string.gsub</span>
            <input className="tool-mono" value={replacement} onChange={(event) => { telemetry.touch(flavor); setReplacement(event.target.value); }} spellCheck={false} autoCapitalize="off" autoComplete="off" />
          </label>
          <RuntimeSelect value={flavor} onChange={(next) => {
            telemetry.touch(next);
            trackEvent("runtime", { tool: "pattern-tester", to: next });
            setFlavor(next);
          }} />
          {pattern.startsWith("^") && (
            <p className="tool-note">
              A leading ^ anchors string.find and string.match, so there is at most one match. string.gmatch reads it as a
              plain ^ character instead.
            </p>
          )}
        </section>

        <section className="tool-panel" aria-label="Matches" aria-busy={pending}>
          {!report ? (
            <p className="tool-note">Loading the runtime…</p>
          ) : !report.ok ? (
            <p className="tool-error" role="alert">{report.error}</p>
          ) : (
            <>
              <h2 className="tool-heading">
                {report.matches.length === 0
                  ? "No match"
                  : `${report.truncated ? "First " : ""}${report.matches.length} match${report.matches.length === 1 ? "" : "es"}`}
                {report.truncated && <span> (listing stops at {MAX_MATCHES})</span>}
              </h2>
              <pre className="pattern-subject">{highlightMatches(subjectBytes, report.matches)}</pre>
              {report.matches.length > 0 && (
                <div className="tool-table-scroll">
                  <table className="tool-table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Bytes</th>
                        <th scope="col">Match</th>
                        <th scope="col">Captures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.matches.map((match, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{match.last < match.first ? `${match.first} (empty)` : `${match.first}–${match.last}`}</td>
                          <td>{JSON.stringify(decode(subjectBytes.slice(match.first - 1, Math.max(match.first - 1, match.last))))}</td>
                          <td>{match.captures.length ? match.captures.map(captureText).join(", ") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h2 className="tool-heading">
                string.gsub <span>{report.gsub.count} replacement{report.gsub.count === 1 ? "" : "s"}</span>
                <CopyButton text={decode(report.gsub.bytes)} label="Copy the replaced text" tool="pattern-tester" onUse={() => {
                  telemetry.touch(flavor); telemetry.complete(true, flavor);
                }} />
              </h2>
              <pre className="tool-output">{decode(report.gsub.bytes)}</pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const SAMPLE_TABLE = `{
  name = "weblua",
  runtimes = { "lua51", "lua54", "luau" },
  limits = { timeout = 5, memory = 64 * 1024 },
  strict = true,
}`;

const TABLE_PRESETS: Array<[label: string, source: string]> = [
  ["Config", SAMPLE_TABLE],
  [
    "Array of records",
    `{
  { id = 1, name = "Ada", admin = true },
  { id = 2, name = "Grace", admin = false },
}`
  ],
  [
    "Built with code",
    `local squares = {}
for i = 1, 5 do
  squares[i] = i * i
end
return { squares = squares, total = #squares }`
  ],
  ["Sparse array", `{ [1] = "a", [2] = "b", [4] = "d" }`],
  ["Escapes", `{ path = "C:\\\\games", quote = 'say "hi"', tab = "a\\tb" }`]
];

function TableToJson() {
  const telemetry = useToolTelemetry("table-to-json");
  const [fromLua, setFromLua] = useState(true);
  const [input, setInput] = useState(SAMPLE_TABLE);
  const direction = fromLua ? "lua-to-json" : "json-to-lua";
  const { value: converted, pending } = useScriptRun(fromLua ? buildLuaToJsonScript(input) : null, "lua54", parseLuaToJsonOutput,
    (value) => telemetry.complete(value.ok, "lua54", "lua-to-json"));
  const fromJson = useMemo(() => {
    if (fromLua) return null;
    try {
      return { ok: true as const, text: jsonToLua(input) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [fromLua, input]);
  useEffect(() => {
    if (fromJson) telemetry.complete(fromJson.ok, "lua54", "json-to-lua");
  }, [fromJson]);

  const output = fromLua
    ? converted && (converted.ok ? { ok: true as const, text: converted.json } : converted)
    : fromJson;
  const outputText = output?.ok ? output.text : "";

  // The converted text becomes the next input, so a round trip is one click.
  const swap = () => {
    const next = fromLua ? "json-to-lua" : "lua-to-json";
    telemetry.touch("lua54", next);
    trackEvent("tool_direction", { tool: "table-to-json", direction: next });
    if (outputText) setInput(outputText);
    setFromLua((current) => !current);
  };

  return (
    <div className="tool-stage">
      {fromLua && (
        <div className="tool-presets" role="group" aria-label="Example tables">
          <span>Try</span>
          {TABLE_PRESETS.map(([label, source]) => (
            <button className={`chip${source === input ? " is-active" : ""}`} type="button" key={label} onClick={() => {
              telemetry.touch("lua54", direction);
              trackEvent("tool_preset", { tool: "table-to-json", preset: TABLE_PRESETS.findIndex(([name]) => name === label) + 1 });
              setInput(source);
            }}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="tool-grid">
        <section className="tool-panel" aria-label={fromLua ? "Lua table" : "JSON"}>
          <div className="tool-heading-row">
            <h2 className="tool-heading">{fromLua ? "Lua table" : "JSON"}</h2>
            <button className="button" type="button" onClick={swap}>
              <ArrowLeftRight size={16} /> {fromLua ? "JSON to Lua" : "Lua to JSON"}
            </button>
          </div>
          <textarea
            className="tool-mono tool-source"
            value={input}
            onChange={(event) => { telemetry.touch("lua54", direction); setInput(event.target.value); }}
            spellCheck={false}
            aria-label={fromLua ? "Lua table to convert" : "JSON to convert"}
          />
        </section>
        <section className="tool-panel" aria-label={fromLua ? "JSON" : "Lua table"} aria-busy={fromLua && pending}>
          <div className="tool-heading-row">
            <h2 className="tool-heading">{fromLua ? "JSON" : "Lua table"}</h2>
            <CopyButton text={outputText} label={fromLua ? "Copy JSON" : "Copy Lua table"} tool="table-to-json" direction={direction} onUse={() => {
              telemetry.touch("lua54", direction); telemetry.complete(true, "lua54", direction);
            }} />
          </div>
          {!output ? (
            <p className="tool-note">Loading Lua 5.4…</p>
          ) : output.ok ? (
            <pre className="tool-output">{output.text}</pre>
          ) : (
            <p className="tool-error" role="alert">{output.error}</p>
          )}
        </section>
      </div>
    </div>
  );
}

const TOOL_HEROES: Record<StandaloneTool, { kicker: string; title: string; lead: string; current: string }> = {
  "pattern-tester": {
    kicker: "Free tool · Lua 5.1 to 5.5 and Luau",
    title: "Lua Pattern Tester",
    lead: "Test a Lua pattern against your text and see every match, its byte positions, and its captures, plus what string.gsub returns. It runs on the real interpreter you pick, in your browser.",
    current: "/lua-pattern-tester"
  },
  "table-to-json": {
    kicker: "Free tool · runs in your browser",
    title: "Lua Table to JSON Converter",
    lead: "Paste a Lua table and get JSON, or paste JSON and get a Lua table. Lua 5.4 evaluates the table, so expressions, nested tables, and code that builds the table all work. Nothing is uploaded.",
    current: "/lua-table-to-json"
  }
};

interface ToolsProps {
  tool: StandaloneTool;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Tools({ tool, theme, onToggleTheme }: ToolsProps) {
  const hero = TOOL_HEROES[tool];
  return (
    <SiteFrame theme={theme} onToggleTheme={onToggleTheme} current={hero.current}>
      <main className="page tool-page" id="content">
        <header className="page-hero tool-hero">
          <p className="page-kicker">{hero.kicker}</p>
          <h1>{hero.title}</h1>
          <p className="page-lead">{hero.lead}</p>
        </header>
        {tool === "pattern-tester" ? <PatternTester /> : <TableToJson />}
        <GuideContent tool={tool} />
      </main>
    </SiteFrame>
  );
}
