import { forwardRef } from "react";
import {
  Text as NativeText,
  StyleSheet,
  type TextProps as NativeTextProps,
  type TextStyle,
} from "react-native";
import { typography, type TypographyVariant } from "@/theme";
import { useTheme } from "@/theme";

type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "onPrimary"
  | "inverse"
  | "brand"
  | "success"
  | "warning"
  | "danger";

type TextProps = NativeTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  tabularNumbers?: boolean;
};

const toneToken: Record<TextTone, keyof ReturnType<typeof useTheme>["colors"]> =
  {
    primary: "textPrimary",
    secondary: "textSecondary",
    tertiary: "textTertiary",
    onPrimary: "textOnPrimary",
    inverse: "textInverse",
    brand: "primary",
    success: "success",
    warning: "warning",
    danger: "danger",
  };

export const Text = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  function Text(
    {
      variant = "body",
      tone = "primary",
      tabularNumbers = false,
      style,
      ...props
    },
    ref,
  ) {
    const { colors } = useTheme();
    const numberStyle: TextStyle | undefined = tabularNumbers
      ? { fontVariant: ["tabular-nums"] }
      : undefined;
    const requestedColor = StyleSheet.flatten(style)?.color;
    const resolvedColor =
      typeof requestedColor === "string" &&
      Object.values(colors).includes(requestedColor)
        ? requestedColor
        : colors[toneToken[tone]];

    return (
      <NativeText
        ref={ref}
        {...props}
        style={[
          typography[variant],
          style,
          numberStyle,
          { color: resolvedColor },
        ]}
      />
    );
  },
);

Text.displayName = "Text";
export type { TextProps, TextTone };
