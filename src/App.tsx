import { StreamLanguage, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { type Diagnostic as CmDiagnostic, lintGutter, linter } from "@codemirror/lint";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Link,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitHubMark, MoonMark } from "./components/Brand";
import { Landing } from "./components/Landing";
import { checkProject } from "./lib/checker";
import {
  deserializeProject,
  PROJECT_EXPORT_EXTENSION,
  readProjectShareHash,
  serializeProject,
  tryBuildProjectShareUrl
} from "./lib/codec";
import { defaultExample, examples } from "./lib/examples";
import {
  createDefaultWorkspace,
  deleteProjectFile,
  projectFromSnippet,
  renameProjectFile,
  runtimeFileExtension,
  setProjectEntry,
  upsertProjectFile
} from "./lib/project";
import { runProject } from "./lib/runner";
import { getAppRoute } from "./lib/routes";
import { reportRuntimeError, trackEvent } from "./lib/telemetry";
import type {
  OutputChunk,
  ProjectPayload,
  RunResult,
  RuntimeFlavor,
  Workspace
} from "./lib/types";
import {
  type StoredWorkspaceProject,
  workspaceStore
} from "./lib/workspaceStore";

type Theme = "dark" | "light";

const languageExtension = StreamLanguage.define(lua);

const runtimeOptions: Array<{ value: RuntimeFlavor; label: string }> = [
  { value: "lua51", label: "Lua 5.1" },
  { value: "lua52", label: "Lua 5.2" },
  { value: "lua53", label: "Lua 5.3" },
  { value: "lua54", label: "Lua 5.4" },
  { value: "luau", label: "Luau" }
];

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

function defaultWorkspace(): Workspace {
  return createDefaultWorkspace(defaultExample.flavor, defaultExample.code);
}

function workspaceFromProject(project: ProjectPayload): Workspace {
  return { project, activeFile: project.entry, stdin: "" };
}

function runtimeLabel(flavor: RuntimeFlavor): string {
  return runtimeOptions.find((runtime) => runtime.value === flavor)?.label ?? flavor;
}

function defaultProjectName(workspace: Workspace): string {
  const base = workspace.project.entry.split("/").at(-1) ?? "project";
  return base.replace(/\.(?:lua|luau)$/i, "") || "Untitled project";
}

function exportName(workspace: Workspace): string {
  const name = defaultProjectName(workspace).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  return `${name || "weblua-project"}${PROJECT_EXPORT_EXTENSION}`;
}

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
  const [workspace, setWorkspace] = useState<Workspace>(defaultWorkspace);
  const [projects, setProjects] = useState<StoredWorkspaceProject[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const skipNextAutosave = useRef(false);

  const refreshProjects = useCallback(async () => {
    if (isEmbed) return;
    setProjects(await workspaceStore.listProjects());
  }, [isEmbed]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const shared = await readProjectShareHash(window.location.hash);
      const [draft, savedProjects] = isEmbed
        ? [null, [] as StoredWorkspaceProject[]]
        : await Promise.all([workspaceStore.getDraft(), workspaceStore.listProjects()]);

      if (cancelled) return;
      if (shared) {
        setWorkspace(workspaceFromProject(shared));
      } else if (draft) {
        setWorkspace(draft);
      }
      setProjects(savedProjects);
      setIsHydrated(true);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [isEmbed]);

  useEffect(() => {
    if (!isHydrated || isEmbed) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void workspaceStore.saveWorkspace(workspace);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [isEmbed, isHydrated, workspace]);

  const activeCode = workspace.project.files[workspace.activeFile] ?? "";
  const selectedExample = useMemo(() => {
    const example = examples.find(
      (candidate) =>
        candidate.flavor === workspace.project.flavor &&
        candidate.code === workspace.project.files[workspace.project.entry] &&
        Object.keys(workspace.project.files).length === 1
    );
    return example?.id ?? "custom";
  }, [workspace.project]);

  const updateWorkspace = useCallback((update: (current: Workspace) => Workspace) => {
    setWorkspace((current) => update(current));
  }, []);

  const execute = useCallback(async () => {
    setIsRunning(true);
    setNotice(null);
    setResult({
      id: "pending",
      flavor: workspace.project.flavor,
      status: "ok",
      durationMs: 0,
      chunks: [{ kind: "system", text: "Running..." }]
    });

    try {
      const nextResult = await runProject(workspace.project, workspace.stdin);
      setResult(nextResult);
      trackEvent("run", { flavor: workspace.project.flavor, status: nextResult.status });
    } catch (error) {
      reportRuntimeError(error);
      setResult({
        id: "failed",
        flavor: workspace.project.flavor,
        status: "error",
        durationMs: 0,
        chunks: [{ kind: "stderr", text: error instanceof Error ? error.message : String(error) }]
      });
    } finally {
      setIsRunning(false);
    }
  }, [workspace]);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    setNotice(null);

    try {
      const checked = await checkProject(workspace.project, workspace.activeFile);
      if (!checked) {
        setNotice("Check could not run. Try again.");
        return;
      }

      trackEvent("check", {
        flavor: workspace.project.flavor,
        problems: checked.diagnostics.length
      });

      const clean = checked.diagnostics.length === 0;
      setResult({
        id: checked.id,
        flavor: checked.flavor,
        status: clean ? "ok" : "error",
        durationMs: checked.durationMs,
        chunks: clean
          ? [{ kind: "system", text: "Check passed: every project file compiled cleanly." }]
          : checked.diagnostics.map((diagnostic) => ({
              kind: "stderr" as const,
              text: `${diagnostic.file ?? workspace.activeFile}:${diagnostic.line}: ${diagnostic.message}`
            }))
      });
    } finally {
      setIsChecking(false);
    }
  }, [workspace]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          void runCheck();
        } else {
          void execute();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [execute, runCheck]);

  const editorExtensions = useMemo(() => {
    const project = workspace.project;
    const activeFile = workspace.activeFile;
    const liveLinter = linter(
      async (view): Promise<CmDiagnostic[]> => {
        const source = view.state.doc.toString();
        if (!source.trim()) return [];

        const checked = await checkProject(
          { ...project, files: { ...project.files, [activeFile]: source } },
          activeFile
        );
        if (!checked || view.state.doc.toString() !== source) return [];

        return checked.diagnostics
          .filter((diagnostic) => !diagnostic.file || diagnostic.file === activeFile)
          .map((diagnostic) => {
            const lineNumber = Math.min(Math.max(diagnostic.line, 1), view.state.doc.lines);
            const line = view.state.doc.line(lineNumber);
            return {
              from: line.from,
              to: line.to,
              severity: diagnostic.severity,
              message: diagnostic.message,
              source: runtimeLabel(project.flavor)
            };
          });
      },
      { delay: 650 }
    );

    return [languageExtension, liveLinter, lintGutter()];
  }, [workspace.activeFile, workspace.project]);

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    if (!example) return;

    setWorkspace({ ...workspaceFromProject(projectFromSnippet(example)), activeProjectId: undefined });
    setResult(null);
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

  const deleteActiveFile = () => {
    try {
      const project = deleteProjectFile(workspace.project, workspace.activeFile);
      const activeFile = project.files[workspace.project.entry]
        ? workspace.project.entry
        : Object.keys(project.files)[0];
      setWorkspace({ ...workspace, project, activeFile });
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
      setNotice(`This project is too large for a reliable link. Export ${PROJECT_EXPORT_EXTENSION} instead.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      window.history.replaceState(null, "", new URL(shareUrl).hash);
      setNotice("Share link copied. Input stays local to this browser.");
      trackEvent("copy_share", { flavor: workspace.project.flavor });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not copy the share link.");
    }
  };

  const copyInput = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopiedInput(true);
    trackEvent("copy_input", { flavor: workspace.project.flavor });
    window.setTimeout(() => setCopiedInput(false), 1500);
  };

  const copyOutput = async () => {
    const text = (result?.chunks ?? []).map((chunk) => chunk.text).join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    trackEvent("copy_output", { flavor: workspace.project.flavor });
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
      setNotice(`This project is too large for an embed link. Export ${PROJECT_EXPORT_EXTENSION} instead.`);
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
    skipNextAutosave.current = true;
    setWorkspace(defaultWorkspace());
    setResult(null);
    setNotice(null);
    window.history.replaceState(null, "", "/playground");
    if (!isEmbed) await workspaceStore.clearDraft();
  };

  const newProject = () => {
    setWorkspace(createDefaultWorkspace(workspace.project.flavor));
    setResult(null);
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

  const openProject = (project: StoredWorkspaceProject) => {
    setWorkspace(project.workspace);
    setLibraryOpen(false);
    setResult(null);
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
      setResult(null);
      await refreshProjects();
      setNotice(`Imported ${imported.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import that project.");
    }
  };

  const statusKind = isRunning ? "running" : result ? result.status : "idle";
  const filePaths = Object.keys(workspace.project.files);
  const activeNamedProject = projects.find((project) => project.id === workspace.activeProjectId);

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
              <option value="custom">Custom project</option>
              {examples.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.title}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>Runtime</span>
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
              <input
                ref={importRef}
                className="visually-hidden"
                type="file"
                accept={`application/json,${PROJECT_EXPORT_EXTENSION}`}
                onChange={importProject}
              />
            </div>
          )}

          <div className="toolbar-actions">
            <button className="button button-primary" type="button" onClick={execute} disabled={isRunning}>
              <Play size={16} />
              {isRunning ? "Running" : "Run"}
              <kbd className="run-kbd" aria-hidden="true">Ctrl ↵</kbd>
            </button>
            <button className="button" type="button" onClick={runCheck} disabled={isChecking} title="Compile all files without running (Ctrl+Shift+Enter)">
              <ShieldCheck size={16} />
              {isChecking ? "Checking" : "Check"}
            </button>
            <button className="button" type="button" onClick={copyShareLink}>
              <Link size={16} />
              Copy link
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

          {!isEmbed && libraryOpen && (
            <ProjectLibrary
              projects={projects}
              activeProjectId={workspace.activeProjectId}
              onClose={() => setLibraryOpen(false)}
              onNew={newProject}
              onOpen={openProject}
              onRename={() => void renameCurrentProject()}
              onDelete={() => void deleteCurrentProject()}
              activeName={activeNamedProject?.name}
            />
          )}
        </div>

        {notice && <div className="notice" role="status">{notice}</div>}

        <div className="panes">
          <section className="editor-pane" aria-label="Project editor">
            <div className="pane-header">
              <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="pane-title">{workspace.activeFile}</span>
              <span className="pane-badge">{runtimeLabel(workspace.project.flavor)}</span>
              <button className="icon-button text-icon" type="button" onClick={copyInput} title="Copy active file" aria-label="Copy active file">
                {copiedInput ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="editor-workbench">
              <nav className="file-explorer" aria-label="Project files">
                <div className="file-explorer-header">
                  <span>Files</span>
                  <button className="icon-button text-icon" type="button" onClick={addFile} title="Add file" aria-label="Add file"><FilePlus2 size={16} /></button>
                </div>
                <div className="file-list">
                  {filePaths.map((path) => (
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
                  <button className="file-action" type="button" onClick={setActiveEntry} disabled={workspace.activeFile === workspace.project.entry}>Set entry</button>
                  <button className="file-action" type="button" onClick={renameActiveFile}><Pencil size={14} /> Rename</button>
                  <button className="file-action danger" type="button" onClick={deleteActiveFile} disabled={workspace.activeFile === workspace.project.entry || filePaths.length === 1}><Trash2 size={14} /> Delete</button>
                </div>
              </nav>
              <div className="editor-host">
                <CodeMirror
                  value={activeCode}
                  height="100%"
                  theme={theme === "dark" ? darkEditorTheme : lightEditorTheme}
                  extensions={editorExtensions}
                  basicSetup={{ foldGutter: true, highlightActiveLine: true, lineNumbers: true }}
                  onChange={updateActiveCode}
                />
              </div>
            </div>
          </section>

          <aside className="output-pane" aria-label="Execution output">
            <div className="output-header">
              <span className={`status-dot status-${statusKind}`} aria-hidden="true" />
              <div>
                <strong>Output</strong>
                <span aria-live="polite">{isRunning ? "running..." : result ? formatRunMeta(result) : "Ready"}</span>
              </div>
              <button className="icon-button text-icon" type="button" onClick={() => setInputOpen((open) => !open)} title={inputOpen ? "Hide input" : "Show input"} aria-label={inputOpen ? "Hide input" : "Show input"} aria-expanded={inputOpen}>
                <Plus className={inputOpen ? "input-toggle is-open" : "input-toggle"} size={16} />
              </button>
              <button className="icon-button text-icon" type="button" onClick={copyOutput} disabled={!result?.chunks.length} title="Copy output" aria-label="Copy output">
                {copiedOutput ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button className="icon-button text-icon" type="button" onClick={() => setResult(null)} title="Clear output" aria-label="Clear output"><Trash2 size={16} /></button>
            </div>
            <OutputView chunks={result?.chunks ?? []} />
            {inputOpen && (
              <section className="input-drawer" aria-label="Preset standard input">
                <label htmlFor="stdin-input">Input <span>{workspace.project.flavor === "luau" ? "read()" : "io.read()"}</span></label>
                <textarea id="stdin-input" value={workspace.stdin} onChange={(event) => updateWorkspace((current) => ({ ...current, stdin: event.target.value }))} placeholder="One line per read. This input stays in this browser." spellCheck={false} />
              </section>
            )}
          </aside>
        </div>
      </main>

      {!isEmbed && <footer className="seo-line">Weblua runs Lua and Luau projects entirely in your browser. Named projects, draft recovery, and shared source never require an account.</footer>}
    </div>
  );
}

interface ProjectLibraryProps {
  projects: StoredWorkspaceProject[];
  activeProjectId?: string;
  activeName?: string;
  onClose: () => void;
  onNew: () => void;
  onOpen: (project: StoredWorkspaceProject) => void;
  onRename: () => void;
  onDelete: () => void;
}

function ProjectLibrary({ projects, activeProjectId, activeName, onClose, onNew, onOpen, onRename, onDelete }: ProjectLibraryProps) {
  return (
    <section className="project-library" id="project-library" role="dialog" aria-label="Local projects">
      <div className="project-library-header">
        <div><strong>Local projects</strong><span>Stored only in this browser</span></div>
        <button className="icon-button text-icon" type="button" onClick={onClose} aria-label="Close projects"><X size={16} /></button>
      </div>
      <div className="project-library-actions">
        <button className="button" type="button" onClick={onNew}><Plus size={16} /> New project</button>
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

function OutputView({ chunks }: { chunks: OutputChunk[] }) {
  if (chunks.length === 0) {
    return <div className="empty-output"><p>Press Run — or Ctrl+Enter — to see stdout, stderr, and timing here.</p></div>;
  }

  return <pre className="output-stream">{chunks.map((chunk, index) => <span className={`output-line output-${chunk.kind}`} key={`${chunk.kind}-${index}`}>{chunk.text}{"\n"}</span>)}</pre>;
}

function formatRunMeta(result: RunResult): string {
  const status = result.status === "ok" ? "finished" : result.status;
  return `${status} in ${Math.max(1, Math.round(result.durationMs))} ms`;
}

function formatProjectDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp);
}
