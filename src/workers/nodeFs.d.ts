// The execution suites run in Vitest's Node environment and read the Lua
// WebAssembly straight from node_modules. Declaring just that one API keeps the
// test host typechecked without adding @types/node, which would put Node
// globals in scope for the browser sources too.
declare module "node:fs/promises" {
  export function readFile(path: string): Promise<Uint8Array>;
}
