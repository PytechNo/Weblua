import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), wasm()],
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
  worker: {
    format: "es"
  },
  test: {
    environment: "jsdom"
  }
});
