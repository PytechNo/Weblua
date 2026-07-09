import type { SnippetPayload } from "./types";

export interface SavedSnippet extends SnippetPayload {
  id: string;
  createdAt: string;
}

export async function fetchSnippet(id: string): Promise<SavedSnippet> {
  const response = await fetch(`/api/snippets/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Snippet ${id} could not be loaded.`);
  }

  return (await response.json()) as SavedSnippet;
}

export async function saveSnippet(snippet: SnippetPayload): Promise<SavedSnippet> {
  const response = await fetch("/api/snippets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(snippet)
  });

  if (!response.ok) {
    throw new Error("Short links are not configured on this deployment.");
  }

  return (await response.json()) as SavedSnippet;
}
