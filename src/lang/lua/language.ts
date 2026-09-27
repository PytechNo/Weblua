import {
  delimitedIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  LRLanguage,
  type TreeIndentContext
} from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { parser } from "./lua.grammar";

type FoldRange = { from: number; to: number } | null;

/** Words that close a block, so the line that starts with one is dedented. */
const BLOCK_CLOSER = /^\s*(?:end|else|elseif|until)\b/;

/** Folds a `... end` construct from the end of its header to the `end`. */
function foldToEnd(node: SyntaxNode): FoldRange {
  const block = node.getChild("Block");
  const header = block?.prevSibling;
  const close = node.lastChild;
  if (!block || !header || close?.name !== "end") return null;
  return header.to < close.from ? { from: header.to, to: close.from } : null;
}

function foldRepeat(node: SyntaxNode): FoldRange {
  const open = node.firstChild;
  const close = node.getChild("until");
  if (open?.name !== "repeat" || !close) return null;
  return { from: open.to, to: close.from };
}

/** Folds the inside of a long-bracket comment or string, keeping its delimiters. */
function foldLongBracket(node: SyntaxNode, state: EditorState, prefix: string): FoldRange {
  const head = state.sliceDoc(node.from, Math.min(node.to, node.from + 256));
  const opener = new RegExp(`^${prefix}\\[(=*)\\[`).exec(head);
  if (!opener) return null;
  const closer = `]${opener[1]}]`;
  const closed = state.sliceDoc(node.to - closer.length, node.to) === closer;
  const from = node.from + opener[0].length;
  const to = closed ? node.to - closer.length : node.to;
  return from < to ? { from, to } : null;
}

function blockIndent(context: TreeIndentContext): number {
  return context.baseIndent + (BLOCK_CLOSER.test(context.textAfter) ? 0 : context.unit);
}

export const luaLanguage = LRLanguage.define({
  name: "lua",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        "IfStatement WhileStatement DoStatement ForNumericStatement ForGenericStatement RepeatStatement FunctionBody":
          blockIndent,
        "TableConstructor TableType": delimitedIndent({ closing: "}" }),
        "ParamList Arguments ParenthesizedExpression ParenthesizedType": delimitedIndent({
          closing: ")"
        }),
        "TypeArgs TypeParams": delimitedIndent({ closing: ">" })
      }),
      foldNodeProp.add({
        "IfStatement WhileStatement DoStatement ForNumericStatement ForGenericStatement FunctionBody":
          foldToEnd,
        RepeatStatement: foldRepeat,
        "TableConstructor TableType ParamList Arguments": foldInside,
        BlockComment: (node, state) => foldLongBracket(node, state, "--"),
        LongString: (node, state) => foldLongBracket(node, state, "")
      })
    ]
  }),
  languageData: {
    commentTokens: { line: "--", block: { open: "--[[", close: "]]" } },
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
    indentOnInput: /^\s*(?:end|else|elseif|until|\}|\))$/,
    wordChars: "_"
  }
});
