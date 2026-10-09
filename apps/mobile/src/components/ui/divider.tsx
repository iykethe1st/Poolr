import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";

export function Divider() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={[styles.divider, { backgroundColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    alignSelf: "stretch",
  },
});
