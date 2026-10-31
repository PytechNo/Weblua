import { type ArticlePage, lua, lua51, luau } from "./articleTypes";
import type { ToolPage } from "./routes";

/** A cell linking the pattern tester to this pattern and text, through its `#p=…&s=…` hash. */
function tryIt(pattern: string, text: string, replacement?: string): string {
  const params = new URLSearchParams({ p: pattern, s: text, ...(replacement === undefined ? {} : { r: replacement }) });
  return `[Try it](/lua-pattern-tester#${params})`;
}

const LUAU_SOURCES: Array<[string, string]> = [
  ["Luau: compatibility with Lua 5.2, 5.3, and 5.4", "https://luau.org/compatibility"],
  ["Luau: syntax", "https://luau.org/syntax"],
  ["Luau: sandboxing", "https://luau.org/sandbox"],
  ["Luau: performance", "https://luau.org/performance"]
];

/**
 * The text of each tool and comparison page. Comparison pages show it as the
 * page; tool pages show it below the tool. Code blocks run in
 * articles.execution.test.ts like the examples' and lessons'.
 */
export const guidePages: Record<ToolPage, ArticlePage> = {
  "lua-vs-luau": {
    slug: "lua-vs-luau",
    title: "Lua vs Luau: differences, speed, and which to use",
    metaTitle: "Lua vs Luau: Differences, Syntax, and Speed Compared | Weblua",
    description:
      "How Luau differs from Lua 5.1 and 5.4: types, syntax, the standard library, sandboxing, and speed, with every difference run side by side in your browser.",
    answer:
      "Luau is a programming language derived from Lua 5.1, built by Roblox and used for every Roblox script. It keeps Lua's syntax, so most Lua 5.1 code runs unchanged, and adds optional type checking, `continue`, compound assignment such as `+=`, string interpolation, if-expressions, a larger standard library, and a faster interpreter. For safety it removes file access, `load`, and bytecode loading, and it doesn't take on Lua 5.2+ features such as `goto` and integers.",
    blocks: [
      {
        heading: "Lua and Luau at a glance",
        table: {
          head: ["", "Lua 5.1", "Lua 5.4", "Luau"],
          rows: [
            ["Made by", "PUC-Rio", "PUC-Rio", "Roblox, open source (MIT)"],
            ["Type annotations and a checker", "No", "No", "Yes"],
            ["Number types", "One: float", "Two: integer and float", "One: float"],
            ["`continue`", "No", "No", "Yes"],
            ["`+=`, `-=`, `..=` and the rest", "No", "No", "Yes"],
            ["String interpolation", "No", "No", "Yes"],
            ["If-expressions", "No", "No", "Yes"],
            ["`goto`", "No", "Yes", "No"],
            ["Floor division `//`", "No", "Yes", "Yes"],
            ["Bitwise operations", "No", "Operators: `&`, `|`, `~`, `<<`, `>>`", "The `bit32` library"],
            ["Files and processes (`io`, `os.execute`)", "Yes", "Yes", "No"],
            ["Compile code at runtime", "`loadstring`", "`load`", "Only if the host adds `loadstring`; never bytecode"],
            ["Where you meet it", "LuaJIT, LÖVE, Neovim, WoW add-ons, Redis", "Embedded in apps and engines", "Roblox, and apps that embed Luau"]
          ]
        }
      },
      {
        heading: "Run Lua and Luau side by side",
        text: [
          "This editor runs one file on Lua 5.1 and on Luau and shows both outputs. It loads and runs as soon as it scrolls into view. Change the code and press Run, or pick other runtimes under Runtime and Compare."
        ],
        embed: { example: "lua-vs-luau-demo", compare: "luau", title: "The same file on Lua 5.1 and Luau" }
      },
      {
        heading: "Syntax Luau adds",
        text: [
          "Luau accepts Lua 5.1 syntax and adds to it. Each addition is a syntax error on standard Lua, so a file that uses one runs only on Luau. Here are four in a few lines; note that Lua stops at the first one, on line 2."
        ],
        code: luau(
          `local score = 10
score += 5
local label = if score > 12 then "high" else "low"
print(\`score {score} is {label}\`)
for i = 1, 3 do
  if i == 2 then
    continue
  end
  print(i)
end`,
          {
            lua51: "main.lua:2: '=' expected near '+'",
            lua54: "main.lua:2: syntax error near '+'",
            luau: "score 15 is high\n1\n3"
          }
        )
      },
      {
        text: ["The full list of what Luau adds to Lua 5.1's syntax:"],
        list: [
          "**Type annotations**: `local n: number`, `function f(x: string): boolean`, `type Point = { x: number, y: number }`. They're optional and have no effect at runtime.",
          "**Compound assignment**: `+=`, `-=`, `*=`, `/=`, `//=`, `%=`, `^=`, and `..=`.",
          "**`continue`** skips to a loop's next pass. Lua 5.2+ writes `goto continue`.",
          "**If-expressions**: `if a then b else c` is a value, safer than Lua's `a and b or c`, which fails when `b` is `false` or `nil`.",
          "**String interpolation**: in a backtick string, each `{expression}` is replaced by its value.",
          "**Generalized iteration**: `for k, v in t do` loops over a table without `pairs`, and the `__iter` metamethod customizes it.",
          "**Number literals**: binary `0b1010` and digit separators such as `1_000_000`.",
          "**Floor division** `//`, which Lua also has since 5.3, and **attributes** such as `@native` on functions."
        ]
      },
      {
        heading: "Standard library differences",
        text: [
          "Luau's standard library is Lua 5.1's, with additions borrowed from later Lua versions, additions of its own, and removals for sandboxing. The table sums them up, and the file below it checks for a few of those names on each runtime."
        ],
        code: lua51(
          `print("string.split", type(string.split))
print("table.find", type(table.find))
print("table.clone", type(table.clone))
print("math.clamp", type(math.clamp))
print("table.unpack", type(table.unpack))
print("unpack", type(unpack))
print("utf8", type(utf8))
print("bit32", type(bit32))
print("io", type(io))
print("load", type(load))`,
          {
            lua51: "string.split\tnil\ntable.find\tnil\ntable.clone\tnil\nmath.clamp\tnil\ntable.unpack\tnil\nunpack\tfunction\nutf8\tnil\nbit32\tnil\nio\ttable\nload\tfunction",
            lua54: "string.split\tnil\ntable.find\tnil\ntable.clone\tnil\nmath.clamp\tnil\ntable.unpack\tfunction\nunpack\tnil\nutf8\ttable\nbit32\tnil\nio\ttable\nload\tfunction",
            luau: "string.split\tfunction\ntable.find\tfunction\ntable.clone\tfunction\nmath.clamp\tfunction\ntable.unpack\tfunction\nunpack\tfunction\nutf8\ttable\nbit32\ttable\nio\tnil\nload\tnil"
          }
        ),
        table: {
          head: ["Change in Luau", "Functions"],
          rows: [
            ["Added, Luau's own", "`string.split`, `table.find`, `table.clone`, `table.clear`, `table.create`, `table.freeze`, `table.isfrozen`, `math.clamp`, `math.sign`, `math.round`, `math.noise`, the `buffer` library"],
            ["Added, from later Lua", "`table.unpack`, `table.pack`, `table.move`, `utf8`, `bit32`, `string.pack` and `string.unpack`, `coroutine.close`, `coroutine.isyieldable`"],
            ["Removed", "`io`, `package`, `dofile`, `loadfile`, `load`, `string.dump`, most of `os` and `debug`, and `collectgarbage` except `\"count\"`"]
          ]
        }
      },
      {
        heading: "Numbers: one type, not two",
        text: [
          "Lua 5.3 split numbers into integers and floats, and 5.4 kept that: `10 / 2` is the float `5.0`, and integers wrap around at 2^63. Luau, like Lua 5.1, has a single number type, a 64-bit float, which holds whole numbers exactly up to 2^53. That's why the same division prints differently:"
        ],
        code: lua51(
          `print(10 / 2, 3 * 1.0, 2 ^ 53)
print(math.maxinteger)
print(100000000000000)`,
          {
            lua51: "5\t3\t9.007199254741e+15\nnil\n1e+14",
            lua54: "5.0\t3.0\t9.007199254741e+15\n9223372036854775807\n100000000000000",
            luau: "5\t3\t9007199254740992\nnil\n100000000000000"
          }
        )
      },
      {
        heading: "Types: Luau's biggest addition",
        text: [
          "Luau has a gradual type system with a checker that runs before the code. Annotate what you want checked and inference fills in the rest; add `--!strict` to a file and every mismatch is reported. Types are erased before the code runs, so they never slow it down or change what it does.",
          "Weblua runs the same checker as you type, in the [Luau type checker](/luau-type-checker) and in every Luau project in the playground."
        ],
        code: luau(
          `--!strict
type Player = { name: string, coins: number }

local function reward(player: Player, amount: number): Player
  player.coins += amount
  return player
end

print(reward({ name = "Ada", coins = 5 }, 10).coins)
-- reward({ name = "Ada" }, "ten") -- two type errors: missing coins, and a string for a number`,
          { luau: "15" }
        )
      },
      {
        heading: "Is Luau faster than Lua?",
        text: [
          "According to the Luau team, its interpreter is tuned to be noticeably faster than the Lua 5.x interpreters, including 5.4, and on some workloads to match LuaJIT's interpreter. Its compiler folds constants, and at optimization level 2 inlines small functions and unrolls loops. Common built-ins such as `math.floor` are called without a full function call, and field lookups are cached.",
          "Luau also has optional native code generation for x64 and arm64, for functions or files you mark, and no tracing JIT: the team chose predictable speed everywhere Roblox runs, including platforms that forbid JIT compilation. LuaJIT, a separate implementation of Lua 5.1 with a tracing JIT, is a different comparison, and the fastest of the three on long numeric loops is usually LuaJIT.",
          "Benchmarks are workload-specific. Run this one on both runtimes to compare them on your machine; in Weblua both run as WebAssembly, so the times show the gap between interpreters, not native speeds."
        ],
        code: { ...lua51(
          `local start = os.clock()
local total = 0
for i = 1, 3000000 do
  total = total + i % 7
end
print(total, string.format("%.3f s", os.clock() - start))`,
          {}
        ), compare: "luau" }
      },
      {
        heading: "What Luau removes, and why",
        text: [
          "Luau was built to run code from people you don't trust, such as every Roblox game. So it leaves out anything that reaches outside the VM: `io` and `package`, `os` except `clock`, `date`, `difftime`, and `time`, and `debug` except `info` and `traceback`. It can't load bytecode, because hand-made bytecode is a classic way to break a VM's memory safety, so `string.dump` and `load` are gone and a host's `loadstring` accepts only source.",
          "Some later Lua features were left out on purpose: `goto`, `__gc` finalizers, and `<const>` and `<close>` variables. Luau's compatibility notes give the reason for each."
        ]
      },
      {
        heading: "Can Lua code run in Luau?",
        text: [
          "Code written for Lua 5.1 usually runs in Luau unchanged. What breaks is code that touches what Luau removed: files, `load`, `string.dump`, and most of `debug`. Code written for Lua 5.2 and later needs more care. Use this checklist when porting:"
        ],
        list: [
          "Replace `goto continue` with `continue`, and other `goto`s with loops or functions.",
          "Replace bitwise operators with `bit32` calls: `a & b` becomes `bit32.band(a, b)`.",
          "Check integer arithmetic: values above 2^53 lose precision, and `math.type` doesn't exist.",
          "Replace `_ENV` tricks; Luau keeps Lua 5.1's `setfenv` and `getfenv`, though using them turns off some optimizations.",
          "Remove `<const>` and `<close>` attributes, and any `__gc` metamethods.",
          "Swap `io` and `require` of C modules for whatever the host provides."
        ]
      },
      {
        heading: "Which should you use?",
        list: [
          "**Making Roblox games**: Luau. Roblox runs nothing else.",
          "**Embedding a scripting language in your own app**: Luau if you'll run untrusted scripts or want types; Lua 5.4 if you want integers and the larger set of C libraries; LuaJIT if raw speed and its FFI matter most.",
          "**LÖVE, Neovim, OpenResty, or WoW add-ons**: Lua 5.1 as LuaJIT implements it.",
          "**Learning**: either. Luau is Lua with optional extras, so everything you learn in one carries over. Weblua's [Learn Luau course](/learn-luau) starts from zero."
        ]
      }
    ],
    faq: [
      ["Is Luau the same as Lua?", "No. Luau is derived from Lua 5.1 and keeps its syntax and core behavior, but it adds types, new syntax, and library functions, removes some unsafe features, and has its own compiler and interpreter."],
      ["Is Roblox Lua or Luau?", "Luau. Roblox used Lua 5.1 until 2019, then switched to Luau, its own derivative, which has been open source since 2021. People still often say Roblox Lua."],
      [
        "Can I use Lua libraries in Luau?",
        "Pure Lua 5.1 libraries usually work, sometimes after small changes. Libraries with C code don't: Luau's C API differs from Lua's, and Roblox doesn't load native modules."
      ],
      ["Does Luau have integers?", "No. Like Lua 5.1, it has one number type, a 64-bit float. Lua 5.3 and later have a separate integer type."],
      ["Is Luau harder to learn than Lua?", "No. Luau is Lua plus optional extras, and you can ignore types until you want them. The [Learn Luau course](/learn-luau) starts from zero."],
      ["Does Luau have goto?", "No. Luau left `goto` out on purpose and added `continue`, which covers the most common use of `goto` in Lua."]
    ],
    related: [
      ["Lua 5.1 vs 5.4", "/lua-5-1-vs-5-4"],
      ["Learn Luau, free", "/learn-luau"],
      ["Luau playground", "/luau"],
      ["Luau type checker", "/luau-type-checker"]
    ],
    sources: [...LUAU_SOURCES, ["Lua 5.1 Reference Manual", "https://www.lua.org/manual/5.1/manual.html"]]
  },

  "lua51-vs-lua54": {
    slug: "lua-5-1-vs-5-4",
    title: "Lua 5.1 vs 5.4: what changed and what breaks",
    metaTitle: "Lua 5.1 vs 5.4: Differences and Upgrade Guide | Weblua",
    description:
      "What changed between Lua 5.1 and 5.4: integers, _ENV, goto, bitwise operators, table.unpack, <const> and <close>, with each change run on both interpreters.",
    answer:
      "Lua 5.4 is the current line of the reference interpreter; 5.1, from 2006, is the version LuaJIT, LÖVE, Neovim, and World of Warcraft add-ons still build on. The changes that break 5.1 code most are integers (5.3), `_ENV` replacing `setfenv` (5.2), `unpack` moving to `table.unpack` (5.2), and `loadstring` merging into `load` (5.2). Along the way Lua gained `goto`, `//`, bitwise operators, `utf8`, and `<const>` and `<close>` variables.",
    blocks: [
      {
        heading: "What changed in each version",
        table: {
          head: ["", "5.1", "5.2", "5.3", "5.4"],
          rows: [
            ["Released", "2006", "2011", "2015", "2020"],
            ["Integer subtype", "No", "No", "Yes", "Yes"],
            ["`goto` and labels", "No", "Yes", "Yes", "Yes"],
            ["`//` and bitwise operators", "No", "No", "Yes", "Yes"],
            ["`_ENV` instead of `setfenv`", "No", "Yes", "Yes", "Yes"],
            ["`table.unpack` instead of `unpack`", "No", "Yes", "Yes", "Yes"],
            ["`bit32` library", "No", "Yes", "Deprecated", "No"],
            ["`utf8` library", "No", "No", "Yes", "Yes"],
            ["`<const>` and `<close>` variables", "No", "No", "No", "Yes"],
            ["Generational garbage collector", "No", "Experimental", "No", "Yes"]
          ]
        },
        text: ["Lua 5.5, the newest version, adds `global` declarations; Weblua runs it too, as well as 5.2 and 5.3, under Runtime and Compare."]
      },
      {
        heading: "Run 5.1 and 5.4 side by side",
        text: ["This editor runs one file on the real Lua 5.1 and Lua 5.4 interpreters and shows both outputs. Edit it to test what worries you before an upgrade."],
        embed: { example: "lua51-vs-lua54-demo", compare: "lua54", title: "The same file on Lua 5.1 and Lua 5.4" }
      },
      {
        heading: "Integers (5.3)",
        text: [
          "Lua 5.3 split numbers into two subtypes, integer and float. Integer arithmetic stays integer, `/` always gives a float, and a float prints with `.0` even when it's whole. Most code doesn't notice, but output does: `6 / 2` prints `3.0`, and `string.format(\"%d\", 3.5)` is now an error instead of `3`."
        ],
        code: lua51(
          `print(6 / 2, 3 * 2, 2 ^ 2, 1e2)
print(math.floor(3.7), tostring(10 / 2))
print(math.maxinteger, type(math.type))`,
          {
            lua51: "3\t6\t4\t100\n3\t5\nnil\tnil",
            lua54: "3.0\t6\t4.0\t100.0\n3\t5.0\n9223372036854775807\tfunction"
          }
        ),
        note: "Watch table keys: `t[1]` and `t[1.0]` are the same key in 5.4, because a float with an integer value is converted, but `t[\"1\"]` is still a different key. And integers wrap around: `math.maxinteger + 1` is `math.mininteger`."
      },
      {
        heading: "Integer division and bitwise operators (5.3)",
        text: ["`//` divides and rounds down, and `&`, `|`, `~`, `<<`, `>>`, and unary `~` work on integers. On 5.1 they're syntax errors; LuaJIT has the `bit` library instead, and Lua 5.2 had `bit32`."],
        code: lua(
          `print(7 // 2, 7.0 // 2, -7 // 2)
print(6 & 3, 6 | 3, 6 ~ 3, 1 << 4)
print(math.type(1), math.type(1.0), math.type("1"))`,
          {
            lua51: "main.lua:1: unexpected symbol near '/'",
            lua54: "3\t3.0\t-4\n2\t7\t5\t16\ninteger\tfloat\tnil"
          }
        )
      },
      {
        heading: "Moved and removed functions (5.2)",
        text: [
          "Lua 5.2 tidied the global namespace. `unpack` moved to `table.unpack`, `loadstring` became `load` (which now accepts a string), and `setfenv`, `getfenv`, `module`, and `table.getn` went away. This prints what each runtime has:"
        ],
        code: lua51(
          `print(type(unpack), type(table.unpack))
print(type(loadstring), type(load))
print(type(setfenv), type(getfenv))
print(type(module), type(table.getn), type(math.pow))`,
          {
            lua51: "function\tnil\nfunction\tfunction\nfunction\tfunction\nfunction\tfunction\tfunction",
            lua54: "nil\tfunction\nnil\tfunction\nnil\tnil\nnil\tnil\tnil"
          }
        ),
        list: [
          "`local unpack = table.unpack or unpack` makes code work on both.",
          "`load(string)` replaces `loadstring(string)`; `load` also takes a mode and an environment.",
          "`math.pow(x, y)` is `x ^ y`, and `table.getn(t)` is `#t`."
        ]
      },
      {
        heading: "_ENV instead of setfenv (5.2)",
        text: [
          "In 5.1 every function has an environment table, changed with `setfenv`. Since 5.2, globals are fields of a local named `_ENV`, and you give a chunk its own environment by passing it to `load`. That's the modern way to run code in a sandbox:"
        ],
        code: lua(
          `local env = { print = print }
local chunk = load("x = 1 print(x, y)", "sandbox", "t", env)
chunk()
print(env.x, x)`,
          {
            lua51: "main.lua:2: bad argument #1 to 'load' (function expected, got string)",
            lua54: "1\tnil\n1\tnil"
          }
        )
      },
      {
        heading: "goto, const, and close (5.2 and 5.4)",
        text: [
          "`goto` jumps to a `::label::` in the same function, most often to emulate `continue`. `<const>` makes a local that can't be reassigned, checked when the code compiles. `<close>` calls the value's `__close` metamethod when the variable goes out of scope, even after an error, which suits files and locks."
        ],
        code: lua(
          `local limit <const> = 3
for i = 1, limit do
  if i == 2 then goto continue end
  print("item", i)
  ::continue::
end

do
  local handle <close> = setmetatable({}, {
    __close = function() print("closed") end,
  })
  print("using")
end
print("after")`,
          {
            lua51: "main.lua:1: unexpected symbol near '<'",
            lua54: "item\t1\nitem\t3\nusing\nclosed\nafter"
          }
        )
      },
      {
        heading: "Smaller changes that still bite",
        list: [
          "**`print` no longer calls the global `tostring`** (5.4). Overriding `tostring` doesn't change what `print` shows; use `__tostring`.",
          "**`__lt` no longer stands in for `__le`** (5.4). Define `__le` yourself if you compare with `<=`.",
          "**String-to-number coercion moved into the string library** (5.4). `\"10\" + 1` still works, but through string metamethods, and the result keeps the numeral's type: `\"10\" + 1` is the integer `11`.",
          "**`math.random` uses a new algorithm and a random seed** (5.4), so sequences differ from 5.1 even with the same `math.randomseed`.",
          "**`ipairs` respects `__index`** (5.3), and **`__len` works on tables** (5.2).",
          "**`string.format(\"%d\", x)` needs an integer value** (5.3), so round floats first.",
          "**`os.execute` returns three values** (5.2): success, `\"exit\"` or `\"signal\"`, and the code."
        ]
      },
      {
        heading: "Upgrade checklist",
        list: [
          "Run the code under 5.4 and fix every syntax and \"attempt to call a nil value\" error first; they point at moved functions.",
          "Add `local unpack = table.unpack or unpack`, and replace `loadstring` with `load`.",
          "Replace `setfenv` sandboxes with `load(code, name, \"t\", env)`.",
          "Search for `%d` in format strings and for output compared as text, which `3.0` vs `3` can break.",
          "Check `__le` and `__gc` metamethods, and any code that overrides `tostring` for `print`."
        ]
      },
      {
        heading: "Which version should you use?",
        text: [
          "If your host fixes the version, use that one: LÖVE, Neovim, OpenResty, and Defold use LuaJIT, so 5.1; Roblox uses [Luau](/lua-vs-luau). For a new embedding, 5.4 is the stable choice with the most features and the newest libraries; 5.5 is newer still. Write against 5.1 only when the code must also run under LuaJIT."
        ]
      }
    ],
    faq: [
      ["Is Lua 5.1 code compatible with Lua 5.4?", "Mostly, but not entirely. Code that uses `unpack`, `setfenv`, `loadstring`, `module`, or `table.getn`, or prints numbers that turn into floats, needs changes. The checklist above covers the usual fixes."],
      [
        "Why does LuaJIT still use Lua 5.1?",
        "LuaJIT implements Lua 5.1, plus `goto` and a few other 5.2 additions. Its design predates 5.2's `_ENV` and 5.3's integers, and it never adopted them, so code written for LuaJIT targets 5.1."
      ],
      ["Does Roblox use Lua 5.1?", "Roblox uses Luau, which is derived from Lua 5.1. See [Lua vs Luau](/lua-vs-luau)."],
      ["What is the latest version of Lua?", "Lua 5.5, which adds `global` declarations. Lua 5.4 remains widely used, and Weblua runs 5.1 through 5.5."]
    ],
    related: [
      ["Lua vs Luau", "/lua-vs-luau"],
      ["Lua playground", "/lua"],
      ["Lua metatables by version", "/examples/metatables"],
      ["string.format differences", "/examples/string-format"]
    ],
    sources: [
      ["Lua 5.2 manual, §8: incompatibilities with 5.1", "https://www.lua.org/manual/5.2/manual.html#8"],
      ["Lua 5.3 manual, §8: incompatibilities with 5.2", "https://www.lua.org/manual/5.3/manual.html#8"],
      ["Lua 5.4 manual, §8: incompatibilities with 5.3", "https://www.lua.org/manual/5.4/manual.html#8"]
    ]
  },

  "pattern-tester": {
    slug: "lua-pattern-tester",
    title: "Lua patterns: a cheat sheet with examples",
    metaTitle: "Lua Pattern Tester Online: Test string.match and gsub | Weblua",
    description:
      "Test Lua patterns online with every match highlighted, on Lua 5.1 to 5.5 or Luau, plus a cheat sheet: classes, quantifiers, captures, %b, %f, and gsub.",
    answer:
      "Lua patterns are the matching language of `string.find`, `string.match`, `string.gmatch`, and `string.gsub`. They look like regular expressions but are smaller: `%d` is a digit, `%a` a letter, `.` any character, `+`, `*`, `-`, and `?` repeat the item before them, and parentheses capture. There's no `|` alternation and no `{n,m}` counts.",
    blocks: [
      {
        heading: "How to use the tester",
        list: [
          "Type a pattern and some text. Every match is highlighted the way `string.gmatch` finds it, and the table lists each match's byte positions and captures.",
          "The first match is what `string.find` and `string.match` return. A leading `^` anchors those two to the start, so there's at most one match.",
          "Add a replacement to see what `string.gsub` returns and how many replacements it made. `%1` stands for the first capture and `%0` for the whole match.",
          "Pick a runtime. The pattern runs on the real interpreter, because versions differ at the edges, as the version table below shows.",
          "Every **Try it** link on this page loads its pattern into the tester, so you can change it and watch the matches move."
        ]
      },
      {
        heading: "Character classes",
        text: ["A class matches one character. An uppercase letter means the opposite: `%d` is a digit and `%D` anything but a digit. Classes also work inside a set, as in `[%w_]`."],
        table: {
          head: ["Class", "Matches", "Example"],
          rows: [
            ["`.`", "Any character", tryIt("h.t", "hat hit hot h t")],
            ["`%a`", "A letter", tryIt("%a+", "abc 123 déf")],
            ["`%d`", "A digit, 0 to 9", tryIt("%d+", "order 66 of 100")],
            ["`%l` / `%u`", "A lowercase / uppercase letter", tryIt("%u%l+", "Ada and Grace met Alan")],
            ["`%s`", "Whitespace: space, tab, newline", tryIt("%s+", "a  b\tc")],
            ["`%w`", "A letter or digit", tryIt("%w+", "user_42 is here!")],
            ["`%x`", "A hexadecimal digit", tryIt("#%x+", "color #ff8800 and #FFF")],
            ["`%p`", "Punctuation", tryIt("%p", "Hi! (ok?) yes.")],
            ["`%c`", "A control character", tryIt("%c", "tab\there")],
            ["`%g`", "Any printable character except space (5.2+, Luau)", tryIt("%g+", "two words")],
            ["`[abc]`", "Any one of the characters in the set", tryIt("[aeiou]", "education")],
            ["`[^abc]`", "Any character not in the set", tryIt("[^%s,]+", "red, green ,blue")],
            ["`[a-f]`", "A range", tryIt("[a-f]+", "deadbeef cafe")],
            ["`%.`, `%%`, `%(`", "The character itself: `%` escapes any punctuation", tryIt("%d+%.%d+", "pi is 3.14, not 3")]
          ]
        }
      },
      {
        heading: "Repetition",
        text: [
          "Quantifiers apply to the single class or character right before them, never to a group. `-` is the lazy one: it matches as little as possible, which is what you want for \"everything up to the next X\"."
        ],
        table: {
          head: ["Quantifier", "Means", "Example"],
          rows: [
            ["`+`", "One or more, as many as possible", tryIt("%d+", "a1 b22 c333")],
            ["`*`", "Zero or more, as many as possible", tryIt("ab*", "a ab abbb")],
            ["`-`", "Zero or more, as few as possible", tryIt("<.->", "<b>bold</b>")],
            ["`?`", "Optional: zero or one", tryIt("colou?r", "color colour")]
          ]
        },
        code: lua(
          `local html = "<b>bold</b> and <i>italic</i>"
print(html:match("<(.+)>"))
print(html:match("<(.-)>"))`,
          {
            lua51: "b>bold</b> and <i>italic</i\nb",
            lua54: "b>bold</b> and <i>italic</i\nb",
            luau: "b>bold</b> and <i>italic</i\nb"
          }
        ),
        note: "Greedy `.+` runs to the last `>` in the text, so the first capture swallows both tags. Lazy `.-` stops at the first `>`, so the second capture is just `b`. When a match grabs too much, switch `+` or `*` to `-`."
      },
      {
        heading: "Anchors, captures, and back-references",
        table: {
          head: ["Syntax", "Means", "Example"],
          rows: [
            ["`^`", "At the start of the text (for `find`, `match`, `gsub`)", tryIt("^%s*(.-)%s*$", "   padded   ", "[%1]")],
            ["`$`", "At the end of the text", tryIt("%d+$", "room 101")],
            ["`( )`", "Capture what's inside", tryIt("(%w+)=(%w+)", "a=1, b=2", "%2=%1")],
            ["`()`", "Capture the position, as a number", tryIt("()ll()", "hello")],
            ["`%1` to `%9`", "The same text as an earlier capture", tryIt("([\"'])(.-)%1", "say 'hi' or \"bye\"")]
          ]
        },
        code: lua(
          `print(("  trim me  "):match("^%s*(.-)%s*$"))
print(("key = value"):match("^(%w+)%s*=%s*(%w+)$"))
print(("hello"):find("l+"))
print(("hello"):match("()ll()"))
print(("say 'hi' or \\"bye\\""):match("([\\"'])(.-)%1"))`,
          {
            lua51: "trim me\nkey\tvalue\n3\t4\n3\t5\n'\thi",
            lua54: "trim me\nkey\tvalue\n3\t4\n3\t5\n'\thi",
            luau: "trim me\nkey\tvalue\n3\t4\n3\t5\n'\thi"
          }
        )
      },
      {
        heading: "Balanced matches and frontiers",
        text: [
          "Two items have no regex equivalent. `%bxy` matches from an `x` to its balancing `y`, counting nested pairs, which is perfect for brackets. `%f[set]` is a frontier: it matches the empty spot where the previous character isn't in the set and the next one is, which makes whole-word matching possible."
        ],
        table: {
          head: ["Syntax", "Means", "Example"],
          rows: [
            ["`%b()`", "A balanced pair of parentheses and everything in it", tryIt("%b()", "f(a, g(b, c)) + (d)")],
            ["`%b\"\"`", "A quoted string", tryIt('%b""', 'say "hi" and "bye"')],
            ["`%f[%w]%w+`", "A whole word", tryIt("%f[%a]the%f[%A]", "the theme of the other", "THE")],
            ["`%f[%d]%d+`", "A number that starts at a non-digit", tryIt("%f[%d]%d+", "a1 b22 c333")]
          ]
        },
        code: lua(
          `print(("f(a, g(b, c)) + (d)"):match("%b()"))
print(("the theme of the other"):gsub("%f[%a]the%f[%A]", "THE"))`,
          {
            lua51: "(a, g(b, c))\nTHE theme of THE other\t2",
            lua54: "(a, g(b, c))\nTHE theme of THE other\t2",
            luau: "(a, g(b, c))\nTHE theme of THE other\t2"
          }
        )
      },
      {
        heading: "The four pattern functions",
        table: {
          head: ["Function", "Returns", "Notes"],
          rows: [
            ["`s:find(p, init, plain)`", "Start and end positions, then any captures; or `nil`", "Pass `true` as `plain` to search for text with no pattern rules"],
            ["`s:match(p, init)`", "The captures, or the whole match if there are none; or `nil`", "Only the first match"],
            ["`s:gmatch(p)`", "An iterator over every match", "Use in `for ... in`; a leading `^` is literal here"],
            ["`s:gsub(p, repl, n)`", "The new string and the number of replacements", "`repl` can be a string, a table, or a function; `n` limits the count"]
          ]
        },
        code: lua(
          `local vars = { name = "Ada", lang = "Lua" }
print(("$name writes $lang"):gsub("%$(%w+)", vars))
print(("1 2 3"):gsub("%d", function(d) return d * 2 end))
print(("a,b,c"):gsub(",", ";", 1))`,
          {
            lua51: "Ada writes Lua\t2\n2 4 6\t3\na;b,c\t1",
            lua54: "Ada writes Lua\t2\n2 4 6\t3\na;b,c\t1",
            luau: "Ada writes Lua\t2\n2 4 6\t3\na;b,c\t1"
          }
        )
      },
      {
        heading: "Lua patterns vs regular expressions",
        table: {
          head: ["Regular expression", "Lua pattern", "Notes"],
          rows: [
            ["`\\d`, `\\s`, `\\w`", "`%d`, `%s`, `%w`", "`%w` has no underscore: use `[%w_]`"],
            ["`.*?`", "`.-`", "Lazy repetition"],
            ["`\\b`", "`%f[%w]` and `%f[%W]`", "Frontiers mark word edges"],
            ["`\\1`", "`%1`", "Back-reference"],
            ["`\\.`", "`%.`", "`%` escapes instead of a backslash"],
            ["`(cat|dog)`", "No equivalent", "Try two patterns, or a set when it's single characters"],
            ["`a{2,4}`", "No equivalent", "Spell it out: `aaa?a?`"],
            ["`(ab)+`", "No equivalent", "Quantifiers apply to one character or class"],
            ["Lookahead `(?=...)`", "No equivalent", "Match more and capture the part you need"]
          ]
        }
      },
      {
        heading: "Differences between Lua versions",
        text: [
          "Patterns barely changed across versions, but the edges did, which is why the tester runs on the runtime you pick. The best-known difference is `gmatch` with a pattern that can match nothing: Lua 5.1, 5.2, and Luau report an empty match right after each real match, and 5.3 and later skip it."
        ],
        code: lua(
          `local count = 0
for _ in ("abc d"):gmatch("%a*") do
  count = count + 1
end
print(count)`,
          { lua51: "4", lua54: "2", luau: "4" }
        ),
        list: ["`%g` is new in Lua 5.2, and Luau has it.", "Lua 5.1 needs `%z` to match a zero byte; 5.2 and later accept `\\0` in a pattern.", "`%f` frontiers work in 5.1 but were only documented from 5.2.", "Lua 5.4 added an `init` argument to `gmatch`; Luau doesn't have it."]
      },
      {
        heading: "Pattern recipes",
        table: {
          head: ["Task", "Pattern", "Example"],
          rows: [
            ["Trim spaces", "`^%s*(.-)%s*$`", tryIt("^%s*(.-)%s*$", "   hello world   ", "%1")],
            ["Split on commas", "`[^,]+`", tryIt("[^,]+", "red,green,blue")],
            ["Integers, with a sign", "`[+-]?%d+`", tryIt("[+-]?%d+", "x=-12, y=+7, z=3")],
            ["Decimals", "`%d+%.?%d*`", tryIt("%d+%.?%d*", "3 4.5 10.25")],
            ["File extension", "`%.(%w+)$`", tryIt("%.(%w+)$", "archive.tar.gz")],
            ["key=value pairs", "`(%w+)=(%w+)`", tryIt("(%w+)=(%w+)", "a=1&b=2&c=3")],
            ["Hex colors", "`#%x%x%x%x%x%x`", tryIt("#%x%x%x%x%x%x", "#ff8800 and #00ffcc")],
            ["Words in camelCase", "`%u?%l+`", tryIt("%u?%l+", "parseHttpRequestHeader")],
            ["Text in quotes", "`\"(.-)\"`", tryIt('"(.-)"', 'say "hi" and "bye"')]
          ]
        }
      }
    ],
    faq: [
      [
        "Does Lua support regular expressions?",
        "Not built in. Lua has patterns, which cover most everyday matching in a much smaller implementation but lack alternation, counted repetition, and lookaround. For full regular expressions in Lua, libraries such as LPeg or lrexlib exist; in Roblox there's no regex library."
      ],
      [
        "How do I escape special characters in a Lua pattern?",
        "Put `%` before them: `%.` matches a dot and `%%` a percent sign. To escape a whole string, use `text:gsub(\"%p\", \"%%%0\")`. Or skip patterns entirely with `string.find(text, needle, 1, true)`."
      ],
      ["Why does my pattern match too much?", "`.*` and `.+` are greedy and run to the last possible match. Use `.-` to stop at the first one."],
      ["How do I match a whole word in Lua?", "Use frontiers: `%f[%a]word%f[%A]` matches `word` only where letters don't continue on either side."],
      ["Does Luau use the same patterns as Lua?", "Yes, Luau's patterns follow Lua 5.1's, plus `%g` and frontiers. Luau also has `string.split` for plain-text splitting."]
    ],
    related: [
      ["Split a string in Lua", "/examples/string-split"],
      ["Learn Luau: working with strings", "/learn-luau/strings"],
      ["Lua table to JSON", "/lua-table-to-json"]
    ],
    sources: [
      ["Lua 5.4 Reference Manual, §6.4.1 Patterns", "https://www.lua.org/manual/5.4/manual.html#6.4.1"],
      ["Lua 5.1 Reference Manual, §5.4.1 Patterns", "https://www.lua.org/manual/5.1/manual.html#5.4.1"]
    ]
  },

  "table-to-json": {
    slug: "lua-table-to-json",
    title: "Converting Lua tables to JSON, and back",
    metaTitle: "Lua Table to JSON Converter Online (and JSON to Lua) | Weblua",
    description:
      "Convert a Lua table to JSON or JSON to a Lua table in your browser. How arrays, objects, nil, and numbers map, plus a JSON encoder in plain Lua and Roblox's JSONEncode.",
    answer:
      "Paste a Lua table and the converter evaluates it with Lua 5.4 and writes JSON: a table with keys 1 to n becomes an array, any other table an object with sorted keys, and keys whose value is `nil` disappear. JSON to Lua goes the other way and writes a table constructor you can paste into code. Nothing leaves your browser.",
    blocks: [
      {
        heading: "How Lua values become JSON",
        table: {
          head: ["Lua", "JSON", "Notes"],
          rows: [
            ["`true`, `false`", "`true`, `false`", ""],
            ["`42`, `-7`", "`42`, `-7`", "Integers stay whole"],
            ["`0.1`, `1e300`", "`0.1`, `1e+300`", "The shortest text that reads back as the same float"],
            ["`\"text\"`", "`\"text\"`", "Quotes, backslashes, and control characters are escaped"],
            ["`{ \"a\", \"b\" }`", "`[\"a\", \"b\"]`", "Keys exactly 1 to n make an array"],
            ["`{ x = 1, [5] = 2 }`", "`{\"5\": 2, \"x\": 1}`", "Anything else makes an object; number keys become strings"],
            ["`{}`", "`[]`", "An empty table has no keys to say it's an object"],
            ["`nil`", "Left out", "A table can't hold `nil`, so the key isn't there to convert"],
            ["`0/0`, `math.huge`", "Error", "JSON has no NaN or infinity"],
            ["Functions, coroutines", "Error", "No JSON form"],
            ["A table that contains itself", "Error", "JSON can't represent a cycle"]
          ]
        }
      },
      {
        heading: "Why did my array become an object?",
        text: [
          "JSON has two containers and Lua has one, so the converter decides from the keys. A table is an array only if its keys are exactly `1, 2, …, n`. A hole such as `{ [1] = \"a\", [2] = \"b\", [4] = \"d\" }`, a key `0`, or any string key makes it an object, with the numbers written as strings. That keeps every value; an encoder that guessed \"array\" would have to drop the extra keys or invent `null`s.",
          "Object keys come out sorted, so the same table always gives the same JSON, which keeps diffs and tests stable."
        ]
      },
      {
        heading: "Convert a table to JSON in your own Lua code",
        text: [
          "If you need JSON inside a program, a small encoder is enough for configs and save files. This one runs unchanged on Lua 5.1 to 5.5 and Luau. It treats a table as an array when every key is in `1..#t`, sorts object keys, and escapes strings. For production code with large data, use a library such as lua-cjson, dkjson, or rxi's json.lua."
        ],
        code: lua(
          String.raw`local escapes = { ['"'] = '\\"', ["\\"] = "\\\\", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }

local function quote(text)
  return '"' .. text:gsub('[%c"\\]', function(c)
    return escapes[c] or string.format("\\u%04x", c:byte())
  end) .. '"'
end

local function toJson(value)
  local kind = type(value)
  if kind == "string" then return quote(value) end
  if kind ~= "table" then return tostring(value) end
  local count = 0
  for _ in pairs(value) do count = count + 1 end
  local parts = {}
  if count == #value then
    for i, item in ipairs(value) do parts[i] = toJson(item) end
    return "[" .. table.concat(parts, ",") .. "]"
  end
  local keys = {}
  for key in pairs(value) do keys[#keys + 1] = key end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  for i, key in ipairs(keys) do
    parts[i] = quote(tostring(key)) .. ":" .. toJson(value[key])
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

print(toJson({ name = "Ada", langs = { "lua", "luau" }, admin = true, score = 9.5 }))
print(toJson({ 1, 2, 3 }))
print(toJson({ say = 'He said "hi"\n' }))`,
          {
            lua51: '{"admin":true,"langs":["lua","luau"],"name":"Ada","score":9.5}\n[1,2,3]\n{"say":"He said \\"hi\\"\\n"}',
            lua54: '{"admin":true,"langs":["lua","luau"],"name":"Ada","score":9.5}\n[1,2,3]\n{"say":"He said \\"hi\\"\\n"}',
            luau: '{"admin":true,"langs":["lua","luau"],"name":"Ada","score":9.5}\n[1,2,3]\n{"say":"He said \\"hi\\"\\n"}'
          }
        ),
        note: "This short encoder writes `nan` and `inf` as they print, which isn't valid JSON, and doesn't detect cycles. The converter on this page reports both as errors."
      },
      {
        heading: "JSON to a Lua table",
        text: [
          "Switch the direction with the button above the input and paste JSON. Objects become `key = value` fields, using `[\"key\"]` when a key isn't a valid Lua name or is a keyword such as `end`. Arrays become lists. Strings are escaped so they read back exactly.",
          "JSON `null` becomes `nil`. In an object that's harmless, since the key simply isn't there, but inside an array it leaves a hole: `[1, null, 3]` becomes `{ 1, nil, 3 }`, whose length Lua doesn't guarantee. If nulls matter, replace them with a sentinel value before converting."
        ]
      },
      {
        heading: "JSON in Roblox, Neovim, and other hosts",
        table: {
          head: ["Where", "Encode", "Decode"],
          rows: [
            ["Roblox", "`HttpService:JSONEncode(t)`", "`HttpService:JSONDecode(text)`"],
            ["Neovim", "`vim.json.encode(t)`", "`vim.json.decode(text)`"],
            ["Lune", "`serde.encode(\"json\", t)`", "`serde.decode(\"json\", text)`"],
            ["OpenResty", "`cjson.encode(t)`", "`cjson.decode(text)`"],
            ["Plain Lua or LÖVE", "A library: lua-cjson, dkjson, or json.lua", "The same library"]
          ]
        },
        text: ["Each library makes its own choices about empty tables, `nil` in arrays, and key order, so check its documentation when the exact output matters."]
      }
    ],
    faq: [
      ["How do I convert a Lua table to JSON?", "Paste the table into the converter on this page. In code, use your host's encoder, such as `HttpService:JSONEncode` in Roblox or `vim.json.encode` in Neovim, or the small encoder above."],
      ["Why are the keys in my JSON sorted?", "Lua tables have no key order, so the converter sorts object keys to give the same JSON every time."],
      ["Can the converter read a whole Lua file?", "Yes, if the file returns the table: code such as `local t = {} ... return t` is run, and the returned value is converted. The code runs in Lua 5.4 in your browser, with a five-second limit."],
      ["Is my data uploaded anywhere?", "No. Both directions run entirely in your browser; the Lua side runs in a Web Worker on this page."]
    ],
    related: [
      ["Learn Luau: tables", "/learn-luau/tables"],
      ["Lua pattern tester", "/lua-pattern-tester"],
      ["Online Lua compiler", "/playground"]
    ]
  },

  formatter: {
    slug: "lua-formatter",
    title: "How to format Lua and Luau code online",
    metaTitle: "Lua & Luau Formatter Online (StyLua) | Weblua",
    description:
      "Format Lua 5.1–5.5 and Luau code online with StyLua, in your browser. Paste code, press Format, and copy the result. Free, with no install or account.",
    answer:
      "Paste your code into the editor above and press Format, or Shift+Alt+F. Weblua formats it with StyLua, a widely used opinionated formatter for Lua and Luau, compiled to WebAssembly, so your code never leaves the browser. Pick the runtime first, so StyLua reads the right syntax.",
    blocks: [
      {
        heading: "What the formatter changes",
        text: [
          "StyLua rewrites the layout of your code and nothing else: indentation, spacing, line breaks, and the style of quotes and parentheses. Comments stay where they are. Formatting is a single edit, so Ctrl+Z undoes it, and you can run the code before and after to see that the output is the same."
        ],
        table: {
          head: ["Setting", "Weblua uses", "Effect"],
          rows: [
            ["Indentation", "2 spaces", "Matches the examples on this site"],
            ["Line width", "120 columns", "Longer lines are broken at commas and operators"],
            ["Quotes", "Double, unless that needs more escapes", "`'hi'` becomes `\"hi\"`, but `'say \"hi\"'` stays"],
            ["Call parentheses", "Always", "`print \"x\"` becomes `print(\"x\")`"],
            ["Line endings", "Unix (`\\n`)", "Windows line endings are converted"]
          ]
        }
      },
      {
        heading: "Before and after",
        text: ["Here is a function as it might be pasted in, and below it the same function after Format. Run either one: they print the same thing."],
        code: lua(
          `local function   area( w,h )
if w<=0 or h<=0 then return 0 end
    return w*h end
print( area(3,4),area( -1 , 2 ) )`,
          { lua54: "12\t0" }
        )
      },
      {
        code: lua(
          `local function area(w, h)
  if w <= 0 or h <= 0 then
    return 0
  end
  return w * h
end
print(area(3, 4), area(-1, 2))`,
          { lua54: "12\t0" }
        )
      },
      {
        heading: "Which Lua versions it understands",
        text: [
          "StyLua parses Lua 5.1, 5.2, 5.3, and 5.4, and Luau, including type annotations, compound assignment, and backtick strings. The Runtime menu tells it which: Luau syntax such as `x += 1` doesn't parse as Lua 5.1. Lua 5.5 files are formatted as 5.4, so 5.5-only syntax such as `global` declarations gets a notice instead. If code doesn't parse, you see StyLua's error rather than a silent no-op."
        ]
      },
      {
        heading: "Formatting on your own machine",
        text: [
          "StyLua is a command-line tool too. Install it from its GitHub releases, with Cargo, or as a VS Code extension, and add a `stylua.toml` to your project to pin the settings. To match this page, set `indent_type = \"Spaces\"` and `indent_width = 2`; the other settings above are StyLua's defaults."
        ]
      }
    ],
    faq: [
      ["Does formatting change what my code does?", "No. StyLua only changes whitespace, line breaks, quote style, and call parentheses. Run the code before and after to check."],
      ["Can I change the formatter's settings here?", "Not yet: the page uses the settings in the table above. For other settings, run StyLua locally with a `stylua.toml`."],
      ["Is my code uploaded?", "No. StyLua runs as WebAssembly in your browser. The first Format downloads it, about 0.9 MB compressed."],
      ["Does it format Roblox Luau scripts?", "Yes. Choose Luau under Runtime; types, `continue`, `+=`, and backtick strings are all understood."]
    ],
    related: [
      ["Luau type checker", "/luau-type-checker"],
      ["Online Lua compiler", "/playground"],
      ["Lua playground", "/lua"]
    ],
    sources: [["StyLua on GitHub", "https://github.com/JohnnyMorganz/StyLua"]]
  },

  "type-checker": {
    slug: "luau-type-checker",
    title: "How to check Luau types online",
    metaTitle: "Luau Type Checker Online — Strict Mode in Your Browser | Weblua",
    description:
      "Type-check Luau code online in strict or nonstrict mode. Errors appear as you type, with hover details and types that cross require. Free, no Roblox Studio needed.",
    answer:
      "Paste Luau code into the editor above. Luau's own type checker runs in your browser and underlines errors as you type; hover an underline to read the message, or press Check to list every error and lint in the project. Strict mode is on by default, and `--!strict`, `--!nonstrict`, and `--!nocheck` comments set the mode per file.",
    blocks: [
      {
        heading: "The three checking modes",
        table: {
          head: ["Mode", "Comment", "What it reports"],
          rows: [
            ["Strict", "`--!strict`", "Every type error. Unannotated values are inferred, and anything it can't prove is an error."],
            ["Nonstrict", "`--!nonstrict`", "Only clear errors. Where inference is unsure, it assumes `any`."],
            ["Off", "`--!nocheck`", "No type errors for the file. Lints still run."]
          ]
        },
        text: ["The Types menu in the editor header sets the default for files without a comment. A comment must be the first line of the file to count."]
      },
      {
        heading: "What the checker knows",
        list: [
          "The Luau standard library, with full signatures: `string`, `table`, `math`, `coroutine`, `buffer`, `bit32`, `utf8`, and the rest.",
          "Weblua's additions: the `task` library and the `read` function for preset input.",
          "Every file in the project. `require` resolves the way the runtime does, with `./sibling`, `../parent`, `@self`, and `.luaurc` aliases, and exported types cross files.",
          "Not Roblox's APIs. `game`, `Instance`, `Vector3`, and other engine types are unknown here, so code that uses them reports unknown globals."
        ]
      },
      {
        heading: "A typical error, and its fix",
        text: [
          "This file passes in strict mode. In the editor, change `parseScore(\"12\")` to `parseScore(12)`, or delete the `if score then` check, and the checker underlines the problem before you run anything."
        ],
        code: luau(
          `--!strict
local function parseScore(text: string): number?
  return tonumber(text)
end

local score = parseScore("12")
if score then
  print(score * 2)
end`,
          { luau: "24" }
        )
      },
      {
        heading: "Reading the messages",
        table: {
          head: ["The message says", "It usually means"],
          rows: [
            ["Type X could not be converted into Y", "A value of one type was passed or assigned where another was expected"],
            ["Value of type `T?` could be nil", "Check the value with `if value then`, or give a default with `or`"],
            ["Key not found in table", "A misspelled field, or a field the table's type doesn't declare"],
            ["Argument count mismatch", "Too many or too few arguments for the function's signature"],
            ["Unknown global", "A typo, or a Roblox API that only exists in Studio"]
          ]
        },
        note: "A type error doesn't stop a run. Press Run to see what the code does anyway; the checker and the runtime are separate."
      }
    ],
    faq: [
      ["Is this the same type checker as Roblox Studio?", "It's Luau's open-source checker, the same analysis Studio builds on, compiled to WebAssembly. Studio adds definitions for Roblox's engine APIs, which this page doesn't have."],
      ["Does it support the new type solver?", "The checker here uses Luau's default solver. Switching solvers isn't offered yet."],
      ["Can I check several files at once?", "Yes. Add files with the Files panel and press Check: it checks every Luau file and lists errors with links to the line."],
      ["Do I need an account?", "No. The checker runs in your browser; nothing is uploaded."]
    ],
    related: [
      ["Learn Luau: type annotations", "/learn-luau/types"],
      ["Luau type annotation examples", "/examples/luau-types"],
      ["Lua & Luau formatter", "/lua-formatter"]
    ],
    sources: [["Luau: type checking", "https://luau.org/typecheck"]]
  },

  bytecode: {
    slug: "luau-bytecode-viewer",
    title: "Reading Luau bytecode",
    metaTitle: "Luau Bytecode Viewer — See What the Compiler Emits | Weblua",
    description:
      "View Luau bytecode online. The Luau compiler runs in your browser and lists each instruction under its source line, at optimization levels 0 to 2.",
    answer:
      "Luau compiles source code into bytecode, a compact list of instructions its interpreter runs. The Bytecode tab above shows that list for the open file, with each instruction under the source line it came from, and updates as you type. Optimize sets the level from 0 to 2, and Debug sets how much naming and line information is kept.",
    blocks: [
      {
        heading: "Optimization levels",
        table: {
          head: ["Level", "What the compiler does"],
          rows: [
            ["0", "Translates the code as written, with no optimizations"],
            ["1", "The default for runs: constant folding, cheaper upvalues, and fast calls to built-ins such as `math.floor`"],
            ["2", "Everything at 1, plus inlining small local functions and unrolling short loops with constant bounds"]
          ]
        },
        text: ["A `--!optimize 2` comment at the top of a file sets the level for runs as well as for the listing."]
      },
      {
        heading: "Instructions you'll see often",
        table: {
          head: ["Instruction", "Does"],
          rows: [
            ["`LOADN`, `LOADK`", "Puts a small number or a constant into a register"],
            ["`GETIMPORT`", "Loads a global or library function, resolved once when the script loads"],
            ["`GETTABLEKS`, `SETTABLEKS`", "Reads or writes a table field with a constant name"],
            ["`NAMECALL`", "Looks up a method for a `obj:method()` call"],
            ["`CALL`, `RETURN`", "Calls a function, returns from one"],
            ["`FASTCALL1`, `FASTCALL2`", "Calls a built-in directly, skipping the general call path"],
            ["`ADD`, `ADDK`, `MUL`, …", "Arithmetic; the `K` forms take a constant"],
            ["`FORNPREP`, `FORNLOOP`", "A numeric `for` loop"],
            ["`FORGPREP`, `FORGLOOP`", "A `for ... in` loop"],
            ["`JUMPIF`, `JUMPIFNOT`", "Conditional jumps for `if` and loops"],
            ["`NEWTABLE`, `DUPTABLE`", "Create a table"],
            ["`NEWCLOSURE`, `DUPCLOSURE`, `CAPTURE`", "Create a function and capture its upvalues"]
          ]
        }
      },
      {
        heading: "What to look for",
        list: [
          "**Constant folding**: `60 * 60 * 24` becomes a single `LOADN 86400` at level 1.",
          "**Imports**: `math.max` used directly shows as one `GETIMPORT`, not two table lookups. Using `getfenv` or `setfenv` turns this off.",
          "**Fast calls**: `math.floor(x)` shows a `FASTCALL1` before its `CALL`; `x:floor()`-style method calls don't get one.",
          "**Inlining** at level 2: a small local function's body appears where it's called, with no `CALL`.",
          "**Remarks**: the compiler's notes on what it inlined or unrolled, when Remarks is on."
        ]
      },
      {
        heading: "An example to compile",
        text: ["This is the demo the page opens with. Open the Bytecode tab, then switch Optimize between 0 and 2 and watch the `for` loop and the constant change."],
        code: luau(
          `local function sumSquares(values: { number }): number
  local total = 0
  for _, value in values do
    total += value * value
  end
  return total
end

local seconds = 60 * 60 * 24
print(sumSquares({ 1, 2, 3, 4 }), seconds)`,
          { luau: "30\t86400" }
        )
      }
    ],
    faq: [
      ["Can I download the bytecode?", "Not from this page. The listing is for reading; Luau's command-line compiler, `luau-compile`, writes binary bytecode files."],
      ["Does the bytecode match Roblox's?", "It's the same open-source compiler, so instructions match for the same version and settings. Roblox may compile with different settings and a newer Luau version."],
      ["Why is the first load slow?", "The compiler is about 0.8 MB of WebAssembly, downloaded the first time you open the Bytecode tab and cached after that."]
    ],
    related: [
      ["Luau playground", "/luau"],
      ["Lua vs Luau: performance", "/lua-vs-luau"],
      ["Luau type checker", "/luau-type-checker"]
    ],
    sources: [["Luau: performance", "https://luau.org/performance"]]
  },

  lua: {
    slug: "lua",
    title: "Run Lua online: Lua 5.1 to 5.5 in your browser",
    metaTitle: "Lua Playground — Run Lua 5.1 to 5.5 Online | Weblua",
    description:
      "A free Lua playground: run Lua 5.1, 5.2, 5.3, 5.4, and 5.5 online with the real interpreters, compare versions side by side, and share code as a link.",
    answer:
      "Write Lua in the editor above and press Run, or Ctrl+Enter. The Runtime menu switches between the official Lua 5.1, 5.2, 5.3, 5.4, and 5.5 interpreters, compiled to WebAssembly and running in your browser, so the output is exactly what that version prints. There's no install and no account.",
    blocks: [
      {
        heading: "Pick a Lua version",
        table: {
          head: ["Version", "Released", "Pick it for"],
          rows: [
            ["Lua 5.1", "2006", "Code for LuaJIT, LÖVE, Neovim, Redis, or WoW add-ons"],
            ["Lua 5.2", "2011", "`goto` and `_ENV`; few hosts still pin it"],
            ["Lua 5.3", "2015", "The first version with integers and bitwise operators"],
            ["Lua 5.4", "2020", "The current stable line, and the default here"],
            ["Lua 5.5", "Newest", "`global` declarations and the latest changes"]
          ]
        },
        text: ["To see how two versions differ, turn on Compare: the code runs on both and the outputs sit side by side. [Lua 5.1 vs 5.4](/lua-5-1-vs-5-4) walks through the changes."]
      },
      {
        heading: "What works in the browser",
        list: [
          "The whole standard library that doesn't need an operating system: `string`, `table`, `math`, `coroutine`, `utf8`, `os.time`, `os.clock`, and `os.date`.",
          "`io.read` and `io.lines` read the Input panel, so programs that read from standard input work.",
          "On Lua 5.4, `io.open` reads the project's other files, so data files work.",
          "Projects with several files, joined with `require`.",
          "Each run gets five seconds, or thirty with long runs on, and Stop ends a run at once."
        ]
      },
      {
        heading: "What doesn't",
        list: [
          "C modules and LuaRocks packages: there's no native code in the browser. Pure Lua libraries work if you add them as project files.",
          "Network access and `os.execute`.",
          "LuaJIT itself. Lua 5.1 behaves the same for most code, but LuaJIT's `ffi` and `bit` libraries aren't there."
        ]
      },
      {
        heading: "A first program",
        code: lua(
          `local function greet(name)
  return ("Hello, %s!"):format(name)
end

print(greet("Lua"))

local squares = {}
for i = 1, 5 do
  squares[#squares + 1] = i * i
end
print(table.concat(squares, ", "))`,
          { lua51: "Hello, Lua!\n1, 4, 9, 16, 25", lua54: "Hello, Lua!\n1, 4, 9, 16, 25" }
        )
      },
      {
        heading: "Share and keep your code",
        text: [
          "Copy link puts the whole project in the URL, so whoever opens it sees the same files. Copy embed gives an iframe for a blog or tutorial. Code on this page isn't saved between visits; the [playground](/playground) keeps a draft and named projects in your browser, and works offline once loaded."
        ]
      }
    ],
    faq: [
      ["Is this the real Lua interpreter?", "Yes. Each version is the official Lua source compiled to WebAssembly, not a reimplementation, so error messages and number formatting match the desktop interpreter."],
      ["Which Lua version should I use?", "Use the version your host runs. If nothing decides it, Lua 5.4 is the stable choice; write for 5.1 if the code must also run under LuaJIT."],
      ["Can I use Lua libraries?", "Pure Lua libraries, yes: add them as files and `require` them. Libraries with C code don't run in the browser."],
      ["Does it work offline?", "Yes, after a first visit online: the app and each runtime you've used are cached."]
    ],
    related: [
      ["Online Lua compiler", "/playground"],
      ["Lua 5.1 vs 5.4", "/lua-5-1-vs-5-4"],
      ["Lua examples", "/examples"],
      ["Luau playground", "/luau"]
    ]
  },

  luau: {
    slug: "luau",
    title: "Run Luau online, with type checking",
    metaTitle: "Luau Playground — Run and Type-Check Luau Online | Weblua",
    description:
      "A free Luau playground: run Luau online with type checking as you type, string interpolation, generics, and the task library. No Roblox Studio or install.",
    answer:
      "Write Luau in the editor above and press Run, or Ctrl+Enter. Luau's compiler and type checker run as WebAssembly in your browser, so errors are underlined as you type and nothing is sent to a server. It runs the Luau language, the one Roblox scripts are written in, without the Roblox engine.",
    blocks: [
      {
        heading: "What you can run",
        list: [
          "The whole language: types, generics, `continue`, `+=`, if-expressions, backtick strings, and generalized iteration.",
          "The standard library: `string` (with `split`), `table` (with `find`, `clone`, and `freeze`), `math`, `coroutine`, `buffer`, `bit32`, `utf8`, and `os.clock`, `os.time`, and `os.date`.",
          "The `task` library from Roblox: `spawn`, `defer`, `delay`, `wait`, and `cancel`, with real-time waits.",
          "Projects with several files and modern `require`: `./sibling`, `../parent`, `@self`, and `.luaurc` aliases.",
          "Strict, nonstrict, or no type checking, from the Types menu or a `--!strict` comment."
        ]
      },
      {
        heading: "What isn't here: the Roblox engine",
        text: [
          "Roblox scripts use two things: the Luau language and the Roblox engine's API. This page has the first. Anything that belongs to a place or a game isn't available:"
        ],
        table: {
          head: ["Works here", "Needs Roblox Studio"],
          rows: [
            ["`print`, `warn`, `task.wait`", "`game:GetService`, `workspace`"],
            ["Tables, metatables, classes", "`Instance.new`, parts, and models"],
            ["Types and the checker", "`Vector3`, `CFrame`, `Color3`"],
            ["Coroutines and `task`", "Events such as `Touched`, RemoteEvents"],
            ["`string`, `math`, `table`", "DataStores, `HttpService`, players"]
          ]
        }
      },
      {
        text: ["That makes it a good place to learn the language, test logic, and try out a module, then move the code into Studio. It also works on Chromebooks and school computers, where Studio won't install."]
      },
      {
        heading: "A first program",
        code: luau(
          `local function greet(name: string): string
  return \`Hello, {name}!\`
end

print(greet("Luau"))

local squares: { number } = {}
for i = 1, 5 do
  table.insert(squares, i * i)
end
print(table.concat(squares, ", "))`,
          { luau: "Hello, Luau!\n1, 4, 9, 16, 25" }
        )
      },
      {
        heading: "Where to go next",
        text: [
          "New to the language? The free [Learn Luau course](/learn-luau) teaches it in eight short lessons, with animated walkthroughs and exercises. Coming from Lua? [Lua vs Luau](/lua-vs-luau) lists what's different. Want just the checker? Use the [Luau type checker](/luau-type-checker)."
        ]
      }
    ],
    faq: [
      ["Can I run Roblox scripts here?", "The parts that are plain Luau, yes. Anything that uses the engine, such as `game`, `Instance`, `Vector3`, or events, needs Roblox Studio."],
      ["Is this the official Luau?", "It's the open-source Luau compiler, VM, and type checker compiled to WebAssembly. Weblua adds the `task` library and a `read` function for input."],
      ["Does it work on a Chromebook?", "Yes. It runs in any modern browser, with nothing to install."],
      ["Is my code saved?", "Code on this page isn't. The [playground](/playground) keeps a draft and named projects in your browser, and Copy link shares a project as a URL."]
    ],
    related: [
      ["Learn Luau, free", "/learn-luau"],
      ["Lua vs Luau", "/lua-vs-luau"],
      ["Luau type checker", "/luau-type-checker"],
      ["Luau examples", "/examples"]
    ]
  }
};
