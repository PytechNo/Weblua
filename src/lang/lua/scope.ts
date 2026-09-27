import type { SyntaxNode, Tree } from "@lezer/common";
import type { Text } from "@codemirror/state";

export type SymbolKind = "variable" | "function" | "parameter" | "type";

/** A name defined in the document, with the range where it is visible. */
export interface LuaSymbol {
  name: string;
  kind: SymbolKind;
  /** Where the name is defined. */
  at: number;
  /** Global definitions are visible everywhere; locals only within scope. */
  global: boolean;
  scopeFrom: number;
  scopeTo: number;
}

/** Fields a document gives one table: `function M.f()`, `M.x = ...`, `local M = { y = 1 }`. */
export type TableFields = Map<string, Map<string, SymbolKind>>;

export interface DocumentSymbols {
  symbols: LuaSymbol[];
  fields: TableFields;
}

const BLOCK_PARENTS = new Set([
  "IfStatement",
  "ElseifClause",
  "ElseClause",
  "WhileStatement",
  "RepeatStatement",
  "DoStatement",
  "ForNumericStatement",
  "ForGenericStatement",
  "FunctionBody"
]);

/**
 * Where a local declared in `block` stops being visible. A Block node ends at
 * its last statement, but the scope runs on to the token that closes it, so a
 * cursor on a blank line before `end` still sees the block's locals. Locals in
 * a repeat body stay visible in its `until` condition.
 */
function blockScopeEnd(block: SyntaxNode, docLength: number): number {
  if (block.name === "Chunk") return docLength;
  const parent = block.parent;
  if (!parent) return block.to;
  if (parent.name === "RepeatStatement") return parent.to;
  if (block.nextSibling) return block.nextSibling.from;
  if (parent.name === "ElseifClause" || parent.name === "ElseClause") {
    return parent.nextSibling ? parent.nextSibling.from : parent.to;
  }
  return parent.to;
}

function enclosingBlock(node: SyntaxNode): SyntaxNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (current.name === "Block" || current.name === "Chunk") return current;
  }
  return null;
}

function isFunctionValue(node: SyntaxNode | null): boolean {
  return node?.name === "FunctionExpression";
}

/** Collects definitions and table fields from a parsed document. */
export function collectSymbols(tree: Tree, doc: Text): DocumentSymbols {
  const symbols: LuaSymbol[] = [];
  const fields: TableFields = new Map();
  const assignments: SyntaxNode[] = [];
  const text = (node: SyntaxNode) => doc.sliceString(node.from, node.to);
  const docLength = doc.length;

  const addLocal = (node: SyntaxNode, kind: SymbolKind, scopeFrom: number, scopeTo: number) => {
    symbols.push({ name: text(node), kind, at: node.from, global: false, scopeFrom, scopeTo });
  };
  const addGlobal = (node: SyntaxNode, kind: SymbolKind) => {
    symbols.push({ name: text(node), kind, at: node.from, global: true, scopeFrom: 0, scopeTo: docLength });
  };
  const addField = (table: string, field: string, kind: SymbolKind) => {
    let known = fields.get(table);
    if (!known) fields.set(table, (known = new Map()));
    if (known.get(field) !== "function") known.set(field, kind);
  };

  tree.iterate({
    enter(ref) {
      const node = ref.node;
      switch (node.name) {
        case "LocalDeclaration": {
          const block = enclosingBlock(node);
          const scopeTo = block ? blockScopeEnd(block, docLength) : docLength;
          const names = node.getChildren("VariableDefinition");
          const values = valuesOf(node);
          names.forEach((name, index) => {
            const value = values[index] ?? null;
            addLocal(name, isFunctionValue(value) ? "function" : "variable", node.to, scopeTo);
            if (value?.name === "TableConstructor") addConstructorFields(text(name), value);
          });
          break;
        }
        case "LocalFunctionDeclaration": {
          const name = node.getChild("VariableDefinition");
          const block = enclosingBlock(node);
          if (name) addLocal(name, "function", name.from, block ? blockScopeEnd(block, docLength) : docLength);
          break;
        }
        case "FunctionDeclaration": {
          const functionName = node.getChild("FunctionName");
          const base = functionName?.getChild("VariableName");
          const properties = functionName?.getChildren("PropertyName") ?? [];
          if (base && properties.length === 0) addGlobal(base, "function");
          if (base && properties.length === 1) addField(text(base), text(properties[0]), "function");
          break;
        }
        case "GlobalDeclaration": {
          for (const name of node.getChildren("VariableDefinition")) {
            addGlobal(name, node.getChild("function") ? "function" : "variable");
          }
          break;
        }
        case "Parameter": {
          const name = node.getChild("VariableDefinition");
          const body = node.parent?.parent;
          if (name && body?.name === "FunctionBody") addLocal(name, "parameter", body.from, body.to);
          break;
        }
        case "ForNumericStatement":
        case "ForGenericStatement": {
          const block = node.getChild("Block");
          const scopeTo = block ? blockScopeEnd(block, docLength) : node.to;
          for (const name of node.getChildren("VariableDefinition")) {
            addLocal(name, "variable", block?.from ?? name.to, scopeTo);
          }
          break;
        }
        case "TypeAlias":
        case "TypeFunction": {
          const name = node.getChild("TypeDefinition");
          if (name) addGlobal(name, "type");
          break;
        }
        case "TypeParam": {
          const name = node.getChild("TypeDefinition");
          const owner = node.parent?.parent;
          if (name && owner) addLocal(name, "type", owner.from, owner.to);
          break;
        }
        case "Assignment":
          assignments.push(node);
          break;
      }
    }
  });

  // Assignments go last: `x = 1` defines a global only where no local x is visible.
  for (const assignment of assignments) {
    const values = valuesOf(assignment);
    let index = 0;
    for (let child = assignment.firstChild; child && child.name !== "="; child = child.nextSibling) {
      if (child.name === "VariableName") {
        const name = text(child);
        const value = values[index] ?? null;
        if (!isVisibleLocal(symbols, name, child.from)) {
          addGlobal(child, isFunctionValue(value) ? "function" : "variable");
        }
        if (value?.name === "TableConstructor") addConstructorFields(name, value);
        index += 1;
      } else if (child.name === "MemberExpression") {
        const object = child.firstChild;
        const property = child.getChild("PropertyName");
        if (object?.name === "VariableName" && property) {
          addField(text(object), text(property), isFunctionValue(values[index] ?? null) ? "function" : "variable");
        }
        index += 1;
      }
    }
  }

  function addConstructorFields(table: string, constructor: SyntaxNode) {
    for (const field of constructor.getChildren("Field")) {
      const key = field.getChild("PropertyName");
      if (key) addField(table, text(key), isFunctionValue(key.nextSibling?.nextSibling ?? null) ? "function" : "variable");
    }
  }

  return { symbols, fields };
}

/** The expressions after `=` in a declaration or assignment, in order. */
function valuesOf(statement: SyntaxNode): SyntaxNode[] {
  const values: SyntaxNode[] = [];
  let afterEquals = false;
  for (let child = statement.firstChild; child; child = child.nextSibling) {
    if (child.name === "=") afterEquals = true;
    else if (afterEquals && child.name !== ",") values.push(child);
  }
  return values;
}

function isVisibleLocal(symbols: LuaSymbol[], name: string, pos: number): boolean {
  return symbols.some(
    (symbol) => !symbol.global && symbol.name === name && symbol.scopeFrom <= pos && pos <= symbol.scopeTo
  );
}

/**
 * Names visible at `pos`, one per name. A local wins over a global of the same
 * name, and among locals the nearest definition wins.
 */
export function visibleSymbols(symbols: LuaSymbol[], pos: number): LuaSymbol[] {
  const visible = new Map<string, LuaSymbol>();
  for (const symbol of symbols) {
    if (symbol.scopeFrom > pos || pos > symbol.scopeTo) continue;
    const current = visible.get(symbol.name);
    if (
      !current ||
      (current.global && !symbol.global) ||
      (!current.global && !symbol.global && symbol.at > current.at)
    ) {
      visible.set(symbol.name, symbol);
    }
  }
  return [...visible.values()];
}
