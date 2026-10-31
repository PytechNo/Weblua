import { type ArticlePage, luau, raw } from "./articleTypes";

/**
 * The Learn Luau course. Every code block's output, every trace's printed
 * lines, and every quiz answer is checked against a real Luau run by
 * articles.execution.test.ts, and every block type-checks in strict mode.
 */
export const lessonPages: ArticlePage[] = [
  {
    slug: "values-and-variables",
    title: "Values and variables",
    metaTitle: "Learn Luau 1: Values, Variables, and Types | Weblua",
    description:
      "Lesson 1 of a free interactive Luau course: numbers, strings, booleans, nil, local variables, arithmetic, and string interpolation, with an animated walkthrough.",
    answer:
      "Values are the data a program works with, such as `10`, `\"Ada\"`, and `true`. A variable is a name for a value: `local coins = 10` creates one, `coins = 12` changes it, and `type(coins)` tells you what kind of value it holds.",
    minutes: 10,
    outcomes: [
      "Recognise Luau's basic value types and check them with `type`",
      "Create variables with `local` and change them with `=` and `+=`",
      "Do arithmetic, including `/`, `//`, and `%`",
      "Build text with `..` and backtick strings"
    ],
    blocks: [
      {
        text: [
          "Every program works with **values**: the number `10`, the text `\"Ada\"`, the answer `true`. A **variable** gives a value a name, so you can use it again and change it later. Press Play below and watch each line create or change a variable on the right."
        ],
        trace: {
          title: "Variables change as each line runs",
          code: `local coins = 10
local price = 4
coins -= price
local name = "Ada"
print(\`{name} has {coins} coins\`)
local rich = coins > 100
print(rich)`,
          steps: [
            { line: 1, say: "`local coins = 10` creates a variable named `coins` and stores the number `10` in it.", set: { coins: 10 } },
            { line: 2, say: "A second variable, `price`, holds `4`.", set: { price: 4 } },
            { line: 3, say: "`coins -= price` reads `coins`, subtracts `price`, and stores the result back in `coins`. `price` doesn't change.", set: { coins: 6 } },
            { line: 4, say: "Text goes in quotes. `name` holds the string `\"Ada\"`.", set: { name: "Ada" } },
            { line: 5, say: "A backtick string swaps each `{expression}` for its value, then `print` shows the result.", print: "Ada has 6 coins" },
            { line: 6, say: "`coins > 100` compares two numbers and gives a boolean: `false`, since 6 is not more than 100.", set: { rich: false } },
            { line: 7, say: "`print` shows any value, booleans included.", print: "false" }
          ]
        }
      },
      {
        heading: "The basic types",
        text: ["Luau has a handful of value types. `type` returns the name of a value's type as a string, which is handy when you're not sure what you have."],
        table: {
          head: ["Type", "Examples", "What it holds"],
          rows: [
            ["`number`", "`42`, `3.5`, `-7`, `1e6`", "Every number, whole or not. Luau has one number type, so `10` and `10.0` are the same value."],
            ["`string`", "`\"hello\"`, `'hi'`", "Text. Single and double quotes mean the same thing."],
            ["`boolean`", "`true`, `false`", "Yes-or-no answers, such as the result of `5 > 3`."],
            ["`nil`", "`nil`", "No value at all. A variable you never set holds `nil`, and so does a missing table key."],
            ["`table`", "`{ 1, 2, 3 }`", "Lists and records. Lesson 4 covers them."],
            ["`function`", "`print`", "Code you can call. Lesson 3 covers them."]
          ]
        },
        code: luau(
          `print(42, 3.5, "hello", true, nil)
print(type(42), type("hello"), type(true), type(nil))
print(type({}), type(print))`,
          { luau: "42\t3.5\thello\ttrue\tnil\nnumber\tstring\tboolean\tnil\ntable\tfunction" }
        )
      },
      {
        heading: "Variables with local",
        text: [
          "`local name = value` creates a variable. It exists from that line to the end of the block it's in: the file, a function, or a loop. To change it later, assign with `=` and leave out `local`; writing `local` again would create a second variable with the same name.",
          "Compound assignment updates a variable in place: `score += 5` means `score = score + 5`, and `-=`, `*=`, `/=`, and `..=` work the same way. You can also declare several variables on one line."
        ],
        code: luau(
          `local score = 10
score = score + 5
score += 5
print(score)

local playerName, level = "Ada", 3
print(playerName, level)`,
          { luau: "20\nAda\t3" }
        ),
        note: "Always write `local`. Without it, `score = 10` creates a **global**, which every function in the script shares, so separate parts of a program can overwrite each other's values by accident. Locals are also faster to read."
      },
      {
        heading: "Arithmetic",
        text: [
          "`+`, `-`, and `*` work as you'd expect. `/` always divides exactly, so `7 / 2` is `3.5`. `//` divides and rounds down to a whole number, `%` gives the remainder, and `^` raises to a power. `math.floor` rounds down too, and the `math` library has the rest: `math.max`, `math.abs`, `math.sqrt`, `math.random`, and more."
        ],
        code: luau(
          `print(7 + 2, 7 - 2, 7 * 2)
print(7 / 2, 7 // 2, 7 % 2)
print(2 ^ 10, -7 // 2, math.floor(3.7))`,
          { luau: "9\t5\t14\n3.5\t3\t1\n1024\t-4\t3" }
        ),
        quiz: {
          question: "What does this print?",
          code: `print(10 // 4, 10 % 4)`,
          options: ["2.5 2", "2 2", "2 0.5", "3 2"],
          answer: 1,
          why: "`//` divides and rounds down: 10 / 4 is 2.5, which rounds down to `2`. `%` is what's left over: 4 goes into 10 twice, leaving `2`."
        }
      },
      {
        heading: "Joining text",
        text: [
          "`..` joins two strings, and numbers are converted to text for you. Booleans and `nil` aren't, so wrap those in `tostring`. For anything longer, a backtick string is easier to read: each `{expression}` inside it is evaluated, converted, and inserted.",
          "`#` gives a string's length, and `name:upper()` is one of the string methods lesson 5 covers."
        ],
        code: luau(
          `local name, age = "Ada", 36
print("Hi, " .. name .. "!")
print(name .. " is " .. age)
print(\`{name} is {age}, next year {age + 1}\`)
print("Ready: " .. tostring(true))
print(#name, name:upper())`,
          { luau: "Hi, Ada!\nAda is 36\nAda is 36, next year 37\nReady: true\n3\tADA" }
        )
      },
      {
        heading: "nil means nothing there",
        text: [
          "A variable that hasn't been given a value holds `nil`. You'll meet `nil` constantly: it's also what a missing table key or a function with no `return` gives you. `or` is the usual way to supply a default, because `a or b` gives `b` whenever `a` is `nil` or `false`.",
          "The `: string?` below is a type annotation saying `nickname` holds a string or `nil`. Lesson 7 covers types; for now, read it as a comment the checker understands."
        ],
        code: luau(
          `local nickname: string? = nil
print(nickname)
print(nickname or "no nickname")
nickname = "Countess"
print(nickname or "no nickname")`,
          { luau: "nil\nno nickname\nCountess" }
        )
      },
      {
        heading: "Comparing values",
        text: [
          "`==` checks whether two values are equal and `~=` whether they differ; Luau has no `!=`. `<`, `>`, `<=`, and `>=` compare numbers, and strings alphabetically. Each comparison gives a boolean, and `and`, `or`, and `not` combine them."
        ],
        code: luau(
          `local age = 15
print(age >= 13, age == 15, age ~= 15)
print(age >= 13 and age < 18, not (age > 18))
print("apple" < "banana")`,
          { luau: "true\ttrue\tfalse\ntrue\ttrue\ntrue" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Writing `!=` for not equal. Luau uses `~=`.",
          "Using `=` to compare: `if x = 5 then` is a syntax error. Comparison is `==`.",
          "Leaving out `local`, which creates a global that every function shares.",
          "Joining `nil` or a boolean with `..`: `\"x\" .. nil` is an error. Use `tostring`, or a backtick string, which converts for you.",
          "Expecting `7 / 2` to be `3`. Use `//` when you want whole-number division."
        ]
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
    },
    recap: [
      "Every value has a type: `number`, `string`, `boolean`, `nil`, `table`, or `function`.",
      "`local name = value` makes a variable; `=` changes it, and `+=` updates it in place.",
      "`/` divides exactly, `//` rounds down, and `%` gives the remainder.",
      "Join text with `..`, or put values straight into a backtick string.",
      "`nil` means no value, and `value or default` supplies one."
    ],
    faq: [
      [
        "Does Luau have integers?",
        "Not as a separate type. Every number is a 64-bit float, which stores whole numbers exactly up to 2^53, about 9 quadrillion. Lua 5.3 and later have a separate integer type; it's one of the differences on the [Lua vs Luau](/lua-vs-luau) page."
      ],
      [
        "What is the difference between local and global variables in Luau?",
        "A local belongs to the block it's declared in and disappears when the block ends. A global lives in the script's environment, where any function can read and change it. Prefer locals: nothing elsewhere can clobber them, and they're faster."
      ],
      ["Why does Luau use ~= instead of != for not equal?", "Lua chose `~=` when it was designed in 1993, and Luau kept Lua's syntax. `!=` is a syntax error."]
    ],
    related: [
      ["Lua vs Luau", "/lua-vs-luau"],
      ["String interpolation in Lua and Luau", "/examples/string-interpolation"]
    ]
  },
  {
    slug: "control-flow",
    title: "Conditions and loops",
    metaTitle: "Learn Luau 2: if Statements, for and while Loops | Weblua",
    description:
      "Lesson 2 of a free interactive Luau course: if, elseif, and else, truthiness, if-expressions, for, while, and repeat loops, continue, and break, animated step by step.",
    answer:
      "`if` runs code only when a condition is true, and loops run code again and again: `for` counts, `while` repeats while a condition holds, and `repeat` runs at least once. In Luau only `false` and `nil` count as false, so `0` and `\"\"` are true.",
    minutes: 11,
    outcomes: [
      "Choose between branches with `if`, `elseif`, and `else`",
      "Know which values count as true",
      "Repeat code with `for`, `while`, and `repeat`",
      "Skip a pass with `continue` and leave a loop with `break`"
    ],
    blocks: [
      {
        text: [
          "Programs make decisions and repeat work. This loop adds up the even numbers from 1 to 4. Watch the highlighted line jump back to the top of the loop on each pass, and the `if` skip its body when the number is odd."
        ],
        trace: {
          title: "A loop with a condition inside",
          code: `local total = 0
for i = 1, 4 do
  if i % 2 == 0 then
    total += i
  end
end
print(total)`,
          steps: [
            { line: 1, say: "`total` starts at `0`.", set: { total: 0 } },
            { line: 2, say: "The loop starts with `i` at `1`. It will run its body once for each number up to `4`.", set: { i: 1 } },
            { line: 3, say: "`1 % 2` is `1`, not `0`, so the condition is false and the body of the `if` is skipped." },
            { line: 2, say: "Back to the top: `i` is now `2`.", set: { i: 2 } },
            { line: 3, say: "`2 % 2 == 0` is true, so the body runs." },
            { line: 4, say: "`total += i` adds `2`.", set: { total: 2 } },
            { line: 2, say: "`i` is `3`.", set: { i: 3 } },
            { line: 3, say: "`3 % 2` is `1`: the condition is false again, so nothing is added." },
            { line: 2, say: "`i` is `4`, the last value the loop will use.", set: { i: 4 } },
            { line: 4, say: "Four is even, so `total` becomes `2 + 4`, which is `6`.", set: { total: 6 } },
            { line: 7, say: "The loop has run out of numbers, and its counter `i` no longer exists. `print` shows the total.", drop: ["i"], print: "6" }
          ]
        }
      },
      {
        heading: "if, elseif, and else",
        text: [
          "An `if` checks its condition and runs the block up to `elseif`, `else`, or `end`. With `elseif`, the conditions are checked in order and only the first true one runs. `else` catches everything that's left. Every `if` ends with one `end`."
        ],
        code: luau(
          `local score = 85
if score >= 90 then
  print("A")
elseif score >= 80 then
  print("B")
else
  print("C")
end`,
          { luau: "B" }
        )
      },
      {
        heading: "What counts as true",
        text: [
          "Conditions don't have to be booleans. Luau treats `false` and `nil` as false and **everything else** as true, including `0`, the empty string, and an empty table. That's different from JavaScript and Python, where `0` and `\"\"` are false, so it's worth a moment to get used to.",
          "This is what makes `if player then` a check that `player` exists, and `name or \"guest\"` a default."
        ],
        quiz: {
          question: "Which of these values makes an `if` skip its block?",
          options: ["`0`", "`\"\"` (an empty string)", "`nil`", "`{}` (an empty table)"],
          answer: 2,
          why: "Only `false` and `nil` are false in Luau. `0`, `\"\"`, and `{}` are all values, so they count as true."
        }
      },
      {
        heading: "Choosing a value with an if-expression",
        text: [
          "When you only need to pick a value, an if-expression does it in one line: `if condition then a else b`. It must have an `else`, and it can have `elseif` too. This is a Luau addition; standard Lua uses `condition and a or b`, which goes wrong when `a` is `false` or `nil`."
        ],
        code: luau(
          `local temperature = 30
local feel = if temperature > 25 then "warm" else "cool"
print(feel)
print(if temperature > 35 then "hot" elseif temperature > 25 then "warm" else "cool")`,
          { luau: "warm\nwarm" }
        )
      },
      {
        heading: "for loops that count",
        text: [
          "`for i = start, stop do` runs its body once for each number from `start` to `stop`, including both. A third number sets the step, which can be negative to count down. The counter `i` is a fresh local on each pass and doesn't exist after the loop. Lesson 4 shows the other kind of `for`, which walks through a table."
        ],
        code: luau(
          `for i = 1, 3 do
  print("lap", i)
end
for i = 10, 1, -4 do
  print("countdown", i)
end`,
          { luau: "lap\t1\nlap\t2\nlap\t3\ncountdown\t10\ncountdown\t6\ncountdown\t2" }
        )
      },
      {
        heading: "while and repeat",
        text: [
          "`while` checks its condition before each pass and stops when it's false, so its body may not run at all. `repeat ... until` checks after each pass, so its body always runs at least once, and it stops when the condition becomes **true**."
        ],
        code: luau(
          `local fuel = 3
while fuel > 0 do
  print("fuel left:", fuel)
  fuel -= 1
end

local tries = 0
repeat
  tries += 1
until tries >= 2
print("tries:", tries)`,
          { luau: "fuel left:\t3\nfuel left:\t2\nfuel left:\t1\ntries:\t2" }
        ),
        quiz: {
          question: "What does this print?",
          code: `local n = 1
while n < 20 do
  n *= 3
end
print(n)`,
          options: ["9", "20", "27", "81"],
          answer: 2,
          why: "`n` goes 1, 3, 9, 27. The condition is checked before each pass: `9 < 20` is true, so `n` becomes `27`; then `27 < 20` is false and the loop stops."
        }
      },
      {
        heading: "continue and break",
        text: [
          "`continue` skips the rest of this pass and moves to the next one. `break` leaves the loop entirely. `continue` is Luau's; in standard Lua you'd write `goto continue` (Lua 5.2 and later), which Luau doesn't support."
        ],
        code: luau(
          `for i = 1, 10 do
  if i % 2 == 0 then
    continue
  end
  if i > 7 then
    break
  end
  print("odd", i)
end`,
          { luau: "odd\t1\nodd\t3\nodd\t5\nodd\t7" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Writing `else if` for `elseif`. `else if` starts a second `if` inside the `else`, which needs its own `end`.",
          "Forgetting `then` after an `if` condition or `do` after a loop header.",
          "Expecting `0` or `\"\"` to be false. Compare explicitly: `if count > 0 then`.",
          "Changing a `for` loop's counter inside the loop: it's reset on the next pass. Use `while` when you need that control.",
          "Writing a `while` loop whose condition never becomes false. Weblua stops a run after five seconds; elsewhere the program simply hangs."
        ]
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
    },
    recap: [
      "`if`/`elseif`/`else` runs the first branch whose condition is true.",
      "Only `false` and `nil` are false; `0`, `\"\"`, and `{}` are true.",
      "`if a then b else c` picks a value in one expression.",
      "`for` counts, `while` checks first, and `repeat ... until` checks last.",
      "`continue` skips to the next pass and `break` leaves the loop."
    ],
    faq: [
      ["Does Luau have a switch statement?", "No. Use an `if`/`elseif` chain, or a table that maps each case to a value or a function, and look the case up."],
      ["Does Luau have continue?", "Yes. Luau added `continue`. Standard Lua doesn't have it; Lua 5.2 and later use `goto continue` with a label at the end of the loop body instead."],
      [
        "What is the difference between while and repeat in Luau?",
        "`while` checks its condition before each pass, so the body might never run. `repeat ... until` checks after each pass, so the body always runs at least once, and it stops when the condition is true rather than false."
      ]
    ],
    related: [
      ["Lua vs Luau: continue and other syntax", "/lua-vs-luau"],
      ["Luau playground", "/luau"]
    ]
  },
  {
    slug: "functions",
    title: "Functions and closures",
    metaTitle: "Learn Luau 3: Functions, Return Values, and Closures | Weblua",
    description:
      "Lesson 3 of a free interactive Luau course: parameters, return values, multiple returns, functions as values, and closures, with an animated call stack.",
    answer:
      "A function is a named block of code you can run with different inputs. `local function add(a, b) return a + b end` defines one and `add(2, 3)` calls it. Each call gets its own local variables, and a function created inside another keeps access to the outer one's variables: that's a closure.",
    minutes: 12,
    outcomes: [
      "Define functions with parameters and return values",
      "Return several values at once and pick them up",
      "Pass functions to other functions",
      "Use a closure to keep private state between calls"
    ],
    blocks: [
      {
        text: [
          "A function packages code so you can write it once and run it whenever you need it. Watch what happens on a call: a new frame opens with the function's own variables, and when the function returns, the frame disappears and only the returned value is left."
        ],
        trace: {
          title: "A function call, step by step",
          code: `local function add(a: number, b: number): number
  local sum = a + b
  return sum
end

local result = add(2, 3)
print(result)`,
          steps: [
            { line: 1, say: "This defines a function and stores it in a local named `add`. The code inside doesn't run yet.", set: { add: raw("function") } },
            { line: 6, say: "`add(2, 3)` calls it. A new frame opens for the call, holding the parameters: `a` is `2` and `b` is `3`.", enter: "add", set: { a: 2, b: 3 } },
            { line: 2, say: "`sum` is a local of this call. Code outside the function can't see it.", set: { sum: 5 } },
            { line: 3, say: "`return sum` ends the call and hands `5` back. The frame, with `a`, `b`, and `sum`, is gone.", leave: true },
            { line: 6, say: "Back on line 6, the returned `5` is stored in `result`.", set: { result: 5 } },
            { line: 7, say: "And printed.", print: "5" }
          ]
        }
      },
      {
        heading: "Parameters and return values",
        text: [
          "Parameters are the names in the parentheses; arguments are the values a call passes in. A missing argument arrives as `nil`, and extra ones are ignored. `return` ends the call and hands back a value; a function without `return` gives back nothing, which reads as `nil`.",
          "The annotations, `name: string` for a parameter and `): string` for the result, are optional. They let the checker catch calls with the wrong kind of value. `greeting: string?` marks an optional parameter."
        ],
        code: luau(
          `local function greet(name: string, greeting: string?): string
  return \`{greeting or "Hello"}, {name}!\`
end

print(greet("Ada"))
print(greet("Grace", "Welcome"))`,
          { luau: "Hello, Ada!\nWelcome, Grace!" }
        )
      },
      {
        heading: "Returning several values",
        text: [
          "A function can return several values, separated by commas, and the caller can take them with several variables. Values the caller doesn't take are dropped, and wrapping a call in parentheses keeps only the first one. Many built-in functions work this way, such as `string.find`, which returns where a match starts and ends."
        ],
        code: luau(
          `local function divide(a: number, b: number): (number, number)
  return a // b, a % b
end

local quotient, remainder = divide(17, 5)
print(quotient, remainder)
print(divide(9, 2))
print((divide(9, 2)))`,
          { luau: "3\t2\n4\t1\n4" }
        ),
        quiz: {
          question: "What does this print?",
          code: `local function double(n: number): number
  return n * 2
end
print(double(double(3)))`,
          options: ["6", "9", "12", "36"],
          answer: 2,
          why: "The inner call runs first: `double(3)` is `6`. The outer call doubles that: `double(6)` is `12`."
        }
      },
      {
        heading: "Functions are values",
        text: [
          "A function is a value, like a number or a string. You can store it in another variable, put it in a table, pass it to a function, or return it from one. `table.sort` takes a function that answers whether `a` should come before `b`; here it sorts from highest to lowest.",
          "`(string) -> string` is the type of a function that takes a string and returns one."
        ],
        code: luau(
          `local function shout(text: string): string
  return text:upper() .. "!"
end

local say = shout
print(say("hi"))

local function twice(f: (string) -> string, text: string): string
  return f(f(text))
end
print(twice(shout, "hey"))

local scores = { 30, 10, 20 }
table.sort(scores, function(a: number, b: number)
  return a > b
end)
print(table.concat(scores, " "))`,
          { luau: "HI!\nHEY!!\n30 20 10" }
        )
      },
      {
        heading: "Closures",
        text: [
          "A function made inside another function can use the outer function's locals, even after the outer function has returned. Luau keeps those variables alive for as long as the inner function exists. The inner function and the variables it holds on to are called a closure.",
          "Closures are how Luau code keeps private state: a counter, a cache, a cooldown timer. Watch `count` survive after `makeCounter` returns, and keep its value between calls."
        ],
        trace: {
          title: "A closure keeps its variables",
          code: `local function makeCounter()
  local count = 0
  return function()
    count += 1
    return count
  end
end

local counter = makeCounter()
print(counter())
print(counter())`,
          steps: [
            { line: 1, say: "Defines `makeCounter`. Each call to it will build and return a new function.", set: { makeCounter: raw("function") } },
            { line: 9, say: "`makeCounter()` runs, and a frame opens for the call.", enter: "makeCounter" },
            { line: 2, say: "`count` is a local of this call, starting at `0`.", set: { count: 0 } },
            {
              line: 3,
              say: "It returns the inner function. Normally the call's frame would now be thrown away, but the inner function uses `count`, so Luau keeps the frame alive for it.",
              leave: "kept"
            },
            { line: 9, say: "The returned function is stored in `counter`.", set: { counter: raw("function") } },
            { line: 10, say: "`counter()` runs the inner function. It adds 1 to the `count` it kept, and returns `1`.", frame: "makeCounter", set: { count: 1 }, print: "1" },
            { line: 11, say: "The second call finds the same `count`, now `1`, and makes it `2`. Nothing outside the closure can touch it.", frame: "makeCounter", set: { count: 2 }, print: "2" }
          ]
        }
      },
      {
        heading: "Common mistakes",
        list: [
          "Calling a function before the line that defines it. `local function f` makes the name `f` exist from that line on.",
          "Forgetting `return`: the function runs, but the caller gets `nil`.",
          "Writing `print(greet)` instead of `print(greet(\"Ada\"))`. Without the parentheses you pass the function itself, which prints as `function: 0x…`.",
          "Expecting a function to change the caller's variable by assigning to its parameter. Parameters are local copies. Tables are the exception, as lesson 4 explains."
        ]
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
    },
    recap: [
      "`local function name(params) ... end` defines a function; `name(args)` calls it.",
      "Each call gets its own frame of local variables, gone when the call returns.",
      "`return a, b` returns several values; `(f())` keeps only the first.",
      "Functions are values you can store, pass, and return.",
      "A closure keeps the outer variables it uses alive between calls."
    ],
    faq: [
      [
        "What is the difference between local function and function in Luau?",
        "`local function f()` creates a local, visible from that line to the end of the block, and lets `f` call itself. `function f()` assigns a global instead. Prefer the local form."
      ],
      [
        "How do I give a parameter a default value in Luau?",
        "Mark it optional with `?` and fall back with `or`: `local function greet(name: string?) local who = name or \"friend\" ... end`. Luau has no default-value syntax in the parameter list."
      ],
      [
        "How do I write a function that takes any number of arguments?",
        "Use `...` as the last parameter. `local function sum(...: number)` accepts `sum(1, 2, 3)`; inside, `{ ... }` collects the arguments into a table and `select(\"#\", ...)` counts them."
      ]
    ],
    related: [
      ["Object-oriented programming in Luau", "/examples/luau-oop"],
      ["Luau playground", "/luau"]
    ]
  },
  {
    slug: "tables",
    title: "Tables: arrays and dictionaries",
    metaTitle: "Learn Luau 4: Tables, Arrays, and Dictionaries | Weblua",
    description:
      "Lesson 4 of a free interactive Luau course: tables as arrays and dictionaries, table.insert, table.remove, length, looping, and copying, with animated table cells.",
    answer:
      "A table is Luau's one data structure. With values listed in order, `{ \"a\", \"b\" }`, it's an array indexed from 1. With keys, `{ name = \"Ada\" }`, it's a dictionary. Variables hold a reference to a table, so two variables can share one.",
    minutes: 13,
    outcomes: [
      "Build arrays, add and remove items, and read their length",
      "Store and remove values by key in a dictionary",
      "Loop over both kinds of table",
      "Know when two variables share one table, and how to copy it"
    ],
    blocks: [
      {
        text: [
          "Lists, records, inventories, settings: in Luau they're all tables. Watch the cells on the right as items are added, replaced, and removed. Note what `table.remove` does to the items after the one it removes."
        ],
        trace: {
          title: "An array grows and shrinks",
          code: `local fruits = { "apple", "banana" }
table.insert(fruits, "cherry")
print(#fruits)
fruits[1] = "avocado"
table.remove(fruits, 2)
print(table.concat(fruits, ", "))`,
          steps: [
            { line: 1, say: "Values listed in braces make an array: `\"apple\"` at index 1 and `\"banana\"` at index 2. Luau arrays start at 1, not 0.", set: { fruits: ["apple", "banana"] } },
            { line: 2, say: "`table.insert` adds a value at the end, at index 3.", set: { fruits: ["apple", "banana", "cherry"] } },
            { line: 3, say: "`#fruits` is the length of the array.", print: "3" },
            { line: 4, say: "Assigning to an index replaces the value there.", set: { fruits: ["avocado", "banana", "cherry"] } },
            { line: 5, say: "`table.remove(fruits, 2)` takes out index 2 and shifts everything after it down one, so `\"cherry\"` moves to index 2.", set: { fruits: ["avocado", "cherry"] } },
            { line: 6, say: "`table.concat` joins the values into one string, with a separator between them.", print: "avocado, cherry" }
          ]
        }
      },
      {
        heading: "Dictionaries",
        text: [
          "A table can also map keys to values. `stock.apples` and `stock[\"apples\"]` mean the same thing; use the brackets when the key is in a variable or isn't a valid name. Assigning to a new key adds it, and assigning `nil` removes it, because a table never stores `nil`.",
          "The type `{ [string]: number }` tells the checker that any string key may hold a number."
        ],
        trace: {
          title: "A dictionary gains and loses keys",
          code: `local stock: { [string]: number } = { apples = 3, pears = 5 }
stock.apples += 2
stock.plums = 7
stock.pears = nil
print(stock.apples, stock.pears)`,
          steps: [
            { line: 1, say: "`key = value` pairs in braces make a dictionary. Each key maps to one value.", set: { stock: { apples: 3, pears: 5 } } },
            { line: 2, say: "`stock.apples` reads the value under the key `\"apples\"`, and `+=` writes `5` back.", set: { stock: { apples: 5, pears: 5 } } },
            { line: 3, say: "Assigning to a key the table doesn't have yet adds it.", set: { stock: { apples: 5, pears: 5, plums: 7 } } },
            { line: 4, say: "Assigning `nil` removes the key. A table has no way to hold `nil` as a value.", set: { stock: { apples: 5, plums: 7 } } },
            { line: 5, say: "Reading a key that isn't there gives `nil`, never an error.", print: "5\tnil" }
          ]
        }
      },
      {
        heading: "Looping over a table",
        text: [
          "`for index, value in fruits do` visits each item of an array in order. On a dictionary the same loop gives each key and value, but in no particular order, so sort the keys when order matters. Standard Lua writes these loops with `ipairs` and `pairs`; Luau accepts those too."
        ],
        code: luau(
          `local fruits = { "apple", "banana", "cherry" }
for index, fruit in fruits do
  print(index, fruit)
end

local ages: { [string]: number } = { ada = 36, grace = 85, alan = 41 }
local names = {}
for name in ages do
  table.insert(names, name)
end
table.sort(names)
print(table.concat(names, " "))`,
          { luau: "1\tapple\n2\tbanana\n3\tcherry\nada alan grace" }
        )
      },
      {
        heading: "Two names, one table",
        text: [
          "Numbers and strings are copied when you assign them, but tables aren't. A variable holds a **reference** to a table, so after `local b = a` both names point to the same table, and a change through one is visible through the other. The same goes for a table passed to a function: the function can change it."
        ],
        quiz: {
          question: "What does this print?",
          code: `local a = { 1, 2 }
local b = a
table.insert(b, 3)
print(#a)`,
          options: ["2", "3", "nil", "an error"],
          answer: 1,
          why: "`local b = a` doesn't copy the table. `a` and `b` are two names for one table, so the insert through `b` shows up in `a`. To copy, use `table.clone(a)`."
        }
      },
      {
        heading: "Handy table functions",
        table: {
          head: ["Function", "What it does", "In standard Lua"],
          rows: [
            ["`table.insert(t, v)`", "Adds `v` at the end; `table.insert(t, i, v)` inserts at index `i`", "Yes"],
            ["`table.remove(t, i)`", "Removes and returns index `i`, or the last item without `i`", "Yes"],
            ["`table.sort(t, f)`", "Sorts in place, optionally with a compare function", "Yes"],
            ["`table.concat(t, sep)`", "Joins strings and numbers into one string", "Yes"],
            ["`table.find(t, v)`", "Index of the first `v`, or `nil`", "No"],
            ["`table.clone(t)`", "A shallow copy", "No"],
            ["`table.clear(t)`", "Removes every key, keeping the table", "No"],
            ["`table.freeze(t)`", "Makes the table read-only", "No"]
          ]
        },
        code: luau(
          `local colors = { "red", "green", "blue" }
print(table.find(colors, "green"), table.find(colors, "pink"))

local copy = table.clone(colors)
table.insert(copy, "pink")
print(#colors, #copy)

local frozen = table.freeze({ "fixed" })
print(pcall(function()
  table.insert(frozen, "more")
end))`,
          { luau: "2\tnil\n3\t4\nfalse\tattempt to modify a readonly table" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Starting at index 0. Arrays start at 1; `t[0]` is just another key, which `#` and loops over the array skip.",
          "Using `#` on a dictionary. `#` counts the array part, so a table with only string keys has length `0`. Count with a loop instead.",
          "Leaving holes. `{ 1, nil, 3 }` has an unreliable length. Remove items with `table.remove`, not by assigning `nil` in the middle.",
          "Expecting `b = a` to copy a table. Use `table.clone(a)`, which copies one level deep.",
          "Relying on the order of a dictionary loop. Collect and sort the keys first."
        ]
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
    },
    recap: [
      "`{ \"a\", \"b\" }` is an array indexed from 1; `#t` is its length.",
      "`{ key = value }` is a dictionary; assigning `nil` removes a key.",
      "`for k, v in t do` loops over any table; dictionary order isn't fixed.",
      "Variables hold references: `b = a` shares the table, `table.clone(a)` copies it.",
      "Luau adds `table.find`, `table.clone`, `table.clear`, and `table.freeze`."
    ],
    faq: [
      [
        "How do I get the length of a table in Luau?",
        "`#t` gives the length of an array. For a dictionary, count the keys with a loop: `local n = 0 for _ in t do n += 1 end`. `#` only counts consecutive integer keys starting at 1."
      ],
      ["Why do Luau arrays start at 1?", "Lua started at 1 to match how people count, and Luau kept Lua's rules. The table functions and `#` all assume it."],
      ["How do I check if a table contains a value?", "For an array, `table.find(t, value)` returns the index or `nil`. For a dictionary, check `t[key] ~= nil`."]
    ],
    related: [
      ["Lua table to JSON converter", "/lua-table-to-json"],
      ["Lua metatables and __index", "/examples/metatables"]
    ]
  },
  {
    slug: "strings",
    title: "Working with strings",
    metaTitle: "Learn Luau 5: Strings, split, find, gsub, and format | Weblua",
    description:
      "Lesson 5 of a free interactive Luau course: string methods, split, find, match, gsub, patterns, string.format, and backtick strings, with an animated pattern match.",
    answer:
      "Strings are text, and every string has methods: `s:upper()`, `s:sub(1, 3)`, `s:find(\"x\")`, `s:split(\",\")`, and more. Luau matches text with Lua patterns, a lighter cousin of regular expressions, and `string.format` lines numbers up.",
    minutes: 12,
    outcomes: [
      "Write strings with escapes and long brackets",
      "Use string methods to slice, search, and change text",
      "Split and join text",
      "Match and replace with patterns"
    ],
    blocks: [
      {
        heading: "Writing strings",
        text: [
          "Single and double quotes both make strings. Inside them, a backslash starts an escape: `\\n` is a new line, `\\t` a tab, and `\\\"` a quote. Double square brackets make a long string, which can span lines and needs no escapes. Backtick strings, from lesson 1, insert values."
        ],
        code: luau(
          `print("She said \\"hi\\"")
print('It\\'s fine')
print("Tab:\\tthen a new line\\nSecond line")
print([[Long strings keep
line breaks and "quotes" as they are]])`,
          { luau: 'She said "hi"\nIt\'s fine\nTab:\tthen a new line\nSecond line\nLong strings keep\nline breaks and "quotes" as they are' }
        )
      },
      {
        heading: "String methods",
        text: [
          "Call a method with a colon: `word:upper()` is short for `string.upper(word)`. Strings never change in place; every method returns a new string. Positions count from 1, and negative positions count back from the end, so `word:sub(-3)` is the last three characters."
        ],
        code: luau(
          `local word = "Weblua"
print(#word, word:upper(), word:lower())
print(word:sub(1, 3), word:sub(-3), word:sub(4))
print(word:rep(3), word:reverse())
print(word:byte(1), string.char(87))`,
          { luau: "6\tWEBLUA\tweblua\nWeb\tlua\tlua\nWebluaWebluaWeblua\taulbeW\n87\tW" }
        ),
        quiz: {
          question: "`find` returns two numbers. What does this print?",
          code: `print(("banana"):find("an"))`,
          options: ["2 3", "2", "1 2", "true"],
          answer: 0,
          why: "`find` returns where the first match starts and ends. `\"an\"` first appears at positions 2 and 3 of `\"banana\"`. If there's no match, it returns `nil`."
        }
      },
      {
        heading: "Splitting and joining",
        text: [
          "`s:split(sep)` breaks a string into a table of parts. It splits on plain text, not a pattern, and keeps empty parts, so two commas in a row give an empty string between them. `table.concat` does the reverse. `split` is Luau's; in standard Lua see [splitting a string in Lua](/examples/string-split)."
        ],
        code: luau(
          `local csv = "red,green,,blue"
local parts = csv:split(",")
print(#parts, parts[3] == "")
print(table.concat(parts, " | "))`,
          { luau: "4\ttrue\nred | green |  | blue" }
        )
      },
      {
        heading: "Finding text with patterns",
        text: [
          "`find`, `match`, `gmatch`, and `gsub` take a **pattern**: a small language for describing text. `%d` matches a digit, `%a` a letter, `%s` a space, and `.` any character. `+` means one or more, `*` zero or more, and `-` zero or more but as few as possible. Parentheses **capture** the part they match, and `match` returns the captures.",
          "Watch `match` pull a key and a number out of a line of text. To experiment with your own patterns, use the [Lua pattern tester](/lua-pattern-tester), which highlights every match."
        ],
        trace: {
          title: "Pulling values out of text",
          code: `local line = "hp=100"
local key, value = line:match("(%a+)=(%d+)")
print(key, value)
local hp = tonumber(value) or 0
print(hp + 1)`,
          steps: [
            { line: 1, say: "A string to search.", set: { line: "hp=100" } },
            {
              line: 2,
              say: "The pattern reads: one or more letters, captured; an `=`; one or more digits, captured. `match` returns the two captures, which go into `key` and `value`.",
              set: { key: "hp", value: "100" }
            },
            { line: 3, say: "Both captures are strings, even the digits.", print: "hp\t100" },
            { line: 4, say: "`tonumber` turns `\"100\"` into the number `100`. It gives `nil` for text that isn't a number, so `or 0` supplies a fallback.", set: { hp: 100 } },
            { line: 5, say: "Now it's a number, so arithmetic works.", print: "101" }
          ]
        }
      },
      {
        heading: "Replacing with gsub",
        text: [
          "`s:gsub(pattern, replacement)` replaces every match and returns the new string and the number of replacements. The replacement can be a string, where `%1` stands for the first capture, or a function that gets each match and returns its replacement."
        ],
        code: luau(
          `local text = "I like cats. Cats are great."
print(text:gsub("[Cc]ats", "dogs"))
print(("hello world"):gsub("%w+", string.upper))
print(("x=1, y=2"):gsub("(%w+)=(%w+)", "%2=%1"))`,
          { luau: "I like dogs. dogs are great.\t2\nHELLO WORLD\t2\n1=x, 2=y\t2" }
        )
      },
      {
        heading: "Formatting numbers",
        text: [
          "`string.format` fills a template: `%d` is a whole number, `%.2f` a number with two decimals, and `%s` a string. A number before the letter sets a minimum width, and `-` pads on the right. It's the tool for prices, tables, and anything that must line up; [string.format examples](/examples/string-format) has more."
        ],
        code: luau(
          `local price, quantity = 4.5, 3
print(string.format("%d x $%.2f = $%.2f", quantity, price, quantity * price))
print(("%-8s|%5d"):format("score", 42))`,
          { luau: "3 x $4.50 = $13.50\nscore   |   42" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Expecting a method to change the string: `name:upper()` returns a new string, so write `name = name:upper()`.",
          "Calling a method with a dot: `word.upper()` passes no string and fails. Use `word:upper()`.",
          "Forgetting that `.`, `-`, `+`, `%`, and brackets are special in patterns. Escape them with `%`: `%.` matches a literal dot. Or pass `true` as `find`'s fourth argument for a plain search.",
          "Building a long string with `..` in a loop, which copies the string each time. Collect the pieces in a table and `table.concat` them once."
        ]
      }
    ],
    exercise: {
      starter: `--!strict
-- initials("Ada Lovelace") should return "AL": the first letter of each
-- word, as a capital. Hint: name:gmatch("%a+") loops over the words.
local function initials(name: string): string
  return ""
end`,
      solution: `--!strict
-- initials("Ada Lovelace") should return "AL": the first letter of each
-- word, as a capital. Hint: name:gmatch("%a+") loops over the words.
local function initials(name: string): string
  local letters = {}
  for word in name:gmatch("%a+") do
    table.insert(letters, word:sub(1, 1):upper())
  end
  return table.concat(letters)
end`,
      checks: [
        ['initials("Ada Lovelace")', 'return initials("Ada Lovelace") == "AL"'],
        ['initials("grace brewster hopper")', 'return initials("grace brewster hopper") == "GBH"'],
        ['initials("") is empty', 'return initials("") == ""']
      ]
    },
    recap: [
      "Escapes such as `\\n` work in quotes; `[[...]]` strings take text as is.",
      "Methods use a colon, return new strings, and count positions from 1.",
      "`s:split(sep)` and `table.concat(t, sep)` split and join.",
      "Patterns use `%d`, `%a`, `%s`, `+`, `*`, `-`, and captures in parentheses.",
      "`gsub` replaces matches; `string.format` lines numbers up."
    ],
    faq: [
      ["How do I split a string in Luau?", "`str:split(\",\")` returns a table of the parts, splitting on plain text. In standard Lua there's no `split`; see [split a string in Lua](/examples/string-split) for the `gmatch` version."],
      [
        "Are Lua patterns regular expressions?",
        "No. They're smaller: there's no alternation with `|` and no `{n,m}` counts, and quantifiers apply to one character or class. In exchange there are extras like `%b()` for balanced brackets. The [Lua pattern tester](/lua-pattern-tester) has a cheat sheet."
      ],
      ["How do I convert a string to a number in Luau?", "`tonumber(\"42\")` returns `42`, and `nil` if the text isn't a number. `tostring(42)` goes the other way."]
    ],
    related: [
      ["Lua pattern tester", "/lua-pattern-tester"],
      ["string.format examples", "/examples/string-format"]
    ]
  },
  {
    slug: "metatables-and-classes",
    title: "Metatables and classes",
    metaTitle: "Learn Luau 6: Metatables, __index, and Classes | Weblua",
    description:
      "Lesson 6 of a free interactive Luau course: metatables, __index, methods with self, classes, operators, and inheritance, with an animated __index lookup.",
    answer:
      "A metatable changes how a table behaves. When a key is missing, Luau checks the metatable's `__index` and looks there instead. A class is built on that: methods live in one shared table, and each object's metatable points to it.",
    minutes: 14,
    outcomes: [
      "Attach a metatable with `setmetatable` and use `__index`",
      "Write a class with a constructor and methods using `self`",
      "Define operators such as `+` with metamethods",
      "Inherit methods from a parent class"
    ],
    blocks: [
      {
        text: [
          "So far, a missing key has always given `nil`. A metatable can change that, and change what operators like `+` and `==` do with a table. It's the machinery behind object-oriented Luau, and once you see how a lookup travels, classes stop being magic."
        ]
      },
      {
        heading: "Watch a lookup follow __index",
        text: [
          "Here `rex` is a dog object, `Dog` is its class, and `Dog` inherits from `Animal`. Pick a key. Luau looks in `rex` first; if the key is missing, it follows the metatable's `__index` to the next table, and so on until it finds the key or runs out of tables."
        ],
        lookup: {
          chain: [
            { name: "rex", keys: { name: '"Rex"' } },
            { name: "Dog", keys: { new: "function", speak: "function" } },
            { name: "Animal", keys: { new: "function", speak: "function", describe: "function" } }
          ],
          tries: ["name", "speak", "describe", "fly"]
        }
      },
      {
        heading: "setmetatable and __index",
        text: [
          "`setmetatable(t, mt)` attaches `mt` as `t`'s metatable and returns `t`. When `__index` in the metatable is a table, it acts as a fallback for missing keys. `rawget` reads a table directly, skipping the metatable, which shows the key really isn't there."
        ],
        trace: {
          title: "A missing key falls back to __index",
          code: `local defaults = { color = "red", size = 10 }
local settings = setmetatable({ size = 12 }, { __index = defaults })
print(settings.size)
print(settings.color)
print(rawget(settings, "color"))`,
          steps: [
            { line: 1, say: "A plain table of default values.", set: { defaults: { color: "red", size: 10 } } },
            { line: 2, say: "`setmetatable` gives `{ size = 12 }` a metatable whose `__index` is `defaults`. The table itself still holds only `size`.", set: { settings: { size: 12 } } },
            { line: 3, say: "`size` is in `settings`, so the metatable isn't consulted.", print: "12" },
            { line: 4, say: "`color` isn't in `settings`. Luau checks the metatable, finds `__index = defaults`, and reads `defaults.color`.", print: "red" },
            { line: 5, say: "`rawget` skips the metatable: `color` isn't really in `settings`.", print: "nil" }
          ]
        }
      },
      {
        heading: "A class",
        text: [
          "A class is a table of methods that is also its objects' metatable. `Point.__index = Point` makes missing keys on an object fall back to the class, which is where the methods are. The constructor, `Point.new`, makes each object and attaches the metatable.",
          "The colon passes the object along: `function Point:length()` is short for `function Point.length(self)`, and `p:length()` for `Point.length(p)`. Inside a method, `self` is the object it was called on. Annotating it, `self: PointData`, tells the checker which fields an object has; [Luau OOP](/examples/luau-oop) shows the fuller pattern that types the methods too."
        ],
        code: luau(
          `type PointData = { x: number, y: number }

local Point = {}
Point.__index = Point

function Point.new(x: number, y: number)
  return setmetatable({ x = x, y = y }, Point)
end

function Point.length(self: PointData): number
  return math.sqrt(self.x ^ 2 + self.y ^ 2)
end

function Point.scaled(self: PointData, factor: number)
  return Point.new(self.x * factor, self.y * factor)
end

local p = Point.new(3, 4)
print(p:length())
print(p:scaled(2):length())
print(getmetatable(p) == Point)`,
          { luau: "5\n10\ntrue" }
        )
      },
      {
        heading: "Operators with metamethods",
        text: [
          "Metamethods are metatable fields that Luau calls for operators. `__add` runs for `+`, `__eq` for `==`, `__lt` for `<`, `__tostring` for `tostring` and `print`, `__call` when you call a table like a function, and `__len` for `#`. Each gets the operands and returns the result."
        ],
        code: luau(
          `type VectorData = { x: number, y: number }

local Vector = {}
Vector.__index = Vector

function Vector.new(x: number, y: number)
  return setmetatable({ x = x, y = y }, Vector)
end

Vector.__add = function(a: VectorData, b: VectorData)
  return Vector.new(a.x + b.x, a.y + b.y)
end

Vector.__tostring = function(v: VectorData)
  return \`({v.x}, {v.y})\`
end

local sum = Vector.new(1, 2) + Vector.new(3, 4)
print(tostring(sum))
print(sum)`,
          { luau: "(4, 6)\n(4, 6)" }
        )
      },
      {
        heading: "Inheritance",
        text: [
          "To inherit, make the subclass's own metatable point at the parent. A lookup then goes object, subclass, parent, which is exactly the chain you clicked through above. A method defined on the subclass is found first, so it overrides the parent's."
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

local rex = Dog.new("Rex")
print(rex:speak())
print(rex:describe())`,
          { luau: "Rex barks\nI am Rex" }
        ),
        quiz: {
          question: "Which `greet` does `obj` find?",
          code: `local Base = { greet = function() return "base" end }
local Child = setmetatable({ greet = function() return "child" end }, { __index = Base })
local obj = setmetatable({}, { __index = Child })
print(obj.greet())`,
          options: ["base", "child", "nil", "an error"],
          answer: 1,
          why: "`obj` has no `greet`, so Luau follows `__index` to `Child`, which has one. The search stops at the first table that has the key, so `Base.greet` is never reached."
        }
      },
      {
        heading: "Common mistakes",
        list: [
          "Forgetting `Class.__index = Class`. Without it, objects can't find their methods and calls fail with \"attempt to call a nil value\".",
          "Calling a method with a dot: `p.length()` passes no `self`. Use `p:length()`.",
          "Mixing the two forms: a method defined with `.` and `self` as the first parameter is called with `:`, and so is one defined with `:`. Plain functions such as `Point.new` take no `self` and are called with `.`.",
          "Storing per-object data on the class table. Everything on the class is shared by every object."
        ]
      }
    ],
    exercise: {
      starter: `--!strict
-- Finish the Stack class: push adds a value on top, pop removes and returns
-- the top value (nil when the stack is empty), and size counts the values.
type StackData = { items: { number } }

local Stack = {}
Stack.__index = Stack

function Stack.new()
  return setmetatable({ items = {} :: { number } }, Stack)
end

function Stack.push(self: StackData, value: number)
end

function Stack.pop(self: StackData): number?
  return nil
end

function Stack.size(self: StackData): number
  return 0
end`,
      solution: `--!strict
-- Finish the Stack class: push adds a value on top, pop removes and returns
-- the top value (nil when the stack is empty), and size counts the values.
type StackData = { items: { number } }

local Stack = {}
Stack.__index = Stack

function Stack.new()
  return setmetatable({ items = {} :: { number } }, Stack)
end

function Stack.push(self: StackData, value: number)
  table.insert(self.items, value)
end

function Stack.pop(self: StackData): number?
  return table.remove(self.items)
end

function Stack.size(self: StackData): number
  return #self.items
end`,
      checks: [
        ["a new stack is empty", "return Stack.new():size() == 0"],
        ["push adds to the size", "local s = Stack.new()\n  s:push(1)\n  s:push(2)\n  return s:size() == 2"],
        ["pop returns the last value pushed", "local s = Stack.new()\n  s:push(1)\n  s:push(2)\n  return s:pop() == 2 and s:pop() == 1 and s:pop() == nil"]
      ]
    },
    recap: [
      "`setmetatable(t, mt)` attaches a metatable; `__index` handles missing keys.",
      "A class is a method table with `Class.__index = Class`, and a constructor that calls `setmetatable`.",
      "`obj:method()` passes `obj` as `self`.",
      "Metamethods such as `__add`, `__eq`, and `__tostring` define operators.",
      "Inheritance chains `__index`: object, then class, then parent."
    ],
    faq: [
      ["Does Luau have classes?", "Not as a keyword. A class is a table of methods used as its objects' metatable, as on this page. It's the same pattern Roblox code uses."],
      [
        "What is the difference between . and : in Luau?",
        "`obj:method(x)` is shorthand for `obj.method(obj, x)`: the colon passes the object as the first argument, called `self`. Use `:` to call methods and `.` for functions that don't take an object, such as `Point.new`."
      ],
      [
        "What is __index in Luau?",
        "A metatable field Luau checks when a key is missing from a table. If `__index` is a table, Luau looks the key up there; if it's a function, Luau calls it with the table and the key and uses what it returns."
      ]
    ],
    related: [
      ["Object-oriented programming in Luau", "/examples/luau-oop"],
      ["Lua metatables and __index", "/examples/metatables"]
    ]
  },
  {
    slug: "types",
    title: "Type annotations",
    metaTitle: "Learn Luau 7: Type Annotations and Strict Mode | Weblua",
    description:
      "Lesson 7 of a free interactive Luau course: type annotations, inference, optional types, narrowing, type aliases, unions, generics, and --!strict, checked as you type.",
    answer:
      "Luau checks types before your code runs. Annotations such as `name: string` say what a variable or parameter holds, the checker infers the rest, and with `--!strict` at the top of a file it reports mistakes as you type. Types never change what the program does.",
    minutes: 13,
    outcomes: [
      "Annotate parameters, return values, and variables",
      "Handle optional values and let the checker narrow them",
      "Name shapes with `type` aliases and unions",
      "Write a generic function"
    ],
    blocks: [
      {
        text: [
          "Everything so far would run the same with or without types. What types add is a second reader: the checker reads your code before it runs and tells you when something can't be right. Watch it work out a type for each variable, from nothing but the text."
        ],
        trace: {
          title: "What the checker infers",
          scope: "Types",
          code: `--!strict
local score = 10
local name = "Ada"
local nickname: string? = nil
local label = nickname or name
local doubled = score * 2`,
          steps: [
            { line: 1, say: "`--!strict` turns on strict mode for this file: every value gets a type, and type mistakes are reported as errors." },
            { line: 2, say: "No annotation needed: the checker infers `number` from `10`.", set: { score: raw("number") } },
            { line: 3, say: "And `string` from `\"Ada\"`.", set: { name: raw("string") } },
            {
              line: 4,
              say: "`string?` means a string or `nil`. This one needs an annotation: from `nil` alone, the checker can't know what else it might hold later.",
              set: { nickname: raw("string?") }
            },
            { line: 5, say: "`nickname or name` is always a `string`: when `nickname` is `nil`, `or` picks `name`. The checker follows that logic.", set: { label: raw("string") } },
            { line: 6, say: "`number * number` is a `number`. Nothing has run yet; all of this came from reading the code.", set: { doubled: raw("number") } }
          ]
        }
      },
      {
        heading: "Annotating functions",
        text: [
          "Annotate a function's parameters and return type, and let inference handle the locals inside. `number?` makes `times` optional, and `or` supplies a default. In the playground, uncomment the last line and the checker underlines it: `42` isn't a string."
        ],
        code: luau(
          `--!strict
local function greet(name: string, times: number?): string
  return string.rep(\`Hello, {name}! \`, times or 1)
end

print(greet("Ada"))
print(greet("Grace", 2))
-- greet(42)`,
          { luau: "Hello, Ada! \nHello, Grace! Hello, Grace! " }
        )
      },
      {
        heading: "What strict mode catches",
        text: ["Without types, each of these runs and fails later, or quietly gives a wrong answer. In strict mode the checker flags them as you type."],
        table: {
          head: ["Mistake", "Example", "Without the checker"],
          rows: [
            ["Wrong kind of argument", "`greet(42)`", "Fails inside the function, far from the real mistake"],
            ["Misspelled field", "`player.helth`", "Reads `nil` without complaint"],
            ["Value that might be `nil`", "`tonumber(text) + 1`", "Errors only when the text isn't a number"],
            ["Missing argument", "`greet()`", "The parameter is silently `nil`"],
            ["Returning the wrong type", "`return \"5\"` from a `: number` function", "The caller gets a string"]
          ]
        },
        note: "Type errors don't stop a run. Luau compiles and runs code whether or not it type-checks; the checker is a tool for you, not a gate. That's why the lessons' editors let you press Run even with an underline showing."
      },
      {
        heading: "Optional values and narrowing",
        text: [
          "A function that might not have an answer returns `T?`. Before you use the result, check it: after `if age then`, the checker knows `age` isn't `nil` inside the block, so `age + 1` is allowed. This is called narrowing. Outside the `if`, `age + 1` would be an error."
        ],
        code: luau(
          `--!strict
local function parseAge(text: string): number?
  local age = tonumber(text)
  if age and age >= 0 then
    return age
  end
  return nil
end

local age = parseAge("36")
if age then
  print(age + 1)
end
print(parseAge("abc"), parseAge("-5"))`,
          { luau: "37\nnil\tnil" }
        ),
        quiz: {
          question: "In strict mode, which line does the checker reject?",
          options: ["`local n: number = 5`", "`local s: string = 5`", "`local t: { number } = { 1, 2 }`", "`local m: number? = nil`"],
          answer: 1,
          why: "`5` is a number, but the annotation says `s` is a string. The other three match: `{ number }` is an array of numbers, and `number?` allows `nil`."
        }
      },
      {
        heading: "Type aliases",
        text: [
          "`type` gives a shape a name so you can reuse it. A field whose type ends in `?` may be missing, and `{ Item }` is an array of items. Aliases cost nothing at runtime: they exist only for the checker."
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
          { luau: "200" }
        )
      },
      {
        heading: "Unions and literal types",
        text: [
          "A union, `A | B`, is a value that's one of several types. Give each shape a field with a literal type, such as `kind: \"circle\"`, and checking that field narrows the union: inside `if shape.kind == \"circle\"`, the checker knows `shape.radius` exists."
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
          { luau: "9\n3.14" }
        )
      },
      {
        heading: "Generics",
        text: [
          "A generic function works for any type while keeping track of which one. `<T>` introduces a type parameter: `first` returns the same type its array holds, so `first({ \"a\" })` is a `string?` and `first({ 1 })` a `number?`. `map` has two type parameters, for what goes in and what comes out."
        ],
        code: luau(
          `--!strict
local function first<T>(items: { T }): T?
  return items[1]
end

local function map<T, U>(items: { T }, f: (T) -> U): { U }
  local out = {}
  for index, item in items do
    out[index] = f(item)
  end
  return out
end

print(first({ "a", "b" }), first({ 10, 20 }))
local labels = map({ 1, 2, 3 }, function(n)
  return \`#{n}\`
end)
print(table.concat(labels, " "))`,
          { luau: "a\t10\n#1 #2 #3" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Annotating every local. Inference handles locals; annotate parameters, return types, and empty tables or `nil` starting values.",
          "Silencing errors with `:: any`. It works, but it turns off checking for that value, and the bug the checker saw is still there.",
          "Using a `T?` value without checking it. Narrow it with `if value then`, or give a default with `or`.",
          "Expecting types to exist at runtime. `type(x)` still returns the runtime kind, such as `\"table\"`, never the name of your alias. Classes are typed with `typeof`; see [Luau OOP](/examples/luau-oop)."
        ]
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
    },
    recap: [
      "Annotations go after a colon: `x: number`, `(...): string`.",
      "The checker infers most types; `--!strict` makes it report every mismatch.",
      "`T?` means `T` or `nil`; check it before use and the type narrows.",
      "`type Name = ...` names a shape; `A | B` is a union.",
      "`<T>` makes a function generic. Types never change how code runs."
    ],
    faq: [
      [
        "What is --!strict in Luau?",
        "A comment on the first line of a file that sets how strictly it's type-checked. `--!strict` reports every type error, `--!nonstrict` assumes `any` wherever it can't be sure, and `--!nocheck` turns checking off for the file."
      ],
      [
        "Do Luau type annotations make code faster?",
        "Not by themselves: the interpreter ignores them. Luau's optional native code generation can use them as hints, but the main point of types is catching mistakes before you run."
      ],
      ["Can I use Luau types in Roblox Studio?", "Yes. Studio runs the same checker. Add `--!strict` at the top of a script to turn on strict mode for it."]
    ],
    related: [
      ["Luau type checker", "/luau-type-checker"],
      ["Luau type annotation examples", "/examples/luau-types"]
    ]
  },
  {
    slug: "coroutines-and-task",
    title: "Coroutines and the task library",
    metaTitle: "Learn Luau 8: Coroutines, task.spawn, and task.wait | Weblua",
    description:
      "Lesson 8 of a free interactive Luau course: coroutines, yield and resume, generators, and task.spawn, defer, delay, wait, and cancel, animated thread by thread.",
    answer:
      "A coroutine is a function that can pause with `coroutine.yield` and later carry on from the same spot. The `task` library schedules coroutines for you: `task.spawn` starts one, `task.wait` pauses it for a while, and other code runs in the meantime.",
    minutes: 14,
    outcomes: [
      "Create, resume, and yield a coroutine and read its status",
      "Write a generator with `coroutine.wrap`",
      "Run code alongside other code with `task.spawn` and `task.defer`",
      "Wait, delay, and cancel with the `task` library"
    ],
    blocks: [
      {
        text: [
          "Most code runs from top to bottom and finishes. Games and tools often need code that waits: for a timer, for a player, for something to load. Luau's answer is the coroutine, a function that can pause in the middle and pick up where it left off. Watch the coroutine's status change as control passes back and forth."
        ],
        trace: {
          title: "A coroutine pauses and resumes",
          code: `local function steps()
  print("step 1")
  coroutine.yield()
  print("step 2")
end

local co = coroutine.create(steps)
coroutine.resume(co)
print("main code")
coroutine.resume(co)
print(coroutine.status(co))`,
          steps: [
            { line: 1, say: "An ordinary function.", set: { steps: raw("function") } },
            { line: 7, say: "`coroutine.create` wraps it in a coroutine. Nothing runs yet: its status is `suspended`.", set: { co: raw("suspended") } },
            { line: 8, say: "`coroutine.resume` starts it. The main code waits while the coroutine runs.", set: { co: raw("running") } },
            { line: 2, say: "The coroutine's first line runs.", print: "step 1" },
            {
              line: 3,
              say: "`coroutine.yield` pauses the coroutine and hands control back to the line that resumed it. The coroutine remembers that it stopped here.",
              set: { co: raw("suspended") }
            },
            { line: 9, say: "The main code carries on.", print: "main code" },
            { line: 10, say: "Resuming again continues right after the `yield`, not from the top.", set: { co: raw("running") } },
            { line: 4, say: "The rest of the function runs.", print: "step 2" },
            { line: 5, say: "The function reaches its end, so the coroutine is finished. A `dead` coroutine can't be resumed.", set: { co: raw("dead") } },
            { line: 11, say: "`coroutine.status` reports it.", print: "dead" }
          ]
        }
      },
      {
        heading: "Passing values in and out",
        text: [
          "Values travel both ways. The arguments to the first `resume` become the function's parameters. Values passed to `yield` come out of that `resume`, after `true`. Values passed to the next `resume` come out of `yield`. Once a coroutine is dead, `resume` returns `false` and an error message instead of raising an error."
        ],
        table: {
          head: ["Function", "What it does"],
          rows: [
            ["`coroutine.create(f)`", "Makes a coroutine from a function, suspended"],
            ["`coroutine.resume(co, ...)`", "Runs it until it yields or ends; returns `true` and the values, or `false` and an error"],
            ["`coroutine.yield(...)`", "Pauses the running coroutine, handing values back"],
            ["`coroutine.status(co)`", "`\"suspended\"`, `\"running\"`, `\"normal\"`, or `\"dead\"`"],
            ["`coroutine.wrap(f)`", "Makes a coroutine you resume by calling it like a function"],
            ["`coroutine.isyieldable()`", "Whether the current code can yield"]
          ]
        },
        code: luau(
          `local co = coroutine.create(function(a: number, b: number)
  local c = coroutine.yield(a + b)
  return c * 2
end)

print(coroutine.resume(co, 1, 2))
print(coroutine.resume(co, 10))
print(coroutine.resume(co))`,
          { luau: "true\t3\ntrue\t20\nfalse\tcannot resume dead coroutine" }
        )
      },
      {
        heading: "Generators with coroutine.wrap",
        text: [
          "`coroutine.wrap` returns a function that resumes the coroutine each time you call it and returns what it yields. That makes it a neat way to write an iterator for a `for` loop: yield each value, then return `nil` to end the loop.",
          "The `: number?` annotation and the final `return nil` are for the checker: it reads the iterator's type from what the function returns, not from what it yields."
        ],
        code: luau(
          `local function range(n: number)
  return coroutine.wrap(function(): number?
    for i = 1, n do
      coroutine.yield(i)
    end
    return nil
  end)
end

for i in range(3) do
  print(i)
end`,
          { luau: "1\n2\n3" }
        ),
        quiz: {
          question: "In what order do the letters print?",
          code: `local co = coroutine.wrap(function()
  print("a")
  coroutine.yield()
  print("b")
end)
co()
print("c")
co()`,
          options: ["a\nb\nc", "a\nc\nb", "c\na\nb", "a\nb"],
          answer: 1,
          why: "The first `co()` runs until the `yield`, printing `a`. The main code prints `c`. The second `co()` resumes after the `yield` and prints `b`."
        }
      },
      {
        heading: "The task library",
        text: [
          "Resuming coroutines by hand gets tedious. The `task` library hands that job to a scheduler. It comes from Roblox, other Luau runtimes such as Lune copy it, and Weblua provides it too, so the code here runs the way it would in a Roblox script. Waits last at least one frame, about 1/60 of a second, as on Roblox.",
          "Watch two threads take turns: whenever one waits, the other gets to run."
        ],
        table: {
          head: ["Function", "What it does"],
          rows: [
            ["`task.spawn(f, ...)`", "Runs `f` now, as a new thread, until it first waits; then the caller continues"],
            ["`task.defer(f, ...)`", "Runs `f` as a new thread once the current thread waits or ends"],
            ["`task.delay(t, f, ...)`", "Runs `f` after `t` seconds"],
            ["`task.wait(t)`", "Pauses the current thread for `t` seconds, at least one frame, and returns the time waited"],
            ["`task.cancel(thread)`", "Stops a thread that hasn't finished"]
          ]
        },
        trace: {
          title: "Two threads take turns",
          scope: "Threads",
          code: `task.spawn(function()
  print("A: start")
  task.wait(0.1)
  print("A: done")
end)
print("main: after spawn")
task.wait(0.2)
print("main: done")`,
          steps: [
            {
              line: 1,
              say: "`task.spawn` starts the function right away as a new thread, A. The main thread is paused until A waits or finishes.",
              set: { main: raw("paused"), A: raw("running") }
            },
            { line: 2, say: "Thread A prints.", print: "A: start" },
            {
              line: 3,
              say: "`task.wait(0.1)` puts A to sleep for a tenth of a second and gives control back. The main thread continues after `task.spawn`.",
              set: { A: raw("waiting 0.1 s"), main: raw("running") }
            },
            { line: 6, say: "The main thread prints.", print: "main: after spawn" },
            { line: 7, say: "Now the main thread sleeps too. Both are waiting, and the scheduler wakes whichever is due first.", set: { main: raw("waiting 0.2 s") } },
            { line: 4, say: "After 0.1 seconds, A wakes and finishes its function.", set: { A: raw("running") }, print: "A: done" },
            { line: 5, say: "Thread A is done.", set: { A: raw("dead") } },
            { line: 8, say: "At 0.2 seconds the main thread wakes and prints its last line.", set: { main: raw("running") }, print: "main: done" }
          ]
        }
      },
      {
        heading: "spawn, defer, and delay",
        text: [
          "The three ways to start a thread differ in when it starts. `task.spawn` runs it immediately. `task.defer` runs it once the current thread waits or ends, which here is at `task.wait`. `task.delay` runs it after a number of seconds."
        ],
        code: luau(
          `task.defer(function()
  print("deferred")
end)
task.spawn(function()
  print("spawned")
end)
task.delay(0.05, function()
  print("delayed")
end)
print("main")
task.wait(0.1)
print("end")`,
          { luau: "spawned\nmain\ndeferred\ndelayed\nend" }
        )
      },
      {
        heading: "Canceling a thread",
        text: [
          "`task.spawn` returns the thread it started. Keep it, and `task.cancel` can stop that thread later, for example a repeating timer you no longer need."
        ],
        code: luau(
          `local ticker = task.spawn(function()
  for i = 1, 10 do
    print("tick", i)
    task.wait(0.1)
  end
end)
task.wait(0.25)
task.cancel(ticker)
print("canceled")`,
          { luau: "tick\t1\ntick\t2\ntick\t3\ncanceled" }
        )
      },
      {
        heading: "Common mistakes",
        list: [
          "Waiting in a loop without yielding: `while not ready do end` freezes everything, because only one thread runs at a time. Put `task.wait()` in the loop.",
          "Expecting `task.spawn` to wait for the thread to finish. It returns as soon as the thread first waits.",
          "Expecting `task.wait(0)` to return instantly. It waits at least one frame.",
          "Resuming a dead coroutine and ignoring the result: `coroutine.resume` reports the failure as `false` and a message rather than an error."
        ]
      }
    ],
    exercise: {
      starter: `--!strict
-- evens(n) returns an iterator over the even numbers from 2 up to n:
-- for value in evens(6) do ... end visits 2, 4, and 6.
-- Hint: return coroutine.wrap(function() ... coroutine.yield(value) ... end)
local function evens(n: number): () -> number?
  return function(): number?
    return nil
  end
end`,
      solution: `--!strict
-- evens(n) returns an iterator over the even numbers from 2 up to n:
-- for value in evens(6) do ... end visits 2, 4, and 6.
-- Hint: return coroutine.wrap(function() ... coroutine.yield(value) ... end)
local function evens(n: number): () -> number?
  return coroutine.wrap(function(): number?
    for value = 2, n, 2 do
      coroutine.yield(value)
    end
    return nil
  end)
end`,
      checks: [
        ["evens(6) visits 2, 4, 6", 'local seen = ""\n  for value in evens(6) do\n    seen ..= tostring(value) .. " "\n  end\n  return seen == "2 4 6 "'],
        ["evens(1) visits nothing", "for _ in evens(1) do\n    return false\n  end\n  return true"],
        ["evens(5) stops at 4", "local last: number? = 0\n  for value in evens(5) do\n    last = value\n  end\n  return last == 4"]
      ]
    },
    recap: [
      "`coroutine.create` makes a coroutine; `resume` runs it until it yields or ends.",
      "`yield` pauses and remembers the spot; values pass both ways.",
      "`coroutine.wrap` turns a coroutine into a function, handy for iterators.",
      "`task.spawn`, `task.defer`, and `task.delay` start threads now, soon, or later.",
      "`task.wait` lets other threads run; `task.cancel` stops one."
    ],
    faq: [
      [
        "Is the task library part of Luau?",
        "No. `task` comes from Roblox, and other Luau runtimes such as Lune copy it; the core language has only `coroutine`. Weblua provides `task.spawn`, `task.defer`, `task.delay`, `task.wait`, and `task.cancel` so Roblox-style code runs here."
      ],
      [
        "What is the difference between task.spawn and coroutine.wrap?",
        "`coroutine.wrap` gives you a function, and you decide when to resume the coroutine by calling it. `task.spawn` hands the coroutine to the scheduler, which resumes it after each wait for you."
      ],
      [
        "Do Luau coroutines run in parallel?",
        "No. Only one runs at a time, and each runs until it yields, which is why a loop without a wait blocks everything else. Roblox's Parallel Luau, which runs scripts under Actor instances on several cores, is a separate feature."
      ]
    ],
    related: [
      ["Luau playground", "/luau"],
      ["Back to all lessons", "/learn-luau"]
    ]
  }
];
