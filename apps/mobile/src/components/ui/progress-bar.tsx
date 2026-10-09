import { StyleSheet, View } from "react-native";
import { radii } from "@/theme";
import { useTheme } from "@/theme";

export function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedProgress * 100),
      }}
      style={[styles.track, { backgroundColor: colors.primarySubtle }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    overflow: "hidden",
    borderRadius: radii.small,
  },
  fill: {
    height: "100%",
    borderRadius: radii.small,
  },
});
