import { importProjectJson, MAX_SHARE_DECOMPRESSED_BYTES, PROJECT_EXPORT_EXTENSION } from "./codec";
import { assertProjectPayload, ProjectValidationError } from "./project";
import type { ProjectPayload, RuntimeFlavor } from "./types";

/**
 * GitHub gists as share links: for projects too large for a `#c=` link, and as
 * short links for chats that cap message length. Weblua has no backend that
 * could create a gist, so people make one themselves and Weblua only reads it,
 * from GitHub's API, when a `#gist=` link is opened.
 */

const GIST_HASH_KEY = "gist";
/** Gist IDs are hex (the oldest are decimal); anything else never reaches GitHub. */
const GIST_ID = /^[0-9a-f]{1,64}$/i;
const GIST_HOSTS = new Set(["gist.github.com", "gist.githubusercontent.com"]);
const GIST_TIMEOUT_MS = 10_000;
/** GitHub's response also carries history and metadata; the files are capped below. */
const MAX_RESPONSE_CHARS = 8 * 1024 * 1024;
const DEFAULT_LUA_FLAVOR: RuntimeFlavor = "lua54";

export class GistLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GistLoadError";
  }
}

interface GistFile {
  content?: unknown;
  truncated?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The gist ID in a `#gist=` hash, or null when the hash names none. */
export function readGistHash(hash: string): string | null {
  const id = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash).get(GIST_HASH_KEY);
  return id && GIST_ID.test(id) ? id : null;
}

export function gistHash(id: string): string {
  return `#${GIST_HASH_KEY}=${id}`;
}

/**
 * The gist ID in whatever someone pastes: a bare ID, a gist page or raw-file
 * URL, or a Weblua `#gist=` link.
 */
export function gistIdFrom(input: string): string | null {
  const text = input.trim();
  if (GIST_ID.test(text)) return text;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  const fromHash = readGistHash(url.hash);
  if (fromHash) return fromHash;
  if (!GIST_HOSTS.has(url.hostname)) return null;

  // gist.github.com/<id>, gist.github.com/<user>/<id>[/<revision>],
  // gist.githubusercontent.com/<user>/<id>/raw/...
  const [first, second] = url.pathname.split("/").filter(Boolean);
  const id = second ?? first;
  return id && GIST_ID.test(id) ? id : null;
}

/** Fetches a gist from GitHub's API and turns it into a project. */
export async function loadGistProject(id: string, fetchImpl: typeof fetch = fetch): Promise<ProjectPayload> {
  if (!GIST_ID.test(id)) throw new GistLoadError("That is not a GitHub gist ID.");

  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com/gists/${id}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(GIST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new GistLoadError(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "GitHub did not answer in time."
        : "Could not reach GitHub to load the gist."
    );
  }

  if (response.status === 404) throw new GistLoadError("GitHub has no gist with that ID.");
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
    throw new GistLoadError("GitHub allows 60 anonymous gist requests an hour from one address. Try again later.");
  }
  if (!response.ok) throw new GistLoadError(`GitHub answered with HTTP ${response.status}.`);

  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) throw new GistLoadError("The gist is too large to open.");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new GistLoadError("GitHub sent a response Weblua could not read.");
  }
  return projectFromGistFiles(isRecord(body) ? body.files : undefined);
}

/**
 * A `.weblua.json` export keeps its folders, entry, and runtime. Otherwise the
 * gist's `.lua` and `.luau` files become a flat project (gist file names cannot
 * hold folders): Luau if any file is `.luau`, else Lua 5.4.
 */
export function projectFromGistFiles(files: unknown): ProjectPayload {
  if (!isRecord(files)) throw new GistLoadError("GitHub's response listed no files.");

  const entries = Object.entries(files).filter((entry): entry is [string, GistFile] => isRecord(entry[1]));
  const exports = entries.filter(([name]) => name.toLowerCase().endsWith(PROJECT_EXPORT_EXTENSION));
  if (exports.length > 1) {
    throw new GistLoadError(`The gist has more than one ${PROJECT_EXPORT_EXTENSION} file.`);
  }

  if (exports.length === 1) {
    const [name, file] = exports[0];
    const project = importProjectJson(contentOf(name, file));
    if (!project) throw new GistLoadError(`${name} is not a valid Weblua project export.`);
    return project;
  }

  const sources = entries.filter(([name]) => /\.luau?$/i.test(name));
  if (sources.length === 0) {
    throw new GistLoadError(`The gist has no .lua, .luau, or ${PROJECT_EXPORT_EXTENSION} file.`);
  }

  const flavor = sources.some(([name]) => /\.luau$/i.test(name)) ? "luau" : DEFAULT_LUA_FLAVOR;
  const sourceFiles: Record<string, string> = {};
  let bytes = 0;
  for (const [name, file] of sources) {
    sourceFiles[name] = contentOf(name, file);
    bytes += new TextEncoder().encode(sourceFiles[name]).length;
  }
  if (bytes > MAX_SHARE_DECOMPRESSED_BYTES) throw new GistLoadError("The gist's source files are too large to open.");

  try {
    return assertProjectPayload({ flavor, entry: entryFor(Object.keys(sourceFiles)), files: sourceFiles });
  } catch (error) {
    throw new GistLoadError(error instanceof ProjectValidationError ? error.message : "The gist is not a valid project.");
  }
}

function contentOf(name: string, file: GistFile): string {
  // GitHub leaves content out, or cuts it short, past about 1 MB: over Weblua's cap anyway.
  if (file.truncated === true || typeof file.content !== "string") {
    throw new GistLoadError(`${name} is too large to open from GitHub.`);
  }
  if (file.content.length > MAX_SHARE_DECOMPRESSED_BYTES) {
    throw new GistLoadError(`${name} is too large to open.`);
  }
  return file.content;
}

/** `main`, then `init`, then the first file in name order. */
function entryFor(names: string[]): string {
  const sorted = [...names].sort();
  for (const stem of ["main", "init"]) {
    const match = sorted.find((name) => name.replace(/\.luau?$/i, "") === stem);
    if (match) return match;
  }
  return sorted[0];
}
