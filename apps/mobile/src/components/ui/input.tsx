import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { radii, spacing, typography } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "./text";

type InputProps = TextInputProps & {
  error?: string;
  helperText?: string;
  label: string;
};

export function Input({
  error,
  helperText,
  label,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={colors.textTertiary}
        style={[
          props.style,
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error
              ? colors.danger
              : focused
                ? colors.borderInput
                : colors.border,
          },
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" tone="tertiary">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing[2],
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.medium,
    paddingHorizontal: spacing[3],
    ...typography.body,
  },
});
