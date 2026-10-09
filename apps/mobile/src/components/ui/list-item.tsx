import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { radii, spacing } from "@/theme";
import { Card } from "./card";
import { Text } from "./text";

type ListItemProps = PropsWithChildren<{
  accessibilityLabel: string;
  onPress?: PressableProps["onPress"];
  subtitle?: string;
  title: string;
}>;

export function ListItem({
  accessibilityLabel,
  children,
  onPress,
  subtitle,
  title,
}: ListItemProps) {
  const content = (
    <Card style={styles.card}>
      <View style={styles.copy}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.medium,
  },
  copy: {
    flex: 1,
    gap: spacing[1],
  },
  pressed: {
    opacity: 0.8,
  },
});
