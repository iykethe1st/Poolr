import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { radii, spacing, typography } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "./text";

type AmountInputProps = Omit<TextInputProps, "accessibilityLabel"> & {
  accessibilityLabel: string;
  error?: string;
  label: string;
};

export function AmountInput({
  accessibilityLabel,
  error,
  label,
  onBlur,
  onFocus,
  ...props
}: AmountInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error
              ? colors.danger
              : focused
                ? colors.borderInput
                : colors.border,
          },
        ]}
      >
        <Text variant="title2" tone="secondary" tabularNumbers>
          ₦
        </Text>
        <TextInput
          {...props}
          accessibilityLabel={accessibilityLabel}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={colors.textTertiary}
          style={[props.style, styles.input, { color: colors.textPrimary }]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing[2],
  },
  inputWrap: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderRadius: radii.medium,
  },
  input: {
    flex: 1,
    ...typography.title1,
    fontVariant: ["tabular-nums"],
  },
});
