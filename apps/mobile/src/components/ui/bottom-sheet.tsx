import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme";

export function BottomSheet({
  children,
  onClose,
  visible,
}: PropsWithChildren<{
  onClose: () => void;
  visible: boolean;
}>) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.borderInput }]}
          />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    gap: spacing[4],
    padding: spacing[6],
    paddingBottom: Platform.OS === "ios" ? spacing[8] : spacing[6],
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
  },
  handle: {
    width: spacing[10],
    height: spacing[1],
    alignSelf: "center",
    borderRadius: radii.small,
  },
});
