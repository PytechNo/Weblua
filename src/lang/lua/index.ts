import { LanguageSupport } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { builtinHighlighting } from "./builtins";
import { luaCompletionSource } from "./completion";
import { type LuaEditorContext, luaEditorContext } from "./context";
import { luaHover } from "./hover";
import { luaLanguage } from "./language";

export { type LuaEditorContext, refreshLuaContext } from "./context";
export { luaLanguage } from "./language";

const docTheme = EditorView.baseTheme({
  ".cm-lua-doc": {
    maxWidth: "420px",
    padding: "6px 10px",
    fontSize: "12.5px",
    lineHeight: "1.5"
  },
  ".cm-lua-doc p": { margin: "4px 0 0" },
  ".cm-lua-doc-signature": { fontWeight: "600", whiteSpace: "pre-wrap" },
  ".cm-lua-doc-availability": { opacity: "0.7", fontSize: "11.5px" },
  ".cm-lua-doc-missing": { opacity: "1", color: "#c2410c" },
  "&dark .cm-lua-doc-missing": { color: "#fdba74" }
});

/**
 * Lua and Luau editing: the Lezer grammar with folding and indentation, plus
 * flavor-aware completion, hover documentation, and builtin highlighting.
 */
export function luaSupport(context?: LuaEditorContext): LanguageSupport {
  return new LanguageSupport(luaLanguage, [
    context ? luaEditorContext.of(context) : [],
    luaLanguage.data.of({ autocomplete: luaCompletionSource }),
    luaHover,
    builtinHighlighting,
    docTheme
  ]);
}
