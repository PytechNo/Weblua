# Upstream issue draft for luau-web

Ready to paste into https://github.com/xNasuni/luau-web/issues/new

---

**Title:** `pcall`/`xpcall` cannot catch runtime errors — WASM built without exception catching

**Body:**

## Summary

In `luau-web@1.4.0`, `pcall` and `xpcall` do not catch runtime errors. Any error raised
inside a protected call (`error(...)`, failed `assert`, indexing `nil`, arithmetic on
`nil`, etc.) escapes the protected call, aborts the VM, and propagates to the JS caller
of `runnable()` instead of returning `false, message`.

## Reproduction

```js
import { LuauState, InternalLuauWasmModule } from "luau-web";

const state = await LuauState.createAsync({});
state.env.set("print", (...a) => console.log(...a), true);

const run = state.loadstring(`
  local ok, err = pcall(function() error("boom") end)
  print("ok=" .. tostring(ok) .. " err=" .. tostring(err))
  print("still running")
`, "repro", true);

await run(); // rejects/throws with "[string \"repro\"]:2: boom" instead of printing
```

**Expected:**
```
ok=false err=[string "repro"]:2: boom
still running
```

**Actual:** the error escapes `pcall`; the two `print` calls never run and the error
surfaces at the JS boundary.

## Root cause

Luau raises errors as C++ exceptions and `pcall` relies on `try/catch`. Both shipped WASM
builds appear to be compiled with Emscripten exception catching **disabled**:

- `src/lib/Luau.Web.Asyncify.js` contains the Emscripten stub string:
  *"Exception thrown, but exception catching is not enabled. Compile with
  `-sNO_DISABLE_EXCEPTION_CATCHING` or `-sEXCEPTION_CATCHING_ALLOWED=[..]` to catch."*
- `src/lib/Luau.Web.JSPI.js` contains no `__cxa_throw` / exception symbols at all.

So `__cxa_throw` aborts to the top level instead of unwinding into `pcall`'s handler.

## Suggested fix

Rebuild the WASM with C++ exception support enabled — either the JS-based scheme
(`-sNO_DISABLE_EXCEPTION_CATCHING`) or native WASM exceptions
(`-fwasm-exceptions` + `-sSUPPORT_LONGJMP=wasm`) — and build `Luau.VM` with exceptions
enabled rather than `LUA_USE_LONGJMP`. Note native WASM exceptions can conflict with
Asyncify, so the Asyncify target may need the JS-based scheme while the JSPI target can
use native.

## Environment

- luau-web 1.4.0
- Reproduces on both the JSPI and Asyncify builds (i.e. every browser).
