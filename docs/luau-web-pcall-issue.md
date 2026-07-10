# Upstream issue draft for luau-web

Status: the local Asyncify workaround is active and covered by `pcall` and `xpcall`
regression tests. The JSPI fix described below is still required upstream. This report is
ready to paste into https://github.com/xNasuni/luau-web/issues/new.

---

**Title:** JSPI build: `pcall`/`xpcall` cannot catch runtime errors

**Body:**

## Summary

In `luau-web@1.4.0`, the JSPI build selected by modern browsers appears to let runtime
errors escape `pcall` and `xpcall`. An error raised inside a protected call
(`error(...)`, failed `assert`, indexing `nil`, arithmetic on `nil`, etc.) propagates to
the JS caller of `runnable()` instead of returning `false, message`.

## Reproduction

```js
import { LuauState } from "luau-web";

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

```text
ok=false err=[string "repro"]:2: boom
still running
```

**Actual in JSPI-capable browsers:** the error escapes `pcall`; the two `print` calls
never run and the error surfaces at the JS boundary.

## Root cause

Luau raises errors through the protected-call machinery in `Luau.VM`:

- `VM/src/ldo.cpp` implements `luaD_rawrunprotected` with `try/catch` when
  `LUA_USE_LONGJMP=0`.
- `CMakeLists.txt` adds `-fwasm-exceptions` to `Luau.Web.JSPI`, but `Luau.Web.JSPI`
  links the normal `Luau.VM` static library.

Emscripten requires exception mode at compile time and link time. If `Luau.VM` is not
compiled with `-fwasm-exceptions`, the JSPI executable can be linked with native wasm
exceptions while the VM object files that contain Luau's `try/catch` are not using the
same exception model.

Note: the Asyncify build is different. It links a separate `Luau.VM.Asyncify` with
`LUA_USE_LONGJMP=1`, and a Node smoke test using the Asyncify bundle catches
`pcall(function() error("boom") end)` correctly.

## Suggested fix

Build the VM used by `Luau.Web.JSPI` with native wasm exceptions too. The cleanest shape
is probably to mirror the Asyncify split:

- add a `Luau.VM.JSPI` static library from the same VM sources
- compile `Luau.VM.JSPI` with `-fwasm-exceptions` and without `LUA_USE_LONGJMP`
- link `Luau.Web.JSPI` against `Luau.VM.JSPI`
- keep `Luau.Web.Asyncify` linked against `Luau.VM.Asyncify`

Then verify `pcall` and `xpcall` through both the Luau-level protected-call path and the
JS boundary path.

## Environment

- luau-web 1.4.0
- Reproduces when the JSPI build is selected.
- Weblua's Asyncify regression tests confirm that both `pcall` and `xpcall` catch the
  protected error and continue execution.
