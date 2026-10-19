import { useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveTheme, THEME_STORAGE_KEY, type ThemeId } from "../../../shared/themes";
import { ThemeContext } from "./themeContext";

function readSavedTheme(): ThemeId {
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    // Storage can throw (private mode, blocked site data): use the default palette.
    return resolveTheme(null).id;
  }
}

/** Sets `data-theme` and the status bar color. Mirrors the inline script in `index.html`. */
function applyTheme(id: ThemeId) {
  const theme = resolveTheme(id);
  document.documentElement.dataset.theme = theme.id;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = theme.bar;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(readSavedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The choice still applies for this session.
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
