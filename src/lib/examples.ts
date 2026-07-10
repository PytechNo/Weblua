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

export function exampleMatchesProject(example: PlaygroundExample, project: ProjectPayload): boolean {
  const candidate = projectForExample(example);
  const candidatePaths = Object.keys(candidate.files);
  const projectPaths = Object.keys(project.files);

  return (
    candidate.flavor === project.flavor &&
    candidate.entry === project.entry &&
    candidatePaths.length === projectPaths.length &&
    candidatePaths.every((path) => candidate.files[path] === project.files[path])
  );
}
