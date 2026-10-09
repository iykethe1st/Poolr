import { StyleSheet, View } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "./text";

export function Toast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "warning" | "danger";
}) {
  const { colors } = useTheme();
  const background = {
    success: colors.successSubtle,
    warning: colors.warningSubtle,
    danger: colors.dangerSubtle,
  }[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: background }]}
    >
      <Text variant="bodyStrong" tone={tone}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    padding: spacing[3],
    borderRadius: radii.medium,
  },
});
