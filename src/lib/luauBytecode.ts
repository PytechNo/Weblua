import type {
  BytecodeOptions,
  BytecodeRequest,
  BytecodeResponse,
  BytecodeResult,
  CompilerLevel
} from "./types";

/** The first request downloads and compiles the Luau compiler (~830 KB gzipped). */
const LOAD_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

interface Compiler {
  worker: Worker;
  pending: Map<string, (response: BytecodeResponse | null) => void>;
  warm: boolean;
}

let compiler: Compiler | null = null;

/**
 * Compiles one Luau file and lists its bytecode. Null when the compiler could
 * not load or stopped answering; the next call starts a fresh one.
 */
export async function dumpLuauBytecode(
  source: string,
  options: BytecodeOptions
): Promise<BytecodeResult | null> {
  const current = ensureCompiler();
  if (!current) return null;

  const timeoutMs = current.warm ? REQUEST_TIMEOUT_MS : LOAD_TIMEOUT_MS;
  const response = await send(current, { id: crypto.randomUUID(), source, options }, timeoutMs);
  if (!response?.result) {
    fail(current);
    return null;
  }
  current.warm = true;
  return response.result;
}

function ensureCompiler(): Compiler | null {
  if (compiler) return compiler;

  let worker: Worker;
  try {
    worker = new Worker(new URL("../workers/luauBytecodeWorker.ts", import.meta.url), {
      type: "module",
      name: "luau-bytecode"
    });
  } catch {
    return null;
  }
  const current: Compiler = { worker, pending: new Map(), warm: false };

  worker.onmessage = (event: MessageEvent<BytecodeResponse>) => {
    const resolve = current.pending.get(event.data.id);
    if (resolve) {
      current.pending.delete(event.data.id);
      resolve(event.data);
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    fail(current);
  };

  compiler = current;
  return current;
}

function send(current: Compiler, request: BytecodeRequest, timeoutMs: number): Promise<BytecodeResponse | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      if (current.pending.has(request.id)) fail(current);
    }, timeoutMs);

    current.pending.set(request.id, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
    current.worker.postMessage(request);
  });
}

/** Ends a crashed, hung, or unloadable compiler and answers its callers with null. */
function fail(current: Compiler): void {
  current.worker.terminate();
  if (compiler === current) compiler = null;

  for (const resolve of current.pending.values()) resolve(null);
  current.pending.clear();
}

/**
 * The level a `--!optimize` hot comment sets. The compiler prefers it to the
 * level it is given, and reads it only above the file's first statement.
 */
export function optimizeHotComment(source: string): CompilerLevel | null {
  for (const line of source.split("\n")) {
    const text = line.trim();
    if (text === "") continue;
    if (!text.startsWith("--")) return null;
    const match = /^--!optimize\s+([012])\s*$/.exec(text);
    if (match) return Number(match[1]) as CompilerLevel;
  }
  return null;
}

export type BytecodeLine =
  | { kind: "function" | "remark" | "local" | "other"; text: string }
  | { kind: "source"; line: string; code: string }
  | { kind: "instruction"; line: string; label?: string; opcode: string; operands: string };

const INSTRUCTION = /^(\d+): (?:(L\d+): )?([A-Z][A-Z0-9_]*)(.*)$/;
// With source lines on, each is printed indented, above the code it compiled to.
const SOURCE = /^\s+(\d+): (.*)$/;

/** Splits a listing into lines tagged for highlighting. */
export function parseBytecodeListing(listing: string): BytecodeLine[] {
  return listing.split("\n").map((text): BytecodeLine => {
    const instruction = INSTRUCTION.exec(text);
    if (instruction) {
      const [, line, label, opcode, operands] = instruction;
      return { kind: "instruction", line, label, opcode, operands };
    }
    const source = SOURCE.exec(text);
    if (source) return { kind: "source", line: source[1], code: source[2] };
    if (text.startsWith("Function ")) return { kind: "function", text };
    if (text.startsWith("REMARK ")) return { kind: "remark", text };
    if (/^local \d+ \(/.test(text)) return { kind: "local", text };
    return { kind: "other", text };
  });
}
