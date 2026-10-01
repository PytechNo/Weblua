import { CompletionContext, type CompletionResult, insertCompletionText } from "@codemirror/autocomplete";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, type Tooltip } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { luaSupport } from "../lang/lua";
import { luauIntelligence, mergeCompletions, toCompletion } from "./editorIntelligence";
import { completeLuau, inspectLuau } from "./luauAnalysis";
import type { LuauCompletionEntry, LuauTypeMode, RuntimeFlavor } from "./types";

vi.mock("./luauAnalysis", () => ({ completeLuau: vi.fn(), inspectLuau: vi.fn() }));

afterEach(() => {
  vi.mocked(completeLuau).mockReset();
  vi.mocked(inspectLuau).mockReset();
});

function entry(overrides: Partial<LuauCompletionEntry>): LuauCompletionEntry {
  return {
    label: "value",
    kind: "binding",
    parentheses: "none",
    deprecated: false,
    typeMatch: false,
    wrongIndexType: false,
    replaceDotWithColon: false,
    ...overrides
  };
}

/** Accepts `completion` for the word that starts at `from`, as CodeMirror would. */
function accept(doc: string, from: number, completionEntry: LuauCompletionEntry) {
  const cursor = doc.length;
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor } }) });
  const completion = toCompletion(completionEntry);

  if (typeof completion.apply === "function") {
    completion.apply(view, completion, from, cursor);
  } else {
    // What CodeMirror itself does with a string `apply`.
    view.dispatch(insertCompletionText(view.state, completion.apply ?? completion.label, from, cursor));
  }

  const result = { doc: view.state.doc.toString(), cursor: view.state.selection.main.head };
  view.destroy();
  return result;
}

/** An editor for `doc`, where `|` marks the cursor, wired the way Playground wires it. */
function editorFor(doc: string, flavor: RuntimeFlavor = "luau", typeMode: LuauTypeMode = "strict") {
  const pos = doc.indexOf("|");
  const text = doc.slice(0, pos) + doc.slice(pos + 1);
  const activeFile = flavor === "luau" ? "main.luau" : "main.lua";
  const project = { flavor, entry: activeFile, files: { [activeFile]: text } };
  const overrides = luauIntelligence(() => ({ project, activeFile, typeMode }));
  const state = EditorState.create({
    doc: text,
    selection: { anchor: pos },
    extensions: luaSupport(
      { flavor: () => flavor, activeFile: () => activeFile, files: () => [activeFile] },
      overrides
    )
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return { state, pos, overrides };
}

async function complete(doc: string, flavor?: RuntimeFlavor, typeMode?: LuauTypeMode) {
  const { state, pos, overrides } = editorFor(doc, flavor, typeMode);
  return (await overrides.completion!(new CompletionContext(state, pos, false))) as CompletionResult | null;
}

async function hover(doc: string): Promise<HTMLElement | null> {
  const { state, pos, overrides } = editorFor(doc);
  const view = new EditorView({ state });
  try {
    const tooltip = (await overrides.hover!(view, pos, 1)) as Tooltip | null;
    return tooltip ? tooltip.create(view).dom : null;
  } finally {
    view.destroy();
  }
}

const labels = (result: CompletionResult | null) => result?.options.map((option) => option.label) ?? [];

describe("luauIntelligence completion", () => {
  it("leaves Lua, and Luau with types off, to the editor's own completion", async () => {
    expect(labels(await complete("pr|", "lua54"))).toContain("print");
    expect(labels(await complete("pr|", "luau", "off"))).toContain("print");
    expect(completeLuau).not.toHaveBeenCalled();
  });

  it("falls back to the editor's own completion while the analyzer loads", async () => {
    vi.mocked(completeLuau).mockResolvedValue(null);

    expect(labels(await complete("pr|"))).toContain("print");
    expect(completeLuau).toHaveBeenCalledOnce();
  });

  it("does not ask the analyzer about comments or strings", async () => {
    expect(await complete("-- pr|")).toBeNull();
    expect(await complete(`print("pr|")`)).toBeNull();
    expect(completeLuau).not.toHaveBeenCalled();
  });

  it("asks after a member access even before a letter is typed", async () => {
    vi.mocked(completeLuau).mockResolvedValue([entry({ label: "upper", kind: "property", type: "(string) -> string" })]);

    const result = await complete(`local s = "x"\ns:|`);
    expect(labels(result)).toEqual(["upper"]);
  });

  it("puts the analyzer's types on the editor's names, keeping stdlib docs and snippets", async () => {
    vi.mocked(completeLuau).mockResolvedValue([
      entry({ label: "print", parentheses: "cursorInside", type: "<T...>(T...) -> ()" }),
      entry({ label: "for", kind: "keyword" })
    ]);

    const result = await complete("pr|");
    const print = result?.options.filter((option) => option.label === "print") ?? [];
    expect(print).toEqual([expect.objectContaining({ detail: "<T...>(T...) -> ()", type: "function" })]);
    expect(typeof print[0].info).toBe("function");

    // The keyword comes once, from the analyzer; the loop snippets stay.
    const loops = result?.options.filter((option) => option.label === "for") ?? [];
    expect(loops.filter((option) => typeof option.apply !== "function")).toHaveLength(1);
    expect(loops.filter((option) => typeof option.apply === "function").length).toBeGreaterThan(0);
  });
});

describe("mergeCompletions", () => {
  it("returns the analyzer's options alone when the editor offered none", () => {
    const analyzed = [toCompletion(entry({ label: "x" }))];
    expect(mergeCompletions(null, 4, analyzed)).toMatchObject({ from: 4, options: analyzed });
  });

  it("keeps the editor's names the analyzer did not offer", () => {
    const base = { from: 0, options: [{ label: "x" }, { label: "y", detail: "local" }] };
    const merged = mergeCompletions(base, 0, [toCompletion(entry({ label: "x", type: "number" }))]);
    expect(merged.options.map((option) => [option.label, option.detail])).toEqual([
      ["x", "number"],
      ["y", "local"]
    ]);
  });

  it("trusts its own range when the two disagree", () => {
    const base = { from: 2, options: [{ label: "lib.util" }] };
    expect(labels(mergeCompletions(base, 0, [toCompletion(entry({ label: "x" }))]))).toEqual(["x"]);
  });
});

describe("luauIntelligence hover", () => {
  it("shows the checked type of a project name", async () => {
    vi.mocked(inspectLuau).mockResolvedValue({ name: "total", type: "number" });

    const dom = await hover("local to|tal = 1");
    expect(dom?.className).toBe("cm-luau-hover");
    expect(dom?.textContent).toBe("total: number");
  });

  it("shows stdlib documentation under the checked type", async () => {
    vi.mocked(inspectLuau).mockResolvedValue({ type: "(number) -> number" });

    const dom = await hover("print(math.fl|oor(2.5))");
    expect(dom?.className).toBe("cm-lua-doc");
    expect(dom?.querySelector(".cm-lua-doc-signature")?.textContent).toBe("math.floor: (number) -> number");
    expect(dom?.textContent).toContain("Luau");
  });

  it("keeps the documentation alone while the analyzer loads", async () => {
    vi.mocked(inspectLuau).mockResolvedValue(null);

    const dom = await hover("print(math.fl|oor(2.5))");
    expect(dom?.querySelector(".cm-lua-doc-signature")?.textContent).toBe("math.floor(x)");
  });

  it("does not describe keywords", async () => {
    expect(await hover("lo|cal x = 1")).toBeNull();
    expect(inspectLuau).not.toHaveBeenCalled();
  });
});

describe("toCompletion", () => {
  it("maps analyzer kinds to editor icons", () => {
    expect(toCompletion(entry({ kind: "property" })).type).toBe("property");
    expect(toCompletion(entry({ kind: "property", parentheses: "cursorAfter" })).type).toBe("method");
    expect(toCompletion(entry({ kind: "binding" })).type).toBe("variable");
    expect(toCompletion(entry({ kind: "binding", parentheses: "cursorInside" })).type).toBe("function");
    expect(toCompletion(entry({ kind: "keyword" })).type).toBe("keyword");
    expect(toCompletion(entry({ kind: "type" })).type).toBe("type");
  });

  it("shows short types inline and moves long ones to the info panel", () => {
    expect(toCompletion(entry({ type: "number" }))).toMatchObject({ detail: "number" });
    expect(toCompletion(entry({ type: "number" })).info).toBeUndefined();

    const long = `(${"string, ".repeat(10)}number) -> boolean`;
    const completion = toCompletion(entry({ type: long }));
    expect(completion.detail).toHaveLength(48);
    expect(completion.detail?.endsWith("…")).toBe(true);
    expect(completion.info).toBe(long);
  });

  it("ranks type matches above misuse", () => {
    expect(toCompletion(entry({ typeMatch: true })).boost).toBeGreaterThan(0);
    expect(toCompletion(entry({ deprecated: true })).boost).toBeLessThan(0);
    expect(toCompletion(entry({ wrongIndexType: true })).boost).toBeLessThan(0);
  });

  it("inserts the label as-is for plain entries", () => {
    expect(accept("print(point.la", 12, entry({ label: "label", kind: "property" }))).toEqual({
      doc: "print(point.label",
      cursor: 17
    });
  });

  it("adds parentheses and places the cursor where the analyzer asks", () => {
    expect(accept("pri", 0, entry({ label: "print", parentheses: "cursorInside" }))).toEqual({
      doc: "print()",
      cursor: 6
    });
    expect(accept("s:up", 2, entry({ label: "upper", kind: "property", parentheses: "cursorAfter" }))).toEqual({
      doc: "s:upper()",
      cursor: 9
    });
  });

  it("turns a dot into a colon for methods", () => {
    expect(
      accept(
        "account.dep",
        8,
        entry({ label: "deposit", kind: "property", parentheses: "cursorInside", replaceDotWithColon: true })
      )
    ).toEqual({ doc: "account:deposit()", cursor: 16 });
  });

  it("prefers the analyzer's insert text over the label", () => {
    expect(accept("x = ", 4, entry({ label: "function", insertText: "function()" }))).toEqual({
      doc: "x = function()",
      cursor: 14
    });
  });
});
