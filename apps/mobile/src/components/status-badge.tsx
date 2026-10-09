import { StyleSheet, View } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "@/components/ui/text";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "completed"
  | "primary";

export function StatusBadge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  const { colors } = useTheme();

  const colorMap: Record<
    BadgeVariant,
    {
      bg: string;
      border: string;
      tone: "brand" | "success" | "warning" | "danger" | "secondary";
    }
  > = {
    success: {
      bg: colors.successSubtle,
      border: colors.success,
      tone: "success",
    },
    warning: {
      bg: colors.warningSubtle,
      border: colors.warning,
      tone: "warning",
    },
    danger: { bg: colors.dangerSubtle, border: colors.danger, tone: "danger" },
    info: {
      bg: colors.primarySubtle,
      border: colors.borderInput,
      tone: "brand",
    },
    neutral: {
      bg: colors.surfaceRaised,
      border: colors.border,
      tone: "secondary",
    },
    completed: {
      bg: colors.primarySubtle,
      border: colors.primary,
      tone: "brand",
    },
    primary: {
      bg: colors.primarySubtle,
      border: colors.primary,
      tone: "brand",
    },
  };

  const { bg, border, tone } = colorMap[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text variant="overline" tone={tone}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.small,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
