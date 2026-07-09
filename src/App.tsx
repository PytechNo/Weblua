import { StreamLanguage, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import {
  Check,
  Code2,
  Copy,
  Link,
  Moon,
  Play,
  RotateCcw,
  Sun,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitHubMark, MoonMark } from "./components/Brand";
import { Landing } from "./components/Landing";
import { buildShareUrl, readShareHash } from "./lib/codec";
import { defaultExample, examples } from "./lib/examples";
import { runSnippet } from "./lib/runner";
import { getAppRoute } from "./lib/routes";
import { reportRuntimeError, trackEvent } from "./lib/telemetry";
import type { OutputChunk, RunResult, RuntimeFlavor, SnippetPayload } from "./lib/types";

type Theme = "dark" | "light";

const languageExtension = StreamLanguage.define(lua);

const sharedEditorChrome = {
  "&": {
    height: "100%",
    fontSize: "13.5px",
    backgroundColor: "transparent"
  },
  "&.cm-focused": {
    outline: "none"
  },
  ".cm-scroller": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
    lineHeight: "1.65"
  },
  ".cm-content": {
    padding: "16px 0"
  },
  ".cm-line": {
    padding: "0 18px"
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    borderRight: "1px solid var(--border)",
    paddingLeft: "6px"
  }
};

const darkEditorTheme = [
  EditorView.theme(
    {
      ...sharedEditorChrome,
      "&": { ...sharedEditorChrome["&"], color: "#dbe4ff" },
      ".cm-content": { ...sharedEditorChrome[".cm-content"], caretColor: "#8da2ff" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#8da2ff" },
      ".cm-gutters": { ...sharedEditorChrome[".cm-gutters"], color: "#4a5478" },
      ".cm-activeLine": { backgroundColor: "rgba(124, 144, 255, 0.07)" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#93a3d8" },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "rgba(91, 124, 255, 0.28)"
      },
      ".cm-matchingBracket": {
        backgroundColor: "rgba(34, 211, 238, 0.18)",
        outline: "1px solid rgba(34, 211, 238, 0.35)"
      }
    },
    { dark: true }
  ),
  syntaxHighlighting(oneDarkHighlightStyle)
];

const lightEditorTheme = [
  EditorView.theme({
    ...sharedEditorChrome,
    "&": { ...sharedEditorChrome["&"], color: "#1d2340" },
    ".cm-content": { ...sharedEditorChrome[".cm-content"], caretColor: "#4055e8" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#4055e8" },
    ".cm-gutters": { ...sharedEditorChrome[".cm-gutters"], color: "#9aa2c4" },
    ".cm-activeLine": { backgroundColor: "rgba(64, 85, 232, 0.05)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#5a6494" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(64, 85, 232, 0.16)"
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(8, 145, 178, 0.12)",
      outline: "1px solid rgba(8, 145, 178, 0.3)"
    }
  }),
  syntaxHighlighting(defaultHighlightStyle)
];

export function App() {
  const route = useMemo(() => getAppRoute(), []);
  const isEmbed = route.mode === "embed";
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  if (route.mode === "landing") {
    return <Landing theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <Playground theme={theme} onToggleTheme={toggleTheme} isEmbed={isEmbed} />;
}

interface PlaygroundProps {
  theme: Theme;
  onToggleTheme: () => void;
  isEmbed: boolean;
}

function Playground({ theme, onToggleTheme, isEmbed }: PlaygroundProps) {
  const [code, setCode] = useState(defaultExample.code);
  const [flavor, setFlavor] = useState<RuntimeFlavor>(defaultExample.flavor);
  const [selectedExample, setSelectedExample] = useState(defaultExample.id);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const snippet: SnippetPayload = useMemo(() => ({ code, flavor }), [code, flavor]);

  useEffect(() => {
    let cancelled = false;

    void readShareHash(window.location.hash).then((shared) => {
      if (cancelled || !shared) return;
      setCode(shared.code);
      setFlavor(shared.flavor);
      setSelectedExample("custom");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const execute = useCallback(async () => {
    setIsRunning(true);
    setNotice(null);
    setResult({
      id: "pending",
      flavor,
      status: "ok",
      durationMs: 0,
      chunks: [{ kind: "system", text: "Running..." }]
    });

    try {
      const nextResult = await runSnippet(code, flavor);
      setResult(nextResult);
      trackEvent("run", {
        flavor,
        status: nextResult.status
      });
    } catch (error) {
      reportRuntimeError(error);
      setResult({
        id: "failed",
        flavor,
        status: "error",
        durationMs: 0,
        chunks: [
          {
            kind: "stderr",
            text: error instanceof Error ? error.message : String(error)
          }
        ]
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, flavor]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void execute();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [execute]);

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    if (!example) return;

    setSelectedExample(example.id);
    setCode(example.code);
    setFlavor(example.flavor);
    setNotice(`Loaded ${example.title}.`);
  };

  const copyShareLink = async () => {
    const shareUrl = await buildShareUrl(snippet);
    await navigator.clipboard.writeText(shareUrl);
    window.history.replaceState(null, "", new URL(shareUrl).hash);
    setNotice("Share link copied.");
    trackEvent("copy_share", { flavor });
  };

  const copyInput = async () => {
    await navigator.clipboard.writeText(code);
    setCopiedInput(true);
    trackEvent("copy_input", { flavor });
    window.setTimeout(() => setCopiedInput(false), 1500);
  };

  const copyOutput = async () => {
    const text = (result?.chunks ?? []).map((chunk) => chunk.text).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    trackEvent("copy_output", { flavor });
    window.setTimeout(() => setCopiedOutput(false), 1500);
  };

  const copyEmbed = async () => {
    const embedUrl = await buildShareUrl(snippet, true);
    const iframe = `<iframe src="${embedUrl}" title="Weblua snippet" loading="lazy" width="100%" height="420"></iframe>`;
    await navigator.clipboard.writeText(iframe);
    setNotice("Embed code copied.");
    trackEvent("copy_embed", { flavor });
  };

  const reset = () => {
    setCode(defaultExample.code);
    setFlavor(defaultExample.flavor);
    setSelectedExample(defaultExample.id);
    setResult(null);
    setNotice(null);
    window.history.replaceState(null, "", "/playground");
  };

  const statusKind = isRunning ? "running" : result ? result.status : "idle";

  return (
    <div className={isEmbed ? "app app-embed" : "app"}>
      {!isEmbed && (
        <header className="app-header">
          <a className="brand" href="/" aria-label="Weblua home">
            <MoonMark size={26} />
            <h1>Weblua</h1>
            <span className="brand-tag">Playground</span>
          </a>
          <div className="header-actions">
            <a
              className="icon-button"
              href="https://github.com/PytechNo/Weblua"
              target="_blank"
              rel="noreferrer"
              title="Open GitHub repository"
              aria-label="Open GitHub repository"
            >
              <GitHubMark size={17} />
            </a>
            <button
              className="icon-button"
              type="button"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Use light theme" : "Use dark theme"}
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
      )}

      <main className="workspace">
        <div className="toolbar" aria-label="Playground controls">
          <label className="control">
            <span>Example</span>
            <select value={selectedExample} onChange={(event) => loadExample(event.target.value)}>
              <option value="custom">Custom snippet</option>
              {examples.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.title}
                </option>
              ))}
            </select>
          </label>

          <div className="control" role="group" aria-label="Runtime">
            <span>Runtime</span>
            <div className="segmented">
              <button
                type="button"
                className={flavor === "lua54" ? "is-active" : ""}
                onClick={() => setFlavor("lua54")}
                aria-pressed={flavor === "lua54"}
              >
                Lua 5.4
              </button>
              <button
                type="button"
                className={flavor === "luau" ? "is-active" : ""}
                onClick={() => setFlavor("luau")}
                aria-pressed={flavor === "luau"}
              >
                Luau
              </button>
            </div>
          </div>

          <div className="toolbar-actions">
            <button className="button button-primary" type="button" onClick={execute} disabled={isRunning}>
              <Play size={16} />
              {isRunning ? "Running" : "Run"}
              <kbd className="run-kbd" aria-hidden="true">
                Ctrl ↵
              </kbd>
            </button>
            <button className="button" type="button" onClick={copyShareLink}>
              <Link size={16} />
              Copy link
            </button>
            {!isEmbed && (
              <>
                <button className="icon-button text-icon" type="button" onClick={copyEmbed} title="Copy iframe embed">
                  <Code2 size={16} />
                </button>
                <button className="icon-button text-icon" type="button" onClick={reset} title="Reset playground">
                  <RotateCcw size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}

        <div className="panes">
          <section className="editor-pane" aria-label="Lua editor">
            <div className="pane-header">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="pane-title">{flavor === "luau" ? "main.luau" : "main.lua"}</span>
              <span className="pane-badge">{flavor === "luau" ? "Luau" : "Lua 5.4"}</span>
              <button
                className="icon-button text-icon"
                type="button"
                onClick={copyInput}
                title="Copy code"
                aria-label="Copy code"
              >
                {copiedInput ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="editor-host">
              <CodeMirror
                value={code}
                height="100%"
                theme={theme === "dark" ? darkEditorTheme : lightEditorTheme}
                extensions={[languageExtension]}
                basicSetup={{
                  foldGutter: true,
                  highlightActiveLine: true,
                  lineNumbers: true
                }}
                onChange={(value) => {
                  setCode(value);
                  setSelectedExample("custom");
                }}
              />
            </div>
          </section>

          <aside className="output-pane" aria-label="Execution output">
            <div className="output-header">
              <span className={`status-dot status-${statusKind}`} aria-hidden="true" />
              <div>
                <strong>Output</strong>
                <span>{isRunning ? "running..." : result ? formatRunMeta(result) : "Ready"}</span>
              </div>
              <button
                className="icon-button text-icon"
                type="button"
                onClick={copyOutput}
                disabled={!result?.chunks.length}
                title="Copy output"
                aria-label="Copy output"
              >
                {copiedOutput ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                className="icon-button text-icon"
                type="button"
                onClick={() => setResult(null)}
                title="Clear output"
                aria-label="Clear output"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <OutputView chunks={result?.chunks ?? []} />
          </aside>
        </div>
      </main>

      {!isEmbed && (
        <footer className="seo-line">
          Weblua is a Lua playground for running Lua online, testing Luau snippets, checking Lua
          5.4 behavior, and sharing small programs from the browser.
        </footer>
      )}
    </div>
  );
}

function OutputView({ chunks }: { chunks: OutputChunk[] }) {
  if (chunks.length === 0) {
    return (
      <div className="empty-output">
        <p>Press Run — or hit Ctrl+Enter — to see stdout, stderr, and timing here.</p>
      </div>
    );
  }

  return (
    <pre className="output-stream">
      {chunks.map((chunk, index) => (
        <span className={`output-line output-${chunk.kind}`} key={`${chunk.kind}-${index}`}>
          {chunk.text}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

function formatRunMeta(result: RunResult): string {
  const status = result.status === "ok" ? "finished" : result.status;
  return `${status} in ${Math.max(1, Math.round(result.durationMs))} ms`;
}
