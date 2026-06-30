import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/lib/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  redirectPath?: string;
  context?: 'create' | 'join';
}

export function KycRequiredModal({ visible, onClose, redirectPath, context = 'create' }: Props) {
  const colors = useColors();
  const s = styles(colors);

  function handleVerify() {
    onClose();
    const path = redirectPath ? `/kyc?redirect=${encodeURIComponent(redirectPath)}` : '/kyc';
    router.push(path as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.icon}>🪪</Text>
          <Text style={s.title}>Identity verification required</Text>
          <Text style={s.body}>
            {context === 'join'
              ? 'You need to verify your identity before joining a savings group. This protects you and every other member of your circle.'
              : 'You need to verify your identity before creating a savings group. This protects all members of your circle.'}
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={handleVerify}>
            <Text style={s.primaryBtnText}>Verify identity</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
            <Text style={s.secondaryBtnText}>Not now</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (colors: import('@/lib/colors').Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      gap: 8,
    },
    icon: { fontSize: 48 },
    title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
    body: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginTop: 2, marginBottom: 8 },
    primaryBtn: {
      width: '100%', height: 50, backgroundColor: colors.primary,
      borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    secondaryBtn: { width: '100%', paddingVertical: 10, alignItems: 'center' },
    secondaryBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  });
