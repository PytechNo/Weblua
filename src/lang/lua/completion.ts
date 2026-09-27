import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippetCompletion
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import type { RuntimeFlavor } from "../../lib/types";
import { editorContext } from "./context";
import { renderStdlibDoc } from "./docs";
import { collectSymbols, type SymbolKind, visibleSymbols } from "./scope";
import {
  keywordsFor,
  LUAU_BUILTIN_TYPES,
  type StdlibEntry,
  stdlibGlobals,
  stdlibMembers
} from "./stdlib";

const IDENTIFIER = /^[A-Za-z_]\w*$/;
const MODULE_PATH = /^[\w./@-]*$/;

const SNIPPETS: Completion[] = [
  snippetCompletion("function ${name}(${params})\n\t${}\nend", { label: "function", detail: "declaration", type: "keyword" }),
  snippetCompletion("local function ${name}(${params})\n\t${}\nend", { label: "local function", detail: "declaration", type: "keyword" }),
  snippetCompletion("for ${i} = ${1}, ${10} do\n\t${}\nend", { label: "for", detail: "numeric loop", type: "keyword" }),
  snippetCompletion("for ${key}, ${value} in pairs(${t}) do\n\t${}\nend", { label: "for", detail: "pairs loop", type: "keyword" }),
  snippetCompletion("for ${index}, ${value} in ipairs(${t}) do\n\t${}\nend", { label: "for", detail: "ipairs loop", type: "keyword" }),
  snippetCompletion("if ${condition} then\n\t${}\nend", { label: "if", detail: "block", type: "keyword" }),
  snippetCompletion("while ${condition} do\n\t${}\nend", { label: "while", detail: "loop", type: "keyword" }),
  snippetCompletion("repeat\n\t${}\nuntil ${condition}", { label: "repeat", detail: "loop", type: "keyword" })
];

function stdlibCompletion(entry: StdlibEntry, flavor: RuntimeFlavor, label: string): Completion {
  return {
    label,
    type: entry.kind === "function" ? "function" : entry.kind === "library" ? "namespace" : "constant",
    detail: entry.params,
    info: () => renderStdlibDoc(entry, flavor)
  };
}

function symbolCompletion(name: string, kind: SymbolKind, detail: string): Completion {
  return {
    label: name,
    type: kind === "parameter" ? "variable" : kind,
    detail,
    boost: 1
  };
}

function isInside(node: SyntaxNode, ...names: string[]): boolean {
  for (let current: SyntaxNode | null = node; current; current = current.parent) {
    if (names.includes(current.name)) return true;
  }
  return false;
}

/** The string argument of a `require(...)` call that the cursor is inside, if any. */
function requireString(node: SyntaxNode, source: string, pos: number): SyntaxNode | null {
  if (node.name !== "String") return null;
  const text = source.slice(node.from, node.to);
  const closed = text.length > 1 && text.endsWith(text[0]);
  if (closed && pos >= node.to) return null;

  const call = node.parent?.name === "Arguments" ? node.parent.parent : null;
  const callee = call?.name === "CallExpression" ? call.firstChild : null;
  if (callee?.name !== "VariableName" || source.slice(callee.from, callee.to) !== "require") return null;
  return node;
}

/** A module's path without its extension; an init file stands for its folder. */
function moduleLocation(path: string): string[] {
  return path
    .replace(/\.luau?$/i, "")
    .replace(/(?:^|\/)init$/i, "")
    .split("/")
    .filter(Boolean);
}

/** `lib/config/init.lua` -> `lib.config`, the form Lua's require expects. */
export function dottedModuleName(path: string): string {
  return moduleLocation(path).join(".");
}

/**
 * The require-by-string path from one Luau module to another: `./` resolves
 * against the requiring module's folder (for an init file, its folder's parent).
 */
export function relativeModulePath(from: string, to: string): string {
  const base = moduleLocation(from).slice(0, -1);
  const target = moduleLocation(to);
  let common = 0;
  while (common < base.length && common < target.length - 1 && base[common] === target[common]) {
    common += 1;
  }
  const ups = base.length - common;
  const rest = target.slice(common).join("/");
  return ups === 0 ? `./${rest}` : `${"../".repeat(ups)}${rest}`;
}

function requireCompletions(context: CompletionContext, string: SyntaxNode): CompletionResult | null {
  const { flavor, activeFile, files } = editorContext(context.state);
  const from = string.from + 1;
  const typed = context.state.sliceDoc(from, context.pos);
  const active = activeFile();
  const relative =
    flavor() === "luau" && (typed === "" || typed.startsWith(".") || typed.startsWith("@"));

  const options: Completion[] = [];
  const seen = new Set<string>();
  for (const path of files()) {
    if (path === active || !/\.luau?$/i.test(path)) continue;
    const label = relative ? relativeModulePath(active, path) : dottedModuleName(path);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    options.push({ label, type: "text", detail: path });
  }

  return options.length > 0 ? { from, options, validFor: MODULE_PATH } : null;
}

function memberCompletions(
  context: CompletionContext,
  object: string,
  separator: string,
  from: number
): CompletionResult | null {
  const flavor = editorContext(context.state).flavor();
  const { symbols, fields } = collectSymbols(syntaxTree(context.state), context.state.doc);
  const shadowed = visibleSymbols(symbols, context.pos).some(
    (symbol) => symbol.name === object && !symbol.global
  );

  const options: Completion[] = [];
  const labels = new Set<string>();
  for (const [field, kind] of fields.get(object) ?? []) {
    if (separator === ":" && kind !== "function") continue;
    labels.add(field);
    options.push(symbolCompletion(field, kind, "field"));
  }

  if (separator === "." && !shadowed) {
    for (const entry of stdlibMembers(flavor, object)) {
      const label = entry.name.slice(object.length + 1);
      if (!labels.has(label)) options.push(stdlibCompletion(entry, flavor, label));
    }
  }

  return options.length > 0 ? { from, options, validFor: /^\w*$/ } : null;
}

/**
 * Luau positions that expect a type: inside one already, or after `::`, `->`,
 * or the colon of a return annotation. (`local x:` is handled with members,
 * where the colon is told apart from a method call.)
 */
function inTypePosition(context: CompletionContext, node: SyntaxNode, wordFrom: number): boolean {
  if (isInside(node, "TypeReference", "TypeArgs", "TableType", "TypeProperty")) return true;
  const lookback = Math.max(0, wordFrom - 64);
  const before = context.state.sliceDoc(lookback, wordFrom).trimEnd();
  if (before.endsWith("::") || before.endsWith("->")) return true;

  // `function f(): T` -- but not `obj:get():method()`, where `)` ends a call.
  const returnColon = /\)\s*:$/.exec(before);
  if (!returnColon) return false;
  const paren = syntaxTree(context.state).resolveInner(lookback + returnColon.index + 1, -1);
  return paren.parent?.name === "ParamList";
}

function typeCompletions(context: CompletionContext, from: number): CompletionResult {
  const { symbols } = collectSymbols(syntaxTree(context.state), context.state.doc);
  const options: Completion[] = LUAU_BUILTIN_TYPES.map((name) => ({ label: name, type: "type" }));
  for (const symbol of visibleSymbols(symbols, context.pos)) {
    if (symbol.kind === "type") options.push({ label: symbol.name, type: "type", boost: 1 });
  }
  return { from, options, validFor: /^\w*$/ };
}

/** Completion for Lua and Luau: names, library members, types, and require paths. */
export function luaCompletionSource(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const node = syntaxTree(state).resolveInner(pos, -1);
  const source = state.doc.toString();

  if (node.name === "LineComment" || node.name === "BlockComment") return null;
  const requireArg = requireString(node, source, pos);
  if (requireArg) return requireCompletions(context, requireArg);
  if (node.name === "String" || node.name === "LongString") return null;
  if (node.name === "InterpolatedString" && !isInside(node, "Interpolation")) return null;

  const flavor = editorContext(state).flavor();
  const word = context.matchBefore(/\w*$/);
  if (!word) return null;

  // `name.` and `name:` complete members of a bare name; `x:` after a
  // declared name is a Luau annotation instead.
  const member = context.matchBefore(/([A-Za-z_]\w*)\s*([.:])\s*\w*$/);
  const [, object, separator] = member ? /^([A-Za-z_]\w*)\s*([.:])/.exec(member.text) ?? [] : [];
  if (member && object && separator) {
    const objectNode = syntaxTree(state).resolveInner(member.from + object.length, -1);
    if (objectNode.name === "VariableName") {
      return memberCompletions(context, object, separator, word.from);
    }
    if (separator === ":" && flavor === "luau" && objectNode.name === "VariableDefinition") {
      return typeCompletions(context, word.from);
    }
  }

  if (word.from === word.to && !context.explicit) return null;
  if (word.text && !IDENTIFIER.test(word.text)) return null;

  if (flavor === "luau" && inTypePosition(context, node, word.from)) {
    return typeCompletions(context, word.from);
  }

  const { symbols } = collectSymbols(syntaxTree(state), state.doc);
  const options: Completion[] = [];
  const labels = new Set<string>();
  for (const symbol of visibleSymbols(symbols, pos)) {
    if (symbol.kind === "type" || symbol.at === word.from) continue;
    labels.add(symbol.name);
    options.push(symbolCompletion(symbol.name, symbol.kind, symbol.global ? "global" : "local"));
  }
  for (const entry of stdlibGlobals(flavor)) {
    if (!labels.has(entry.name)) options.push(stdlibCompletion(entry, flavor, entry.name));
  }
  for (const keyword of keywordsFor(flavor)) {
    options.push({ label: keyword, type: "keyword", boost: -1 });
  }
  options.push(...SNIPPETS);

  return { from: word.from, options, validFor: /^\w*$/ };
}
