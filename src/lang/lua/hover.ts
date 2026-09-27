import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { editorContext } from "./context";
import { renderStdlibDoc } from "./docs";
import { collectSymbols, visibleSymbols } from "./scope";
import { STDLIB, type StdlibEntry, stdlibFor } from "./stdlib";

function definedInDocument(state: EditorState, name: string, pos: number): boolean {
  const { symbols } = collectSymbols(syntaxTree(state), state.doc);
  return visibleSymbols(symbols, pos).some((symbol) => symbol.name === name);
}

/**
 * The stdlib name under a node: a bare global (`print`) or a library member
 * (`string.format`), unless the document defines that name itself.
 */
export function stdlibNameAt(state: EditorState, node: SyntaxNode): string | null {
  const text = (target: SyntaxNode) => state.sliceDoc(target.from, target.to);

  if (node.name === "VariableName") {
    const name = text(node);
    return definedInDocument(state, name, node.from) ? null : name;
  }

  if (node.name === "PropertyName" && node.parent?.name === "MemberExpression") {
    const object = node.parent.firstChild;
    if (object?.name !== "VariableName") return null;
    const library = text(object);
    return definedInDocument(state, library, object.from) ? null : `${library}.${text(node)}`;
  }

  return null;
}

/** The entry for a name in this flavor, or in any flavor so the tooltip can say where it exists. */
export function stdlibEntryFor(state: EditorState, name: string): StdlibEntry | null {
  const flavor = editorContext(state).flavor();
  return stdlibFor(flavor).get(name) ?? STDLIB.find((entry) => entry.name === name) ?? null;
}

export const luaHover = hoverTooltip((view, pos, side) => {
  const node = syntaxTree(view.state).resolveInner(pos, side);
  const name = stdlibNameAt(view.state, node);
  const entry = name ? stdlibEntryFor(view.state, name) : null;
  if (!entry) return null;

  const flavor = editorContext(view.state).flavor();
  return {
    pos: node.from,
    end: node.to,
    above: true,
    create: () => ({ dom: renderStdlibDoc(entry, flavor) })
  };
});
