export type AppRoute =
  | { mode: "landing"; id?: undefined }
  | { mode: "playground"; id?: undefined }
  | { mode: "snippet"; id: string }
  | { mode: "embed"; id?: string };

export function getAppRoute(
  pathname = window.location.pathname,
  hash = window.location.hash
): AppRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "embed") {
    return { mode: "embed", id: parts[1] };
  }

  if (parts[0] === "p" && parts[1]) {
    return { mode: "snippet", id: parts[1] };
  }

  if (parts.length === 0) {
    // Legacy share links point at "/" with a #share= hash.
    return hash.includes("share=") ? { mode: "playground" } : { mode: "landing" };
  }

  return { mode: "playground" };
}
