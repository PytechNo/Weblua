import { indentLess, indentMore, redo, undo } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic as CmDiagnostic, forceLinting, lintGutter, linter } from "@codemirror/lint";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  IndentDecrease,
  IndentIncrease,
  Keyboard,
  Link,
  Menu,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  ShieldCheck,
  Square,
  Timer,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  WrapText,
  X
} from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  lazy,
  Suspense,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { GitHubMark, MoonMark } from "./components/Brand";
import { PlaygroundShell } from "./components/PlaygroundShell";
import { SwapLabel } from "./components/SwapLabel";
import { luaSupport, refreshLuaContext } from "./lang/lua";
import { checkProject } from "./lib/checker";
import { formatLua, minimalChange } from "./lib/formatter";
import {
  deserializeProject,
  PROJECT_EXPORT_EXTENSION,
  readProjectShareHash,
  serializeProject,
  tryBuildProjectShareUrl
} from "./lib/codec";
import { diagnosticRange, formatDiagnostic } from "./lib/diagnostics";
import { luauIntelligence } from "./lib/editorIntelligence";
import { linkLocations } from "./lib/outputLinks";
import {
  defaultExample,
  exampleMatchesProject,
  examples,
  findExample,
  projectForExample,
  toolExamples
} from "./lib/examples";
import { gistHash, gistIdFrom, loadGistProject, readGistHash } from "./lib/gist";
import { type PlaygroundTool, readCompareHash, TOOL_PATHS } from "./lib/routes";
import { onLuauAnalysisReady, warmLuauAnalysis } from "./lib/luauAnalysis";
import { dumpLuauBytecode, optimizeHotComment, parseBytecodeListing } from "./lib/luauBytecode";
import {
  EDITOR_FONT_SIZES,
  type EditorOptions,
  readBytecodeOptions,
  readEditorOptions,
  readLuauTypeMode,
  storeBytecodeOptions,
  storeEditorOptions,
  storeLuauTypeMode
} from "./lib/preferences";
import {
  createDefaultWorkspace,
  deleteProjectFile,
  isSourcePath,
  renameProjectFile,
  runtimeFileExtension,
  runtimeOptions,
  setProjectEntry,
  upsertProjectFile
} from "./lib/project";
import { runProject, type RunHandle } from "./lib/runner";
import { selectionLayer } from "./lib/selectionLayer";
import { reportRuntimeError, trackEvent } from "./lib/telemetry";
import { DEFAULT_RUN_TIMEOUT_MS, EXTENDED_RUN_TIMEOUT_MS } from "./lib/types";
import type {
  BytecodeOptions,
  BytecodeResult,
  CompilerLevel,
  Diagnostic,
  LuauTypeMode,
  OutputChunk,
  ProjectPayload,
  RunResult,
  RuntimeFlavor,
  Workspace
} from "./lib/types";
import {
  hasStoredDraftHint,
  type StoredWorkspaceProject,
  workspaceStore
} from "./lib/workspaceStore";

type Theme = "dark" | "light";

const typeModeOptions: Array<{ value: LuauTypeMode; label: string }> = [
  { value: "strict", label: "Strict" },
  { value: "nonstrict", label: "Nonstrict" },
  { value: "off", label: "Off" }
];

const compilerLevels: CompilerLevel[] = [0, 1, 2];

/** A tool page's guide, below the editor: text the editor itself never needs. */
const ToolGuide = lazy(() => import("./components/Articles").then((module) => ({ default: module.ToolGuide })));

/** Comparison pages open with Compare already on, against this runtime. */
const toolCompare: Partial<Record<PlaygroundTool, RuntimeFlavor>> = {
  "lua-vs-luau": "luau",
  "lua51-vs-lua54": "lua54"
};

/** Phones in either orientation; embeds are always compact. Keep in step with styles.css. */
const COMPACT_QUERY = "(max-width: 640px), (max-width: 880px) and (max-height: 500px)";
/** Too narrow for code and output side by side. */
const NARROW_QUERY = "(max-width: 640px)";
/** Tall enough to stack code over output, as a narrow embed (the homepage hero) does. */
const TALL_QUERY = "(min-height: 560px)";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", onChange);
      return () => media?.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false);
}

/** Touch screens: no hover, no physical keyboard to hand. */
const COARSE_QUERY = "(pointer: coarse)";

/** Characters a phone keyboard hides behind extra taps, for the key bar. */
const KEY_BAR_CHARACTERS = ["(", ")", "{", "}", "[", "]", '"', "=", ".", ":", ",", "#", "~", "-"];

/** Line wrapping, switched without rebuilding the editor's extensions. */
const wrapCompartment = new Compartment();

type SaveState = "saving" | "saved" | "failed" | "memory";

/** Pause after the last keystroke before the open file is recompiled. */
const BYTECODE_DELAY_MS = 250;

type OutputTab = "output" | "bytecode";

type BytecodeState =
  | { status: "ready"; file: string; result: BytecodeResult }
  | { status: "unavailable" };

const sharedEditorChrome = {
  "&": {
    height: "100%",
    fontSize: "var(--editor-font-size, 13.5px)",
    backgroundColor: "transparent"
  },
  "&.cm-focused": {
    outline: "none"
  },
  ".cm-scroller": {
    fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, monospace)',
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
  },
  ".cm-tooltip": {
    backgroundColor: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border-strong)",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    overflow: "hidden"
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, monospace)',
    fontSize: "12.5px"
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--primary)",
    color: "var(--primary-text)"
  },
  ".cm-completionDetail": {
    marginLeft: "1.2em",
    color: "var(--muted)",
    fontStyle: "normal"
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
    color: "inherit",
    opacity: "0.8"
  },
  ".cm-completionInfo, .cm-luau-hover": {
    padding: "6px 10px",
    maxWidth: "560px",
    fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, monospace)',
    fontSize: "12.5px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere"
  },
  ".cm-luau-hover code": {
    fontFamily: "inherit"
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

/**
 * Whether restore() can still replace the document after the first paint.
 *
 * Painting the default project and then swapping in a share link or a saved
 * draft moves the line-number gutter (its width tracks the line count), the
 * file list, and everything the editor lays out below them -- the ~1.0 CLS
 * the field data reports. Visitors with neither a hash nor a draft have
 * nothing to swap in, so they skip the wait and keep their current LCP.
 */
function hasPendingRestore(keepsDraft: boolean): boolean {
  if (window.location.hash.length > 1) return true;
  return keepsDraft && hasStoredDraftHint();
}

function defaultWorkspace(tool?: PlaygroundTool): Workspace {
  const example = tool ? toolExamples[tool] : defaultExample;
  const project = projectForExample(example);
  return {
    project,
    activeFile: project.entry,
    stdin: "stdin" in example ? example.stdin ?? "" : ""
  };
}

function workspaceFromProject(project: ProjectPayload): Workspace {
  return { project, activeFile: project.entry, stdin: "" };
}

function runtimeLabel(flavor: RuntimeFlavor): string {
  return runtimeOptions.find((runtime) => runtime.value === flavor)?.label ?? flavor;
}

/** The "source" line of a lint tooltip: which checker said so. */
function diagnosticSourceLabel(diagnostic: Diagnostic, flavor: RuntimeFlavor): string {
  switch (diagnostic.source) {
    case "type":
      return "Luau type check";
    case "lint":
      return diagnostic.code ? `Luau lint · ${diagnostic.code}` : "Luau lint";
    default:
      return runtimeLabel(flavor);
  }
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function defaultProjectName(workspace: Workspace): string {
  const base = workspace.project.entry.split("/").at(-1) ?? "project";
  return base.replace(/\.(?:lua|luau)$/i, "") || "Untitled project";
}

function exportName(workspace: Workspace): string {
  const name = defaultProjectName(workspace).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  return `${name || "weblua-project"}${PROJECT_EXPORT_EXTENSION}`;
}

interface PlaygroundProps {
  theme: Theme;
  onToggleTheme: () => void;
  isEmbed: boolean;
  tool?: PlaygroundTool;
}

export default function Playground({ theme, onToggleTheme, isEmbed, tool }: PlaygroundProps) {
  // Tool pages always open on their demo and never touch the draft, so a quick
  // format or check can't overwrite what the visitor left in /playground.
  const keepsDraft = !isEmbed && !tool;
  const [workspace, setWorkspace] = useState<Workspace>(() => defaultWorkspace(tool));
  const [projects, setProjects] = useState<StoredWorkspaceProject[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  /** The same run on the Compare runtime. Null whenever the output pane shows one result. */
  const [compareResult, setCompareResult] = useState<RunResult | null>(null);
  const [compareFlavor, setCompareFlavor] = useState<RuntimeFlavor | null>(() => {
    const linked = runtimeOptions.find((runtime) => runtime.value === readCompareHash())?.value;
    return linked ?? (tool && toolCompare[tool]) ?? null;
  });
  const [isRunning, setIsRunning] = useState(false);
  /** Off: five seconds per run. On: thirty, for benchmarks and heavy loops. */
  const [longRuns, setLongRuns] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  /** Luau files without a `--!strict`-style hot comment are checked in this mode. */
  const [typeMode, setTypeMode] = useState<LuauTypeMode>(readLuauTypeMode);
  const [isHydrated, setIsHydrated] = useState(false);
  // Constant for the life of the mount: the answer cannot change once the
  // hash is read and restore() is in flight.
  const [restorePending] = useState(() => hasPendingRestore(keepsDraft));
  const [notice, setNotice] = useState<string | null>(null);
  /** What the notice's Undo button restores, while that notice is up. */
  const [undoable, setUndoable] = useState<{ notice: string; workspace: Workspace } | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [editorOptions, setEditorOptions] = useState<EditorOptions>(readEditorOptions);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [outputTab, setOutputTab] = useState<OutputTab>(tool === "bytecode" ? "bytecode" : "output");
  // Phones and embeds get the compact layout: one slim bar, everything else in a menu.
  // Below 640px it also shows one pane at a time, picked by phonePane.
  const compact = useMediaQuery(COMPACT_QUERY) || isEmbed;
  const narrow = useMediaQuery(NARROW_QUERY);
  const coarse = useMediaQuery(COARSE_QUERY);
  const tall = useMediaQuery(TALL_QUERY);
  // Phones keep tabs even when tall: with the keyboard open, a stacked editor would be a sliver.
  const layout = !compact ? "" : !narrow ? " is-compact" : isEmbed && tall ? " is-compact is-stacked" : " is-compact is-tabbed";
  const tabbed = layout.endsWith("is-tabbed");
  const [phonePane, setPhonePane] = useState<"editor" | "output">("editor");
  const menuRef = useRef<HTMLDialogElement>(null);
  const [openInWebluaUrl, setOpenInWebluaUrl] = useState("/playground");
  // Touch devices get the system share sheet, which has its own Copy action.
  const [nativeShare] = useState(() => !!navigator.share && window.matchMedia("(pointer: coarse)").matches);
  const [bytecodeOptions, setBytecodeOptions] = useState<BytecodeOptions>(readBytecodeOptions);
  /** The open file's listing. Null until the compiler first answers. */
  const [bytecode, setBytecode] = useState<BytecodeState | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const skipNextAutosave = useRef(false);
  /** The run in flight, so Stop and unmount can end it. Null when idle. */
  const runRef = useRef<RunHandle | null>(null);
  /** Latest workspace for callbacks that must not be rebuilt per keystroke. */
  const workspaceRef = useRef(workspace);
  const typeModeRef = useRef(typeMode);

  // Declared ahead of every other effect so the lint source reads a committed
  // workspace, never one from a render React threw away.
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    typeModeRef.current = typeMode;
    storeLuauTypeMode(typeMode);
  }, [typeMode]);

  useEffect(() => {
    storeBytecodeOptions(bytecodeOptions);
  }, [bytecodeOptions]);

  const refreshProjects = useCallback(async () => {
    if (isEmbed) return;
    setProjects(await workspaceStore.listProjects());
  }, [isEmbed]);

  useEffect(() => {
    let cancelled = false;

    /** A gist that fails to load leaves a notice, then the draft opens as usual. */
    const readGist = async (id: string): Promise<ProjectPayload | null> => {
      try {
        return await loadGistProject(id);
      } catch (error) {
        if (!cancelled) setNotice(`Could not open the gist. ${error instanceof Error ? error.message : ""}`.trim());
        return null;
      }
    };

    const restore = async () => {
      try {
        const gistId = readGistHash(window.location.hash);
        const linkedExample = await findExample(window.location.hash);
        const [shared, draft, savedProjects] = await Promise.all([
          gistId ? readGist(gistId) : linkedExample ? projectForExample(linkedExample) : readProjectShareHash(window.location.hash),
          keepsDraft ? workspaceStore.getDraft() : null,
          isEmbed ? ([] as StoredWorkspaceProject[]) : workspaceStore.listProjects()
        ]);

        if (cancelled) return;
        if (shared) {
          setWorkspace(workspaceFromProject(shared));
        } else if (draft) {
          setWorkspace(draft);
        }
        setProjects(savedProjects);
      } catch (error) {
        // A truncated share hash throws while decoding. The default workspace
        // is a fine fallback, but the editor now waits on this flag, so it has
        // to be set on every path or a bad link renders an empty pane forever.
        if (!cancelled) reportRuntimeError(error);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [isEmbed, keepsDraft]);

  useEffect(() => {
    if (!isHydrated || !keepsDraft) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }

    setSaveState("saving");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void workspaceStore.saveWorkspace(workspace).then((saved) => {
        if (cancelled) return;
        // Memory mode "saves" fine but forgets on reload, so it is not "Saved".
        setSaveState(!saved ? "failed" : workspaceStore.mode === "memory" ? "memory" : "saved");
      });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keepsDraft, isHydrated, workspace]);

  useEffect(() => {
    storeEditorOptions(editorOptions);
    editorRef.current?.view?.dispatch({ effects: wrapCompartment.reconfigure(editorOptions.wrap ? EditorView.lineWrapping : []) });
  }, [editorOptions]);

  const activeCode = workspace.project.files[workspace.activeFile] ?? "";
  /** Hold back content whose size a pending restore would change. */
  const editorReady = isHydrated || !restorePending;
  const selectedExample = useMemo(() => {
    const example = examples.find((candidate) => exampleMatchesProject(candidate, workspace.project));
    return example?.id ?? "custom";
  }, [workspace.project]);

  const updateWorkspace = useCallback((update: (current: Workspace) => Workspace) => {
    setWorkspace((current) => update(current));
  }, []);

  const clearOutput = () => {
    setResult(null);
    setCompareResult(null);
  };

  const compareWith = compareFlavor !== workspace.project.flavor ? compareFlavor : null;

  const execute = useCallback(async () => {
    if (runRef.current) return;

    const flavor = workspace.project.flavor;
    const timeoutMs = longRuns ? EXTENDED_RUN_TIMEOUT_MS : DEFAULT_RUN_TIMEOUT_MS;
    setIsRunning(true);
    setNotice(null);
    setOutputTab("output");
    setPhonePane("output");

    try {
      // Output is accumulated outside state: several worker messages can
      // arrive between renders, and each one needs the full list so far.
      const start = (project: ProjectPayload, show: (result: RunResult) => void): RunHandle => {
        let live: OutputChunk[] = [];
        const handle = runProject(project, workspace.stdin, {
          timeoutMs,
          onOutput: (chunks) => {
            live = [...live, ...chunks];
            show({ id: handle.id, flavor: project.flavor, status: "ok", durationMs: 0, chunks: live });
          }
        });
        // The same id as the result that will replace this, so the output pane
        // stays mounted for the whole run instead of remounting at the end.
        show({
          id: handle.id,
          flavor: project.flavor,
          status: "ok",
          durationMs: 0,
          chunks: [{ kind: "system", text: "Running..." }]
        });
        return handle;
      };

      // Compare runs both runtimes at once, each in its own worker.
      const handle = start(workspace.project, setResult);
      const other = compareWith ? start({ ...workspace.project, flavor: compareWith }, setCompareResult) : null;
      if (!other) setCompareResult(null);
      runRef.current = {
        id: handle.id,
        result: handle.result,
        stop: () => {
          handle.stop();
          other?.stop();
        }
      };

      const [nextResult, nextOther] = await Promise.all([handle.result, other?.result ?? null]);
      setResult(nextResult);
      setCompareResult(nextOther);
      // Weblua's own lesson pages mark an exercise done from this. The target
      // origin keeps the output from reaching third-party pages that embed us.
      if (isEmbed && window.parent !== window) {
        const output = nextResult.chunks.filter((chunk) => chunk.kind === "stdout").map((chunk) => chunk.text).join("\n");
        window.parent.postMessage({ type: "weblua:run", status: nextResult.status, output }, window.location.origin);
      }
      trackEvent("run", { flavor, status: nextResult.status, timeoutMs, ...(compareWith ? { compare: compareWith } : {}) });
    } catch (error) {
      reportRuntimeError(error);
      setCompareResult(null);
      setResult({
        id: "failed",
        flavor,
        status: "error",
        durationMs: 0,
        chunks: [{ kind: "stderr", text: error instanceof Error ? error.message : String(error) }]
      });
    } finally {
      runRef.current = null;
      setIsRunning(false);
    }
  }, [compareWith, isEmbed, longRuns, workspace]);

  // "Run it here" on an article swaps in `/embed#example=…&run=1`, already
  // pressed. Only Weblua's own examples run unasked, never shared code.
  const autorunDone = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (!isEmbed || !isHydrated || autorunDone.current || !params.has("example") || params.get("run") !== "1") return;
    autorunDone.current = true;
    void execute();
  }, [execute, isEmbed, isHydrated]);

  /**
   * Ends the run and keeps what it printed. The handle resolves a "stopped"
   * result, so the awaiting execute() finishes on its normal path.
   */
  const stopRun = useCallback(() => {
    runRef.current?.stop();
  }, []);

  // A worker outlives the component that started it unless it is terminated.
  useEffect(() => () => runRef.current?.stop(), []);

  // A plain link rather than window.open after an await, which Safari treats as a popup.
  useEffect(() => {
    if (!isEmbed) return;
    const timer = window.setTimeout(() => {
      tryBuildProjectShareUrl(workspace.project).then(
        (url) => setOpenInWebluaUrl(url ?? "/playground"),
        () => setOpenInWebluaUrl("/playground")
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isEmbed, workspace.project]);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    setNotice(null);
    setOutputTab("output");
    setPhonePane("output");

    try {
      const isLuau = workspace.project.flavor === "luau";
      const checked = await checkProject(workspace.project, workspace.activeFile, { typeMode });
      if (!checked) {
        setNotice("Check could not run. Try again.");
        return;
      }

      trackEvent("check", {
        flavor: workspace.project.flavor,
        problems: checked.diagnostics.length,
        ...(isLuau ? { types: typeMode } : {})
      });

      const errors = checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      const warnings = checked.diagnostics.length - errors;
      const chunks: OutputChunk[] = checked.diagnostics.map((diagnostic) => ({
        kind: "stderr",
        text: formatDiagnostic(diagnostic, workspace.activeFile)
      }));

      if (chunks.length === 0) {
        chunks.push({
          kind: "system",
          text: checked.typeChecked
            ? "Check passed: every project file compiled and type-checked cleanly."
            : "Check passed: every project file compiled cleanly."
        });
      } else {
        chunks.push({
          kind: "system",
          text: `${countLabel(errors, "error")}, ${countLabel(warnings, "warning")}.`
        });
      }
      if (isLuau && typeMode !== "off" && !checked.typeChecked) {
        chunks.push({
          kind: "system",
          text: "The Luau type checker could not load, so only syntax was checked."
        });
      }

      setCompareResult(null);
      setResult({
        id: checked.id,
        flavor: checked.flavor,
        status: errors > 0 ? "error" : "ok",
        durationMs: checked.durationMs,
        chunks
      });
    } finally {
      setIsChecking(false);
    }
  }, [typeMode, workspace]);

  /**
   * Formats the open file with StyLua, loaded on first use. The result is
   * applied as the smallest edit that covers the changes, so undo, the
   * cursor, and scroll position all survive; it is dropped if the file was
   * edited or switched while the formatter loaded.
   */
  const formatActiveFile = useCallback(async () => {
    const view = editorRef.current?.view;
    if (!view) return;
    const { project, activeFile } = workspaceRef.current;
    const source = view.state.doc.toString();
    if (!isSourcePath(activeFile)) {
      setNotice("Format works on .lua and .luau files.");
      return;
    }

    setIsFormatting(true);
    try {
      const formatted = await formatLua(source, project.flavor);
      trackEvent("format", { flavor: project.flavor, status: formatted.ok ? "ok" : "error" });
      if (!formatted.ok) {
        setNotice(formatted.message);
        return;
      }
      if (workspaceRef.current.activeFile !== activeFile || view.state.doc.toString() !== source) return;

      const change = minimalChange(source, formatted.code);
      if (change) view.dispatch({ changes: change, userEvent: "input.format" });
      setNotice(null);
    } finally {
      setIsFormatting(false);
    }
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // event.code, because Alt changes event.key on macOS.
      if (event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyF") {
        event.preventDefault();
        void formatActiveFile();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          void runCheck();
        } else {
          void execute();
        }
        return;
      }

      // Escape only does anything mid-run, so it stays out of the way of the
      // editor and the dialogs the rest of the time.
      if (event.key === "Escape" && runRef.current) {
        event.preventDefault();
        stopRun();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [execute, formatActiveFile, runCheck, stopRun]);

  /**
   * The lint source reads the workspace through a ref rather than closing over
   * it. Rebuilding this array is not free: @uiw/react-codemirror reconfigures
   * the whole editor whenever `extensions` changes identity, which tears down
   * and rebuilds the lint gutter's plugin on every keystroke -- the 664ms INP
   * the field data attributes to .cm-gutter-lint.
   */
  const editorExtensions = useMemo(() => {
    const liveLinter = linter(
      async (view): Promise<CmDiagnostic[]> => {
        const source = view.state.doc.toString();
        const { project, activeFile } = workspaceRef.current;
        if (!source.trim() || !isSourcePath(activeFile)) return [];

        // Only the open file is type-checked per keystroke, and a cold
        // analyzer is skipped rather than awaited; it forces a fresh pass
        // when it finishes loading.
        const checked = await checkProject(
          { ...project, files: { ...project.files, [activeFile]: source } },
          activeFile,
          { typeMode: typeModeRef.current, typeCheckFile: activeFile, background: true }
        );
        if (!checked || view.state.doc.toString() !== source) return [];

        return checked.diagnostics
          .filter((diagnostic) => !diagnostic.file || diagnostic.file === activeFile)
          .map((diagnostic) => ({
            ...diagnosticRange(view.state.doc, diagnostic),
            severity: diagnostic.severity,
            message: diagnostic.message,
            source: diagnosticSourceLabel(diagnostic, project.flavor)
          }));
      },
      { delay: 650 }
    );

    // Completion, hover, and builtin highlighting read the project through the
    // same ref, for the same reason. For Luau, the analyzer adds types to the
    // first two.
    const language = luaSupport(
      {
        flavor: () => workspaceRef.current.project.flavor,
        activeFile: () => workspaceRef.current.activeFile,
        files: () => Object.keys(workspaceRef.current.project.files)
      },
      luauIntelligence(() => ({ ...workspaceRef.current, typeMode: typeModeRef.current }))
    );

    return [language, liveLinter, lintGutter(), selectionLayer, wrapCompartment.of(readEditorOptions().wrap ? EditorView.lineWrapping : [])];
  }, []);

  // A stable lint source no longer re-runs just because the extension array
  // was rebuilt, so ask for a pass when the runtime, the open file, or the
  // type-checking mode changes.
  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    forceLinting(view);
    view.dispatch({ effects: refreshLuaContext.of(null) });
  }, [typeMode, workspace.activeFile, workspace.project.flavor]);

  // Load the Luau analyzer once a Luau project is on screen, so the first
  // keystroke is not the one that pays for downloading it. Every load, and
  // every reload after a crash, refreshes the diagnostics it missed.
  const wantsAnalysis = workspace.project.flavor === "luau" && typeMode !== "off";
  useEffect(() => {
    if (!wantsAnalysis || !editorReady) return;

    const unsubscribe = onLuauAnalysisReady(() => {
      const view = editorRef.current?.view;
      if (view) forceLinting(view);
    });
    void warmLuauAnalysis();
    return unsubscribe;
  }, [editorReady, wantsAnalysis]);

  // Only Luau has a compiler to show; switching a project to Lua 5.x falls back
  // to the output tab without forgetting the choice.
  const showBytecode = outputTab === "bytecode" && workspace.project.flavor === "luau";
  const optimizeOverride = showBytecode ? optimizeHotComment(activeCode) : null;

  // The last listing stays up while the next compiles, so typing does not
  // flash the pane.
  useEffect(() => {
    if (!showBytecode) return;

    let cancelled = false;
    const file = workspace.activeFile;
    const timer = window.setTimeout(() => {
      void dumpLuauBytecode(activeCode, bytecodeOptions).then((result) => {
        if (!cancelled) setBytecode(result ? { status: "ready", file, result } : { status: "unavailable" });
      });
    }, BYTECODE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeCode, bytecodeOptions, showBytecode, workspace.activeFile]);

  const openBytecode = () => {
    if (!showBytecode) trackEvent("open_bytecode");
    setOutputTab("bytecode");
  };

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    if (!example) return;

    setWorkspace({
      ...workspaceFromProject(projectForExample(example)),
      stdin: "stdin" in example ? example.stdin ?? "" : "",
      activeProjectId: undefined
    });
    clearOutput();
    setNotice(`Loaded ${example.title}.`);
  };

  const updateRuntime = (flavor: RuntimeFlavor) => {
    updateWorkspace((current) => ({
      ...current,
      project: { ...current.project, flavor }
    }));
  };

  const updateActiveCode = (code: string) => {
    updateWorkspace((current) => ({
      ...current,
      project: {
        ...current.project,
        files: { ...current.project.files, [current.activeFile]: code }
      }
    }));
  };

  const addFile = () => {
    const extension = runtimeFileExtension(workspace.project.flavor);
    const path = window.prompt("New file path", `module${extension}`)?.trim();
    if (!path) return;

    try {
      if (Object.hasOwn(workspace.project.files, path)) {
        setNotice("A file already uses that path.");
        return;
      }
      const project = upsertProjectFile(workspace.project, path, "");
      setWorkspace({ ...workspace, project, activeFile: path });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create that file.");
    }
  };

  const renameActiveFile = () => {
    const path = window.prompt("Rename file", workspace.activeFile)?.trim();
    if (!path || path === workspace.activeFile) return;

    try {
      const project = renameProjectFile(workspace.project, workspace.activeFile, path);
      setWorkspace({ ...workspace, project, activeFile: path });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not rename that file.");
    }
  };

  /** Shows `message` with an Undo button that puts `previous` back. */
  const offerUndo = (message: string, previous: Workspace) => {
    setNotice(message);
    setUndoable({ notice: message, workspace: previous });
  };

  const deleteActiveFile = () => {
    try {
      const project = deleteProjectFile(workspace.project, workspace.activeFile);
      const activeFile = project.files[workspace.project.entry]
        ? workspace.project.entry
        : Object.keys(project.files)[0];
      setWorkspace({ ...workspace, project, activeFile });
      offerUndo(`Deleted ${workspace.activeFile}.`, workspace);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete that file.");
    }
  };

  const setActiveEntry = () => {
    try {
      setWorkspace({ ...workspace, project: setProjectEntry(workspace.project, workspace.activeFile) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not set the entry file.");
    }
  };

  const copyShareLink = async () => {
    let shareUrl: string | null;
    try {
      shareUrl = await tryBuildProjectShareUrl(workspace.project);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the share link.");
      return;
    }
    if (!shareUrl) {
      setNotice(
        `This project is too large for a link. Export it, add the ${PROJECT_EXPORT_EXTENSION} file to a GitHub gist, then open the gist from Projects for a short link.`
      );
      return;
    }

    // In the address bar first, so the link can still be copied from there if the clipboard refuses.
    window.history.replaceState(null, "", new URL(shareUrl).hash);
    if (nativeShare) {
      try {
        await navigator.share({ title: "Weblua project", url: shareUrl });
        trackEvent("copy_share", { flavor: workspace.project.flavor });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied. Input stays local to this browser.");
      trackEvent("copy_share", { flavor: workspace.project.flavor });
    } catch {
      setNotice(
        isEmbed
          ? "Could not copy the share link."
          : "Could not copy the link. It is in the address bar; copy it from there."
      );
    }
  };

  const copyInput = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopiedInput(true);
    trackEvent("copy_input", { flavor: workspace.project.flavor });
    window.setTimeout(() => setCopiedInput(false), 1500);
  };

  const bytecodeListing = bytecode?.status === "ready" && bytecode.result.ok ? bytecode.result.listing : "";

  const copyOutput = async () => {
    const text = showBytecode
      ? bytecodeListing
      : compareResult && result
        ? [result, compareResult].map((run) => `-- ${runtimeLabel(run.flavor)}\n${outputText(run)}`).join("\n\n")
        : outputText(result);
    await navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    trackEvent(showBytecode ? "copy_bytecode" : "copy_output", { flavor: workspace.project.flavor });
    window.setTimeout(() => setCopiedOutput(false), 1500);
  };

  const copyEmbed = async () => {
    let embedUrl: string | null;
    try {
      embedUrl = await tryBuildProjectShareUrl(workspace.project, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the embed link.");
      return;
    }
    if (!embedUrl) {
      setNotice(
        `This project is too large for an embed link. Export it, add the ${PROJECT_EXPORT_EXTENSION} file to a GitHub gist, and embed /embed#gist= followed by the gist's ID.`
      );
      return;
    }

    try {
      const iframe = `<iframe src="${embedUrl}" title="Weblua project" loading="lazy" width="100%" height="520"></iframe>`;
      await navigator.clipboard.writeText(iframe);
      setNotice("Embed code copied.");
      trackEvent("copy_embed", { flavor: workspace.project.flavor });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not copy the embed code.");
    }
  };

  const reset = async () => {
    const previous = workspace;
    skipNextAutosave.current = true;
    setWorkspace(defaultWorkspace(tool));
    clearOutput();
    offerUndo("Started over.", previous);
    window.history.replaceState(null, "", tool ? `/${TOOL_PATHS[tool]}` : "/playground");
    if (keepsDraft) await workspaceStore.clearDraft();
  };

  const undoLast = () => {
    if (!undoable) return;
    setWorkspace(undoable.workspace);
    setUndoable(null);
    setNotice(null);
  };

  /** Opens `file` at a reported line, from a link in the output. */
  const pendingJump = useRef<{ line: number; column?: number } | null>(null);
  const moveCursor = useCallback((line: number, column = 1) => {
    const view = editorRef.current?.view;
    if (!view) return;
    const target = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
    const anchor = target.from + Math.min(Math.max(column - 1, 0), target.length);
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
  }, []);
  const jumpTo = (file: string, line: number, column?: number) => {
    setPhonePane("editor");
    if (file === workspace.activeFile) {
      moveCursor(line, column);
      return;
    }
    pendingJump.current = { line, column };
    updateWorkspace((current) => ({ ...current, activeFile: file }));
  };
  // The editor's own effect has swapped in the new file's text by the time this runs.
  useEffect(() => {
    const jump = pendingJump.current;
    if (!jump) return;
    pendingJump.current = null;
    moveCursor(jump.line, jump.column);
  }, [moveCursor, workspace.activeFile]);

  /** For the key bar: runs an editor command or types text, keeping the keyboard up. */
  const editorKey = (action: (view: EditorView) => unknown) => {
    const view = editorRef.current?.view;
    if (!view) return;
    action(view);
    view.focus();
  };

  const newProject = () => {
    setWorkspace(createDefaultWorkspace(workspace.project.flavor));
    clearOutput();
    setLibraryOpen(false);
    setNotice("Started a new local workspace.");
  };

  const saveAsProject = async () => {
    const name = window.prompt("Project name", defaultProjectName(workspace))?.trim();
    if (!name) return;
    const saved = await workspaceStore.createProject(name, workspace);
    if (!saved) {
      setNotice("Could not save this project locally.");
      return;
    }
    setWorkspace(saved.workspace);
    await refreshProjects();
    setNotice(`Saved ${saved.name}. Changes now update it automatically.`);
  };

  const openGist = async () => {
    const input = window.prompt("GitHub gist URL or ID");
    if (!input?.trim()) return;
    const id = gistIdFrom(input);
    if (!id) {
      setNotice("That is not a GitHub gist URL or ID.");
      return;
    }

    setNotice("Loading the gist from GitHub…");
    try {
      const project = await loadGistProject(id);
      setWorkspace(workspaceFromProject(project));
      clearOutput();
      setLibraryOpen(false);
      window.history.replaceState(null, "", gistHash(id));
      setNotice("Opened the gist. This page's address now links to it.");
      trackEvent("open_gist", { flavor: project.flavor });
    } catch (error) {
      setNotice(`Could not open the gist. ${error instanceof Error ? error.message : ""}`.trim());
    }
  };

  const openProject = (project: StoredWorkspaceProject) => {
    setWorkspace(project.workspace);
    setLibraryOpen(false);
    clearOutput();
    setNotice(`Opened ${project.name}.`);
  };

  const renameCurrentProject = async () => {
    const id = workspace.activeProjectId;
    const current = projects.find((project) => project.id === id);
    if (!id || !current) return;
    const name = window.prompt("Project name", current.name)?.trim();
    if (!name) return;
    const renamed = await workspaceStore.renameProject(id, name);
    if (!renamed) {
      setNotice("Could not rename this project.");
      return;
    }
    await refreshProjects();
    setNotice(`Renamed to ${renamed.name}.`);
  };

  const deleteCurrentProject = async () => {
    const id = workspace.activeProjectId;
    const current = projects.find((project) => project.id === id);
    if (!id || !current || !window.confirm(`Delete ${current.name} from this browser?`)) return;
    if (!(await workspaceStore.deleteProject(id))) {
      setNotice("Could not delete this project.");
      return;
    }
    setWorkspace((currentWorkspace) => {
      const { activeProjectId: _activeProjectId, ...untitled } = currentWorkspace;
      return untitled;
    });
    await refreshProjects();
    setNotice("Deleted the named project. The open workspace remains as a draft.");
  };

  const exportProject = () => {
    const blob = new Blob([serializeProject(workspace.project)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = exportName(workspace);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    setNotice("Project exported. Input is intentionally not included.");
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const project = deserializeProject(await file.text());
      if (!project) {
        setNotice("That file is not a valid Weblua project export.");
        return;
      }
      const importedName = file.name.toLowerCase().endsWith(PROJECT_EXPORT_EXTENSION)
        ? file.name.slice(0, -PROJECT_EXPORT_EXTENSION.length)
        : file.name;
      const imported = await workspaceStore.createProject(
        importedName || "Imported project",
        workspaceFromProject(project)
      );
      if (!imported) {
        setNotice("Could not save the imported project locally.");
        return;
      }
      setWorkspace(imported.workspace);
      clearOutput();
      await refreshProjects();
      setNotice(`Imported ${imported.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import that project.");
    }
  };

  const statusKind = isRunning ? "running" : result ? result.status : "idle";
  const filePaths = Object.keys(workspace.project.files);
  const projectFiles = new Set(filePaths);
  const activeNamedProject = projects.find((project) => project.id === workspace.activeProjectId);

  // Shared by the desktop toolbar and the compact bar and menu; only one layout renders.
  const runButton = (
    <button
      className={isRunning ? "button button-primary is-running" : "button button-primary"}
      type="button"
      onClick={isRunning ? stopRun : execute}
      title={
        isRunning
          ? "Stop this run and keep its output (Esc)"
          : "Run the project (Ctrl+Enter)"
      }
    >
      {isRunning ? <Square size={13} /> : <Play size={16} />}
      <SwapLabel widest="Stop">{isRunning ? "Stop" : "Run"}</SwapLabel>
      <kbd className="run-kbd" aria-hidden="true">
        <SwapLabel widest="Ctrl ↵">{isRunning ? "Esc" : "Ctrl ↵"}</SwapLabel>
      </kbd>
    </button>
  );

  const runtimeSelect = (
    <select
      value={workspace.project.flavor}
      onChange={(event) => updateRuntime(event.target.value as RuntimeFlavor)}
    >
      {runtimeOptions.map((runtime) => (
        <option key={runtime.value} value={runtime.value}>
          {runtime.label}
        </option>
      ))}
    </select>
  );

  const exampleOptions = (
    <>
      <option value="custom">Custom project</option>
      {examples.map((example) => (
        <option key={example.id} value={example.id}>
          {example.title}
        </option>
      ))}
    </>
  );

  const compareSelect = (
    <select
      value={compareWith ?? ""}
      onChange={(event) => {
        setCompareFlavor((event.target.value || null) as RuntimeFlavor | null);
        setCompareResult(null);
      }}
    >
      <option value="">Off</option>
      {runtimeOptions
        .filter((runtime) => runtime.value !== workspace.project.flavor)
        .map((runtime) => (
          <option key={runtime.value} value={runtime.value}>
            {runtime.label}
          </option>
        ))}
    </select>
  );

  const typeModeSelect = (
    <select value={typeMode} onChange={(event) => setTypeMode(event.target.value as LuauTypeMode)}>
      {typeModeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const projectLibrary = !isEmbed && libraryOpen && (
    <ProjectLibrary
      projects={projects}
      activeProjectId={workspace.activeProjectId}
      onClose={() => setLibraryOpen(false)}
      onNew={newProject}
      onOpenGist={() => void openGist()}
      onOpen={openProject}
      onRename={() => void renameCurrentProject()}
      onDelete={() => void deleteCurrentProject()}
      activeName={activeNamedProject?.name}
    />
  );

  const closeMenu = () => menuRef.current?.close();
  /** Closes the menu first, so prompts and the file picker open over the editor, not the sheet. */
  const fromMenu = (action: () => unknown) => () => {
    closeMenu();
    void action();
  };
  const isLuau = workspace.project.flavor === "luau";

  return (
    <PlaygroundShell
      theme={theme}
      onToggleTheme={onToggleTheme}
      isEmbed={isEmbed}
      tool={tool}
      guide={
        tool && !isEmbed ? (
          <Suspense fallback={null}>
            <ToolGuide tool={tool} />
          </Suspense>
        ) : undefined
      }
    >
      <main className={`workspace${layout}`}>
        {compact ? (
          <div className="compact-top">
            <div className="compact-bar" aria-label="Playground controls">
              {isEmbed && (
                <a className="embed-brand" href={openInWebluaUrl} target="_blank" rel="noopener" title="Open this project in Weblua">
                  <MoonMark size={20} />
                  <span>Weblua</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
              <label className="compact-runtime">
                <span className="visually-hidden">Runtime</span>
                {runtimeSelect}
              </label>
              <button className="icon-button text-icon compact-menu-button" type="button" onClick={() => menuRef.current?.showModal()} aria-haspopup="dialog" title="Menu" aria-label="Menu">
                <Menu size={19} />
              </button>
              {runButton}
            </div>
            {tabbed && (
              <span className="output-tabs compact-tabs" role="group" aria-label="Show">
                <button type="button" aria-pressed={phonePane === "editor"} onClick={() => setPhonePane("editor")}>Code</button>
                <button
                  type="button"
                  aria-pressed={phonePane === "output" && !showBytecode}
                  onClick={() => {
                    setPhonePane("output");
                    setOutputTab("output");
                  }}
                >
                  Output <span className={`status-dot status-${statusKind}`} aria-hidden="true" />
                </button>
                {isLuau && (
                  <button
                    type="button"
                    aria-pressed={phonePane === "output" && showBytecode}
                    onClick={() => {
                      setPhonePane("output");
                      openBytecode();
                    }}
                  >
                    Bytecode
                  </button>
                )}
              </span>
            )}
            {projectLibrary}
          </div>
        ) : (
        <div className="toolbar" aria-label="Playground controls">
          <label className="control">
            <span>Example</span>
            <select value={selectedExample} onChange={(event) => loadExample(event.target.value)}>
              {exampleOptions}
            </select>
          </label>

          <label className="control">
            <span>Runtime</span>
            {runtimeSelect}
          </label>

          <label className="control control-compare" title="Run the code on a second runtime too, and show both outputs">
            <span>Compare</span>
            {compareSelect}
          </label>

          {!isEmbed && (
            <div className="project-toolbar-actions">
              <button
                className="button"
                type="button"
                onClick={() => setLibraryOpen((open) => !open)}
                aria-expanded={libraryOpen}
                aria-controls="project-library"
              >
                <FolderOpen size={16} />
                Projects
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              <button className="icon-button text-icon" type="button" onClick={saveAsProject} title="Save as project" aria-label="Save as project">
                <Save size={16} />
              </button>
              <button className="icon-button text-icon" type="button" onClick={exportProject} title="Export project" aria-label="Export project">
                <Download size={16} />
              </button>
              <button className="icon-button text-icon" type="button" onClick={() => importRef.current?.click()} title="Import project" aria-label="Import project">
                <Upload size={16} />
              </button>
            </div>
          )}

          <div className="toolbar-actions">
            {runButton}
            <button
              className={longRuns ? "button button-toggle is-on" : "button button-toggle"}
              type="button"
              aria-pressed={longRuns}
              onClick={() => setLongRuns((on) => !on)}
              title={
                longRuns
                  ? "Long runs on: each run gets 30 seconds"
                  : "Long runs off: each run gets 5 seconds. Turn on for benchmarks and heavy loops."
              }
            >
              <Timer size={15} />
              <SwapLabel widest="30 s">{longRuns ? "30 s" : "5 s"}</SwapLabel>
            </button>
            <button
              className="button"
              type="button"
              onClick={runCheck}
              disabled={isChecking}
              title={`${wantsAnalysis ? "Compile and type-check" : "Compile"} all files without running (Ctrl+Shift+Enter)`}
            >
              <ShieldCheck size={16} />
              <SwapLabel widest="Checking">{isChecking ? "Checking" : "Check"}</SwapLabel>
            </button>
            <button className="button" type="button" onClick={copyShareLink}>
              <Link size={16} />
              {nativeShare ? "Share link" : "Copy link"}
            </button>
            {!isEmbed && (
              <>
                <button className="icon-button text-icon" type="button" onClick={copyEmbed} title="Copy iframe embed" aria-label="Copy iframe embed">
                  <Code2 size={16} />
                </button>
                <button className="icon-button text-icon" type="button" onClick={() => void reset()} title="Reset workspace" aria-label="Reset workspace">
                  <RotateCcw size={16} />
                </button>
              </>
            )}
          </div>

          {projectLibrary}
        </div>
        )}

        {notice && (
          <div className="notice" role="status">
            {notice}
            {undoable?.notice === notice && (
              <button className="button notice-action" type="button" onClick={undoLast}>
                <Undo2 size={15} /> Undo
              </button>
            )}
          </div>
        )}

        {!isEmbed && (
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept={`application/json,${PROJECT_EXPORT_EXTENSION}`}
            onChange={importProject}
          />
        )}

        <div className={phonePane === "output" ? "panes phone-show-output" : "panes"}>
          <section className="editor-pane" aria-label="Project editor">
            {compact ? (
              editorReady && filePaths.length > 1 && (
                <div className="file-tabs" role="group" aria-label="Project files">
                  {filePaths.map((path) => (
                    <button
                      key={path}
                      className={path === workspace.activeFile ? "file-item is-active" : "file-item"}
                      type="button"
                      aria-pressed={path === workspace.activeFile}
                      onClick={() => updateWorkspace((current) => ({ ...current, activeFile: path }))}
                    >
                      <span>{path}</span>
                      {path === workspace.project.entry && <span className="entry-mark" aria-label="Entry file">Run</span>}
                    </button>
                  ))}
                </div>
              )
            ) : (
            <div className="pane-header">
              <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="pane-title">{workspace.activeFile}</span>
              <span className="pane-badge">{runtimeLabel(workspace.project.flavor)}</span>
              {isLuau && (
                <label
                  className="type-mode"
                  title="Type checking for files without a --!strict, --!nonstrict, or --!nocheck comment"
                >
                  <span>Types</span>
                  {typeModeSelect}
                </label>
              )}
              {saveState && <SaveStatus state={saveState} />}
              <button className="icon-button text-icon" type="button" onClick={() => void formatActiveFile()} disabled={isFormatting || !editorReady} title="Format file (Shift+Alt+F)" aria-label="Format file">
                <WandSparkles size={16} />
              </button>
              <button className="icon-button text-icon" type="button" onClick={copyInput} title="Copy active file" aria-label="Copy active file">
                {copiedInput ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            )}
            <div className="editor-workbench">
              {!compact && (
              <nav className="file-explorer" aria-label="Project files">
                <div className="file-explorer-header">
                  <span>Files</span>
                  <button className="icon-button text-icon" type="button" onClick={addFile} title="Add file" aria-label="Add file"><FilePlus2 size={16} /></button>
                </div>
                <div className="file-list">
                  {editorReady && filePaths.map((path) => (
                    <button
                      key={path}
                      className={path === workspace.activeFile ? "file-item is-active" : "file-item"}
                      type="button"
                      onClick={() => updateWorkspace((current) => ({ ...current, activeFile: path }))}
                      title={path}
                    >
                      <span>{path}</span>
                      {path === workspace.project.entry && <span className="entry-mark" aria-label="Entry file">Run</span>}
                    </button>
                  ))}
                </div>
                <div className="file-actions" aria-label="Active file actions">
                  <button className="file-action" type="button" onClick={setActiveEntry} disabled={workspace.activeFile === workspace.project.entry || !isSourcePath(workspace.activeFile)}>Set entry</button>
                  <button className="file-action" type="button" onClick={renameActiveFile}><Pencil size={14} /> Rename</button>
                  <button className="file-action danger" type="button" onClick={deleteActiveFile} disabled={workspace.activeFile === workspace.project.entry || filePaths.length === 1}><Trash2 size={14} /> Delete</button>
                </div>
              </nav>
              )}
              <div className="editor-host" style={{ "--editor-font-size": `${editorOptions.fontSize}px` } as CSSProperties}>
                {editorReady ? (
                  <CodeMirror
                    ref={editorRef}
                    value={activeCode}
                    height="100%"
                    theme={theme === "dark" ? darkEditorTheme : lightEditorTheme}
                    extensions={editorExtensions}
                    basicSetup={{ foldGutter: true, highlightActiveLine: true, lineNumbers: true }}
                    onChange={updateActiveCode}
                  />
                ) : (
                  <div className="editor-placeholder" aria-hidden="true" />
                )}
              </div>
              {compact && coarse && editorReady && (
                // pointerdown is cancelled so the editor keeps focus and the keyboard stays open.
                <div className="key-bar" role="toolbar" aria-label="Editing keys" onPointerDown={(event) => event.preventDefault()}>
                  <button type="button" onClick={() => editorKey(undo)} aria-label="Undo"><Undo2 size={17} /></button>
                  <button type="button" onClick={() => editorKey(redo)} aria-label="Redo"><Redo2 size={17} /></button>
                  <button type="button" onClick={() => editorKey(indentLess)} aria-label="Outdent"><IndentDecrease size={17} /></button>
                  <button type="button" onClick={() => editorKey(indentMore)} aria-label="Indent"><IndentIncrease size={17} /></button>
                  {KEY_BAR_CHARACTERS.map((character) => (
                    <button
                      key={character}
                      type="button"
                      className="key-bar-char"
                      onClick={() => editorKey((view) => view.dispatch(view.state.replaceSelection(character), { userEvent: "input.type" }))}
                    >
                      {character}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="output-pane" aria-label={showBytecode ? "Bytecode" : "Execution output"}>
            <div className="output-header">
              <span className={`status-dot status-${statusKind}`} aria-hidden="true" />
              <div>
                {/* The tabbed layout has Bytecode as a top-level tab instead. */}
                {isLuau && !tabbed ? (
                  <span className="output-tabs" role="group" aria-label="Output pane">
                    <button type="button" aria-pressed={!showBytecode} onClick={() => setOutputTab("output")}>Output</button>
                    <button type="button" aria-pressed={showBytecode} onClick={openBytecode} title="The bytecode Luau compiles the open file to">Bytecode</button>
                  </span>
                ) : (
                  <strong>{showBytecode ? "Bytecode" : "Output"}</strong>
                )}
                <span className="output-meta" aria-live="polite">
                  {showBytecode
                    ? formatBytecodeMeta(bytecode)
                    : isRunning ? "running..." : compareResult && result ? `${runtimeLabel(result.flavor)} vs ${runtimeLabel(compareResult.flavor)}` : result ? formatRunMeta(result) : compareWith ? `Runs on ${runtimeLabel(workspace.project.flavor)} and ${runtimeLabel(compareWith)}` : "Ready"}
                </span>
              </div>
              {!showBytecode && (
                <button className="button input-button" type="button" onClick={() => setInputOpen((open) => !open)} title={inputOpen ? "Hide preset input" : "Preset input for read calls"} aria-expanded={inputOpen}>
                  <Plus className={inputOpen ? "input-toggle is-open" : "input-toggle"} size={15} />
                  <span className="input-label">Input</span>
                </button>
              )}
              <button
                className="icon-button text-icon"
                type="button"
                onClick={copyOutput}
                disabled={showBytecode ? !bytecodeListing : !result?.chunks.length}
                title={showBytecode ? "Copy bytecode" : "Copy output"}
                aria-label={showBytecode ? "Copy bytecode" : "Copy output"}
              >
                {copiedOutput ? <Check size={16} /> : <Copy size={16} />}
              </button>
              {!showBytecode && (
                <button className="icon-button text-icon output-clear" type="button" onClick={clearOutput} title="Clear output" aria-label="Clear output"><Trash2 size={16} /></button>
              )}
            </div>
            {showBytecode ? (
              <>
                <div className="bytecode-options">
                  <label
                    title={
                      optimizeOverride === null
                        ? "Optimization level. Runs compile at 1. A --!optimize 0, 1, or 2 comment at the top of a file sets the level for runs and for this listing."
                        : `This file's --!optimize ${optimizeOverride} comment sets the level, for runs and for this listing.`
                    }
                  >
                    <span>Optimize</span>
                    <select
                      value={optimizeOverride ?? bytecodeOptions.optimizationLevel}
                      disabled={optimizeOverride !== null}
                      onChange={(event) =>
                        setBytecodeOptions((current) => ({
                          ...current,
                          optimizationLevel: Number(event.target.value) as CompilerLevel
                        }))
                      }
                    >
                      {compilerLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </label>
                  <label title="Debug info: 0 keeps none, 1 keeps line numbers and function names (as runs do), 2 also keeps local names.">
                    <span>Debug</span>
                    <select
                      value={bytecodeOptions.debugLevel}
                      onChange={(event) =>
                        setBytecodeOptions((current) => ({
                          ...current,
                          debugLevel: Number(event.target.value) as CompilerLevel
                        }))
                      }
                    >
                      {compilerLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </label>
                  <label title="Show each source line above the instructions compiled from it. Needs debug level 1 or 2.">
                    <input
                      type="checkbox"
                      checked={bytecodeOptions.source && bytecodeOptions.debugLevel > 0}
                      disabled={bytecodeOptions.debugLevel === 0}
                      onChange={(event) => setBytecodeOptions((current) => ({ ...current, source: event.target.checked }))}
                    />
                    <span>Source</span>
                  </label>
                  {optimizeOverride !== null && <span className="bytecode-override">Set by --!optimize</span>}
                </div>
                <BytecodeView state={bytecode} />
              </>
            ) : (
              /* Keyed by run, not by message: the pending, streamed, and final
                 results share an id, so the stream mounts once per run and replays
                 its enter animation only when a new run starts. */
              compareResult && result ? (
                <CompareView runs={[result, compareResult]} isRunning={isRunning} files={projectFiles} onJump={jumpTo} />
              ) : (
                <OutputView key={result?.id ?? "empty"} chunks={result?.chunks ?? []} isRunning={isRunning} files={projectFiles} onJump={jumpTo} />
              )
            )}
            {!showBytecode && inputOpen && (
              <section className="input-drawer" aria-label="Preset standard input">
                <label htmlFor="stdin-input">Input <span>{workspace.project.flavor === "luau" ? "read()" : "io.read()"}</span></label>
                <textarea id="stdin-input" value={workspace.stdin} onChange={(event) => updateWorkspace((current) => ({ ...current, stdin: event.target.value }))} placeholder="One line per read. This input stays in this browser." spellCheck={false} />
              </section>
            )}
          </aside>
        </div>

        {compact && (
          <dialog
            ref={menuRef}
            className="compact-menu"
            aria-labelledby="compact-menu-title"
            // A click on the dialog itself, not its content, is a click on the backdrop.
            onClick={(event) => event.target === event.currentTarget && closeMenu()}
          >
            <div className="compact-menu-header">
              <strong id="compact-menu-title">Menu</strong>
              {saveState && <SaveStatus state={saveState} />}
              <button className="icon-button text-icon" type="button" onClick={closeMenu} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>

            <section>
              <h2>Example</h2>
              <select
                aria-label="Example"
                value={selectedExample}
                onChange={(event) => {
                  closeMenu();
                  loadExample(event.target.value);
                }}
              >
                {exampleOptions}
              </select>
            </section>

            <section>
              <h2>Code</h2>
              <div className="menu-grid">
                <button className="button" type="button" onClick={fromMenu(formatActiveFile)} disabled={isFormatting || !editorReady}>
                  <WandSparkles size={16} /> Format code
                </button>
                <button className="button" type="button" onClick={fromMenu(copyInput)}>
                  <Copy size={16} /> Copy code
                </button>
                <button className="button" type="button" onClick={fromMenu(runCheck)} disabled={isChecking}>
                  <ShieldCheck size={16} /> Check for errors
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={fromMenu(() => {
                    setPhonePane("output");
                    setOutputTab("output");
                    setInputOpen(true);
                  })}
                >
                  <Keyboard size={16} /> Program input
                </button>
              </div>
              <button
                className={longRuns ? "button button-toggle is-on" : "button button-toggle"}
                type="button"
                aria-pressed={longRuns}
                onClick={() => setLongRuns((on) => !on)}
              >
                <Timer size={16} /> Time limit per run: {longRuns ? "30 seconds" : "5 seconds"}
              </button>
              <label className="menu-field">
                <span>Compare with</span>
                {compareSelect}
              </label>
              <label className="menu-field">
                <span>Text size</span>
                <select
                  value={editorOptions.fontSize}
                  onChange={(event) => setEditorOptions((current) => ({ ...current, fontSize: Number(event.target.value) }))}
                >
                  {EDITOR_FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} px
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={editorOptions.wrap ? "button button-toggle is-on" : "button button-toggle"}
                type="button"
                aria-pressed={editorOptions.wrap}
                onClick={() => setEditorOptions((current) => ({ ...current, wrap: !current.wrap }))}
              >
                <WrapText size={16} /> Wrap long lines: {editorOptions.wrap ? "on" : "off"}
              </button>
              {isLuau && (
                <label className="menu-field">
                  <span>Type checking</span>
                  {typeModeSelect}
                </label>
              )}
            </section>

            <section>
              <h2>Files</h2>
              <div className="menu-grid">
                <button className="button" type="button" onClick={fromMenu(addFile)}>
                  <FilePlus2 size={16} /> New file
                </button>
                <button className="button" type="button" onClick={fromMenu(renameActiveFile)}>
                  <Pencil size={16} /> Rename {workspace.activeFile}
                </button>
                <button className="button" type="button" onClick={fromMenu(setActiveEntry)} disabled={workspace.activeFile === workspace.project.entry || !isSourcePath(workspace.activeFile)}>
                  <Play size={16} /> Start runs from {workspace.activeFile}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={fromMenu(() => window.confirm(`Delete ${workspace.activeFile}?`) && deleteActiveFile())}
                  disabled={workspace.activeFile === workspace.project.entry || filePaths.length === 1}
                >
                  <Trash2 size={16} /> Delete {workspace.activeFile}
                </button>
              </div>
            </section>

            <section>
              <h2>Share</h2>
              <div className="menu-grid">
                <button className="button" type="button" onClick={fromMenu(copyShareLink)}>
                  <Link size={16} /> {nativeShare ? "Share link" : "Copy link"}
                </button>
                {isEmbed ? (
                  <a className="button" href={openInWebluaUrl} target="_blank" rel="noopener" onClick={closeMenu}>
                    <ExternalLink size={16} /> Open in Weblua
                  </a>
                ) : (
                  <button className="button" type="button" onClick={fromMenu(copyEmbed)}>
                    <Code2 size={16} /> Copy embed code
                  </button>
                )}
              </div>
            </section>

            {!isEmbed && (
              <section>
                <h2>Projects</h2>
                <div className="menu-grid">
                  <button className="button" type="button" onClick={fromMenu(() => setLibraryOpen(true))}>
                    <FolderOpen size={16} /> My projects
                  </button>
                  <button className="button" type="button" onClick={fromMenu(saveAsProject)}>
                    <Save size={16} /> Save as project
                  </button>
                  <button className="button" type="button" onClick={fromMenu(exportProject)}>
                    <Download size={16} /> Export to file
                  </button>
                  <button className="button" type="button" onClick={fromMenu(() => importRef.current?.click())}>
                    <Upload size={16} /> Import from file
                  </button>
                  <button className="button" type="button" onClick={fromMenu(() => window.confirm("Start over? This clears the current code.") && reset())}>
                    <RotateCcw size={16} /> Start over
                  </button>
                </div>
              </section>
            )}
          </dialog>
        )}
      </main>
    </PlaygroundShell>
  );
}

interface ProjectLibraryProps {
  projects: StoredWorkspaceProject[];
  activeProjectId?: string;
  activeName?: string;
  onClose: () => void;
  onNew: () => void;
  onOpenGist: () => void;
  onOpen: (project: StoredWorkspaceProject) => void;
  onRename: () => void;
  onDelete: () => void;
}

function ProjectLibrary({ projects, activeProjectId, activeName, onClose, onNew, onOpenGist, onOpen, onRename, onDelete }: ProjectLibraryProps) {
  return (
    <section className="project-library" id="project-library" role="dialog" aria-label="Local projects">
      <div className="project-library-header">
        <div><strong>Local projects</strong><span>Stored only in this browser</span></div>
        <button className="icon-button text-icon" type="button" onClick={onClose} aria-label="Close projects"><X size={16} /></button>
      </div>
      <div className="project-library-actions">
        <button className="button" type="button" onClick={onNew}><Plus size={16} /> New project</button>
        <button className="button" type="button" onClick={onOpenGist} title="Open a GitHub gist of Lua or Luau files, or of a .weblua.json export"><GitHubMark size={15} /> Open gist</button>
        {activeProjectId && <><button className="button" type="button" onClick={onRename}><Pencil size={16} /> Rename</button><button className="button button-danger" type="button" onClick={onDelete}><Trash2 size={16} /> Delete</button></>}
      </div>
      {activeName && <p className="active-project-note">Editing <strong>{activeName}</strong>; changes save automatically.</p>}
      <div className="project-list">
        {projects.length === 0 ? <p className="empty-projects">Save a workspace to keep it here.</p> : projects.map((project) => (
          <button key={project.id} className={project.id === activeProjectId ? "project-item is-active" : "project-item"} type="button" onClick={() => onOpen(project)}>
            <span>{project.name}</span><time dateTime={new Date(project.updatedAt).toISOString()}>{formatProjectDate(project.updatedAt)}</time>
          </button>
        ))}
      </div>
    </section>
  );
}

interface OutputViewProps {
  chunks: OutputChunk[];
  isRunning: boolean;
  /** Project paths, so `main.lua:3` in an error links to that line. */
  files: ReadonlySet<string>;
  onJump: (file: string, line: number, column?: number) => void;
}

function OutputLine({ text, files, onJump }: { text: string; files: ReadonlySet<string>; onJump: OutputViewProps["onJump"] }) {
  return linkLocations(text, files).map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <button key={index} type="button" className="output-link" onClick={() => onJump(part.file, part.line, part.column)} title={`Open ${part.file} at line ${part.line}`}>
        {part.text}
      </button>
    )
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  const label = { saving: "Saving…", saved: "Saved in this browser", failed: "Not saved", memory: "Not saved: storage is off" }[state];
  return <span className={`save-status is-${state}`} role="status">{label}</span>;
}

function OutputView({ chunks, isRunning, files, onJump }: OutputViewProps) {
  const streamRef = useRef<HTMLPreElement>(null);
  const pinnedRef = useRef(true);

  // Follow a streaming run, but stop following the moment the reader scrolls
  // up: mid-run is exactly when someone wants to read what already printed.
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !isRunning || !pinnedRef.current) return;
    stream.scrollTop = stream.scrollHeight;
  }, [chunks, isRunning]);

  if (chunks.length === 0) {
    return <div className="empty-output"><p>Press Run — or Ctrl+Enter — to see stdout, stderr, and timing here.</p></div>;
  }

  const trackPin = (event: UIEvent<HTMLPreElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    pinnedRef.current = scrollHeight - scrollTop - clientHeight < 24;
  };

  // Only errors and Check results carry locations worth linking; plain output stays plain text.
  return <pre className="output-stream" ref={streamRef} onScroll={trackPin}>{chunks.map((chunk, index) => <span className={`output-line output-${chunk.kind}`} key={`${chunk.kind}-${index}`}>{chunk.kind === "stderr" ? <OutputLine text={chunk.text} files={files} onJump={onJump} /> : chunk.text}{"\n"}</span>)}</pre>;
}

/** What a run printed, for copying and for comparing runs. */
function outputText(run: RunResult | null): string {
  return (run?.chunks ?? []).map((chunk) => chunk.text).join("\n");
}

/** Status lines differ between runtimes ("Running...", timings), so only program output counts. */
function programOutput(run: RunResult): string {
  return run.chunks.filter((chunk) => chunk.kind !== "system").map((chunk) => `${chunk.kind}:${chunk.text}`).join("\n");
}

function CompareView({ runs, isRunning, files, onJump }: { runs: [RunResult, RunResult] } & Omit<OutputViewProps, "chunks">) {
  const same = programOutput(runs[0]) === programOutput(runs[1]);
  return (
    <div className="compare-output">
      {!isRunning && (
        <p className={same ? "compare-verdict is-same" : "compare-verdict"} role="status">
          {same ? "Same output on both runtimes." : "The outputs differ."}
        </p>
      )}
      {runs.map((run, index) => (
        <section className="compare-run" key={index} aria-label={`${runtimeLabel(run.flavor)} output`}>
          <h3>
            <span className={`status-dot status-${isRunning ? "running" : run.status}`} aria-hidden="true" />
            {runtimeLabel(run.flavor)}
            <span>{isRunning ? "running..." : formatRunMeta(run)}</span>
          </h3>
          <OutputView key={run.id} chunks={run.chunks} isRunning={isRunning} files={files} onJump={onJump} />
        </section>
      ))}
    </div>
  );
}

function BytecodeView({ state }: { state: BytecodeState | null }) {
  const lines = useMemo(
    () => (state?.status === "ready" && state.result.ok ? parseBytecodeListing(state.result.listing) : []),
    [state]
  );

  if (!state) {
    return <div className="empty-output"><p>Loading the Luau compiler. It downloads once, about 0.8 MB.</p></div>;
  }
  if (state.status === "unavailable") {
    return (
      <div className="empty-output">
        <p>The Luau compiler could not load. Check your connection, then edit the file or change an option to try again.</p>
      </div>
    );
  }
  if (!state.result.ok) {
    return (
      <div className="empty-output bytecode-error">
        <p>{state.file} does not compile: {state.result.message}. The editor underlines what to fix.</p>
      </div>
    );
  }

  // Source, remark, and local lines get a blank gutter, so code lines up under
  // the source it came from.
  const width = Math.max(1, ...lines.map((line) => (line.kind === "instruction" ? line.line.length : 0)));
  const gutter = (text = "") => <span className="bc-gutter">{text.padStart(width)}{text ? ":" : " "} </span>;

  return (
    <pre className="output-stream bytecode-listing">
      {lines.map((line, index) => {
        switch (line.kind) {
          case "instruction":
            return (
              <span className="bc-line" key={index}>
                {gutter(line.line)}
                {line.label && <span className="bc-label">{line.label}: </span>}
                <span className="bc-op">{line.opcode}</span>
                {line.operands}
                {"\n"}
              </span>
            );
          case "source":
            return <span className="bc-line bc-source" key={index}>{gutter()}{line.code}{"\n"}</span>;
          case "remark":
          case "local":
            return <span className={`bc-line bc-${line.kind}`} key={index}>{gutter()}{line.text}{"\n"}</span>;
          default:
            return <span className={`bc-line bc-${line.kind}`} key={index}>{line.text}{"\n"}</span>;
        }
      })}
    </pre>
  );
}

function formatBytecodeMeta(state: BytecodeState | null): string {
  if (!state) return "loading the compiler...";
  if (state.status === "unavailable") return "compiler unavailable";
  if (!state.result.ok) return `${state.file} does not compile`;
  return `${state.file} · Luau ${state.result.compiler}`;
}

function formatRunMeta(result: RunResult): string {
  const status = result.status === "ok" ? "finished" : result.status;
  return `${status} in ${Math.max(1, Math.round(result.durationMs))} ms`;
}

function formatProjectDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp);
}
