import { useEffect, useState } from "react";

const STORAGE_KEY = "airwise.theme";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

/** Light/dark theme that follows the system until the viewer picks one. */
export function useTheme() {
  const [theme, setTheme] = useState(readStoredTheme);
  const effective = theme ?? (systemPrefersDark() ? "dark" : "light");

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem(STORAGE_KEY, theme);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  }, [theme]);

  return { theme: effective, toggleTheme: () => setTheme(effective === "dark" ? "light" : "dark") };
}
