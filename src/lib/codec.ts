import { decompressFromEncodedURIComponent } from "lz-string";
import {
  assertProjectPayload,
  projectFromSnippet,
  snippetFromProject,
  validateProjectPayload
} from "./project";
import type { ProjectPayload, RuntimeFlavor, SnippetPayload } from "./types";

const HASH_KEY = "c";
const LEGACY_HASH_KEY = "share";
const SHARE_V1 = "1";
const SHARE_V2 = "2";
const LEGACY_FORMAT_VERSION = 1;

/** Largest encoded `c` value accepted or created (32 KiB, excluding `#c=`). */
export const MAX_SHARE_ENCODED_LENGTH = 32 * 1024;
/** Limits raw DEFLATE expansion before JSON parsing to avoid decompression bombs. */
export const MAX_SHARE_DECOMPRESSED_BYTES = 1024 * 1024;

export const PROJECT_EXPORT_FORMAT = "weblua-project";
export const PROJECT_EXPORT_VERSION = 1;
export const PROJECT_EXPORT_EXTENSION = ".weblua.json";

const V1_FLAVOR_CODE: Record<RuntimeFlavor, string> = {
  lua51: "1",
  lua52: "2",
  lua53: "3",
  lua54: "L",
  luau: "U"
};

const V1_CODE_FLAVOR: Record<string, RuntimeFlavor> = {
  1: "lua51",
  2: "lua52",
  3: "lua53",
  L: "lua54",
  U: "luau"
};

interface LegacyEncodedSnippet {
  v: typeof LEGACY_FORMAT_VERSION;
  code: string;
  flavor: RuntimeFlavor;
}

export interface ProjectExportDocument {
  format: typeof PROJECT_EXPORT_FORMAT;
  version: typeof PROJECT_EXPORT_VERSION;
  project: ProjectPayload;
}

export class SharePayloadTooLargeError extends Error {
  readonly maxEncodedLength = MAX_SHARE_ENCODED_LENGTH;

  constructor(readonly encodedLength: number) {
    super(
      `This project needs an encoded share payload of at least ${encodedLength} characters; ` +
        `the maximum is ${MAX_SHARE_ENCODED_LENGTH}. Export it as ${PROJECT_EXPORT_EXTENSION} instead.`
    );
    this.name = "SharePayloadTooLargeError";
  }
}

class OutputLimitError extends Error {
  constructor() {
    super("Stream output exceeded its allowed size.");
  }
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectPayloadCandidate(value: ProjectPayload | SnippetPayload): value is ProjectPayload {
  return isRecord(value) && (hasOwn(value, "files") || hasOwn(value, "entry"));
}

function maxCompressedBytes(prefixLength: number): number {
  return Math.floor(((MAX_SHARE_ENCODED_LENGTH - prefixLength) * 6) / 8);
}

async function drain(
  readable: ReadableStream<Uint8Array>,
  maxBytes = Number.POSITIVE_INFINITY
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value.length > maxBytes - total) {
        try {
          await reader.cancel();
        } catch {
          // The size error below is the useful result for callers.
        }
        throw new OutputLimitError();
      }

      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function byteStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

async function deflateRaw(input: string, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(input);
  // lib.dom models CompressionStream's writable side as BufferSource, which
  // is wider than pipeThrough's invariant generic despite Uint8Array being a
  // valid BufferSource at runtime.
  const stream = new CompressionStream("deflate-raw") as unknown as TransformStream<
    Uint8Array,
    Uint8Array
  >;
  return drain(byteStream(bytes).pipeThrough(stream), maxBytes);
}

async function inflateRaw(bytes: Uint8Array): Promise<string> {
  const stream = new DecompressionStream("deflate-raw") as unknown as TransformStream<
    Uint8Array,
    Uint8Array
  >;
  const decompressed = await drain(
    byteStream(bytes).pipeThrough(stream),
    MAX_SHARE_DECOMPRESSED_BYTES
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url payload.");
  }

  let padded = value.replaceAll("-", "+").replaceAll("_", "/");
  while (padded.length % 4 !== 0) padded += "=";
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Walks JSON before JSON.parse so duplicate object keys cannot silently
 * overwrite an earlier source file. The actual JSON grammar validation remains
 * delegated to JSON.parse after this pass.
 */
function parseJsonWithoutDuplicateKeys(input: string): unknown {
  let index = 0;

  const skipWhitespace = () => {
    while (index < input.length && /[\t\n\r ]/.test(input[index])) index += 1;
  };

  const parseString = (decode: boolean): string => {
    if (input[index] !== '"') throw new Error("Expected a JSON string.");
    const start = index;
    index += 1;

    while (index < input.length) {
      const character = input[index];
      index += 1;
      if (character === '"') {
        const raw = input.slice(start, index);
        return decode ? (JSON.parse(raw) as string) : "";
      }
      if (character === "\\") {
        if (index >= input.length) throw new Error("Unterminated JSON escape.");
        const escape = input[index];
        index += 1;
        if (escape === "u") {
          if (index + 4 > input.length) throw new Error("Incomplete JSON Unicode escape.");
          index += 4;
        }
      }
    }

    throw new Error("Unterminated JSON string.");
  };

  const consumeWord = (word: string) => {
    if (input.slice(index, index + word.length) !== word) {
      throw new Error("Invalid JSON token.");
    }
    index += word.length;
  };

  const parseValue = (): void => {
    skipWhitespace();
    const character = input[index];
    if (character === "{") {
      parseObject();
      return;
    }
    if (character === "[") {
      parseArray();
      return;
    }
    if (character === '"') {
      parseString(false);
      return;
    }
    if (character === "t") {
      consumeWord("true");
      return;
    }
    if (character === "f") {
      consumeWord("false");
      return;
    }
    if (character === "n") {
      consumeWord("null");
      return;
    }

    const start = index;
    while (index < input.length && !/[\t\n\r ,\]}]/.test(input[index])) index += 1;
    if (start === index) throw new Error("Expected a JSON value.");
  };

  const parseObject = (): void => {
    index += 1;
    skipWhitespace();
    if (input[index] === "}") {
      index += 1;
      return;
    }

    const keys = new Set<string>();
    for (;;) {
      skipWhitespace();
      const key = parseString(true);
      if (keys.has(key)) throw new Error(`Duplicate JSON key: ${JSON.stringify(key)}.`);
      keys.add(key);

      skipWhitespace();
      if (input[index] !== ":") throw new Error("Expected a JSON object colon.");
      index += 1;
      parseValue();
      skipWhitespace();

      if (input[index] === "}") {
        index += 1;
        return;
      }
      if (input[index] !== ",") throw new Error("Expected a JSON object comma.");
      index += 1;
    }
  };

  const parseArray = (): void => {
    index += 1;
    skipWhitespace();
    if (input[index] === "]") {
      index += 1;
      return;
    }

    for (;;) {
      parseValue();
      skipWhitespace();
      if (input[index] === "]") {
        index += 1;
        return;
      }
      if (input[index] !== ",") throw new Error("Expected a JSON array comma.");
      index += 1;
    }
  };

  parseValue();
  skipWhitespace();
  if (index !== input.length) throw new Error("Unexpected data after JSON value.");
  return JSON.parse(input) as unknown;
}

function serializeProjectFields(project: ProjectPayload): string {
  const files = Object.keys(project.files)
    .sort(comparePaths)
    .map((path) => `${JSON.stringify(path)}:${JSON.stringify(project.files[path])}`)
    .join(",");

  return (
    `"flavor":${JSON.stringify(project.flavor)},` +
    `"entry":${JSON.stringify(project.entry)},` +
    `"files":{${files}}`
  );
}

function serializeShareProject(project: ProjectPayload): string {
  return `{"v":2,${serializeProjectFields(project)}}`;
}

function asProjectPayload(payload: ProjectPayload | SnippetPayload): ProjectPayload {
  return isProjectPayloadCandidate(payload)
    ? assertProjectPayload(payload)
    : projectFromSnippet(payload as SnippetPayload);
}

async function encodeWithPrefix(
  serialized: string,
  prefix: string
): Promise<string> {
  let compressed: Uint8Array<ArrayBuffer>;
  try {
    compressed = await deflateRaw(serialized, maxCompressedBytes(prefix.length));
  } catch (error) {
    if (error instanceof OutputLimitError) {
      throw new SharePayloadTooLargeError(MAX_SHARE_ENCODED_LENGTH + 1);
    }
    throw error;
  }

  const value = prefix + toBase64Url(compressed);
  if (value.length > MAX_SHARE_ENCODED_LENGTH) {
    throw new SharePayloadTooLargeError(value.length);
  }
  return value;
}

async function decodeV1Snippet(value: string): Promise<SnippetPayload | null> {
  if (value.length < 3) return null;

  try {
    const flavor = V1_CODE_FLAVOR[value[1]];
    if (value[0] !== SHARE_V1 || !flavor) return null;
    const code = await inflateRaw(fromBase64Url(value.slice(2)));
    return { code, flavor };
  } catch {
    return null;
  }
}

async function decodeV2Project(value: string): Promise<ProjectPayload | null> {
  if (value.length < 2 || value[0] !== SHARE_V2) return null;

  try {
    const raw = await inflateRaw(fromBase64Url(value.slice(1)));
    const parsed = parseJsonWithoutDuplicateKeys(raw);
    if (!isRecord(parsed) || parsed.v !== 2) return null;
    return validateProjectPayload(parsed);
  } catch {
    return null;
  }
}

function decodeLegacyProject(value: string | null): ProjectPayload | null {
  if (!value || value.length > MAX_SHARE_ENCODED_LENGTH) return null;

  try {
    const raw = decompressFromEncodedURIComponent(value);
    if (!raw || new TextEncoder().encode(raw).length > MAX_SHARE_DECOMPRESSED_BYTES) return null;

    const parsed = parseJsonWithoutDuplicateKeys(raw) as Partial<LegacyEncodedSnippet>;
    if (
      !isRecord(parsed) ||
      parsed.v !== LEGACY_FORMAT_VERSION ||
      typeof parsed.code !== "string" ||
      typeof parsed.flavor !== "string"
    ) {
      return null;
    }

    return projectFromSnippet({ code: parsed.code, flavor: parsed.flavor as RuntimeFlavor });
  } catch {
    return null;
  }
}

/** Encodes a v2 source-only project share payload, without the `#c=` wrapper. */
export async function encodeProject(project: ProjectPayload): Promise<string> {
  return encodeWithPrefix(serializeShareProject(assertProjectPayload(project)), SHARE_V2);
}

/** Decodes v2 project payloads and upgrades raw-DEFLATE v1 snippet payloads. */
export async function decodeProject(value: string | null): Promise<ProjectPayload | null> {
  if (!value || value.length > MAX_SHARE_ENCODED_LENGTH) return null;

  if (value[0] === SHARE_V2) return decodeV2Project(value);
  const snippet = await decodeV1Snippet(value);
  return snippet ? projectFromSnippet(snippet) : null;
}

/**
 * Deprecated compatibility writer for the old raw-DEFLATE snippet token. New
 * shares should call encodeProject/makeProjectShareHash and therefore use v2.
 */
export async function encodeSnippet(snippet: SnippetPayload): Promise<string> {
  const project = projectFromSnippet(snippet);
  return encodeWithPrefix(project.files[project.entry], SHARE_V1 + V1_FLAVOR_CODE[project.flavor]);
}

/** Reads either v2 project data or v1 snippet data as a single legacy snippet. */
export async function decodeSnippet(value: string | null): Promise<SnippetPayload | null> {
  const project = await decodeProject(value);
  return project ? snippetFromProject(project) : null;
}

export async function makeProjectShareHash(project: ProjectPayload): Promise<string> {
  return `#${HASH_KEY}=${await encodeProject(project)}`;
}

/**
 * Compatibility overload: snippet callers receive a v2 one-file project link;
 * project callers preserve their complete source tree.
 */
export async function makeShareHash(project: ProjectPayload): Promise<string>;
export async function makeShareHash(snippet: SnippetPayload): Promise<string>;
export async function makeShareHash(payload: ProjectPayload | SnippetPayload): Promise<string> {
  return makeProjectShareHash(asProjectPayload(payload));
}

export async function tryMakeProjectShareHash(project: ProjectPayload): Promise<string | null> {
  try {
    return await makeProjectShareHash(project);
  } catch (error) {
    if (error instanceof SharePayloadTooLargeError) return null;
    throw error;
  }
}

/** Reads a full project from a current `#c=` or historic `#share=` hash. */
export async function readProjectShareHash(hash: string): Promise<ProjectPayload | null> {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);
  const current = params.get(HASH_KEY);
  if (current) return decodeProject(current);

  return decodeLegacyProject(params.get(LEGACY_HASH_KEY));
}

/** Legacy snippet reader, retained for callers that have not adopted projects yet. */
export async function readShareHash(hash: string): Promise<SnippetPayload | null> {
  const project = await readProjectShareHash(hash);
  return project ? snippetFromProject(project) : null;
}

export async function buildProjectShareUrl(project: ProjectPayload, embed = false): Promise<string> {
  const url = new URL(window.location.href);
  url.pathname = embed ? "/embed" : "/playground";
  url.search = "";
  url.hash = await makeProjectShareHash(project);
  return url.toString();
}

export async function tryBuildProjectShareUrl(
  project: ProjectPayload,
  embed = false
): Promise<string | null> {
  try {
    return await buildProjectShareUrl(project, embed);
  } catch (error) {
    if (error instanceof SharePayloadTooLargeError) return null;
    throw error;
  }
}

export async function buildShareUrl(project: ProjectPayload, embed?: boolean): Promise<string>;
export async function buildShareUrl(snippet: SnippetPayload, embed?: boolean): Promise<string>;
export async function buildShareUrl(
  payload: ProjectPayload | SnippetPayload,
  embed = false
): Promise<string> {
  return buildProjectShareUrl(asProjectPayload(payload), embed);
}

/** Stable, source-only `.weblua.json` document. It deliberately omits stdin and UI state. */
export function serializeProject(project: ProjectPayload): string {
  const normalized = assertProjectPayload(project);
  return (
    `{"format":${JSON.stringify(PROJECT_EXPORT_FORMAT)},` +
    `"version":${PROJECT_EXPORT_VERSION},` +
    `"project":{${serializeProjectFields(normalized)}}}`
  );
}

/** Parses a versioned source-only `.weblua.json` document. */
export function deserializeProject(serialized: string): ProjectPayload | null {
  if (typeof serialized !== "string") return null;

  try {
    const parsed = parseJsonWithoutDuplicateKeys(serialized);
    if (
      !isRecord(parsed) ||
      parsed.format !== PROJECT_EXPORT_FORMAT ||
      parsed.version !== PROJECT_EXPORT_VERSION
    ) {
      return null;
    }
    return validateProjectPayload(parsed.project);
  } catch {
    return null;
  }
}

// Explicit names make import/export call sites self-documenting, while the
// serialize/deserialize pair remains convenient for tests and storage adapters.
export const exportProjectJson = serializeProject;
export const importProjectJson = deserializeProject;
