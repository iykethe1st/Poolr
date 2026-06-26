import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-notifications';
import { useColors } from '@/lib/colors';
import { timeAgo } from '@/lib/format';

export default function NotificationsScreen() {
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.subtitle}>{unreadCount} unread</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={() => markAll.mutate()}
              disabled={markAll.isPending}
              style={styles.markAllBtn}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {isLoading && notifications.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifRow, !n.isRead && styles.notifUnread]}
                onPress={() => { if (!n.isRead) markOne.mutate(n.id); }}
                activeOpacity={0.75}
              >
                <View style={[styles.dot, n.isRead && styles.dotRead]} />
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !n.isRead && styles.notifTitleBold]}>
                    {n.title}
                  </Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 24, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    markAllBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primaryBorder },
    markAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    empty: { paddingVertical: 60, alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptyText: { fontSize: 14, color: colors.textMuted },
    list: { gap: 8 },
    notifRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notifUnread: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5, flexShrink: 0 },
    dotRead: { backgroundColor: colors.border },
    notifContent: { flex: 1, gap: 3 },
    notifTitle: { fontSize: 14, color: colors.text },
    notifTitleBold: { fontWeight: '700' },
    notifBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    notifTime: { fontSize: 11, color: colors.textMuted },
  });
}
