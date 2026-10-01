import capabilityTourDocument from "../../examples/weblua-capability-tour.weblua.json";
import { assertProjectPayload, projectFromSnippet } from "./project";
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
