import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BYTECODE_OPTIONS, readBytecodeOptions, readEditorOptions, storeBytecodeOptions, storeEditorOptions } from "./preferences";

const KEY = "weblua:bytecode-options";

afterEach(() => {
  window.localStorage.clear();
});

describe("bytecode options", () => {
  it("defaults to the levels runs compile at", () => {
    expect(readBytecodeOptions()).toEqual({ optimizationLevel: 1, debugLevel: 1, source: true });
  });

  it("remembers a stored choice", () => {
    storeBytecodeOptions({ optimizationLevel: 2, debugLevel: 0, source: false });
    expect(readBytecodeOptions()).toEqual({ optimizationLevel: 2, debugLevel: 0, source: false });
  });

  it("replaces unreadable or invalid fields with defaults", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readBytecodeOptions()).toEqual(DEFAULT_BYTECODE_OPTIONS);

    window.localStorage.setItem(KEY, JSON.stringify({ optimizationLevel: 7, debugLevel: 2, source: "yes" }));
    expect(readBytecodeOptions()).toEqual({ optimizationLevel: 1, debugLevel: 2, source: true });
  });
});

describe("editor options", () => {
  it("remembers a size from the menu and ignores any other", () => {
    expect(readEditorOptions()).toEqual({ fontSize: 13.5, wrap: false });
    storeEditorOptions({ fontSize: 17, wrap: true });
    expect(readEditorOptions()).toEqual({ fontSize: 17, wrap: true });

    window.localStorage.setItem("weblua:editor-options", JSON.stringify({ fontSize: 400, wrap: 1 }));
    expect(readEditorOptions()).toEqual({ fontSize: 13.5, wrap: false });
  });
});
