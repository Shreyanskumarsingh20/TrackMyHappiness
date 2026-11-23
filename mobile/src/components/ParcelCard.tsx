import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SHADOW_CARD, STAGE_META } from '../theme/tokens';
import { Parcel } from '../types';
import { formatEtaLabel, formatRelativeTime } from '../utils/date';
import { JourneyProgress } from './JourneyProgress';
import { StatusBadge } from './StatusBadge';

interface Props {
  parcel: Parcel;
  onPress: () => void;
}

export function ParcelCard({ parcel, onPress }: Props) {
  const etaLabel = formatEtaLabel(parcel.estimatedDelivery, parcel.status);
  const stageMeta = STAGE_META[parcel.status] ?? STAGE_META.pending;
  const hasUnread = (parcel.unreadAlertsCount ?? 0) > 0;
  const isUrgent = parcel.status === 'exception' || parcel.status === 'out_for_delivery';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isUrgent && { borderColor: stageMeta.color + '55' },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Top Row: What's Coming visual emblem + Title + Status */}
      <View style={styles.topRow}>
        <View style={[styles.avatarBox, { backgroundColor: stageMeta.bg }]}>
          {parcel.itemImageUrl ? (
            <Image source={{ uri: parcel.itemImageUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.emoji}>{parcel.itemEmoji || '📦'}</Text>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {parcel.itemTitle}
            </Text>
          </View>

          <View style={styles.metaRow}>
            {parcel.merchant ? (
              <View style={styles.merchantChip}>
                <Text style={styles.merchantText} numberOfLines={1}>
                  {parcel.merchant}
                </Text>
              </View>
            ) : null}
            <Text style={styles.routeText} numberOfLines={1}>
              {parcel.originFlag} {parcel.originCountry} → {parcel.destinationFlag}
            </Text>
          </View>
        </View>
      </View>

      {/* Personal note reminder ("so I know which parcel is which!") */}
      {parcel.itemNotes ? (
        <Text style={styles.noteText} numberOfLines={1}>
          📝 {parcel.itemNotes}
        </Text>
      ) : null}

      {/* Status + ETA row */}
      <View style={styles.statusRow}>
        <StatusBadge stage={parcel.status} />
        {etaLabel ? (
          <View style={styles.etaPill}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.etaText}>{etaLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Visual 5-step global journey progress */}
      <View style={styles.progressWrap}>
        <JourneyProgress stage={parcel.status} />
      </View>

      {/* Latest important update in plain English */}
      <View style={[styles.updateBox, parcel.status === 'exception' && styles.updateBoxDanger]}>
        <Text style={styles.updateSummary} numberOfLines={2}>
          {parcel.statusSummary || 'Watching carrier for latest milestone...'}
        </Text>
        <Text style={styles.updateTime}>{formatRelativeTime(parcel.lastEventAt || parcel.updatedAt)}</Text>
      </View>

      {/* Subtle footer with carrier & AWB tucked neatly away */}
      <View style={styles.footerRow}>
        <View style={styles.awbPill}>
          <Ionicons name="barcode-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.carrierText} numberOfLines={1}>
            {parcel.carrierName}
          </Text>
          <Text style={styles.awbDivider}>•</Text>
          <Text style={styles.awbText} numberOfLines={1}>
            {parcel.awb}
          </Text>
        </View>

        <View style={styles.footerRight}>
          {parcel.muted ? (
            <Ionicons name="notifications-off-outline" size={15} color={COLORS.textMuted} />
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOW_CARD,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  emoji: {
    fontSize: 26,
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  titleBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  merchantChip: {
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  merchantText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  routeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  noteText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressWrap: {
    marginTop: 12,
  },
  updateBox: {
    marginTop: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  updateBoxDanger: {
    backgroundColor: COLORS.dangerBg,
  },
  updateSummary: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 18,
  },
  updateTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  footerRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  awbPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  carrierText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  awbDivider: {
    color: COLORS.borderStrong,
  },
  awbText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
