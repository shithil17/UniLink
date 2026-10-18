import { createContext, useContext } from "react";
import { DEFAULT_THEME_ID, type ThemeId } from "../../../shared/themes";

export type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_ID,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
