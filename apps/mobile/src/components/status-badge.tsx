import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/lib/colors";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "completed"
  | "primary";

const BORDER: Record<BadgeVariant, string> = {
  success: "#86efac",
  warning: "#fde68a",
  danger: "#fca5a5",
  info: "#bfdbfe",
  neutral: "#cbd5e1",
  completed: "#c7d2fe",
  primary: "#6ee7b7",
};

export function StatusBadge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  const colors = useColors();

  const colorMap: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: colors.successBg + "10", text: colors.successText },
    warning: { bg: colors.warningBg + "10", text: colors.warningText },
    danger: { bg: colors.dangerBg + "10", text: colors.dangerText },
    info: { bg: colors.infoBg + "10", text: colors.infoText },
    neutral: { bg: colors.mutedBg + "10", text: colors.mutedText },
    completed: { bg: colors.completedBg + "10", text: colors.completedText },
    primary: { bg: colors.primaryBg + "10", text: colors.primaryText },
  };

  const { bg, text } = colorMap[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: BORDER[variant] },
      ]}
    >
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
});
