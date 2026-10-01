import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "weblua:theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function readThemePreference(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/** Both routes share a browser preference; only an explicit choice is saved. */
export function useTheme() {
  const [preference, setPreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light"
  );
  const theme = preference ?? systemTheme;

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const updateSystemTheme = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", updateSystemTheme);
    updateSystemTheme();
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useLayoutEffect(() => {
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#05070f" : "#f7f8fd"
    );
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }, [theme]);

  return { theme, toggleTheme };
}
