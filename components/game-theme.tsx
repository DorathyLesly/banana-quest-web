"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SwatchBook } from "lucide-react";

const themes = ["Jungle", "Ocean", "Sunset", "Lavender"] as const;
type Theme = (typeof themes)[number];

const storageKey = "jungle-digits-theme";
const ThemeContext = createContext({ theme: themes[0] as Theme, selectTheme: (_theme: Theme) => {} });

export function GameThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("Jungle");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const storedTheme = themes.find(option => option === saved);
      if (storedTheme) {
        document.documentElement.dataset.gameTheme = storedTheme;
        setTheme(storedTheme);
      }
    } catch {
      // The picker still works when browser storage is unavailable.
    }
  }, []);

  function selectTheme(nextTheme: Theme) {
    document.documentElement.dataset.gameTheme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Keep the selection for this visit.
    }
  }

  return <ThemeContext.Provider value={{ theme, selectTheme }}>{children}</ThemeContext.Provider>;
}

export function GameThemePicker() {
  const { theme, selectTheme } = useContext(ThemeContext);

  return (
    <div className="game-theme-picker">
      <SwatchBook size={16} strokeWidth={1.75} aria-hidden="true" />
      <select
        aria-label="Theme color"
        value={theme}
        onChange={event => {
          const selected = themes.find(option => option === event.currentTarget.value);
          if (selected) selectTheme(selected);
        }}
      >
        {themes.map(option => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}