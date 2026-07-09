import { decompressFromEncodedURIComponent } from "lz-string";
import type { RuntimeFlavor, SnippetPayload } from "./types";

// Current share format: `#c=<version><flavor><base64url>` where the payload is the raw
// snippet code compressed with DEFLATE (browser-native CompressionStream). base64url is
// URL-safe, so what we build is exactly what appears in the address bar.
const HASH_KEY = "c";
const FORMAT_VERSION = "1";

// Legacy share format: `#share=<lz-string>` of a JSON wrapper. Kept for read-only
// backward compatibility with links created before the deflate codec.
const LEGACY_HASH_KEY = "share";
const LEGACY_FORMAT_VERSION = 1;

const FLAVOR_CODE: Record<RuntimeFlavor, string> = { lua54: "L", luau: "U" };
const CODE_FLAVOR: Record<string, RuntimeFlavor> = { L: "lua54", U: "luau" };

interface LegacyEncodedSnippet {
  v: typeof LEGACY_FORMAT_VERSION;
  code: string;
  flavor: RuntimeFlavor;
}

async function drain(readable: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflateRaw(input: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(input)).then(() => writer.close(), () => {});
  return drain(stream.readable);
}

async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  writer.write(bytes).then(() => writer.close(), () => {});
  return new TextDecoder().decode(await drain(stream.readable));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  let padded = value.replaceAll("-", "+").replaceAll("_", "/");
  while (padded.length % 4 !== 0) padded += "=";
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encodeSnippet(snippet: SnippetPayload): Promise<string> {
  const compressed = await deflateRaw(snippet.code);
  return FORMAT_VERSION + FLAVOR_CODE[snippet.flavor] + toBase64Url(compressed);
}

export async function decodeSnippet(value: string | null): Promise<SnippetPayload | null> {
  if (!value || value.length < 2) return null;

  try {
    const flavor = CODE_FLAVOR[value[1]];
    if (value[0] !== FORMAT_VERSION || !flavor) return null;

    const code = await inflateRaw(fromBase64Url(value.slice(2)));
    return { code, flavor };
  } catch {
    return null;
  }
}

function decodeLegacySnippet(value: string | null): SnippetPayload | null {
  if (!value) return null;

  try {
    const raw = decompressFromEncodedURIComponent(value);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LegacyEncodedSnippet>;
    if (
      parsed.v !== LEGACY_FORMAT_VERSION ||
      typeof parsed.code !== "string" ||
      (parsed.flavor !== "lua54" && parsed.flavor !== "luau")
    ) {
      return null;
    }

    return { code: parsed.code, flavor: parsed.flavor };
  } catch {
    return null;
  }
}

export async function makeShareHash(snippet: SnippetPayload): Promise<string> {
  const params = new URLSearchParams();
  params.set(HASH_KEY, await encodeSnippet(snippet));
  return `#${params.toString()}`;
}

export async function readShareHash(hash: string): Promise<SnippetPayload | null> {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);

  const current = params.get(HASH_KEY);
  if (current) return decodeSnippet(current);

  return decodeLegacySnippet(params.get(LEGACY_HASH_KEY));
}

export async function buildShareUrl(snippet: SnippetPayload, embed = false): Promise<string> {
  const url = new URL(window.location.href);
  url.pathname = embed ? "/embed" : "/playground";
  url.search = "";
  url.hash = await makeShareHash(snippet);
  return url.toString();
}
