import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import html from "../index.html?raw";
import { App } from "./App";
import type { Theme } from "./lib/theme";

type ThemeProps = { theme: Theme; onToggleTheme: () => void };

vi.mock("./components/Landing", () => ({
  Landing: ({ theme, onToggleTheme }: ThemeProps) => (
    <button onClick={onToggleTheme}>landing: {theme}</button>
  )
}));

vi.mock("./Playground", () => ({
  default: ({ theme, onToggleTheme }: ThemeProps) => (
    <button onClick={onToggleTheme}>playground: {theme}</button>
  )
}));

let container: HTMLDivElement;
let root: Root;
let media: EventTarget & { matches: boolean };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.body.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

async function mount() {
  await act(() => root.render(<StrictMode><App /></StrictMode>));
}

async function changeSystemTheme(dark: boolean) {
  await act(() => {
    media.matches = dark;
    media.dispatchEvent(new Event("change"));
  });
}

async function toggle() {
  await act(() => container.querySelector("button")!.click());
}

async function navigate(path: string) {
  await act(() => root.unmount());
  window.history.replaceState(null, "", path);
  root = createRoot(container);
  await mount();
}

describe("the shared app theme", () => {
  it.each([false, true])("starts with the system scheme (dark: %s) without saving an override", async (dark) => {
    media.matches = dark;
    await mount();
    expect(document.body.dataset.theme).toBe(dark ? "dark" : "light");
    expect(window.localStorage.getItem("weblua:theme")).toBeNull();
  });

  it("follows system changes until the user chooses a theme", async () => {
    await mount();
    await changeSystemTheme(true);
    expect(container.textContent).toBe("landing: dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    await toggle();
    expect(window.localStorage.getItem("weblua:theme")).toBe("light");
    await changeSystemTheme(false);
    await changeSystemTheme(true);
    expect(container.textContent).toBe("landing: light");
    expect(document.body.dataset.theme).toBe("light");
  });

  it("keeps choices when navigating from landing to playground and back, including reloads", async () => {
    await mount();
    await toggle();
    await navigate("/playground");
    expect(container.textContent).toBe("playground: dark");
    expect(document.body.dataset.theme).toBe("dark");

    await toggle();
    await navigate("/");
    expect(container.textContent).toBe("landing: light");
    await navigate("/");
    expect(document.body.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("weblua:theme")).toBe("light");
  });

  it("ignores invalid saved values and follows the system", async () => {
    window.localStorage.setItem("weblua:theme", "invalid");
    await mount();
    await changeSystemTheme(true);
    expect(document.body.dataset.theme).toBe("dark");
  });

  it("still follows the system and toggles when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    await mount();
    await changeSystemTheme(true);
    await toggle();
    expect(document.body.dataset.theme).toBe("light");
  });

  it.each([null, "dark", "light", "invalid"])("applies the theme before page content renders (saved: %s)", async (saved) => {
    if (saved !== null) window.localStorage.setItem("weblua:theme", saved);
    media.matches = true;
    const bootstrap = html.match(/<body>\s*<script>([\s\S]*?)<\/script>/)![1];
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    try {
      new Function("window", "document", bootstrap)(window, document);
      const initial = document.body.dataset.theme;
      expect(initial).toBe(saved === "light" ? "light" : "dark");
      expect(meta.content).toBe(initial === "dark" ? "#05070f" : "#f7f8fd");
      await mount();
      expect(document.body.dataset.theme).toBe(initial);
    } finally {
      meta.remove();
    }
  });
});
