import { lezer } from "@lezer/generator/rollup";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [lezer(), react(), wasm()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  },
  build: {
    target: "esnext"
  },
  // The dev server's scan cannot see these: @lezer/lr is imported by the
  // compiled grammar module, and StyLua only on the first format. Listing
  // them avoids a full page reload the first time each one loads.
  optimizeDeps: {
    include: ["@lezer/lr", "@johnnymorganz/stylua/web"],
    // The Luau analyzer finds its wasm with `new URL("...wasm", import.meta.url)`.
    // Pre-bundling moves the JS into .vite/deps and leaves the wasm behind, so
    // the dev server serves this package straight from node_modules instead.
    exclude: ["@luau-rs/luau"]
  },
  worker: {
    format: "es"
  },
  test: {
    environment: "jsdom"
  }
});
