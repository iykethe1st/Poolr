import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.large,
    padding: spacing[4],
  },
});
