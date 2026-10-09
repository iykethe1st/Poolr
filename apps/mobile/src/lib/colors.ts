import { useTheme } from "@/theme";

export type Colors = ReturnType<typeof useColors>;

export function useColors() {
  const { colors } = useTheme();

  return {
    ...colors,
    primaryLight: colors.primaryPressed,
    primaryForeground: colors.textOnPrimary,
    card: colors.surface,
    text: colors.textPrimary,
    textMuted: colors.textTertiary,
    primaryBg: colors.primarySubtle,
    primaryBorder: colors.borderInput,
    primaryText: colors.primary,
    primaryTextMid: colors.primary,
    successBg: colors.successSubtle,
    successText: colors.success,
    dangerBg: colors.dangerSubtle,
    dangerText: colors.danger,
    dangerBorder: colors.borderInput,
    warningBg: colors.warningSubtle,
    warningText: colors.warning,
    infoBg: colors.primarySubtle,
    infoText: colors.primary,
    mutedBg: colors.surfaceRaised,
    mutedText: colors.textSecondary,
    completedBg: colors.primarySubtle,
    completedText: colors.primary,
    inputBg: colors.surface,
    destructive: colors.danger,
  };
}

export { useTheme };
