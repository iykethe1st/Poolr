import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "./text";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "small" | "medium" | "large";
type ButtonProps = PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: PressableProps["onPress"];
  size?: ButtonSize;
  style?: ViewStyle;
  variant?: ButtonVariant;
}>;

export function Button({
  accessibilityLabel,
  children,
  disabled = false,
  loading = false,
  onPress,
  size = "medium",
  style,
  variant = "primary",
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const backgroundColors = {
    primary: colors.primary,
    secondary: colors.primarySubtle,
    destructive: colors.danger,
  };
  const backgroundColor =
    variant === "ghost" ? undefined : backgroundColors[variant];
  const textTone =
    variant === "primary" || variant === "destructive" ? "onPrimary" : "brand";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        sizeStyles[size],
        {
          backgroundColor,
          opacity: pressed && !isDisabled ? 0.84 : isDisabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" || variant === "destructive"
              ? colors.textOnPrimary
              : colors.primary
          }
        />
      ) : (
        <Text variant="bodyStrong" tone={textTone}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.medium,
  },
});

const sizeStyles = StyleSheet.create({
  small: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  medium: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  large: {
    minHeight: 48,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
});

export function IconButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: PressableProps["onPress"];
}>) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        iconButtonStyles.button,
        {
          backgroundColor: colors.surfaceRaised,
          opacity: pressed && !disabled ? 0.75 : disabled ? 0.5 : 1,
        },
      ]}
    >
      <View>{children}</View>
    </Pressable>
  );
}

const iconButtonStyles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
  },
});
