import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initTelemetry } from "./lib/telemetry";
import "./styles.css";

initTelemetry();

// Production only: a worker caching the dev server's unhashed modules would serve stale code.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        // This visit's files loaded before the worker took control, so add them
        // now. "weblua-v1" is public/sw.js's CACHE.
        const cache = await caches.open("weblua-v1");
        const urls = [
          window.location.pathname,
          ...performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => new URL(name).origin === window.location.origin)
        ];
        await Promise.allSettled(urls.map((url) => cache.add(url)));
      })
      .catch(() => {
        // Blocked storage or a third-party embed: the app works as before, online.
      });
  });
}

const container = document.getElementById("root")!;
// Read before React replaces it: article pages show it while their code loads.
const prerendered = container.innerHTML;

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App prerendered={prerendered} />
    </ErrorBoundary>
  </React.StrictMode>
);
