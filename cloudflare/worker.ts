export interface Env {
  WEBLUA_SNIPPETS: KVNamespace;
}

type RuntimeFlavor = "lua54" | "luau";

interface SnippetPayload {
  code: string;
  flavor: RuntimeFlavor;
}

interface SavedSnippet extends SnippetPayload {
  id: string;
  createdAt: string;
}

const MAX_CODE_LENGTH = 64_000;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/snippets" && request.method === "POST") {
      return createSnippet(request, env);
    }

    const match = url.pathname.match(/^\/api\/snippets\/([A-Za-z0-9_-]{6,24})$/);
    if (match && request.method === "GET") {
      return getSnippet(match[1], env);
    }

    return json({ error: "Not found" }, 404);
  }
};

async function createSnippet(request: Request, env: Env): Promise<Response> {
  let payload: Partial<SnippetPayload>;

  try {
    payload = (await request.json()) as Partial<SnippetPayload>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (
    typeof payload.code !== "string" ||
    payload.code.length === 0 ||
    payload.code.length > MAX_CODE_LENGTH ||
    (payload.flavor !== "lua54" && payload.flavor !== "luau")
  ) {
    return json({ error: "Invalid snippet" }, 400);
  }

  const saved: SavedSnippet = {
    id: makeId(),
    code: payload.code,
    flavor: payload.flavor,
    createdAt: new Date().toISOString()
  };

  await env.WEBLUA_SNIPPETS.put(saved.id, JSON.stringify(saved), {
    expirationTtl: 60 * 60 * 24 * 365
  });

  return json(saved, 201);
}

async function getSnippet(id: string, env: Env): Promise<Response> {
  const value = await env.WEBLUA_SNIPPETS.get(id);
  if (!value) {
    return json({ error: "Snippet not found" }, 404);
  }

  return new Response(value, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function makeId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
