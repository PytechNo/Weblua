import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import {
  Code2,
  ExternalLink,
  Link,
  Moon,
  Play,
  RotateCcw,
  Share2,
  Sun,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildShareUrl, makeShareHash, readShareHash } from "./lib/codec";
import { defaultExample, examples } from "./lib/examples";
import { runSnippet } from "./lib/runner";
import { getAppRoute } from "./lib/routes";
import { fetchSnippet, saveSnippet } from "./lib/snippetApi";
import { reportRuntimeError, trackEvent } from "./lib/telemetry";
import type { OutputChunk, RunResult, RuntimeFlavor, SnippetPayload } from "./lib/types";

type Theme = "dark" | "light";

const languageExtension = StreamLanguage.define(lua);
const fixedEditorTheme = EditorView.theme({
  "&": {
    height: "100%"
  },
  ".cm-scroller": {
    fontFamily: '"Berkeley Mono", "SFMono-Regular", Consolas, monospace'
  },
  ".cm-content": {
    padding: "16px 0"
  },
  ".cm-line": {
    padding: "0 18px"
  }
});

export function App() {
  const route = useMemo(() => getAppRoute(), []);
  const isEmbed = route.mode === "embed";
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  );
  const [code, setCode] = useState(defaultExample.code);
  const [flavor, setFlavor] = useState<RuntimeFlavor>(defaultExample.flavor);
  const [selectedExample, setSelectedExample] = useState(defaultExample.id);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  const snippet: SnippetPayload = useMemo(() => ({ code, flavor }), [code, flavor]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const shared = readShareHash(window.location.hash);
    if (shared) {
      setCode(shared.code);
      setFlavor(shared.flavor);
      setSelectedExample("custom");
      return;
    }

    if ((route.mode === "snippet" || route.mode === "embed") && route.id) {
      const snippetId = route.id;

      fetchSnippet(snippetId)
        .then((remoteSnippet) => {
          setCode(remoteSnippet.code);
          setFlavor(remoteSnippet.flavor);
          setSelectedExample("custom");
        })
        .catch((error) => {
          setResult({
            id: snippetId,
            flavor: "lua54",
            status: "error",
            durationMs: 0,
            chunks: [{ kind: "stderr", text: error instanceof Error ? error.message : String(error) }]
          });
          reportRuntimeError(error);
        });
    }
  }, [route]);

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
    setShortUrl(null);
    setNotice(`Loaded ${example.title}.`);
  };

  const copyShareLink = async () => {
    const shareUrl = buildShareUrl(snippet);
    await navigator.clipboard.writeText(shareUrl);
    window.history.replaceState(null, "", makeShareHash(snippet));
    setNotice("Share link copied.");
    trackEvent("copy_share", { flavor });
  };

  const createShortLink = async () => {
    setNotice("Creating short link...");

    try {
      const saved = await saveSnippet(snippet);
      const url = new URL(`/p/${saved.id}`, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setShortUrl(url);
      setNotice("Short link copied.");
      trackEvent("short_link", { flavor });
    } catch (error) {
      reportRuntimeError(error);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const copyEmbed = async () => {
    const embedUrl = shortUrl ? shortUrl.replace("/p/", "/embed/") : buildShareUrl(snippet, true);
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
    setShortUrl(null);
    window.history.replaceState(null, "", "/");
  };

  return (
    <div className={isEmbed ? "app app-embed" : "app"}>
      {!isEmbed && (
        <header className="app-header">
          <a className="brand" href="/" aria-label="Weblua home">
            <span className="brand-mark" aria-hidden="true">
              WL
            </span>
            <h1>Weblua</h1>
          </a>
          <div className="header-actions">
            <a
              className="icon-link"
              href="https://github.com/PytechNo/Weblua"
              target="_blank"
              rel="noreferrer"
              title="Open GitHub repository"
              aria-label="Open GitHub repository"
            >
              <ExternalLink size={18} />
            </a>
            <button
              className="icon-button"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Use light theme" : "Use dark theme"}
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
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

          <label className="control runtime-control">
            <span>Runtime</span>
            <select
              value={flavor}
              onChange={(event) => setFlavor(event.target.value as RuntimeFlavor)}
            >
              <option value="lua54">Lua 5.4</option>
              <option value="luau">Luau</option>
            </select>
          </label>

          <div className="toolbar-actions">
            <button className="button button-primary" type="button" onClick={execute} disabled={isRunning}>
              <Play size={17} />
              {isRunning ? "Running" : "Run"}
            </button>
            <button className="button" type="button" onClick={copyShareLink}>
              <Link size={17} />
              Copy link
            </button>
            {!isEmbed && (
              <>
                <button className="icon-button text-icon" type="button" onClick={createShortLink} title="Create short link">
                  <Share2 size={17} />
                </button>
                <button className="icon-button text-icon" type="button" onClick={copyEmbed} title="Copy iframe embed">
                  <Code2 size={17} />
                </button>
                <button className="icon-button text-icon" type="button" onClick={reset} title="Reset playground">
                  <RotateCcw size={17} />
                </button>
              </>
            )}
          </div>
        </div>

        {notice && <div className="notice">{notice}</div>}

        <div className="panes">
          <section className="editor-pane" aria-label="Lua editor">
            <CodeMirror
              value={code}
              height="100%"
              theme={theme === "dark" ? "dark" : "light"}
              extensions={[languageExtension, fixedEditorTheme, theme === "dark" ? oneDark : []]}
              basicSetup={{
                foldGutter: true,
                highlightActiveLine: true,
                lineNumbers: true
              }}
              onChange={(value) => {
                setCode(value);
                setSelectedExample("custom");
                setShortUrl(null);
              }}
            />
          </section>

          <aside className="output-pane" aria-label="Execution output">
            <div className="output-header">
              <div>
                <strong>Output</strong>
                <span>{result ? formatRunMeta(result) : "Ready"}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setResult(null)}
                title="Clear output"
                aria-label="Clear output"
              >
                <Trash2 size={17} />
              </button>
            </div>
            <OutputView chunks={result?.chunks ?? []} />
          </aside>
        </div>
      </main>

      {!isEmbed && (
        <footer className="seo-line">
          Weblua is a Lua playground for running Lua online, testing Luau snippets,
          checking Lua 5.4 behavior, and sharing small programs from the browser.
        </footer>
      )}
    </div>
  );
}

function OutputView({ chunks }: { chunks: OutputChunk[] }) {
  if (chunks.length === 0) {
    return <div className="empty-output">Run a snippet to see stdout, stderr, and timing.</div>;
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
