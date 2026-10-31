import capabilityTourDocument from "../../examples/weblua-capability-tour.weblua.json";
import { assertProjectPayload, projectFromSnippet } from "./project";
import type { PlaygroundTool } from "./routes";
import type { PlaygroundExample, ProjectPayload } from "./types";

export const examples: PlaygroundExample[] = [
  {
    id: "hello",
    title: "Hello world",
    flavor: "lua54",
    code: `print("hello from lua")
print(_VERSION)`
  },
  {
    id: "tables",
    title: "Tables",
    flavor: "lua54",
    code: `local colors = { "red", "green", "blue" }

for index, color in ipairs(colors) do
  print(index, color)
end`
  },
  {
    id: "maps",
    title: "Keyed tables",
    flavor: "lua54",
    code: `local counts = {
  apples = 4,
  oranges = 7,
  pears = 2
}

for fruit, count in pairs(counts) do
  print(fruit .. ": " .. count)
end`
  },
  {
    id: "metatables",
    title: "Metatables",
    flavor: "lua54",
    code: `local vector = {}
vector.__index = vector

function vector.new(x, y)
  return setmetatable({ x = x, y = y }, vector)
end

function vector:len()
  return math.sqrt(self.x * self.x + self.y * self.y)
end

print(vector.new(3, 4):len())`
  },
  {
    id: "coroutines",
    title: "Coroutines",
    flavor: "lua54",
    code: `local worker = coroutine.create(function()
  for i = 1, 3 do
    coroutine.yield("step " .. i)
  end
  return "done"
end)

while coroutine.status(worker) ~= "dead" do
  print(coroutine.resume(worker))
end`
  },
  {
    id: "closures",
    title: "Closures",
    flavor: "lua54",
    code: `local function counter()
  local value = 0
  return function()
    value = value + 1
    return value
  end
end

local nextValue = counter()
print(nextValue())
print(nextValue())
print(nextValue())`
  },
  {
    id: "patterns",
    title: "Patterns",
    flavor: "lua54",
    code: `local text = "red=12 green=8 blue=19"

for name, value in text:gmatch("(%a+)=(%d+)") do
  print(name, tonumber(value) * 2)
end`
  },
  {
    id: "iterators",
    title: "Custom iterator",
    flavor: "lua54",
    code: `local function range(startValue, endValue)
  local current = startValue - 1
  return function()
    current = current + 1
    if current <= endValue then
      return current
    end
  end
end

for value in range(3, 7) do
  print(value)
end`
  },
  {
    id: "errors",
    title: "Runtime error",
    flavor: "lua54",
    code: `local function divide(a, b)
  assert(b ~= 0, "cannot divide by zero")
  return a / b
end

print(divide(10, 0))`
  },
  {
    id: "lua55-changes",
    title: "New in Lua 5.5",
    flavor: "lua55",
    code: `-- New in Lua 5.5 -- see lua.org/manual/5.5/readme.html#changes
global print, ipairs, table, utf8

-- Once a chunk declares one global, every global it uses must be declared.
global total
total = 0

-- A named vararg arrives as an ordinary table.
local function sum(label, ...values)
  for _, value in ipairs(values) do
    total = total + value
  end
  return label, #values
end

print(sum("added", 3, 4, 5))
print("total", total)

-- table.create preallocates; utf8.offset now also returns the final position.
local slots = table.create(4, 0)
slots[1] = "first"
print("slots", #slots, slots[1])
print("utf8.offset", utf8.offset("héllo", 3))

-- Floats print with enough digits to be read back exactly.
print(1 / 3)

-- Loop variables are read only, so this would not compile:
--   for i = 1, 3 do i = i + 1 end
for i = 1, 3 do
  print("i", i)
end`
  },
  {
    id: "luau-types",
    title: "Luau annotations",
    flavor: "luau",
    code: `local function greet(name: string): string
  return "hello, " .. name
end

print(greet("luau"))`
  },
  {
    id: "luau-table",
    title: "Luau typed table",
    flavor: "luau",
    code: `type Item = {
  name: string,
  score: number
}

local items: { Item } = {
  { name = "alpha", score = 12 },
  { name = "beta", score = 18 }
}

for _, item in items do
  print(item.name, item.score)
end`
  },
  {
    id: "luau-generics",
    title: "Luau generic",
    flavor: "luau",
    code: `local function first<T>(items: { T }): T?
  return items[1]
end

print(first({ "one", "two" }))`
  },
  {
    id: "luau-typed-modules",
    title: "Luau typed modules",
    project: assertProjectPayload({
      flavor: "luau",
      entry: "main.luau",
      files: {
        "main.luau": `--!strict
-- Types cross files: hover \`potion\` or \`bag\`, or type \`inventory.\` to see them.
local inventory = require("./lib/inventory")

-- An exported type is reached through the module's local name.
type Item = inventory.Item

local bag = inventory.new()
inventory.add(bag, "potion", 3)
inventory.add(bag, "arrow", 12)
local potion: Item = inventory.add(bag, "potion", 2)

print(\`{potion.name} now: {potion.count}\`)
for _, item in inventory.sorted(bag) do
  print(item.name, item.count)
end

-- Uncomment the next line: the checker flags "ten", because count is a number.
-- inventory.add(bag, "bolt", "ten")`,
        "lib/inventory.luau": `-- A module can export types along with its functions.
export type Item = {
  name: string,
  count: number,
}

export type Inventory = {
  items: { [string]: Item },
}

local inventory = {}

function inventory.new(): Inventory
  return { items = {} }
end

function inventory.add(bag: Inventory, name: string, count: number): Item
  local item = bag.items[name]
  if item then
    item.count += count
  else
    item = { name = name, count = count }
    bag.items[name] = item
  end
  return item
end

function inventory.sorted(bag: Inventory): { Item }
  local list: { Item } = {}
  for _, item in bag.items do
    table.insert(list, item)
  end
  table.sort(list, function(a: Item, b: Item): boolean
    return a.name < b.name
  end)
  return list
end

return inventory`
      }
    })
  },
  {
    id: "luau-tasks",
    title: "Luau tasks and modules",
    project: assertProjectPayload({
      flavor: "luau",
      entry: "main.luau",
      files: {
        "main.luau": `-- task schedules coroutines. Waits are real time, so output streams in.
local countdown = require("./lib/countdown")
local log = require("./lib/log")

task.spawn(countdown.run, "rocket", 3)
task.delay(0.5, log.say, "delayed half a second")
task.defer(log.say, "deferred until main yields")

log.say("main waits")
local waited = task.wait(1)
log.say(string.format("main resumed after %.1fs", waited))`,
        "lib/countdown.luau": `-- ./ is relative to this file, so this is lib/log.luau.
local log = require("./log")

local countdown = {}

function countdown.run(label: string, from: number)
  for n = from, 1, -1 do
    log.say(\`{label}: {n}\`)
    task.wait(0.4)
  end
  log.say(\`{label}: liftoff\`)
end

return countdown`,
        "lib/log.luau": `local log = {}

function log.say(message: string)
  print(message)
end

return log`
      }
    })
  },
  {
    id: "capability-tour",
    title: "Multi-file capability tour",
    project: assertProjectPayload(capabilityTourDocument.project),
    stdin: "Ada\nfirst note\nsecond note"
  }
];

export const defaultExample = examples[0];

/**
 * What each tool page opens with. Kept out of `examples`: the type checker's
 * demo has a deliberate type error, and none belongs in the example picker.
 */
export const toolExamples: Record<PlaygroundTool, PlaygroundExample> = {
  formatter: {
    id: "formatter-demo",
    title: "Unformatted Lua",
    flavor: "lua54",
    code: `-- Press Format (Shift+Alt+F) to tidy this up with StyLua.
local function   fib( n )
if n<2 then return n end
    return fib(n-1)+fib( n-2 )
end
local results={}
for i=1,10 do results[#results+1]=fib(i) end
print(table.concat(results,", "))`
  },
  "type-checker": {
    id: "type-checker-demo",
    title: "Luau type error",
    flavor: "luau",
    code: `--!strict
-- The type checker runs as you type. Hover the underlined value to see why.
type Item = { name: string, price: number }

local function total(items: { Item }): number
  local sum = 0
  for _, item in items do
    sum += item.price
  end
  return sum
end

local cart: { Item } = {
  { name = "sword", price = 120 },
  { name = "shield", price = "80" },
}

print(total(cart))`
  },
  bytecode: {
    id: "bytecode-demo",
    title: "Luau bytecode",
    flavor: "luau",
    code: `-- The Bytecode tab shows what the Luau compiler emits for this file.
-- Edit the code, or change Optimize and Debug, and the listing follows.
local function sumSquares(values: { number }): number
  local total = 0
  for _, value in values do
    total += value * value
  end
  return total
end

-- At optimize level 2, the compiler folds this constant expression.
local seconds = 60 * 60 * 24

print(sumSquares({ 1, 2, 3, 4 }), seconds)`
  },
  lua: {
    id: "lua-demo",
    title: "Lua playground",
    flavor: "lua54",
    code: `-- Write Lua here and press Run (Ctrl+Enter). Pick 5.1 to 5.5 under Runtime.
local function greet(name)
  return ("Hello, %s!"):format(name)
end

print(greet("Lua"))
print(_VERSION)

local squares = {}
for i = 1, 5 do
  squares[#squares + 1] = i * i
end
print(table.concat(squares, ", "))`
  },
  luau: {
    id: "luau-demo",
    title: "Luau playground",
    flavor: "luau",
    code: `-- Write Luau here and press Run (Ctrl+Enter). Types are checked as you type.
local function greet(name: string): string
  return \`Hello, {name}!\`
end

print(greet("Luau"))

local squares: { number } = {}
for i = 1, 5 do
  table.insert(squares, i * i)
end
print(table.concat(squares, ", "))`
  },
  "lua-vs-luau": {
    id: "lua-vs-luau-demo",
    title: "Lua 5.1 vs Luau",
    flavor: "lua51",
    code: `-- Lua 5.1 and Luau run this file side by side. Edit it and press Run.
-- Luau grew out of Lua 5.1, so plain Lua code mostly behaves the same.
print("version:", _VERSION)

-- The same on both: tables, closures, metatables, and string patterns.
local words = {}
for word in ("the quick brown fox"):gmatch("%a+") do
  words[#words + 1] = word:upper()
end
print(table.concat(words, " "))

-- Luau adds library functions that Lua 5.1 does not have.
print("string.split:", type(string.split))
print("table.find:", type(table.find))
print("math.clamp:", type(math.clamp))
print("table.unpack:", type(table.unpack))

-- Lua 5.1 compiles code at runtime with loadstring. Luau leaves that to the
-- app that embeds it, and Weblua's doesn't add it.
print("loadstring:", type(loadstring))

-- Luau also accepts +=, continue, \`{interpolated}\` strings,
-- if-expressions, and type annotations, which Lua 5.1 rejects.
-- Uncomment the next line and run again to see Lua 5.1's syntax error:
-- local total = 1; total += 1; print("total:", total)`
  },
  "lua51-vs-lua54": {
    id: "lua51-vs-lua54-demo",
    title: "Lua 5.1 vs 5.4",
    flavor: "lua51",
    code: `-- Lua 5.1 and Lua 5.4 run this file side by side. Edit it and press Run.
print("version:", _VERSION)

-- Lua 5.3 added integers. / always gives a float; on 5.4 that prints as 3.0.
print("7 / 2 =", 7 / 2)
print("6 / 2 =", 6 / 2)
print("2^53 =", 2^53)
print("math.maxinteger:", math.maxinteger)

-- unpack moved into the table library in 5.2, and setfenv gave way to _ENV.
print("unpack:", type(unpack), "table.unpack:", type(table.unpack))
print("setfenv:", type(setfenv))

-- 5.3 added the utf8 library.
print("utf8:", type(utf8))

-- Strings still convert to numbers in arithmetic on both.
print('"10" + 5 =', "10" + 5)

-- Syntax added after 5.1: goto (5.2), // and bitwise operators (5.3),
-- and <const> and <close> locals (5.4). Uncomment to see 5.1 reject it:
-- print(7 // 2, 6 & 3)`
  }
};

/** The example a `#example=<id>` link names: from the picker, a tool page, or an article. */
export async function findExample(hash: string): Promise<PlaygroundExample | undefined> {
  const id = new URLSearchParams(hash.replace(/^#/, "")).get("example");
  if (!id) return undefined;
  const builtIn = [...examples, ...Object.values(toolExamples)].find((example) => example.id === id);
  if (builtIn) return builtIn;
  // Article text stays out of the playground's chunk until a link asks for it.
  const { articleExamples } = await import("./articles");
  return articleExamples().find((example) => example.id === id);
}

export function projectForExample(example: PlaygroundExample): ProjectPayload {
  return "project" in example
    ? assertProjectPayload(example.project)
    : projectFromSnippet(example);
}

/**
 * projectForExample() rebuilds and re-validates a project on every call, and
 * exampleMatchesProject() runs across the whole example list on every
 * keystroke to decide whether the picker still reads "custom". Caching the
 * comparison copies takes that off the typing path -- it was the bulk of the
 * 456ms INP the field data attributes to .cm-content. Callers of
 * projectForExample() still get a fresh, mutable project.
 */
const comparisonProjects = new WeakMap<PlaygroundExample, ProjectPayload>();

function comparisonProject(example: PlaygroundExample): ProjectPayload {
  let cached = comparisonProjects.get(example);
  if (!cached) {
    cached = projectForExample(example);
    comparisonProjects.set(example, cached);
  }
  return cached;
}

export function exampleMatchesProject(example: PlaygroundExample, project: ProjectPayload): boolean {
  const candidate = comparisonProject(example);
  const candidatePaths = Object.keys(candidate.files);
  const projectPaths = Object.keys(project.files);

  return (
    candidate.flavor === project.flavor &&
    candidate.entry === project.entry &&
    candidatePaths.length === projectPaths.length &&
    candidatePaths.every((path) => candidate.files[path] === project.files[path])
  );
}
