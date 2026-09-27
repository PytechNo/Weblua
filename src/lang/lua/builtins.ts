import { highlightingFor, syntaxTree } from "@codemirror/language";
import { Prec, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { editorContext, refreshLuaContext } from "./context";
import { stdlibGlobals } from "./stdlib";

/**
 * Colors the active flavor's builtin globals (print, string, utf8 in 5.3+) and
 * `self`. The grammar cannot do this: which names are builtin depends on the
 * runtime, not the syntax.
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builtinClass = highlightingFor(view.state, [tags.standard(tags.variableName)]);
  const selfClass = highlightingFor(view.state, [tags.self]);
  if (!builtinClass && !selfClass) return Decoration.none;

  const globals = new Set(stdlibGlobals(editorContext(view.state).flavor()).map((entry) => entry.name));
  const builtin = builtinClass ? Decoration.mark({ class: builtinClass }) : null;
  const self = selfClass ? Decoration.mark({ class: selfClass }) : null;
  const builder = new RangeSetBuilder<Decoration>();
  let lastEnd = -1;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "VariableName" || node.from < lastEnd) return;
        const name = view.state.sliceDoc(node.from, node.to);
        const decoration = name === "self" ? self : globals.has(name) ? builtin : null;
        if (decoration) {
          builder.add(node.from, node.to, decoration);
          lastEnd = node.to;
        }
      }
    });
  }
  return builder.finish();
}

export const builtinHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        update.transactions.some(
          (tr) => tr.reconfigured || tr.effects.some((effect) => effect.is(refreshLuaContext))
        )
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

/**
 * Highest precedence, because higher-precedence decorations render inside
 * lower ones and the innermost color wins. Syntax highlighting itself runs at
 * Prec.high, and this has to beat its `print(` call color and variable color.
 */
export const builtinHighlighting = Prec.highest(builtinHighlighter);
