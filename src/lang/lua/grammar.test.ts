// @vitest-environment node
import type { SyntaxNode, Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import { examples, projectForExample } from "../../lib/examples";
import { parser } from "./lua.grammar";

function errorsIn(source: string): string[] {
  const tree = parser.parse(source);
  const errors: string[] = [];
  tree.iterate({
    enter(node) {
      if (node.type.isError) {
        const line = source.slice(0, node.from).split("\n").length;
        errors.push(`line ${line}: ${JSON.stringify(source.slice(node.from, node.from + 24))}`);
      }
    }
  });
  return errors;
}

/** Every node of `name`, as source text. */
function textsOf(tree: Tree, source: string, name: string): string[] {
  const found: string[] = [];
  tree.iterate({
    enter(node) {
      if (node.name === name) found.push(source.slice(node.from, node.to));
    }
  });
  return found;
}

function firstNamed(tree: Tree, name: string): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  tree.iterate({
    enter(node) {
      if (found) return false;
      if (node.name === name) found = node.node;
    }
  });
  return found;
}

function statementNames(source: string): string[] {
  const names: string[] = [];
  for (let node = parser.parse(source).topNode.firstChild; node; node = node.nextSibling) {
    names.push(node.name);
  }
  return names;
}

describe("lua grammar", () => {
  it("parses every built-in example without errors", () => {
    for (const example of examples) {
      const project = projectForExample(example);
      for (const [path, source] of Object.entries(project.files)) {
        expect(errorsIn(source), `${example.id}:${path}`).toEqual([]);
      }
    }
  });

  it("parses Lua 5.1 syntax", () => {
    const source = `
      local t = { 1, 2, three = 3, ["four"] = 4; }
      local s = [[long
      string]] .. [==[ with ]] inside ]==]
      --[[ block
      comment ]] --[==[ another ]==]
      function t.a.b:c(x, ...)
        local n = #x + -1 * 2 ^ -3
        while n > 0 do n = n - 1 end
        repeat n = n + 1 until n >= 3
        for i = 1, 10, 2 do print(i) end
        for k, v in pairs(t) do print(k, v) end
        if a then b() elseif c then d() else e() end
        return x and y or not z
      end
      local f = function() return end
      f"str" f{} f[[long]]
      obj:method "arg"
      ;(function() end)()
    `;
    expect(errorsIn(source)).toEqual([]);
  });

  it("parses Lua 5.2-5.5 syntax", () => {
    const source = `
      ::top::
      goto top
      local a <const>, b <close> = 1, nil
      local x = 7 // 2 | 1 & 3 ~ 4 << 1 >> 2
      local y = ~x
      global print, tostring
      global <const> *
      global function exported() end
      :: done ::
    `;
    expect(errorsIn(source)).toEqual([]);
    const tree = parser.parse(source);
    expect(textsOf(tree, source, "Label")).toEqual(["::top::", ":: done ::"]);
    expect(textsOf(tree, source, "AttributeName")).toEqual(["const", "close", "const"]);
    expect(firstNamed(tree, "GlobalDeclaration")).not.toBeNull();
  });

  it("parses Luau types, interpolation, and newer syntax", () => {
    const source = `
      --!strict
      export type Point = { x: number, y: number, read tag: string }
      type Result<T, E = string> = { ok: true, value: T } | { ok: false, error: E }
      type Callback<T...> = (T...) -> ()
      type Map<K, V> = { [K]: V }
      type Nested = Map<string, Map<string, number>>
      type Fn = <T>(value: T, ...number) -> (T, string?)
      type Pack = typeof(setmetatable({}, {}))
      type function identity(t)
        return t
      end

      @native
      local function add<T>(a: number, b: number, ...: number): number
        return a + b
      end

      local label = \`Point {p.x}, {p.y} is {if p.x > 0 then "right" else "left"}\`
      local escaped = \`braces \\{ and \\\` ticks\`
      local total: number = 0
      total += 1; total -= 1; total *= 2; total /= 2; total //= 2; total %= 2; total ^= 2
      local name: string = "a"
      name ..= "b"
      local cast = (value :: any) :: number
      for i: number = 1, 3 do
        if i == 2 then continue end
      end
      for key: string, value: number in pairs({}) do end
      local nested = \`outer {\`inner {1 + 1}\`}\`
    `;
    expect(errorsIn(source)).toEqual([]);

    const tree = parser.parse(source);
    expect(textsOf(tree, source, "TypeDefinition")).toContain("Point");
    expect(textsOf(tree, source, "Interpolation")).toContain(
      '{if p.x > 0 then "right" else "left"}'
    );
    expect(textsOf(tree, source, "CompoundOp")).toEqual([
      "+=", "-=", "*=", "/=", "//=", "%=", "^=", "..="
    ]);
    expect(firstNamed(tree, "ContinueStatement")).not.toBeNull();
    expect(firstNamed(tree, "IfExpression")).not.toBeNull();
    expect(firstNamed(tree, "TypeFunction")).not.toBeNull();
  });

  it("keeps contextual keywords usable as names", () => {
    const source = `
      local type = type(x)
      local continue, export, global, goto = 1, 2, 3, 4
      local t = { type = "a", continue = true }
      print(t.type, t.continue, typeof(t))
      type = nil
    `;
    expect(errorsIn(source)).toEqual([]);
    const tree = parser.parse(source);
    expect(firstNamed(tree, "TypeAlias")).toBeNull();
    expect(firstNamed(tree, "ContinueStatement")).toBeNull();
    expect(textsOf(tree, source, "VariableDefinition")).toEqual([
      "type", "continue", "export", "global", "goto", "t"
    ]);
  });

  it("prefers the statement reading of contextual keywords", () => {
    expect(statementNames("type Id = number")).toEqual(["TypeAlias"]);
    expect(statementNames("export type Id = number")).toEqual(["TypeAlias"]);
    expect(statementNames("global x = 1")).toEqual(["GlobalDeclaration"]);
    expect(statementNames("goto continue")).toEqual(["GotoStatement"]);
    expect(statementNames("while true do continue end")).toEqual(["WhileStatement"]);
  });

  it("reads a parenthesized line after a statement as a call, like Lua", () => {
    expect(statementNames("local a = b\n(f)()")).toEqual(["LocalDeclaration"]);
  });

  it("distinguishes Luau casts from goto labels", () => {
    const source = "local n = value :: number\n::skip::";
    expect(errorsIn(source)).toEqual([]);
    const tree = parser.parse(source);
    expect(firstNamed(tree, "TypeAssertion")).not.toBeNull();
    expect(textsOf(tree, source, "Label")).toEqual(["::skip::"]);
  });

  it("ends an unterminated string at the line break", () => {
    const source = `local a = "open\nlocal b = 2`;
    const tree = parser.parse(source);
    expect(textsOf(tree, source, "String")).toEqual(['"open']);
    expect(textsOf(tree, source, "VariableDefinition")).toEqual(["a", "b"]);
  });
});
