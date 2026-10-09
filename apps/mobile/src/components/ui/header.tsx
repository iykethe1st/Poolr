import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/theme";
import { Text } from "./text";

export function Header({
  action,
  subtitle,
  title,
}: {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text variant="title2">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  copy: {
    flex: 1,
    gap: spacing[1],
  },
});
