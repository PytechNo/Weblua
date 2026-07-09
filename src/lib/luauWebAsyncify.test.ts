import { describe, expect, it } from "vitest";
import { InternalLuauWasmModule, LuauState } from "./luauWebAsyncify";

describe("luauWebAsyncify", () => {
  it("keeps running after a protected Luau runtime error", async () => {
    const lines: string[] = [];
    const state = await LuauState.createAsync({});

    try {
      const print = (...args: unknown[]) => lines.push(args.map(String).join("\t"));

      InternalLuauWasmModule.fprint = print;
      InternalLuauWasmModule.fprintwarn = print;
      InternalLuauWasmModule.fprinterr = print;
      state.env.set("print", print, true);

      const run = state.loadstring(
        `
          local ok, err = pcall(function() error("boom") end)
          print("ok=" .. tostring(ok) .. " err=" .. tostring(err))
          print("still running")
        `,
        "repro",
        true
      );

      await run();
    } finally {
      state.destroy();
    }

    expect(lines).toEqual([
      'ok=false err=[string "repro"]:2: boom',
      "still running"
    ]);
  });
});
