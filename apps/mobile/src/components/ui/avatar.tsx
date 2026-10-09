import { StyleSheet, View } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";
import { Text } from "./text";

export function Avatar({ initials }: { initials: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`Avatar: ${initials}`}
      style={[styles.avatar, { backgroundColor: colors.primarySubtle }]}
    >
      <Text variant="bodyStrong" tone="brand">
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: spacing[10],
    height: spacing[10],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
  },
});
