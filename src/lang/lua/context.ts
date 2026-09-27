import { type EditorState, Facet, StateEffect } from "@codemirror/state";
import type { RuntimeFlavor } from "../../lib/types";

/**
 * What the editor needs to know about the project around the open file. The
 * host passes getters rather than values so the extension array can stay
 * stable: rebuilding it reconfigures the whole editor.
 */
export interface LuaEditorContext {
  flavor(): RuntimeFlavor;
  /** Path of the file open in the editor. */
  activeFile(): string;
  /** Every project file path, including the active one. */
  files(): readonly string[];
}

const fallbackContext: LuaEditorContext = {
  flavor: () => "lua54",
  activeFile: () => "main.lua",
  files: () => []
};

export const luaEditorContext = Facet.define<LuaEditorContext, LuaEditorContext>({
  combine: (values) => values[0] ?? fallbackContext
});

/** Dispatch after the flavor or file list changes so derived decorations refresh. */
export const refreshLuaContext = StateEffect.define<null>();

export function editorContext(state: EditorState): LuaEditorContext {
  return state.facet(luaEditorContext);
}
