import { Feather } from "@expo/vector-icons";
import { IconButton } from "./button";
import { useTheme } from "@/theme";

export function ThemeToggle() {
  const { colors, isDark, setTheme } = useTheme();

  return (
    <IconButton
      accessibilityLabel={
        isDark ? "Switch to light theme" : "Switch to dark theme"
      }
      onPress={() => setTheme(isDark ? "light" : "dark")}
    >
      <Feather name={isDark ? "sun" : "moon"} size={20} color={colors.icon} />
    </IconButton>
  );
}
