# Weblua Roadmap & Todo

## Editor Intelligence & Modern Luau Support

High-impact improvements to elevate the editing and developer experience in Weblua.

---

### 1. Modern Syntax Highlighting & Parsing (Replace Legacy Mode)
- [ ] **Migrate away from `@codemirror/legacy-modes/mode/lua`**:
  - Replace the CM5-era regex-based stream mode with a modern Lezer-based parser or enhanced syntax extension.
- [ ] **Full Luau Language Support**:
  - **Type annotations and definitions**: `type Point = { x: number, y: number }`, `type Result<T> = ...`, `typeof()`.
  - **String interpolation**: Backtick syntax (`` `Value: {x}` ``) with proper tokenization for embedded expressions.
  - **Compound assignments**: `+=`, `-=`, `*=`, `/=`, `//=`, `%=`, `^=`, `..=`.
  - **Expressions**: `if ... then ... else ...` ternary-style expressions.
  - **Generics & Attributes**: Function generics `<T>(value: T): T` and attribute syntax.
- [ ] **Structural Editor Enhancements**:
  - Accurate AST-based code folding (functions, tables, control blocks).
  - Smart indentation and bracket/quote auto-closing.

---

### 2. Autocompletion & IntelliSense
- [ ] **Standard Library Autocompletion**:
  - Complete global namespaces and functions based on active runtime flavor:
    - **Lua 5.1–5.4**: `string`, `table`, `math`, `io`, `os`, `coroutine`, `package`, `utf8`, `bit32`.
    - **Luau**: `buffer`, `bit32`, `vector`, `task`, `debug`, etc.
  - Include signature documentation / parameter hints in the completion popup.
- [ ] **Multi-File `require()` Path Completion**:
  - Suggest project file paths automatically when typing inside `require("...")` (supporting dot and slash notations).
- [ ] **In-File Symbol Completion**:
  - Suggest local identifiers, function names, and table fields defined in the active document.

---

### 3. Static Type Analysis & Linting
- [ ] **Luau Static Type Diagnostics**:
  - Extend the "Check" pipeline to run Luau's static analysis engine (via WASM) in addition to grammar verification.
  - Surface type errors (type mismatches, unknown properties, missing parameters) in CodeMirror's lint gutter.
- [ ] **Configurable Lint Severity**:
  - Support strict / non-strict type checking modes (`--!strict`, `--!nonstrict`, `--!nocheck` header flags).

---

### 4. Code Formatting & Tooltips
- [ ] **Format Action**:
  - Integrate an in-browser formatter (e.g., StyLua or Luau formatting) with a "Format Code" shortcut (`Shift+Alt+F`).
- [ ] **Hover Documentation**:
  - Display markdown hover tooltips showing types and standard library docstrings when hovering over functions.
  