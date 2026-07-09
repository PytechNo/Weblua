import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent
} from "lz-string";
import type { RuntimeFlavor, SnippetPayload } from "./types";

const HASH_KEY = "share";
const FORMAT_VERSION = 1;

interface EncodedSnippet {
  v: typeof FORMAT_VERSION;
  code: string;
  flavor: RuntimeFlavor;
}

export function encodeSnippet(snippet: SnippetPayload): string {
  const payload: EncodedSnippet = {
    v: FORMAT_VERSION,
    code: snippet.code,
    flavor: snippet.flavor
  };

  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSnippet(value: string | null): SnippetPayload | null {
  if (!value) return null;

  try {
    const raw = decompressFromEncodedURIComponent(value);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EncodedSnippet>;
    if (
      parsed.v !== FORMAT_VERSION ||
      typeof parsed.code !== "string" ||
      (parsed.flavor !== "lua54" && parsed.flavor !== "luau")
    ) {
      return null;
    }

    return {
      code: parsed.code,
      flavor: parsed.flavor
    };
  } catch {
    return null;
  }
}

export function makeShareHash(snippet: SnippetPayload): string {
  const params = new URLSearchParams();
  params.set(HASH_KEY, encodeSnippet(snippet));
  return `#${params.toString()}`;
}

export function readShareHash(hash: string): SnippetPayload | null {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);
  return decodeSnippet(params.get(HASH_KEY));
}

export function buildShareUrl(snippet: SnippetPayload, embed = false): string {
  const url = new URL(window.location.href);
  url.pathname = embed ? "/embed" : "/playground";
  url.search = "";
  url.hash = makeShareHash(snippet);
  return url.toString();
}
