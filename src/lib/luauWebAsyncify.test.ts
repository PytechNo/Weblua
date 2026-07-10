import { describe, expect, it } from "vitest";
import { InternalLuauWasmModule, LuauState } from "./luauWebAsyncify";

describe("luauWebAsyncify", () => {
  it("keeps running after pcall and xpcall handle Luau runtime errors", async () => {
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
          local pcallOk, pcallErr = pcall(function() error("pcall boom") end)
          print("pcall ok=" .. tostring(pcallOk) .. " err=" .. tostring(pcallErr))

          local xpcallOk, xpcallErr = xpcall(
            function() error("xpcall boom") end,
            function(message) return "handled: " .. tostring(message) end
          )
          print("xpcall ok=" .. tostring(xpcallOk) .. " err=" .. tostring(xpcallErr))
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
      'pcall ok=false err=[string "repro"]:2: pcall boom',
      'xpcall ok=false err=handled: [string "repro"]:6: xpcall boom',
      "still running"
    ]);
  });
});
