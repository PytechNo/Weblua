import { type ArticlePage, lua, luau } from "./articleTypes";

export const examplePages: ArticlePage[] = [
  {
    slug: "string-split",
    title: "Split a string in Lua",
    metaTitle: "Lua String Split: Examples for Lua 5.1, 5.4, and Luau | Weblua",
    description:
      "How to split a string in Lua with string.gmatch, keeping empty fields, plus Luau's built-in string.split. Runnable examples with output on Lua 5.1, 5.4, and Luau.",
    answer:
      "Lua has no built-in split function. Loop over `string.gmatch` and collect the parts in a table, as below. Luau, the language Roblox uses, has `string.split` built in: `(\"a,b\"):split(\",\")` returns `{ \"a\", \"b\" }`.",
    blocks: [
      {
        heading: "A split function for any Lua version",
        text: [
          "This version keeps empty fields, so `\"a,,b\"` gives three parts, and escapes the separator so characters such as `.` and `%` match literally. It works the same on Lua 5.1 to 5.5 and on Luau.",
          "It appends the separator to the text, then takes everything up to each separator with the lazy pattern `(.-)`."
        ],
        code: lua(
          `local function split(text, separator)
  local parts = {}
  -- %p escapes punctuation, so "." or "%" in the separator match literally.
  local pattern = "(.-)" .. separator:gsub("%p", "%%%0")
  for part in (text .. separator):gmatch(pattern) do
    parts[#parts + 1] = part
  end
  return parts
end

local fields = split("apple,banana,,cherry", ",")
print(#fields)
for index, field in ipairs(fields) do
  print(index, field)
end
print(table.concat(split("1.2.3", "."), " "))`,
          {
            lua51: "4\n1\tapple\n2\tbanana\n3\t\n4\tcherry\n1 2 3",
            lua54: "4\n1\tapple\n2\tbanana\n3\t\n4\tcherry\n1 2 3",
            luau: "4\n1\tapple\n2\tbanana\n3\t\n4\tcherry\n1 2 3"
          }
        )
      },
      {
        heading: "Luau's string.split",
        text: [
          "Luau has `string.split` built in. It splits on a plain string, not a pattern, and also keeps empty fields. Lua 5.1 and 5.4 don't have it, so the same code fails there, which matters if you share code between Roblox and LÖVE or Neovim."
        ],
        code: luau(
          `local fields = string.split("apple,banana,,cherry", ",")
print(#fields, fields[3] == "")
print(table.concat(string.split("1.2.3", "."), " "))`,
          {
            lua51: "main.lua:1: attempt to call field 'split' (a nil value)",
            lua54: "main.lua:1: attempt to call a nil value (field 'split')",
            luau: "4\ttrue\n1 2 3"
          }
        )
      },
      {
        heading: "Split on whitespace",
        text: ["To split into words, match runs of non-space characters with `%S+`. Leading, trailing, and repeated spaces disappear, which is usually what you want for user input."],
        code: lua(
          `local words = {}
for word in ("  the quick   brown fox "):gmatch("%S+") do
  words[#words + 1] = word
end
print(#words, table.concat(words, "|"))`,
          {
            lua51: "4\tthe|quick|brown|fox",
            lua54: "4\tthe|quick|brown|fox",
            luau: "4\tthe|quick|brown|fox"
          }
        )
      },
      {
        heading: "Which way to split",
        table: {
          head: ["You want", "Use", "Keeps empty fields"],
          rows: [
            ["Split on a separator, in Luau or Roblox", "`text:split(\",\")`", "Yes"],
            ["Split on a separator, in any Lua", "The `split` function above", "Yes"],
            ["Split on a single character, quickly", "`text:gmatch(\"[^,]+\")`", "No"],
            ["Words separated by any amount of space", "`text:gmatch(\"%S+\")`", "No"],
            ["Lines of text", "`text:gmatch(\"[^\\n]+\")`", "No"]
          ]
        },
        text: ["To try a pattern on your own text first, paste it into the [Lua pattern tester](/lua-pattern-tester#p=%5B%5E%2C%5D%2B&s=apple%2Cbanana%2C%2Ccherry), which highlights every match."]
      },
      {
        heading: "Common mistakes",
        list: [
          "Using `gmatch(\"[^,]+\")` when empty fields matter. It's short, but `\"a,,b\"` gives two parts, not three, so columns in CSV-like data shift.",
          "Passing a separator such as `.` straight into a pattern. `.` matches any character, so every character becomes a separator. Escape it with `%`, as the function above does.",
          "Calling `string.split` in Lua 5.x, LÖVE, or Neovim. It exists only in Luau.",
          "Expecting `string.split` in Luau to accept a pattern. It splits on plain text; `(\"a1b2c\"):split(\"%d\")` looks for the two characters `%d`."
        ]
      }
    ],
    faq: [
      ["Does Lua have a split function?", "No. Lua 5.1 through 5.5 have no `string.split`, so you write one with `string.gmatch`, as above. Luau, which Roblox uses, has `string.split` built in."],
      ["How do I split a string by spaces in Lua?", "`for word in text:gmatch(\"%S+\") do ... end` visits each run of non-space characters, so repeated spaces don't produce empty parts."],
      [
        "How do I split a string into characters in Lua?",
        "`for char in text:gmatch(\".\") do` visits each byte, which is a character for plain ASCII text. For UTF-8 text, loop with `utf8.codes` (Lua 5.3 and later, and Luau) so multi-byte characters stay whole."
      ]
    ],
    related: [
      ["Lua pattern tester", "/lua-pattern-tester"],
      ["Learn Luau: working with strings", "/learn-luau/strings"],
      ["Format strings with string.format", "/examples/string-format"]
    ]
  },
  {
    slug: "string-format",
    title: "Format strings in Lua with string.format",
    metaTitle: "Lua string.format Examples: %d, %s, %q, Padding | Weblua",
    description:
      "string.format in Lua: padding, decimals, hex, %q, and where Lua 5.1, 5.4, and Luau disagree on %d and %s. Every example runs in your browser.",
    answer:
      "`string.format(template, ...)` fills a template like C's `printf`: `%d` for a whole number, `%.2f` for two decimals, `%s` for a string, `%x` for hex, and `%q` for a quoted Lua string. A width such as `%5d` pads on the left, `%-5d` on the right, and `%05d` with zeros.",
    blocks: [
      {
        heading: "The basics",
        text: [
          "`string.format` takes a template and values. Each `%` specifier in the template consumes the next value. A number before the letter sets a minimum width, and `-` pads on the right instead of the left. `%%` prints a percent sign.",
          "`%q` writes a string as Lua source, with quotes and escapes, which is handy for generating code. `(\"%s\"):format(x)` is the same call with method syntax."
        ],
        code: lua(
          `print(string.format("%-6s|%6.2f|%03d", "pi", math.pi, 7))
print(string.format("%x %X %o", 255, 255, 8))
print(string.format("%5s|%-5s|", "ab", "ab"))
print(("%s has %d items"):format("cart", 3))
print(string.format("%5.1f%%", 99.44))
print(string.format("%q", 'say "hi"'))`,
          {
            lua51: "pi    |  3.14|007\nff FF 10\n   ab|ab   |\ncart has 3 items\n 99.4%\n\"say \\\"hi\\\"\"",
            lua54: "pi    |  3.14|007\nff FF 10\n   ab|ab   |\ncart has 3 items\n 99.4%\n\"say \\\"hi\\\"\"",
            luau: "pi    |  3.14|007\nff FF 10\n   ab|ab   |\ncart has 3 items\n 99.4%\n\"say \\\"hi\\\"\""
          }
        )
      },
      {
        heading: "Format specifiers",
        table: {
          head: ["Specifier", "Formats", "Example", "Result"],
          rows: [
            ["`%d`", "A whole number", "`(\"%d\"):format(42)`", "`42`"],
            ["`%5d` / `%-5d` / `%05d`", "Padded left, right, or with zeros", "`(\"%05d\"):format(42)`", "`00042`"],
            ["`%f` / `%.2f`", "A decimal, default 6 places", "`(\"%.2f\"):format(3.14159)`", "`3.14`"],
            ["`%e` / `%g`", "Scientific, or the shorter of `%e` and `%f`", "`(\"%g\"):format(0.0001)`", "`0.0001`"],
            ["`%x` / `%X` / `%o`", "Hexadecimal or octal", "`(\"%x\"):format(255)`", "`ff`"],
            ["`%s`", "A string", "`(\"[%s]\"):format(\"hi\")`", "`[hi]`"],
            ["`%q`", "A string as quoted Lua source", "`(\"%q\"):format('a\"b')`", "`\"a\\\"b\"`"],
            ["`%c`", "A character from its byte code", "`(\"%c\"):format(65)`", "`A`"],
            ["`%+d` / `% d`", "Always show a sign, or a space for positives", "`(\"%+d\"):format(5)`", "`+5`"],
            ["`%%`", "A literal percent sign", "`(\"%d%%\"):format(50)`", "`50%`"]
          ]
        }
      },
      {
        heading: "%d and fractions",
        text: [
          "`%d` wants a whole number. Lua 5.1 and Luau drop the fraction of `3.7`; Lua 5.3 and later raise an error instead, so round first with `math.floor` when the value might have one."
        ],
        code: lua(
          `print(pcall(string.format, "%d", 3.0))
print(pcall(string.format, "%d", 3.7))
print(string.format("%d", math.floor(3.7)))`,
          {
            lua51: "true\t3\ntrue\t3\n3",
            lua54: "true\t3\nfalse\tbad argument #2 to 'string.format' (number has no integer representation)\n3",
            luau: "true\t3\ntrue\t3\n3"
          }
        )
      },
      {
        heading: "%s and __tostring",
        text: [
          "Since Lua 5.2, `%s` converts any value with `tostring`, so a table's `__tostring` metamethod is used. Lua 5.1 and Luau accept only strings and numbers there, so call `tostring` yourself when your code has to run on both."
        ],
        code: lua(
          `local point = setmetatable({ x = 1, y = 2 }, {
  __tostring = function(p) return "(" .. p.x .. ", " .. p.y .. ")" end,
})
print(pcall(string.format, "point %s", point))`,
          {
            lua51: "false\tbad argument #2 to '?' (string expected, got table)",
            lua54: "true\tpoint (1, 2)",
            luau: "false\tinvalid argument #2 to 'format' (string expected, got table)"
          }
        )
      },
      {
        heading: "Rounding to decimal places",
        text: [
          "`%.2f` rounds for display and returns a string. To get a rounded number back, multiply, round, and divide. Flags combine: `%05.1f` is five characters wide, zero-padded, with one decimal."
        ],
        code: lua(
          `local x = 3.14159
print(string.format("%.2f", x))
print(math.floor(x * 100 + 0.5) / 100)
print(string.format("%05.1f|%+d|% d", x, 5, 5))`,
          {
            lua51: "3.14\n3.14\n003.1|+5| 5",
            lua54: "3.14\n3.14\n003.1|+5| 5",
            luau: "3.14\n3.14\n003.1|+5| 5"
          }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Passing a float with a fraction to `%d` on Lua 5.3 or later, which errors. Round it with `math.floor` first.",
          "Passing a table to `%s` on Lua 5.1 or Luau, which errors. Wrap it in `tostring`.",
          "Passing fewer values than specifiers: `(\"%s %s\"):format(\"a\")` errors with \"bad argument #3\".",
          "Using `%` for a literal percent sign. Write `%%`."
        ]
      }
    ],
    faq: [
      ["How do I round a number to 2 decimal places in Lua?", "For display, `string.format(\"%.2f\", x)`. For a number, `math.floor(x * 100 + 0.5) / 100`."],
      ["How do I add leading zeros in Lua?", "Use a zero-padded width: `string.format(\"%03d\", 7)` gives `\"007\"`."],
      [
        "Does Luau have string interpolation instead of string.format?",
        "Yes. Luau's backtick strings put values straight into text; see [string interpolation](/examples/string-interpolation). `string.format` is still the tool for widths and decimals."
      ]
    ],
    related: [
      ["String interpolation in Lua and Luau", "/examples/string-interpolation"],
      ["Learn Luau: working with strings", "/learn-luau/strings"],
      ["Lua 5.1 vs 5.4", "/lua-5-1-vs-5-4"]
    ]
  },
  {
    slug: "string-interpolation",
    title: "String interpolation in Lua and Luau",
    metaTitle: "Lua String Interpolation vs Luau Backtick Strings | Weblua",
    description:
      "Lua has no string interpolation: use .. or string.format. Luau has backtick strings with {expressions}. Runnable examples with output on Lua 5.1, 5.4, and Luau.",
    answer:
      "Standard Lua has no string interpolation: join values with `..` or fill a template with `string.format`. Luau, the language Roblox uses, has it built in: in a string written with backticks, each `{expression}` is replaced by the expression's value.",
    blocks: [
      {
        heading: "In Lua: .. and string.format",
        text: [
          "Lua builds strings with the `..` operator, which converts numbers but not booleans or `nil`, or with `string.format`. Wrap other values in `tostring` first."
        ],
        code: lua(
          `local name, score = "Ada", 42
print("Hello, " .. name .. "! Your score is " .. score .. ".")
print(string.format("Hello, %s! Your score is %d.", name, score))
print(pcall(function() return "flag: " .. true end))
print("flag: " .. tostring(true))`,
          {
            lua51: "Hello, Ada! Your score is 42.\nHello, Ada! Your score is 42.\nfalse\tmain.lua:4: attempt to concatenate a boolean value\nflag: true",
            lua54: "Hello, Ada! Your score is 42.\nHello, Ada! Your score is 42.\nfalse\tmain.lua:4: attempt to concatenate a boolean value\nflag: true",
            luau: "Hello, Ada! Your score is 42.\nHello, Ada! Your score is 42.\nfalse\tmain.luau:4: attempt to concatenate string with boolean\nflag: true"
          }
        )
      },
      {
        heading: "In Luau: backtick strings",
        text: [
          "Luau strings in backticks can hold expressions in braces. Each value goes through `tostring`, so booleans work. A literal brace needs a backslash. Lua 5.1 and 5.4 reject the syntax outright, so this only runs on Luau."
        ],
        code: luau(
          `local name, score = "Ada", 42
print(\`Hello, {name}! Your score is {score}.\`)
print(\`{score} doubled is {score * 2}, and the flag is {true}\`)
print(\`Braces need a backslash: \\{name}\`)`,
          {
            lua51: "main.lua:2: unexpected symbol near '`'",
            lua54: "main.lua:2: unexpected symbol near '`'",
            luau: "Hello, Ada! Your score is 42.\n42 doubled is 84, and the flag is true\nBraces need a backslash: {name}"
          }
        )
      },
      {
        heading: "Formatting values inside backtick strings",
        text: [
          "The braces hold any expression, including function calls and table fields, so you can format a number in place. Each value is converted with `tostring`, which prints numbers in their shortest form; for a fixed number of decimals, call `string.format` inside the braces."
        ],
        code: luau(
          `local price, items = 4.5, 3
print(\`Total: {string.format("%.2f", price * items)}\`)
print(\`Items: {items}, each {price}\`)
local player = { name = "Ada", level = 7 }
print(\`{player.name} (level {player.level})\`)`,
          { luau: "Total: 13.50\nItems: 3, each 4.5\nAda (level 7)" }
        )
      },
      {
        heading: "A template function for plain Lua",
        text: [
          "If you want named placeholders in standard Lua, a few lines of `gsub` do it. This one replaces `${name}` with the value under that key, and runs on every version."
        ],
        code: lua(
          `local function interpolate(template, values)
  return (template:gsub("%\${(%w+)}", function(key)
    return tostring(values[key])
  end))
end

print(interpolate("\${name} scored \${score} points", { name = "Ada", score = 42 }))`,
          {
            lua51: "Ada scored 42 points",
            lua54: "Ada scored 42 points",
            luau: "Ada scored 42 points"
          }
        )
      },
      {
        heading: "Which to use",
        table: {
          head: ["Approach", "Works in", "Good for"],
          rows: [
            ["`..` concatenation", "All Lua and Luau", "Joining two or three pieces"],
            ["`string.format`", "All Lua and Luau", "Widths, decimals, and padding"],
            ["Backtick strings", "Luau only", "Readable messages with several values"],
            ["A `gsub` template", "All Lua and Luau", "Templates stored as data, such as translations"]
          ]
        }
      },
      {
        heading: "Common mistakes",
        list: [
          "Using backticks in code that also runs on standard Lua. The whole file fails to load, not just the line.",
          "Writing `${name}` inside a Luau backtick string. Luau uses `{name}` with no dollar sign; `$` is printed as is.",
          "Joining `nil` with `..`. The error names the operation, not the variable, so check values that might be missing.",
          "Building a long string with `..` in a loop. Collect pieces in a table and call `table.concat` once."
        ]
      }
    ],
    faq: [
      ["Does Lua have f-strings or template literals?", "No. Lua 5.1 through 5.5 have only `..` and `string.format`. Luau added backtick strings in 2022, and they work in Roblox."],
      ["Can I use string interpolation in Roblox?", "Yes. Roblox runs Luau, so backtick strings with `{player.Name}` inside them work in any script."],
      ["How do I put a literal brace in a Luau backtick string?", "Escape it with a backslash: `\\{` prints `{`."]
    ],
    related: [
      ["string.format examples", "/examples/string-format"],
      ["Lua vs Luau", "/lua-vs-luau"],
      ["Learn Luau: values and variables", "/learn-luau/values-and-variables"]
    ]
  },
  {
    slug: "metatables",
    title: "Lua metatables and __index",
    metaTitle: "Lua Metatables and __index Explained, with Examples | Weblua",
    description:
      "What metatables do in Lua: __index for classes and defaults, __add, __eq, __tostring, __newindex, and which metamethods Lua 5.1, 5.4, and Luau support. Runnable examples.",
    answer:
      "A metatable is a table that changes how another table behaves. `setmetatable(t, mt)` attaches it. When a key is missing from `t`, Lua looks at `mt.__index`; when you use `+` on `t`, Lua calls `mt.__add`. Pointing `__index` at a table of functions is how Lua does classes.",
    blocks: [
      {
        heading: "A vector class",
        text: [
          "When a key is missing, Lua looks in the metatable's `__index`; when you use `+`, it calls `__add`. Pointing `__index` at a table of functions is how Lua does classes: `Vector` holds the methods, and each vector's metatable is `Vector`.",
          "Note the length: `math.sqrt` returns a float, which Lua 5.3 and later print as `5.0`."
        ],
        code: lua(
          `local Vector = {}
Vector.__index = Vector

function Vector.new(x, y)
  return setmetatable({ x = x, y = y }, Vector)
end

function Vector:length()
  return math.sqrt(self.x * self.x + self.y * self.y)
end

Vector.__add = function(a, b)
  return Vector.new(a.x + b.x, a.y + b.y)
end

Vector.__eq = function(a, b)
  return a.x == b.x and a.y == b.y
end

Vector.__tostring = function(v)
  return "(" .. v.x .. ", " .. v.y .. ")"
end

local sum = Vector.new(1, 2) + Vector.new(2, 2)
print(tostring(sum), sum:length())
print(sum == Vector.new(3, 4), rawequal(sum, Vector.new(3, 4)))
print(getmetatable(sum) == Vector)`,
          {
            lua51: "(3, 4)\t5\ntrue\tfalse\ntrue",
            lua54: "(3, 4)\t5.0\ntrue\tfalse\ntrue",
            luau: "(3, 4)\t5\ntrue\tfalse\ntrue"
          }
        )
      },
      {
        heading: "Defaults and read-only tables",
        text: [
          "`__index` can also be a function, called with the table and the missing key, which suits defaults. `__newindex` runs when a key that isn't there yet is assigned, so it can refuse."
        ],
        code: lua(
          `local defaults = { color = "red", size = 10 }
local settings = setmetatable({ size = 12 }, {
  __index = function(_, key)
    return defaults[key]
  end,
})
print(settings.size, settings.color, settings.missing)

local frozen = setmetatable({}, {
  __index = { answer = 42 },
  __newindex = function(_, key)
    error("cannot set " .. tostring(key), 2)
  end,
})
print(frozen.answer, pcall(function() frozen.answer = 1 end))`,
          {
            lua51: "12\tred\tnil\n42\tfalse\tmain.lua:15: cannot set answer",
            lua54: "12\tred\tnil\n42\tfalse\tmain.lua:15: cannot set answer",
            luau: "12\tred\tnil\n42\tfalse\tmain.luau:15: cannot set answer"
          }
        )
      },
      {
        heading: "__len differs between versions",
        text: [
          "Lua 5.1 ignores `__len` on tables, so `#` always counts the array part. Lua 5.2 and later, and Luau, call it. Code that relies on a custom length works on 5.4 and Roblox but not on LuaJIT or LÖVE."
        ],
        code: lua(
          `local list = setmetatable({}, {
  __len = function()
    return 42
  end,
})
print(#list)`,
          { lua51: "0", lua54: "42", luau: "42" }
        )
      },
      {
        heading: "Metamethods by version",
        table: {
          head: ["Metamethod", "Runs for", "Lua 5.1", "Lua 5.4", "Luau"],
          rows: [
            ["`__index`", "Reading a missing key", "Yes", "Yes", "Yes"],
            ["`__newindex`", "Assigning a missing key", "Yes", "Yes", "Yes"],
            ["`__call`", "Calling the table like a function", "Yes", "Yes", "Yes"],
            ["`__tostring`", "`tostring` and `print`", "Yes", "Yes", "Yes"],
            ["`__add`, `__sub`, `__mul`, `__div`, `__mod`, `__pow`, `__unm`", "Arithmetic", "Yes", "Yes", "Yes"],
            ["`__idiv`", "Floor division `//`", "No", "Yes", "Yes"],
            ["`__band`, `__bor`, `__shl`, and the rest", "Bitwise operators", "No", "Yes", "No"],
            ["`__eq`, `__lt`, `__le`", "Comparisons", "Yes", "Yes", "Yes"],
            ["`__concat`", "`..`", "Yes", "Yes", "Yes"],
            ["`__len`", "`#` on a table", "No", "Yes", "Yes"],
            ["`__pairs`", "`pairs(t)`", "No", "Yes", "No"],
            ["`__iter`", "`for k, v in t do`", "No", "No", "Yes"],
            ["`__gc`", "Garbage collection of a table", "No", "Yes", "No"],
            ["`__close`", "Leaving a `<close>` variable's scope", "No", "Yes", "No"],
            ["`__mode`", "Weak keys or values", "Yes", "Yes", "Yes"],
            ["`__metatable`", "Hiding or locking the metatable", "Yes", "Yes", "Yes"]
          ]
        },
        text: ["The Luau column follows the [Luau compatibility notes](https://luau.org/compatibility); the `__len` example above runs on all three."]
      },
      {
        heading: "Common mistakes",
        list: [
          "Forgetting `Class.__index = Class`. Objects then can't find their methods: \"attempt to call a nil value (method 'length')\".",
          "Expecting `__newindex` to run for keys that already exist. It only runs for missing keys; to watch every write, keep the data in a separate table.",
          "Calling `rawequal` or `rawget` by habit: they skip metamethods, which is the point when you need it and a bug when you don't.",
          "Expecting `__gc` or `__close` in Luau, or `__len` on LuaJIT. Check the table above."
        ]
      }
    ],
    faq: [
      [
        "What is the difference between __index and __newindex?",
        "`__index` runs when you read a key that isn't in the table; `__newindex` runs when you assign to a key that isn't in the table. Neither runs for keys that already exist."
      ],
      ["What do rawget and rawset do?", "They read and write a table directly, skipping `__index` and `__newindex`. A `__newindex` handler usually calls `rawset` to actually store the value."],
      ["Can a metatable's __index be a function?", "Yes. It's called with the table and the missing key, and whatever it returns is the value. That's how computed defaults and proxies work."]
    ],
    related: [
      ["Learn Luau: metatables and classes", "/learn-luau/metatables-and-classes"],
      ["Object-oriented programming in Luau", "/examples/luau-oop"],
      ["Lua vs Luau", "/lua-vs-luau"]
    ],
    sources: [
      ["Lua 5.4 Reference Manual, §2.4 Metatables and Metamethods", "https://www.lua.org/manual/5.4/manual.html#2.4"],
      ["Luau compatibility with Lua 5.2, 5.3, and 5.4", "https://luau.org/compatibility"]
    ]
  },
  {
    slug: "luau-oop",
    title: "Object-oriented programming in Luau",
    metaTitle: "Luau OOP: Classes, Methods, and Inheritance with Types | Weblua",
    description:
      "Write classes in Luau with metatables, typed with typeof and setmetatable, plus inheritance. Strict-mode examples you can run and type-check in your browser.",
    answer:
      "Luau has no `class` keyword. A class is a table of methods that is also its objects' metatable, with `Class.__index = Class`. To type it, describe the object's fields in a `type`, then let `typeof(setmetatable({} :: Fields, Class))` combine the fields with the methods.",
    blocks: [
      {
        heading: "A typed class",
        text: [
          "Luau has no class keyword. A class is a table of methods used as a metatable, as in Lua. To type it, describe the instance's fields, then let `typeof(setmetatable(...))` combine them with the methods.",
          "This example type-checks in strict mode: open it in the playground and try calling `account:deposit(\"ten\")`."
        ],
        code: luau(
          `--!strict
local Account = {}
Account.__index = Account

type AccountData = { owner: string, balance: number }
type Account = typeof(setmetatable({} :: AccountData, Account))

function Account.new(owner: string, balance: number?): Account
  return setmetatable({ owner = owner, balance = balance or 0 }, Account)
end

function Account.deposit(self: Account, amount: number)
  assert(amount > 0, "deposit must be positive")
  self.balance += amount
end

function Account.withdraw(self: Account, amount: number): boolean
  if amount > self.balance then
    return false
  end
  self.balance -= amount
  return true
end

local account = Account.new("Ada")
account:deposit(100)
print(account:withdraw(30), account.balance)
print(account:withdraw(500), account.balance)`,
          {
            luau: "true\t70\nfalse\t70"
          }
        )
      },
      {
        heading: "Inheritance",
        text: [
          "A subclass is a class whose own metatable's `__index` is the parent, so lookups fall through: instance, then `Dog`, then `Animal`. A method defined on `Dog` overrides the parent's. The [metatables lesson](/learn-luau/metatables-and-classes) animates this lookup step by step."
        ],
        code: luau(
          `local Animal = {}
Animal.__index = Animal

function Animal.new(name: string)
  return setmetatable({ name = name }, Animal)
end

function Animal.speak(self): string
  return \`{self.name} makes a sound\`
end

function Animal.describe(self): string
  return \`I am {self.name}\`
end

local Dog = setmetatable({}, { __index = Animal })
Dog.__index = Dog

function Dog.new(name: string)
  return setmetatable({ name = name }, Dog)
end

function Dog.speak(self): string
  return \`{self.name} barks\`
end

local generic, rex = Animal.new("Generic"), Dog.new("Rex")
print(generic:speak(), "/", generic:describe())
print(rex:speak(), "/", rex:describe())`,
          {
            luau: "Generic makes a sound\t/\tI am Generic\nRex barks\t/\tI am Rex"
          }
        )
      },
      {
        heading: "Calling the parent's method",
        text: [
          "An overriding method can still call the version it replaced, by naming the parent class and passing `self` along. Here `Dog.describe` extends `Animal.describe` instead of repeating it."
        ],
        code: luau(
          `local Animal = {}
Animal.__index = Animal

function Animal.new(name: string)
  return setmetatable({ name = name }, Animal)
end

function Animal.describe(self): string
  return \`I am {self.name}\`
end

local Dog = setmetatable({}, { __index = Animal })
Dog.__index = Dog

function Dog.new(name: string)
  return setmetatable({ name = name }, Dog)
end

function Dog.describe(self): string
  return Animal.describe(self) .. ", a dog"
end

print(Dog.new("Rex"):describe())`,
          { luau: "I am Rex, a dog" }
        )
      },
      {
        heading: "The pieces of a Luau class",
        table: {
          head: ["Piece", "Code", "Why"],
          rows: [
            ["Method table", "`local Account = {}`", "Holds the methods every object shares"],
            ["Fallback", "`Account.__index = Account`", "Missing keys on an object are looked up in the class"],
            ["Constructor", "`setmetatable({ ... }, Account)`", "Makes the object and links it to the class"],
            ["Method", "`function Account.deposit(self, amount)`", "Called as `account:deposit(10)`, which passes the object as `self`"],
            ["Type", "`typeof(setmetatable({} :: Data, Account))`", "Gives the checker the fields and the methods together"]
          ]
        }
      },
      {
        heading: "Common mistakes",
        list: [
          "Calling a method with a dot, `account.deposit(10)`, which passes `10` as `self`. Use a colon.",
          "Annotating `self` as the data type alone. Methods called on `self` then don't type-check; use the `typeof(setmetatable(...))` type.",
          "Putting per-object fields on the class table. They're shared by every object.",
          "Forgetting `Dog.__index = Dog` in a subclass, so `Dog`'s own methods are never found."
        ]
      }
    ],
    faq: [
      ["Does Luau have classes?", "Not as a keyword. Classes are built from metatables, as on this page, which is the standard pattern in Roblox code."],
      [
        "What does typeof(setmetatable(...)) do in Luau?",
        "`typeof` turns an expression into a type without running it. `setmetatable({} :: AccountData, Account)` describes a table with the data fields and the class as its metatable, so the resulting type has both the fields and the methods."
      ],
      ["How do I make a private field in Luau?", "There's no access control. Code usually marks private fields with a leading underscore, or keeps private state in a closure or a separate table keyed by the object."]
    ],
    related: [
      ["Learn Luau: metatables and classes", "/learn-luau/metatables-and-classes"],
      ["Lua metatables and __index", "/examples/metatables"],
      ["Luau type checker", "/luau-type-checker"]
    ]
  },
  {
    slug: "luau-types",
    title: "Luau type annotations",
    metaTitle: "Luau Types: Annotations, Optionals, Generics, Unions | Weblua",
    description:
      "Luau type annotations by example: typed functions, optional types, generics, tagged unions with narrowing, and a syntax cheat sheet, checked in strict mode as you type.",
    answer:
      "Luau type annotations go after a colon: `name: string` for a parameter or variable, `): number` for a return value. `number?` means a number or `nil`, `{ string }` an array of strings, `A | B` either type, and `<T>` makes a function generic. Add `--!strict` to check every line.",
    blocks: [
      {
        heading: "Annotations, optionals, and generics",
        text: [
          "Annotations go after a colon: `name: string` for a parameter, `): number` for a return value. `number?` means a number or `nil`, and `<T>` makes a function generic. The checker reads them before the code runs; the program runs the same with or without them.",
          "Uncomment the last line in the playground and the checker underlines it: `{ x = 0 }` is missing `y`."
        ],
        code: luau(
          `--!strict
type Point = { x: number, y: number }

local function distance(a: Point, b: Point): number
  local dx, dy = a.x - b.x, a.y - b.y
  return math.sqrt(dx * dx + dy * dy)
end

local function indexOf(names: { string }, target: string): number?
  for index, name in names do
    if name == target then
      return index
    end
  end
  return nil
end

local function first<T>(items: { T }): T?
  return items[1]
end

print(distance({ x = 0, y = 0 }, { x = 3, y = 4 }))
print(indexOf({ "ada", "grace" }, "grace"), indexOf({}, "alan"))
print(first({ "a", "b" }), first({ 10, 20 }))
-- distance({ x = 0 }, { x = 1, y = 1 })`,
          {
            luau: "5\n2\tnil\na\t10"
          }
        )
      },
      {
        heading: "Unions and narrowing",
        text: [
          "A union type is one of several shapes. Give each shape a field with a literal type, such as `kind: \"circle\"`, and an `if` on that field tells the checker which shape it has in each branch."
        ],
        code: luau(
          `--!strict
type Shape = { kind: "circle", radius: number } | { kind: "square", side: number }

local function area(shape: Shape): number
  if shape.kind == "circle" then
    return math.pi * shape.radius ^ 2
  else
    return shape.side * shape.side
  end
end

print(area({ kind = "square", side = 3 }))
print(string.format("%.2f", area({ kind = "circle", radius = 1 })))`,
          {
            luau: "9\n3.14"
          }
        )
      },
      {
        heading: "Luau type syntax cheat sheet",
        table: {
          head: ["Syntax", "Means", "Example"],
          rows: [
            ["`x: T`", "A variable or parameter of type `T`", "`local n: number = 0`"],
            ["`(...): T`", "A function's return type", "`function f(): string`"],
            ["`T?`", "`T` or `nil`", "`local name: string? = nil`"],
            ["`{ T }`", "An array of `T`", "`{ number }`"],
            ["`{ [K]: V }`", "A dictionary from `K` to `V`", "`{ [string]: boolean }`"],
            ["`{ a: T, b: U }`", "A table with those fields", "`{ x: number, y: number }`"],
            ["`(A, B) -> R`", "A function type", "`(number) -> string`"],
            ["`A | B`", "Either type, a union", "`string | number`"],
            ["`A & B`", "Both types, an intersection", "`Named & Aged`"],
            ["`\"literal\"`", "Exactly that string or boolean", "`\"circle\"`"],
            ["`<T>`", "A type parameter, for generics", "`function first<T>(xs: { T }): T?`"],
            ["`typeof(expr)`", "The type of an expression", "`typeof(setmetatable(...))`"],
            ["`expr :: T`", "A cast: treat the value as `T`", "`{} :: { number }`"],
            ["`any`, `unknown`, `never`", "Anything unchecked, anything that must be checked, nothing", "`local x: unknown = input`"]
          ]
        }
      },
      {
        heading: "Common mistakes",
        list: [
          "Expecting annotations to convert values. `local n: number = \"5\"` is a type error, not a conversion; use `tonumber`.",
          "Using a `T?` value directly. Check it with `if value then` first, and the checker narrows it to `T`.",
          "Writing `--!strict` anywhere but the top of the file. Mode comments must come before any code.",
          "Reaching for `any` to silence an error. `unknown` is safer: it forces a check before use."
        ]
      }
    ],
    faq: [
      ["Are Luau type annotations required?", "No. Typing is gradual: unannotated code still runs and is still checked as far as inference can go. Add annotations to function signatures first; that's where they catch the most."],
      ["What is the difference between any and unknown in Luau?", "`any` turns checking off for that value. `unknown` accepts any value too, but you must check what it is, with `type(x) == \"string\"` for example, before using it."],
      ["Do Luau types work in Roblox Studio?", "Yes. Studio uses the same checker; put `--!strict` at the top of a script to turn on strict mode."]
    ],
    related: [
      ["Luau type checker", "/luau-type-checker"],
      ["Learn Luau: type annotations", "/learn-luau/types"],
      ["Object-oriented programming in Luau", "/examples/luau-oop"]
    ],
    sources: [["Luau type checking documentation", "https://luau.org/typecheck"]]
  }
];
