import type { ArticleSection } from "./routes";
import type { PlaygroundExample, RuntimeFlavor } from "./types";

/** The runtimes an example page shows output for. */
export type ShownFlavor = "lua51" | "lua54" | "luau";

export interface CodeBlock {
  code: string;
  /** The runtime the playground opens it on. */
  flavor: RuntimeFlavor;
  /**
   * What each runtime prints, as the page shows it. Pinned by
   * articles.execution.test.ts, which runs every block.
   */
  outputs: Partial<Record<ShownFlavor, string>>;
}

/** Prose paragraphs, where `backticks` mark inline code, then an optional runnable block. */
export interface ArticleBlock {
  heading?: string;
  text: string[];
  code?: CodeBlock;
}

export interface Exercise {
  /** What the learner starts from; the checks are appended. */
  starter: string;
  /** The starter with the gap filled in, shown on request and pinned by a test. */
  solution: string;
  /** Labels and Luau function bodies that return true when the answer is right. */
  checks: Array<[label: string, body: string]>;
}

export interface ArticlePage {
  slug: string;
  /** The page's <h1>. */
  title: string;
  /** The <title> tag. */
  metaTitle: string;
  description: string;
  blocks: ArticleBlock[];
  exercise?: Exercise;
}

export interface ArticleHub {
  title: string;
  metaTitle: string;
  description: string;
  intro: string[];
  pages: ArticlePage[];
}

const lua = (code: string, outputs: CodeBlock["outputs"]): CodeBlock => ({ code, flavor: "lua54", outputs });
const luau = (code: string, outputs: CodeBlock["outputs"]): CodeBlock => ({ code, flavor: "luau", outputs });

const examplePages: ArticlePage[] = [
  {
    slug: "string-split",
    title: "Split a string in Lua",
    metaTitle: "Lua String Split: Examples for Lua 5.1, 5.4, and Luau | Weblua",
    description:
      "How to split a string in Lua with string.gmatch, keeping empty fields, plus Luau's built-in string.split. Runnable examples with output on Lua 5.1, 5.4, and Luau.",
    blocks: [
      {
        text: [
          "Lua has no split function, but `string.gmatch` does it in a few lines. This version keeps empty fields, so `\"a,,b\"` gives three parts, and escapes the separator so characters such as `.` and `%` match literally.",
          "It works the same on every Lua version and on Luau."
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
          "Luau has `string.split` built in. It splits on a plain string, not a pattern, and also keeps empty fields. Lua 5.1 and 5.4 don't have it, so the same code fails there."
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
        text: [
          "To split into words, match runs of non-space characters with `%S+`. Leading, trailing, and repeated spaces disappear."
        ],
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
      }
    ]
  },
  {
    slug: "string-format",
    title: "Format strings in Lua with string.format",
    metaTitle: "Lua string.format Examples: %d, %s, %q, Padding | Weblua",
    description:
      "string.format in Lua: padding, decimals, hex, %q, and where Lua 5.1, 5.4, and Luau disagree on %d and %s. Every example runs in your browser.",
    blocks: [
      {
        text: [
          "`string.format` takes a template and values, like C's printf. `%s` is a string, `%d` a whole number, `%.2f` a number with two decimals. A number before the letter sets a minimum width, and `-` pads on the right instead of the left.",
          "`%q` writes a string as Lua source, with quotes and escapes, which is handy for generating code."
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
          "Since Lua 5.2, `%s` converts any value with `tostring`, so a table's `__tostring` metamethod is used. Lua 5.1 and Luau accept only strings and numbers there, so call `tostring` yourself."
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
      }
    ]
  },
  {
    slug: "string-interpolation",
    title: "String interpolation in Lua and Luau",
    metaTitle: "Lua String Interpolation vs Luau Backtick Strings | Weblua",
    description:
      "Lua has no string interpolation: use .. or string.format. Luau has backtick strings with {expressions}. Runnable examples with output on Lua 5.1, 5.4, and Luau.",
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
          "Luau strings in backticks can hold expressions in braces. Each value goes through `tostring`, so booleans work. A literal brace needs a backslash. Lua 5.1 and 5.4 reject the syntax outright."
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
      }
    ]
  },
  {
    slug: "metatables",
    title: "Lua metatables and __index",
    metaTitle: "Lua Metatables and __index Explained, with Examples | Weblua",
    description:
      "What metatables do in Lua: __index for classes and defaults, __add, __eq, __tostring, and __newindex. Runnable examples with output on Lua 5.1, 5.4, and Luau.",
    blocks: [
      {
        text: [
          "A metatable changes how a table behaves. When a key is missing, Lua looks in the metatable's `__index`; when you use `+`, it calls `__add`. Pointing `__index` at a table of functions is how Lua does classes.",
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
          "`__index` can also be a function, called with the table and the missing key, which suits defaults. `__newindex` runs when a new key is assigned, so it can refuse."
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
      }
    ]
  },
  {
    slug: "luau-oop",
    title: "Object-oriented programming in Luau",
    metaTitle: "Luau OOP: Classes, Methods, and Inheritance with Types | Weblua",
    description:
      "Write classes in Luau with metatables, typed with typeof and setmetatable, plus inheritance. Strict-mode examples you can run and type-check in your browser.",
    blocks: [
      {
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
          "A subclass is a class whose own metatable's `__index` is the parent, so lookups fall through: instance, then `Dog`, then `Animal`. A method defined on `Dog` overrides the parent's."
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
      }
    ]
  },
  {
    slug: "luau-types",
    title: "Luau type annotations",
    metaTitle: "Luau Types: Annotations, Optionals, Generics, Unions | Weblua",
    description:
      "Luau type annotations by example: typed functions, optional types, generics, and tagged unions with narrowing, checked in strict mode as you type.",
    blocks: [
      {
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
      }
    ]
  }
];

const lessonPages: ArticlePage[] = [
  {
    slug: "values-and-variables",
    title: "Values and variables",
    metaTitle: "Learn Luau 1: Values and Variables | Weblua",
    description:
      "Lesson 1 of Weblua's free Luau course: numbers, strings, booleans, nil, local variables, and string interpolation, with an exercise you run in the page.",
    blocks: [
      {
        text: [
          "A Luau program works with values: numbers, strings, booleans, `nil`, tables, and functions. `print` shows values, and `type` names what kind each one is.",
          "Every number is a 64-bit float, so `7 / 2` is `3.5`; `//` divides and rounds down, and `%` gives the remainder."
        ],
        code: luau(
          `print(42, 3.5, "hello", true, nil)
print(type(42), type("hello"), type(nil))
print(7 / 2, 7 // 2, 2 ^ 10, 7 % 3)`,
          {
            luau: "42\t3.5\thello\ttrue\tnil\nnumber\tstring\tnil\n3.5\t3\t1024\t1"
          }
        )
      },
      {
        heading: "Variables",
        text: [
          "`local` stores a value under a name, from that line to the end of the block. Without `local` you create a global, which every script shares and is easy to clobber, so always write `local`.",
          "Join strings with `..`, or write a backtick string and put values in braces. `+=` adds to a variable in place."
        ],
        code: luau(
          `local name = "Ada"
local year = 1815
print(name .. " was born in " .. year)
print(\`{name} would be {2026 - year} in 2026\`)

local count = 1
count += 1
print(count)`,
          {
            luau: "Ada was born in 1815\nAda would be 211 in 2026\n2"
          }
        )
      }
    ],
    exercise: {
      starter: `--!strict
-- Finish describe. describe("Ada", 36) should return "Ada is 36 years old".
local function describe(name: string, age: number): string
  return ""
end`,
      solution: `--!strict
-- Finish describe. describe("Ada", 36) should return "Ada is 36 years old".
local function describe(name: string, age: number): string
  return \`{name} is {age} years old\`
end`,
      checks: [
        ['describe("Ada", 36)', 'return describe("Ada", 36) == "Ada is 36 years old"'],
        ['describe("Grace", 85)', 'return describe("Grace", 85) == "Grace is 85 years old"']
      ]
    }
  },
  {
    slug: "tables",
    title: "Tables: arrays and dictionaries",
    metaTitle: "Learn Luau 2: Tables, Arrays, and Dictionaries | Weblua",
    description:
      "Lesson 2 of Weblua's free Luau course: tables as arrays and dictionaries, table.insert, length, and looping, with an exercise you run in the page.",
    blocks: [
      {
        text: [
          "A table holding a list is an array. Indexes start at 1, `#` gives the length, and `table.insert` and `table.remove` add and remove items. `for index, value in list do` visits them in order."
        ],
        code: luau(
          `local fruits = { "apple", "banana", "cherry" }
print(fruits[1], #fruits)
table.insert(fruits, "date")
table.remove(fruits, 1)
print(table.concat(fruits, ", "))
for index, fruit in fruits do
  print(index, fruit)
end`,
          {
            luau: "apple\t3\nbanana, cherry, date\n1\tbanana\n2\tcherry\n3\tdate"
          }
        )
      },
      {
        heading: "Dictionaries",
        text: [
          "A table can also map keys to values. `ages.ada` and `ages[\"ada\"]` mean the same thing, and assigning `nil` removes a key. The type `{ [string]: number }` tells the checker any string key may hold a number. The order a loop visits keys in is not defined, so sort them when order matters."
        ],
        code: luau(
          `local ages: { [string]: number } = { ada = 36, grace = 85 }
ages.alan = 41
ages["grace"] = nil
print(ages.ada, ages.grace, ages.alan)

local names = {}
for name in ages do
  table.insert(names, name)
end
table.sort(names)
print(table.concat(names, " "))`,
          {
            luau: "36\tnil\t41\nada alan"
          }
        )
      }
    ],
    exercise: {
      starter: `--!strict
-- Count how often each word appears: countWords("a b a") returns { a = 2, b = 1 }.
-- Hint: text:gmatch("%a+") loops over the words.
local function countWords(text: string): { [string]: number }
  local counts = {}
  return counts
end`,
      solution: `--!strict
-- Count how often each word appears: countWords("a b a") returns { a = 2, b = 1 }.
-- Hint: text:gmatch("%a+") loops over the words.
local function countWords(text: string): { [string]: number }
  local counts = {}
  for word in text:gmatch("%a+") do
    counts[word] = (counts[word] or 0) + 1
  end
  return counts
end`,
      checks: [
        ['countWords("a b a").a is 2', 'return countWords("a b a").a == 2'],
        ['countWords("a b a").b is 1', 'return countWords("a b a").b == 1'],
        ['countWords("the cat the hat").the is 2', 'return countWords("the cat the hat").the == 2']
      ]
    }
  },
  {
    slug: "functions",
    title: "Functions and closures",
    metaTitle: "Learn Luau 3: Functions, Return Values, and Closures | Weblua",
    description:
      "Lesson 3 of Weblua's free Luau course: typed functions, several return values, functions as values, and closures, with an exercise you run in the page.",
    blocks: [
      {
        text: [
          "Declare a function with `local function`. Annotations say what goes in and comes out; they are optional, and the checker infers what you leave out. A function can return several values at once."
        ],
        code: luau(
          `local function add(a: number, b: number): number
  return a + b
end

local function minMax(values: { number }): (number, number)
  local low, high = math.huge, -math.huge
  for _, value in values do
    low = math.min(low, value)
    high = math.max(high, value)
  end
  return low, high
end

print(add(2, 3))
print(minMax({ 4, 8, 15, 16, 23, 42 }))`,
          {
            luau: "5\n4\t42"
          }
        )
      },
      {
        heading: "Closures",
        text: [
          "Functions are values: you can return them, store them, and pass them to `table.sort`. A function made inside another keeps access to that function's locals, even after it returns. That is a closure."
        ],
        code: luau(
          `local function multiplier(factor: number)
  return function(value: number): number
    return value * factor
  end
end

local double, triple = multiplier(2), multiplier(3)
print(double(5), triple(5))

local numbers = { 3, 1, 2 }
table.sort(numbers, function(a: number, b: number) return a > b end)
print(table.concat(numbers, " "))`,
          {
            luau: "10\t15\n3 2 1"
          }
        )
      }
    ],
    exercise: {
      starter: `--!strict
-- makeCounter returns a function. Each call to that function returns the next
-- number: 1, then 2, then 3. Each counter keeps its own count.
local function makeCounter(): () -> number
  return function()
    return 0
  end
end`,
      solution: `--!strict
-- makeCounter returns a function. Each call to that function returns the next
-- number: 1, then 2, then 3. Each counter keeps its own count.
local function makeCounter(): () -> number
  local count = 0
  return function()
    count += 1
    return count
  end
end`,
      checks: [
        ["a counter returns 1, 2, 3", "local counter = makeCounter()\n  return counter() == 1 and counter() == 2 and counter() == 3"],
        ["two counters count separately", "local a, b = makeCounter(), makeCounter()\n  a()\n  a()\n  return b() == 1"]
      ]
    }
  },
  {
    slug: "control-flow",
    title: "Conditions and loops",
    metaTitle: "Learn Luau 4: if, for, while, and continue | Weblua",
    description:
      "Lesson 4 of Weblua's free Luau course: if and elseif, if-expressions, numeric and generic for loops, while, and continue, with an exercise you run in the page.",
    blocks: [
      {
        text: [
          "`if` runs a block when a condition is true; `elseif` and `else` handle the other cases. Only `false` and `nil` count as false, so `0` and `\"\"` are true. An if-expression picks a value in one line."
        ],
        code: luau(
          `local function grade(score: number): string
  if score >= 90 then
    return "A"
  elseif score >= 80 then
    return "B"
  else
    return "C"
  end
end

print(grade(95), grade(85), grade(40))

local temperature = 30
print(if temperature > 25 then "warm" else "cool")`,
          {
            luau: "A\tB\tC\nwarm"
          }
        )
      },
      {
        heading: "Loops",
        text: [
          "`for i = start, stop, step` counts; the step is optional and can be negative. `while` repeats while a condition holds. `continue` skips to the next pass, and `break` leaves the loop."
        ],
        code: luau(
          `for i = 10, 1, -4 do
  print("countdown", i)
end

local n = 1
while n < 100 do
  n *= 3
end
print("first power of 3 over 100:", n)

for i = 1, 6 do
  if i % 2 == 0 then
    continue
  end
  print("odd", i)
end`,
          {
            luau: "countdown\t10\ncountdown\t6\ncountdown\t2\nfirst power of 3 over 100:\t243\nodd\t1\nodd\t3\nodd\t5"
          }
        )
      }
    ],
    exercise: {
      starter: `--!strict
-- fizzbuzz(n) lists 1 to n, separated by spaces, but says Fizz for multiples
-- of 3, Buzz for multiples of 5, and FizzBuzz for both: fizzbuzz(5) is
-- "1 2 Fizz 4 Buzz".
local function fizzbuzz(n: number): string
  local words = {}
  return table.concat(words, " ")
end`,
      solution: `--!strict
-- fizzbuzz(n) lists 1 to n, separated by spaces, but says Fizz for multiples
-- of 3, Buzz for multiples of 5, and FizzBuzz for both: fizzbuzz(5) is
-- "1 2 Fizz 4 Buzz".
local function fizzbuzz(n: number): string
  local words = {}
  for i = 1, n do
    if i % 15 == 0 then
      table.insert(words, "FizzBuzz")
    elseif i % 3 == 0 then
      table.insert(words, "Fizz")
    elseif i % 5 == 0 then
      table.insert(words, "Buzz")
    else
      table.insert(words, tostring(i))
    end
  end
  return table.concat(words, " ")
end`,
      checks: [
        ["fizzbuzz(5)", 'return fizzbuzz(5) == "1 2 Fizz 4 Buzz"'],
        ["fizzbuzz(15) ends with FizzBuzz", 'return fizzbuzz(15):sub(-8) == "FizzBuzz"']
      ]
    }
  },
  {
    slug: "types",
    title: "Type annotations",
    metaTitle: "Learn Luau 5: Type Annotations and Strict Mode | Weblua",
    description:
      "Lesson 5 of Weblua's free Luau course: type annotations, optional types, type aliases, and strict mode, with an exercise you run in the page.",
    blocks: [
      {
        text: [
          "Luau checks types before your code runs. With `--!strict` at the top of a file, the checker underlines mistakes as you type: a string where a number belongs, a misspelled field, a value that might be `nil`.",
          "`number?` means a number or `nil`, so `times` below is optional, and `or` supplies a default. Uncomment the last line in the playground to see the checker object."
        ],
        code: luau(
          `--!strict
local function greet(name: string, times: number?): string
  return string.rep(\`Hello, {name}! \`, times or 1)
end

print(greet("Ada"))
print(greet("Grace", 2))
-- greet(42)`,
          {
            luau: "Hello, Ada! \nHello, Grace! Hello, Grace! "
          }
        )
      },
      {
        heading: "Type aliases",
        text: [
          "`type` names a shape so you can reuse it. A field type ending in `?` may be missing. `{ Item }` is an array of items."
        ],
        code: luau(
          `--!strict
type Item = { name: string, price: number, tags: { string }? }

local function total(items: { Item }): number
  local sum = 0
  for _, item in items do
    sum += item.price
  end
  return sum
end

local cart: { Item } = {
  { name = "sword", price = 120 },
  { name = "shield", price = 80, tags = { "wood" } },
}
print(total(cart))`,
          {
            luau: "200"
          }
        )
      }
    ],
    exercise: {
      starter: `--!strict
-- average returns the mean of a list of numbers, or nil when the list is
-- empty. The return type number? says it may return nil.
local function average(values: { number }): number?
  return 0
end`,
      solution: `--!strict
-- average returns the mean of a list of numbers, or nil when the list is
-- empty. The return type number? says it may return nil.
local function average(values: { number }): number?
  if #values == 0 then
    return nil
  end
  local sum = 0
  for _, value in values do
    sum += value
  end
  return sum / #values
end`,
      checks: [
        ["average({ 2, 4 }) is 3", "return average({ 2, 4 }) == 3"],
        ["average({ 5 }) is 5", "return average({ 5 }) == 5"],
        ["average({}) is nil", "return average({}) == nil"]
      ]
    }
  }
];

export const articleHubs: Record<ArticleSection, ArticleHub> = {
  examples: {
    title: "Runnable Lua and Luau examples",
    metaTitle: "Lua and Luau Examples You Can Run Online | Weblua",
    description:
      "Short, runnable Lua and Luau examples: string split, string.format, interpolation, metatables, Luau OOP, and Luau types, with output on Lua 5.1, 5.4, and Luau.",
    intro: [
      "Each page answers one common question with code you can read, run, and change. The output under each example is what Lua 5.1, Lua 5.4, and Luau really print, so you can see where they agree and where they don't.",
      "Press Open in the playground on any example to edit it and run it yourself."
    ],
    pages: examplePages
  },
  "learn-luau": {
    title: "Learn Luau",
    metaTitle: "Learn Luau Free: Lessons with Exercises You Run Online | Weblua",
    description:
      "A free, short Luau course in five lessons: values, tables, functions, loops, and types. Each lesson ends with an exercise you run and check in your browser.",
    intro: [
      "Five short lessons on Luau, the language Roblox scripts are written in. Each one explains a few ideas with code you can run, then ends with an exercise in an editor on the page: press Run and the checks tell you whether your answer works.",
      "The lessons teach the language itself. Roblox adds services, instances, and events on top, which only Roblox Studio runs; once you know the language, Roblox's own documentation covers those."
    ],
    pages: lessonPages
  }
};

/** `id` for the playground's `#example=` link to a code block. */
export function codeBlockId(section: ArticleSection, slug: string, index: number): string {
  return `${section}/${slug}/${index}`;
}

/** `id` for the playground's `#example=` link to a lesson's exercise. */
export function exerciseId(slug: string): string {
  return `learn-luau/${slug}/exercise`;
}

/** The exercise file: the starter (or solution) and the checks that grade it. */
export function exerciseSource(exercise: Exercise, code = exercise.starter): string {
  const checks = exercise.checks
    .map(([label, body]) => `check(${JSON.stringify(label)}, function()\n  ${body}\nend)`)
    .join("\n");
  return `${code}

-- Press Run to check your answer. The checks below don't need changes.
local passed = 0
local function check(label: string, test: () -> boolean)
  local ok, result = pcall(test)
  if ok and result then
    passed += 1
    print(\`✓ {label}\`)
  else
    print(\`✗ {label}\` .. (if ok then "" else \`: {result}\`))
  end
end

${checks}
print(if passed == ${exercise.checks.length} then "All checks passed. Nice work!" else \`{passed} of ${exercise.checks.length} checks passed. Keep going!\`)
`;
}

/** Every code block and exercise as an example the playground can open by id. */
export function articleExamples(): PlaygroundExample[] {
  return (Object.keys(articleHubs) as ArticleSection[]).flatMap((section) =>
    articleHubs[section].pages.flatMap((page) => [
      ...page.blocks.flatMap((block, index): PlaygroundExample[] =>
        block.code ? [{ id: codeBlockId(section, page.slug, index), title: page.title, flavor: block.code.flavor, code: block.code.code }] : []
      ),
      ...(page.exercise ? [{ id: exerciseId(page.slug), title: `${page.title} exercise`, flavor: "luau" as const, code: exerciseSource(page.exercise) }] : [])
    ])
  );
}
