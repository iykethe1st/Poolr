import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";
import { Text, type TextTone } from "./text";

type BadgeTone = Extract<
  TextTone,
  "brand" | "success" | "warning" | "danger" | "secondary"
>;

export function Badge({
  children,
  tone = "brand",
}: PropsWithChildren<{ tone?: BadgeTone }>) {
  const { colors } = useTheme();
  const colorTokens: Record<
    BadgeTone,
    { backgroundColor: string; borderColor: string }
  > = {
    brand: {
      backgroundColor: colors.primarySubtle,
      borderColor: colors.borderInput,
    },
    success: {
      backgroundColor: colors.successSubtle,
      borderColor: colors.success,
    },
    warning: {
      backgroundColor: colors.warningSubtle,
      borderColor: colors.warning,
    },
    danger: {
      backgroundColor: colors.dangerSubtle,
      borderColor: colors.danger,
    },
    secondary: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
    },
  };
  const textTone: Record<BadgeTone, TextTone> = {
    brand: "brand",
    success: "success",
    warning: "warning",
    danger: "danger",
    secondary: "secondary",
  };

  return (
    <View style={[styles.badge, colorTokens[tone]]}>
      <Text variant="caption" tone={textTone[tone]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderRadius: radii.small,
  } satisfies ViewStyle,
});
