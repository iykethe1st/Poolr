import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { spacing } from "@/theme";
import { useTheme } from "@/theme";

type ScreenContainerProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
}>;

export function ScreenContainer({
  children,
  contentContainerStyle,
  scroll = true,
  scrollProps,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const content = scroll ? (
    <ScrollView
      {...scrollProps}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    gap: spacing[4],
  },
});
