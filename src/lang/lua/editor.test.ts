import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import {
  ensureSyntaxTree,
  foldable,
  getIndentation,
  syntaxHighlighting,
  syntaxTree
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { describe, expect, it } from "vitest";
import type { RuntimeFlavor } from "../../lib/types";
import { builtinHighlighter } from "./builtins";
import { dottedModuleName, luaCompletionSource, relativeModulePath } from "./completion";
import { refreshLuaContext } from "./context";
import { stdlibEntryFor, stdlibNameAt } from "./hover";
import { luaSupport } from "./index";
import { collectSymbols, visibleSymbols } from "./scope";

interface Setup {
  flavor?: RuntimeFlavor;
  activeFile?: string;
  files?: string[];
}

/** An editor state for `doc`, where `|` marks the cursor and is removed. */
function stateFor(doc: string, setup: Setup = {}) {
  const pos = doc.indexOf("|");
  const text = pos >= 0 ? doc.slice(0, pos) + doc.slice(pos + 1) : doc;
  const flavor = setup.flavor ?? "lua54";
  const activeFile = setup.activeFile ?? (flavor === "luau" ? "main.luau" : "main.lua");
  const state = EditorState.create({
    doc: text,
    selection: { anchor: Math.max(pos, 0) },
    extensions: [
      luaSupport({ flavor: () => flavor, activeFile: () => activeFile, files: () => setup.files ?? [activeFile] })
    ]
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return { state, pos: Math.max(pos, 0) };
}

function complete(doc: string, setup: Setup = {}, explicit = false): CompletionResult | null {
  const { state, pos } = stateFor(doc, setup);
  return luaCompletionSource(new CompletionContext(state, pos, explicit)) as CompletionResult | null;
}

function labels(result: CompletionResult | null): string[] {
  return result ? result.options.map((option) => option.label) : [];
}

describe("lua completion", () => {
  it("offers the flavor's globals and keywords", () => {
    const lua51 = labels(complete("pr|", { flavor: "lua51" }));
    expect(lua51).toContain("print");
    expect(lua51).toContain("setfenv");
    expect(lua51).not.toContain("utf8");
    expect(lua51).not.toContain("goto");

    const lua54 = labels(complete("u|", { flavor: "lua54" }));
    expect(lua54).toContain("utf8");
    expect(lua54).toContain("goto");
    expect(lua54).not.toContain("setfenv");

    const luau = labels(complete("t|", { flavor: "luau" }));
    expect(luau).toContain("typeof");
    expect(luau).toContain("continue");
    expect(luau).not.toContain("io");
  });

  it("completes library members for the active flavor", () => {
    const lua54 = labels(complete("string.|", { flavor: "lua54" }));
    expect(lua54).toContain("format");
    expect(lua54).toContain("pack");
    expect(lua54).not.toContain("split");

    expect(labels(complete("string.s|", { flavor: "luau" }))).toContain("split");
    expect(labels(complete("table.|", { flavor: "lua55" }))).toContain("create");
  });

  it("offers locals, parameters, and functions that are in scope", () => {
    const doc = `
local outer = 1
local function helper(first, second)
  local inner = first
  |
end
local later = 2
`;
    const found = labels(complete(doc, {}, true));
    expect(found).toEqual(expect.arrayContaining(["outer", "helper", "first", "second", "inner"]));
    expect(found).not.toContain("later");
  });

  it("completes fields a document gives its own tables", () => {
    const doc = `
local M = { version = 1 }
function M.greet(name) end
function M:describe() end
M.count = 0
M.|`;
    expect(labels(complete(doc))).toEqual(
      expect.arrayContaining(["version", "greet", "describe", "count"])
    );

    const methods = labels(complete(doc.replace("M.|", "M:|")));
    expect(methods).toEqual(expect.arrayContaining(["greet", "describe"]));
    expect(methods).not.toContain("count");
  });

  it("does not offer stdlib members for a local that shadows a library", () => {
    const found = labels(complete(`local string = { mine = true }\nstring.|`));
    expect(found).toContain("mine");
    expect(found).not.toContain("format");
  });

  it("completes Luau types in annotations", () => {
    const annotation = labels(complete(`type Point = { x: number }\nlocal p: |`, { flavor: "luau" }));
    expect(annotation).toEqual(expect.arrayContaining(["number", "string", "Point"]));
    expect(annotation).not.toContain("print");

    const returnType = labels(complete(`local function f(): num|`, { flavor: "luau" }));
    expect(returnType).toContain("number");

    const cast = labels(complete(`local n = value :: |`, { flavor: "luau" }, true));
    expect(cast).toContain("number");
  });

  it("completes a method call after a call, not a type", () => {
    const doc = `local M = {}\nfunction M:get() return self end\nfunction M:done() end\nM:get():|`;
    const found = labels(complete(doc, { flavor: "luau" }, true));
    expect(found).not.toContain("number");
  });

  it("completes require paths in each flavor's form", () => {
    const files = ["main.lua", "lib/greet.lua", "lib/config/init.lua"];
    const lua = complete(`local g = require("|")`, { files });
    expect(labels(lua)).toEqual(["lib.greet", "lib.config"]);

    const luauFiles = ["main.luau", "lib/greet.luau", "lib/config/init.luau", "lib/util.luau"];
    const luau = complete(`local g = require("|")`, { flavor: "luau", files: luauFiles });
    expect(labels(luau)).toEqual(["./lib/greet", "./lib/config", "./lib/util"]);

    const nested = complete(`local g = require("./|")`, {
      flavor: "luau",
      activeFile: "lib/greet.luau",
      files: luauFiles
    });
    expect(labels(nested)).toEqual(["../main", "./config", "./util"]);

    const legacy = complete(`local g = require("li|")`, { flavor: "luau", files: luauFiles });
    expect(labels(legacy)).toContain("lib.greet");
  });

  it("stays quiet inside comments and ordinary strings", () => {
    expect(complete(`-- pr|`, {}, true)).toBeNull();
    expect(complete(`print("pr|")`, {}, true)).toBeNull();
    expect(complete("local s = `pr|`", { flavor: "luau" }, true)).toBeNull();
    expect(labels(complete("local s = `{pr|}`", { flavor: "luau" }))).toContain("print");
  });
});

describe("require path forms", () => {
  it("builds dotted Lua module names", () => {
    expect(dottedModuleName("lib/greet.lua")).toBe("lib.greet");
    expect(dottedModuleName("lib/config/init.lua")).toBe("lib.config");
  });

  it("builds relative Luau paths with init folder semantics", () => {
    expect(relativeModulePath("main.luau", "lib/a.luau")).toBe("./lib/a");
    expect(relativeModulePath("lib/a.luau", "lib/b.luau")).toBe("./b");
    expect(relativeModulePath("lib/deep/a.luau", "top.luau")).toBe("../../top");
    // An init file's ./ is the folder that contains its own folder.
    expect(relativeModulePath("pkg/init.luau", "pkg/child.luau")).toBe("./pkg/child");
    expect(relativeModulePath("pkg/init.luau", "helper.luau")).toBe("./helper");
  });
});

describe("lua scope", () => {
  it("keeps a local's scope to its block, including the lines before end", () => {
    const doc = `
local a = 1
do
  local b = 2

end
if a then
  local c = 3
else
  local d = 4
end
`;
    const { state } = stateFor(doc);
    const { symbols } = collectSymbols(syntaxTree(state), state.doc);
    const namesAt = (marker: string, offset = 0) =>
      visibleSymbols(symbols, doc.indexOf(marker) + offset).map((symbol) => symbol.name).sort();

    expect(namesAt("\n\nend", 1)).toEqual(["a", "b"]);
    expect(namesAt("else")).toEqual(["a", "c"]);
    expect(namesAt("local d", 12)).toEqual(["a", "d"]);
  });

  it("treats assignments as globals only when no local is visible", () => {
    const { state } = stateFor(`counter = 0\nlocal shadow\nshadow = 1\n`);
    const { symbols } = collectSymbols(syntaxTree(state), state.doc);
    expect(symbols.filter((symbol) => symbol.global).map((symbol) => symbol.name)).toEqual(["counter"]);
  });
});

describe("lua hover", () => {
  function hoverName(doc: string, setup: Setup = {}) {
    const { state, pos } = stateFor(doc, setup);
    const name = stdlibNameAt(state, syntaxTree(state).resolveInner(pos, 1));
    return name ? stdlibEntryFor(state, name) : null;
  }

  it("documents globals and library members", () => {
    expect(hoverName("|print(1)")?.name).toBe("print");
    expect(hoverName("string.|format('%d', 1)")?.params).toBe("(formatstring, ...)");
  });

  it("finds names from other flavors so the tooltip can say where they exist", () => {
    const entry = hoverName("|utf8.char(72)", { flavor: "lua51" });
    expect(entry?.name).toBe("utf8");
    expect(entry?.flavors.has("lua51")).toBe(false);
  });

  it("ignores names the document defines", () => {
    expect(hoverName("local print = 1\n|print")).toBeNull();
  });
});

describe("lua folding and indentation", () => {
  function foldAt(doc: string, line: number) {
    const { state } = stateFor(doc);
    const target = state.doc.line(line);
    const range = foldable(state, target.from, target.to);
    return range ? state.sliceDoc(range.from, range.to) : null;
  }

  it("folds blocks between their header and end", () => {
    const doc = "function f(a)\n  return a\nend\nif x then\n  y()\nelse\n  z()\nend";
    expect(foldAt(doc, 1)).toBe("\n  return a\n");
    expect(foldAt(doc, 4)).toBe("\n  y()\nelse\n  z()\n");
  });

  it("folds tables, repeat loops, and long comments", () => {
    const doc = "local t = {\n  1,\n  2,\n}\nrepeat\n  n = n + 1\nuntil n > 3\n--[==[\nnotes\n]==]";
    expect(foldAt(doc, 1)).toBe("\n  1,\n  2,\n");
    expect(foldAt(doc, 5)).toBe("\n  n = n + 1\n");
    expect(foldAt(doc, 8)).toBe("\nnotes\n");
  });

  it("indents block bodies and dedents their closing words", () => {
    const indentAt = (doc: string) => {
      const { state, pos } = stateFor(doc);
      return getIndentation(state, pos);
    };
    expect(indentAt("function f()\n|")).toBe(2);
    expect(indentAt("if a then\n  b()\n|else")).toBe(0);
    expect(indentAt("local t = {\n|")).toBe(2);
    expect(indentAt("for i = 1, 3 do\n  if i then\n|")).toBe(4);
  });
});

describe("builtin highlighting", () => {
  it("marks the flavor's builtins and self, and follows a flavor change", () => {
    const doc = "print(utf8.char(1), self, obj.print, mine)";
    let flavor: RuntimeFlavor = "lua54";
    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [
          luaSupport({ flavor: () => flavor, activeFile: () => "main.lua", files: () => [] }),
          syntaxHighlighting(oneDarkHighlightStyle)
        ]
      })
    });
    const highlighted = () => {
      const names: string[] = [];
      view.plugin(builtinHighlighter)?.decorations.between(0, doc.length, (from, to) => {
        names.push(doc.slice(from, to));
      });
      return names;
    };

    expect(highlighted()).toEqual(["print", "utf8", "self"]);
    flavor = "lua51";
    view.dispatch({ effects: refreshLuaContext.of(null) });
    expect(highlighted()).toEqual(["print", "self"]);
    view.destroy();
  });

  it("renders the builtin color innermost, over the grammar's call color", () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: "print(x)",
        extensions: [luaSupport(), syntaxHighlighting(oneDarkHighlightStyle)]
      })
    });
    const builtinClass = view.plugin(builtinHighlighter)?.decorations.iter().value?.spec.class;
    const innermost = [...view.contentDOM.querySelectorAll("span")].find(
      (span) => span.textContent === "print" && span.children.length === 0
    );
    expect(builtinClass).toBeTruthy();
    expect(innermost?.className).toBe(builtinClass);
    view.destroy();
  });
});
