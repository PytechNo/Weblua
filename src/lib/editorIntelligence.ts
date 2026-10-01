import {
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import {
  type HoverSource,
  luaCompletionSource,
  luaHoverSource,
  type LuaSupportOverrides,
  renderStdlibDoc,
  stdlibEntryFor,
  stdlibNameAt
} from "../lang/lua";
import { completeLuau, inspectLuau } from "./luauAnalysis";
import type {
  LuauCompletionEntry,
  LuauInspection,
  LuauTypeMode,
  ProjectPayload,
  SourcePosition
} from "./types";

export interface EditorProjectContext {
  project: ProjectPayload;
  activeFile: string;
  typeMode: LuauTypeMode;
}

/** Same as the Lua completion source's, so merged results narrow alike. */
const WORD = /^\w*$/;
/** Nodes that name something the analyzer can describe. */
const NAMED_NODES = new Set([
  "VariableName",
  "VariableDefinition",
  "PropertyName",
  "TypeName",
  "TypeDefinition",
  "ModuleName"
]);
/** Longer types stay readable in the popup's side panel instead. */
const MAX_DETAIL_LENGTH = 48;

/**
 * The Luau analyzer layered onto the Lua editor's own completion and hover.
 * Those read the syntax tree; the analyzer adds checked types, members of
 * values from other files, and the methods a value really has. Until it has
 * loaded, and for Lua or with types off, the editor's own answers stand.
 *
 * `getContext` is read on every request so the extensions themselves never
 * need rebuilding (see the INP note on editorExtensions in Playground.tsx).
 */
export function luauIntelligence(getContext: () => EditorProjectContext): LuaSupportOverrides {
  const completion = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const base = luaCompletionSource(context);
    const { project, activeFile, typeMode } = getContext();
    if (project.flavor !== "luau" || typeMode === "off") return base;
    if (!inCode(syntaxTree(context.state).resolveInner(context.pos, -1))) return base;

    const word = context.matchBefore(/\w*$/);
    const from = word ? word.from : context.pos;
    const afterAccess = /[.:]\s*$/.test(context.state.sliceDoc(Math.max(0, from - 64), from));
    if (from === context.pos && !context.explicit && !afterAccess) return base;

    const entries = await completeLuau(
      withCurrentDocument(project, activeFile, context.state),
      typeMode,
      activeFile,
      positionAt(context.state, context.pos),
      { skipCold: true }
    );
    if (!entries?.length || context.aborted) return base;

    return mergeCompletions(base, from, entries.map(toCompletion));
  };

  const hover: HoverSource = async (view, pos, side) => {
    const base = luaHoverSource(view, pos, side);
    const { project, activeFile, typeMode } = getContext();
    if (project.flavor !== "luau" || typeMode === "off") return base;

    const node = syntaxTree(view.state).resolveInner(pos, side);
    if (!NAMED_NODES.has(node.name)) return base;

    const inspection = await inspectLuau(
      withCurrentDocument(project, activeFile, view.state),
      typeMode,
      activeFile,
      positionAt(view.state, pos),
      { skipCold: true }
    );
    if (!inspection) return base;

    // A stdlib name keeps its documentation, under the checked type.
    const name = stdlibNameAt(view.state, node);
    const entry = name ? stdlibEntryFor(view.state, name) : null;
    const dom = entry
      ? renderStdlibDoc(entry, project.flavor, `${entry.name}: ${inspection.type}`)
      : hoverContent(inspection);
    return { pos: node.from, end: node.to, above: true, create: () => ({ dom }) };
  };

  return { completion, hover };
}

/** Comments and plain strings have nothing to complete; an interpolation does. */
function inCode(node: SyntaxNode): boolean {
  for (let current: SyntaxNode | null = node; current; current = current.parent) {
    switch (current.name) {
      case "Interpolation":
        return true;
      case "LineComment":
      case "BlockComment":
      case "String":
      case "LongString":
      case "InterpolatedString":
        return false;
    }
  }
  return true;
}

/**
 * The analyzer's entries, plus what only the Lua source offers: snippets,
 * and names the analyzer left out. Where both offer a label, the analyzer's
 * entry wins and takes the stdlib documentation with it.
 */
export function mergeCompletions(
  base: CompletionResult | null,
  from: number,
  analyzed: Completion[]
): CompletionResult {
  if (!base || base.from !== from) return { from, options: analyzed, validFor: WORD };

  const docs = new Map<string, Completion["info"]>();
  for (const option of base.options) {
    if (option.info && !docs.has(option.label)) docs.set(option.label, option.info);
  }

  const labels = new Set(analyzed.map((option) => option.label));
  const options = analyzed.map((option) => {
    const info = docs.get(option.label);
    return info ? { ...option, info } : option;
  });
  for (const option of base.options) {
    // Snippets apply a template; the analyzer never offers one.
    if (typeof option.apply === "function" || !labels.has(option.label)) options.push(option);
  }

  return { from, options, validFor: WORD };
}

function withCurrentDocument(
  project: ProjectPayload,
  activeFile: string,
  state: EditorState
): ProjectPayload {
  return { ...project, files: { ...project.files, [activeFile]: state.doc.toString() } };
}

function positionAt(state: EditorState, pos: number): SourcePosition {
  const line = state.doc.lineAt(pos);
  return { line: line.number - 1, column: pos - line.from };
}

export function toCompletion(entry: LuauCompletionEntry): Completion {
  const detail =
    entry.type && entry.type.length > MAX_DETAIL_LENGTH
      ? `${entry.type.slice(0, MAX_DETAIL_LENGTH - 1)}…`
      : entry.type;

  return {
    label: entry.label,
    type: completionType(entry),
    ...(detail === undefined ? {} : { detail }),
    ...(detail !== entry.type && entry.type ? { info: entry.type } : {}),
    // Type-matching suggestions first; ones the analyzer flags as misuse last.
    boost: entry.typeMatch ? 2 : entry.deprecated || entry.wrongIndexType ? -2 : 0,
    apply: completionApplier(entry)
  };
}

function completionType(entry: LuauCompletionEntry): string {
  const callable = entry.parentheses !== "none";
  switch (entry.kind) {
    case "keyword":
    case "hotComment":
      return "keyword";
    case "type":
      return "type";
    case "module":
    case "requirePath":
      return "namespace";
    case "string":
      return "text";
    case "property":
      return callable ? "method" : "property";
    case "binding":
    case "generatedFunction":
      return callable ? "function" : "variable";
  }
}

function completionApplier(entry: LuauCompletionEntry): Completion["apply"] {
  const text = entry.insertText ?? entry.label;
  if (entry.parentheses === "none" && !entry.replaceDotWithColon) return text;

  return (view: EditorView, completion: Completion, from: number, to: number) => {
    let start = from;
    let insert = text;
    if (entry.replaceDotWithColon && view.state.sliceDoc(from - 1, from) === ".") {
      start = from - 1;
      insert = `:${insert}`;
    }
    if (entry.parentheses !== "none") insert += "()";

    const end = start + insert.length;
    view.dispatch({
      changes: { from: start, to, insert },
      selection: { anchor: entry.parentheses === "cursorInside" ? end - 1 : end },
      annotations: pickedCompletion.of(completion),
      userEvent: "input.complete",
      scrollIntoView: true
    });
  };
}

function hoverContent(inspection: LuauInspection): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "cm-luau-hover";
  const code = document.createElement("code");
  code.textContent = inspection.name ? `${inspection.name}: ${inspection.type}` : inspection.type;
  dom.append(code);
  return dom;
}
