import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useParcels } from '../../src/context/ParcelsContext';
import { COLORS, SHADOW_CARD } from '../../src/theme/tokens';
import { formatRelativeTime } from '../../src/utils/date';

export default function UpdatesScreen() {
  const router = useRouter();
  const { alerts, unreadCount, refreshing, refreshData, markAlertRead, markAllAlertsRead, showToast } =
    useParcels();
  const [importantOnly, setImportantOnly] = useState(true);

  const visibleAlerts = useMemo(() => {
    if (!importantOnly) return alerts;
    return alerts.filter((a) => a.importance === 'critical' || a.importance === 'important');
  }, [alerts, importantOnly]);

  const hasAnyUnread = unreadCount > 0 || alerts.some((a) => !a.isRead);

  async function handleMarkAllRead() {
    try {
      await markAllAlertsRead();
      showToast({ title: 'All updates marked read', body: 'Your inbox is clear.', tone: 'info' });
    } catch (err: any) {
      showToast({ title: 'Could not mark read', body: err?.message || 'Try again.', tone: 'danger' });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshData(false)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>SMART ALERTS</Text>
            <Text style={styles.heading}>Important Updates</Text>
            <Text style={styles.sub}>
              Always tells you what's moving — no cryptic AWB guesswork.
            </Text>
          </View>
          {hasAnyUnread ? (
            <Pressable onPress={handleMarkAllRead} style={styles.readAllBtn}>
              <Ionicons name="checkmark-done" size={15} color={COLORS.primary} />
              <Text style={styles.readAllText}>Mark read</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Filter toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setImportantOnly(true)}
            style={[styles.togglePill, importantOnly && styles.togglePillActive]}
          >
            <Text style={[styles.toggleText, importantOnly && styles.toggleTextActive]}>
              Important Only
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setImportantOnly(false)}
            style={[styles.togglePill, !importantOnly && styles.togglePillActive]}
          >
            <Text style={[styles.toggleText, !importantOnly && styles.toggleTextActive]}>
              All Activity ({alerts.length})
            </Text>
          </Pressable>
        </View>

        {visibleAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptySub}>
              As soon as any parcel clears customs, lands in your country, goes out for delivery, or
              hits a delay, you'll see a clear update right here.
            </Text>
          </View>
        ) : (
          visibleAlerts.map((alert) => {
            const isCritical = alert.importance === 'critical';
            return (
              <Pressable
                key={alert.id}
                onPress={() => {
                  if (!alert.isRead) markAlertRead(alert.id).catch(() => {});
                  router.push(`/parcel/${alert.parcelId}`);
                }}
                style={({ pressed }) => [
                  styles.alertCard,
                  !alert.isRead && styles.alertCardUnread,
                  isCritical && styles.alertCardCritical,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.alertTop}>
                  <View style={styles.alertTitleWrap}>
                    {!alert.isRead ? <View style={styles.unreadDot} /> : null}
                    <Text style={[styles.alertTitle, isCritical && { color: COLORS.danger }]}>
                      {alert.title}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
                </View>

                <Text style={styles.alertBody}>{alert.body}</Text>

                <View style={styles.alertFooter}>
                  <Text style={styles.metaChip}>
                    {alert.parcelEmoji} {alert.parcelTitle}
                  </Text>
                  <Text style={styles.carrierTag}>
                    {alert.carrierName} • {alert.parcelAwb}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  overline: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.primary,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  sub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    marginTop: 6,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  togglePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_CARD,
  },
  alertCardUnread: {
    borderColor: COLORS.primary + '66',
    backgroundColor: '#FFFFFF',
  },
  alertCardCritical: {
    borderColor: COLORS.danger + '66',
    backgroundColor: COLORS.dangerBg,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  alertTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  alertTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  alertBody: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  alertFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  carrierTag: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
  },
  emptyEmoji: {
    fontSize: 38,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
