import { StyleSheet, View, type ViewStyle } from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";

export function Skeleton({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      style={[styles.skeleton, { backgroundColor: colors.skeleton }, style]}
    />
  );
}

export function LoadingCard() {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={styles.card}
    >
      <Skeleton style={styles.title} />
      <Skeleton style={styles.value} />
      <Skeleton style={styles.caption} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    minHeight: spacing[3],
    borderRadius: radii.small,
  },
  card: {
    gap: spacing[3],
    padding: spacing[4],
  },
  title: { width: "42%" },
  value: { width: "68%", minHeight: spacing[8] },
  caption: { width: "55%" },
});
