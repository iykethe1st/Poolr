import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import {
  darkPalette,
  lightPalette,
  type ThemeColors,
  type ThemePreference,
} from "./palette";

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");
  const isDark =
    preference === "system" ? systemScheme === "dark" : preference === "dark";
  const colors = isDark ? darkPalette : lightPalette;
  const setTheme = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isDark,
      preference,
      setTheme,
    }),
    [colors, isDark, preference, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { ThemePreference };
