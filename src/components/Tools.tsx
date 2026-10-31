import { ArrowLeftRight, Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { buildPatternScript, MAX_MATCHES, parsePatternOutput, type PatternCapture, type PatternMatch } from "../lib/patternTester";
import { runtimeOptions } from "../lib/project";
import type { StandaloneTool } from "../lib/routes";
import { runSnippet } from "../lib/runner";
import { buildLuaToJsonScript, jsonToLua, parseLuaToJsonOutput } from "../lib/tableJson";
import type { Theme } from "../lib/theme";
import type { RunResult, RuntimeFlavor } from "../lib/types";
import { PlaygroundShell } from "./PlaygroundShell";

/** Pause after the last keystroke before the script runs again. */
const RUN_DELAY_MS = 250;

/**
 * Runs `code` on `flavor` once typing pauses, stopping the previous run, and
 * keeps the last answer on screen while the next one runs.
 */
function useScriptRun<T>(code: string | null, flavor: RuntimeFlavor, parse: (result: RunResult) => T) {
  const [value, setValue] = useState<T | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (code === null) return;
    setPending(true);
    let stop = () => {};
    const timer = window.setTimeout(() => {
      const handle = runSnippet(code, flavor);
      stop = handle.stop;
      void handle.result.then((result) => {
        if (result.status === "stopped") return;
        setValue(parse(result));
        setPending(false);
      });
    }, RUN_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [code, flavor, parse]);

  return { value, pending };
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-button text-icon"
      type="button"
      disabled={!text}
      title={label}
      aria-label={label}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        })
      }
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

function PatternTester() {
  const [pattern, setPattern] = useState("(%w+)=(%w+)");
  const [subject, setSubject] = useState("name=weblua, runtime=luau, year=2026");
  const [replacement, setReplacement] = useState("%1: %2");
  const [flavor, setFlavor] = useState<RuntimeFlavor>("lua54");
  const code = useMemo(() => buildPatternScript(pattern, subject, replacement), [pattern, subject, replacement]);
  const { value: report, pending } = useScriptRun(code, flavor, parsePatternOutput);
  const subjectBytes = useMemo(() => new TextEncoder().encode(subject), [subject]);

  return (
    <div className="tool-grid">
      <section className="tool-panel" aria-label="Pattern and text">
        <label className="tool-field">
          <span>Pattern</span>
          <input className="tool-mono" value={pattern} onChange={(event) => setPattern(event.target.value)} spellCheck={false} autoCapitalize="off" autoComplete="off" />
        </label>
        <label className="tool-field">
          <span>Text</span>
          <textarea className="tool-mono" value={subject} onChange={(event) => setSubject(event.target.value)} rows={6} spellCheck={false} />
        </label>
        <label className="tool-field">
          <span>Replacement, for string.gsub</span>
          <input className="tool-mono" value={replacement} onChange={(event) => setReplacement(event.target.value)} spellCheck={false} autoCapitalize="off" autoComplete="off" />
        </label>
        <RuntimeSelect value={flavor} onChange={setFlavor} />
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
              <CopyButton text={decode(report.gsub.bytes)} label="Copy the replaced text" />
            </h2>
            <pre className="tool-output">{decode(report.gsub.bytes)}</pre>
          </>
        )}
      </section>
    </div>
  );
}

const SAMPLE_TABLE = `{
  name = "weblua",
  runtimes = { "lua51", "lua54", "luau" },
  limits = { timeout = 5, memory = 64 * 1024 },
  strict = true,
}`;

function TableToJson() {
  const [fromLua, setFromLua] = useState(true);
  const [input, setInput] = useState(SAMPLE_TABLE);
  const { value: converted, pending } = useScriptRun(fromLua ? buildLuaToJsonScript(input) : null, "lua54", parseLuaToJsonOutput);
  const fromJson = useMemo(() => {
    if (fromLua) return null;
    try {
      return { ok: true as const, text: jsonToLua(input) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [fromLua, input]);

  const output = fromLua
    ? converted && (converted.ok ? { ok: true as const, text: converted.json } : converted)
    : fromJson;
  const outputText = output?.ok ? output.text : "";

  // The converted text becomes the next input, so a round trip is one click.
  const swap = () => {
    if (outputText) setInput(outputText);
    setFromLua((current) => !current);
  };

  return (
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
          onChange={(event) => setInput(event.target.value)}
          spellCheck={false}
          aria-label={fromLua ? "Lua table to convert" : "JSON to convert"}
        />
      </section>
      <section className="tool-panel" aria-label={fromLua ? "JSON" : "Lua table"} aria-busy={fromLua && pending}>
        <div className="tool-heading-row">
          <h2 className="tool-heading">{fromLua ? "JSON" : "Lua table"}</h2>
          <CopyButton text={outputText} label={fromLua ? "Copy JSON" : "Copy Lua table"} />
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
  );
}

interface ToolsProps {
  tool: StandaloneTool;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Tools({ tool, theme, onToggleTheme }: ToolsProps) {
  return (
    <PlaygroundShell theme={theme} onToggleTheme={onToggleTheme} isEmbed={false} tool={tool}>
      <main className="workspace tool-workspace">{tool === "pattern-tester" ? <PatternTester /> : <TableToJson />}</main>
    </PlaygroundShell>
  );
}
