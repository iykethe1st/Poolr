import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/theme";
import { Text } from "./text";

export function EmptyState({
  action,
  children,
  title,
}: PropsWithChildren<{ action?: React.ReactNode; title: string }>) {
  return (
    <View style={styles.container}>
      <Text variant="headline">{title}</Text>
      {children ? <Text tone="secondary">{children}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[6],
  },
});
