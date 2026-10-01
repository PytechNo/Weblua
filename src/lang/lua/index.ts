import type { CompletionSource } from "@codemirror/autocomplete";
import { LanguageSupport } from "@codemirror/language";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { builtinHighlighting } from "./builtins";
import { luaCompletionSource } from "./completion";
import { type LuaEditorContext, luaEditorContext } from "./context";
import { type HoverSource, luaHover } from "./hover";
import { luaLanguage } from "./language";

export { luaCompletionSource } from "./completion";
export { type LuaEditorContext, refreshLuaContext } from "./context";
export { renderStdlibDoc } from "./docs";
export { type HoverSource, luaHoverSource, stdlibEntryFor, stdlibNameAt } from "./hover";
export { luaLanguage } from "./language";

/**
 * Replacements for the built-in completion and hover, for a host that knows
 * more than the syntax tree does (the Luau analyzer). They usually wrap
 * luaCompletionSource and luaHoverSource rather than start over.
 */
export interface LuaSupportOverrides {
  completion?: CompletionSource;
  /** May be async; the tooltip closes when the document changes. */
  hover?: HoverSource;
}

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
export function luaSupport(
  context?: LuaEditorContext,
  overrides: LuaSupportOverrides = {}
): LanguageSupport {
  return new LanguageSupport(luaLanguage, [
    context ? luaEditorContext.of(context) : [],
    luaLanguage.data.of({ autocomplete: overrides.completion ?? luaCompletionSource }),
    overrides.hover ? hoverTooltip(overrides.hover, { hideOnChange: true }) : luaHover,
    builtinHighlighting,
    docTheme
  ]);
}
