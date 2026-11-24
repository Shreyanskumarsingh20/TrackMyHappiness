import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { JourneyProgress } from '../../src/components/JourneyProgress';
import { StatusBadge } from '../../src/components/StatusBadge';
import { TimelineItem } from '../../src/components/TimelineItem';
import { useParcels } from '../../src/context/ParcelsContext';
import { api } from '../../src/services/api';
import { CATEGORIES, COLORS, SHADOW_CARD, STAGE_META } from '../../src/theme/tokens';
import { ItemCategory, Parcel } from '../../src/types';
import { formatEtaLabel } from '../../src/utils/date';

export default function ParcelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    parcels,
    refreshParcel,
    updateParcel,
    deleteParcel,
    markParcelAlertsRead,
    showToast,
  } = useParcels();

  const [parcel, setParcel] = useState<Parcel | null>(
    () => parcels.find((p) => p.id === id) ?? null
  );
  const [loading, setLoading] = useState(!parcel);
  const [refreshing, setRefreshing] = useState(false);
  const [importantOnly, setImportantOnly] = useState(false);

  // Inline "Edit What's Inside" state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEmoji, setEditEmoji] = useState('📦');
  const [editCategory, setEditCategory] = useState<ItemCategory>('other');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api
      .getParcel(id)
      .then((res) => {
        if (!active) return;
        setParcel(res.parcel);
        setLoading(false);
        markParcelAlertsRead(id).catch(() => {});
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, markParcelAlertsRead]);

  const events = useMemo(() => {
    const all = parcel?.events ?? [];
    if (!importantOnly) return all;
    return all.filter((e) => e.importance === 'critical' || e.importance === 'important');
  }, [parcel, importantOnly]);

  function openEditor() {
    if (!parcel) return;
    setEditTitle(parcel.itemTitle);
    setEditMerchant(parcel.merchant);
    setEditNotes(parcel.itemNotes);
    setEditEmoji(parcel.itemEmoji);
    setEditCategory(parcel.itemCategory);
    setEditing(true);
  }

  async function saveEditor() {
    if (!parcel || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateParcel(parcel.id, {
        itemTitle: editTitle.trim(),
        merchant: editMerchant.trim(),
        itemNotes: editNotes.trim(),
        itemEmoji: editEmoji,
        itemCategory: editCategory,
      });
      setParcel(updated);
      setEditing(false);
      showToast({
        title: 'Item details updated',
        body: `${updated.itemEmoji} ${updated.itemTitle}`,
        tone: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Could not save changes',
        body: err?.message || 'Try refreshing and saving again.',
        tone: 'danger',
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRefresh() {
    if (!parcel) return;
    setRefreshing(true);
    try {
      const res = await refreshParcel(parcel.id);
      setParcel(res.parcel);
    } catch (err: any) {
      showToast({
        title: 'Could not refresh tracking',
        body: err?.message || 'Try again in a moment.',
        tone: 'danger',
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopyAwb() {
    if (!parcel) return;
    try {
      await Clipboard.setStringAsync(parcel.awb);
      showToast({
        title: 'AWB copied',
        body: parcel.awb,
        tone: 'info',
      });
    } catch {
      showToast({ title: 'Copy failed', body: parcel.awb, tone: 'warning' });
    }
  }

  async function handleToggleMute() {
    if (!parcel) return;
    try {
      const updated = await updateParcel(parcel.id, { muted: !parcel.muted });
      setParcel(updated);
      showToast({
        title: updated.muted ? 'Alerts muted for this parcel' : 'Important alerts active',
        body: updated.itemTitle,
        tone: 'info',
      });
    } catch (err: any) {
      showToast({
        title: 'Could not update alert setting',
        body: err?.message || 'Try again in a moment.',
        tone: 'danger',
      });
    }
  }

  function handleDelete() {
    if (!parcel) return;
    const performDelete = async () => {
      try {
        await deleteParcel(parcel.id);
        router.replace('/(tabs)');
      } catch (err: any) {
        showToast({
          title: 'Could not remove parcel',
          body: err?.message || 'Try again in a moment.',
          tone: 'danger',
        });
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Stop tracking "${parcel.itemTitle}"?`)) {
        void performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Parcel?',
      `Stop tracking "${parcel.itemTitle}" (${parcel.awb})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!parcel) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>Parcel not found</Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Go to What's Coming</Text>
        </Pressable>
      </View>
    );
  }

  const stageMeta = STAGE_META[parcel.status] ?? STAGE_META.pending;
  const etaLabel = formatEtaLabel(parcel.estimatedDelivery, parcel.status);
  const isSimulator = parcel.providerUsed === 'simulator';
  const canSimulateNext = isSimulator && parcel.status !== 'delivered';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Hero "What's Coming" Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIconBox, { backgroundColor: stageMeta.bg }]}>
            {parcel.itemImageUrl ? (
              <Image source={{ uri: parcel.itemImageUrl }} style={styles.heroImg} />
            ) : (
              <Text style={styles.heroEmoji}>{parcel.itemEmoji || '📦'}</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{parcel.itemTitle}</Text>
            <View style={styles.heroMetaRow}>
              {parcel.merchant ? (
                <View style={styles.merchantPill}>
                  <Text style={styles.merchantPillText}>{parcel.merchant}</Text>
                </View>
              ) : null}
              <Text style={styles.routePill}>
                {parcel.originFlag} {parcel.originCountry} → {parcel.destinationFlag}{' '}
                {parcel.destinationCountry}
              </Text>
            </View>
          </View>

          <Pressable onPress={openEditor} style={styles.editIconBtn}>
            <Ionicons name="pencil" size={16} color={COLORS.primary} />
          </Pressable>
        </View>

        {parcel.itemNotes ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteBoxText}>📝 {parcel.itemNotes}</Text>
          </View>
        ) : null}

        <View style={styles.heroStatusRow}>
          <StatusBadge stage={parcel.status} />
          {etaLabel ? (
            <View style={styles.etaBadge}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.etaBadgeText}>{etaLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.journeyWrap}>
          <JourneyProgress stage={parcel.status} showLabels />
        </View>

        <View style={styles.summaryCallout}>
          <Text style={styles.summaryText}>{parcel.statusSummary}</Text>
        </View>

        {/* AWB & Carrier strip */}
        <View style={styles.awbRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.providerLine}>
              <Text style={styles.awbLabel}>{parcel.carrierName}</Text>
              <View
                style={[
                  styles.modeChip,
                  isSimulator ? styles.modeChipSim : styles.modeChipLive,
                ]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    isSimulator ? styles.modeChipTextSim : styles.modeChipTextLive,
                  ]}
                >
                  {isSimulator
                    ? 'DEMO'
                    : parcel.providerUsed === 'free_direct'
                    ? 'FREE LIVE'
                    : parcel.providerUsed.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.awbValue}>{parcel.awb}</Text>
          </View>
          <Pressable onPress={handleCopyAwb} style={styles.smallBtn}>
            <Ionicons name="copy-outline" size={15} color={COLORS.text} />
            <Text style={styles.smallBtnText}>Copy AWB</Text>
          </Pressable>
        </View>

        <View style={styles.linksRow}>
          {parcel.carrierTrackingUrl ? (
            <Pressable
              onPress={() => Linking.openURL(parcel.carrierTrackingUrl).catch(() => {})}
              style={styles.carrierLinkBtn}
            >
              <Ionicons name="globe-outline" size={15} color={COLORS.primary} />
              <Text style={styles.carrierLinkText}>Open Live Carrier Page</Text>
              <Ionicons name="open-outline" size={13} color={COLORS.primary} />
            </Pressable>
          ) : null}

          {parcel.orderUrl ? (
            <Pressable
              onPress={() => Linking.openURL(parcel.orderUrl).catch(() => {})}
              style={styles.orderLinkBtn}
            >
              <Ionicons name="receipt-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.orderLinkText}>Order Page</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Inline "Edit What's Inside" Drawer */}
      {editing ? (
        <View style={styles.editCard}>
          <Text style={styles.editHeading}>Edit What's Coming Inside</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setEditCategory(c.id as ItemCategory);
                  setEditEmoji(c.emoji);
                }}
                style={[styles.catChip, editCategory === c.id && styles.catChipActive]}
              >
                <Text>{c.emoji}</Text>
                <Text style={styles.catChipText}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Item name"
            style={styles.editInput}
          />
          <TextInput
            value={editMerchant}
            onChangeText={setEditMerchant}
            placeholder="Store / sender"
            style={styles.editInput}
          />
          <TextInput
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Personal notes (color, size, who it's for...)"
            style={styles.editInput}
          />

          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveEditor} disabled={savingEdit} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{savingEdit ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Live Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          style={[styles.primaryActionBtn, canSimulateNext && styles.simulateActionBtn]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={canSimulateNext ? 'flash' : 'refresh'}
              size={18}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.primaryActionText}>
            {canSimulateNext ? 'Simulate Next Milestone' : 'Check Carrier Now'}
          </Text>
        </Pressable>

        <Pressable onPress={handleToggleMute} style={styles.secondaryActionBtn}>
          <Ionicons
            name={parcel.muted ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color={parcel.muted ? COLORS.textMuted : COLORS.primary}
          />
          <Text style={styles.secondaryActionText}>
            {parcel.muted ? 'Muted' : 'Alerts On'}
          </Text>
        </Pressable>
      </View>

      {canSimulateNext ? (
        <Text style={styles.simHint}>
          💡 Demo Simulator mode: tap "Simulate Next Milestone" to watch international arrival, customs, out-for-delivery, and smart alerts trigger live!
        </Text>
      ) : null}

      {/* Tracking Timeline */}
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineHeading}>Tracking Timeline</Text>
        <View style={styles.filterPills}>
          <Pressable
            onPress={() => setImportantOnly(false)}
            style={[styles.pill, !importantOnly && styles.pillActive]}
          >
            <Text style={[styles.pillText, !importantOnly && styles.pillTextActive]}>
              All ({parcel.events?.length ?? 0})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setImportantOnly(true)}
            style={[styles.pill, importantOnly && styles.pillActive]}
          >
            <Text style={[styles.pillText, importantOnly && styles.pillTextActive]}>
              Important
            </Text>
          </Pressable>
        </View>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyTimeline}>
          <Text style={styles.emptyTimelineText}>No carrier milestones recorded yet.</Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {events.map((ev, index) => (
            <TimelineItem
              key={ev.id}
              event={ev}
              isLatest={index === 0}
              isLast={index === events.length - 1}
            />
          ))}
        </View>
      )}

      {/* Delete Footer */}
      <Pressable onPress={handleDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        <Text style={styles.deleteBtnText}>Remove Parcel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    padding: 18,
    paddingBottom: 48,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    gap: 12,
  },
  notFoundTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700' },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_CARD,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: { width: 60, height: 60, borderRadius: 18 },
  heroEmoji: { fontSize: 30 },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 25,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  merchantPill: {
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  merchantPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  routePill: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    marginTop: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 10,
  },
  noteBoxText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  etaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  journeyWrap: {
    marginTop: 16,
  },
  summaryCallout: {
    marginTop: 14,
    backgroundColor: COLORS.primaryTint,
    borderRadius: 12,
    padding: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    lineHeight: 20,
  },
  awbRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  awbLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  providerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  modeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modeChipLive: {
    backgroundColor: COLORS.successBg,
  },
  modeChipSim: {
    backgroundColor: COLORS.accentSoft,
  },
  modeChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modeChipTextLive: {
    color: COLORS.success,
  },
  modeChipTextSim: {
    color: COLORS.accentDark,
  },
  awbValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  linksRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  carrierLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  carrierLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  orderLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  orderLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  editCard: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
    gap: 10,
  },
  editHeading: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  catRow: { flexDirection: 'row', gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  catChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  editInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.text,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  simulateActionBtn: {
    backgroundColor: COLORS.accentDark,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  simHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  timelineHeader: {
    marginTop: 22,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  timelineList: {
    marginTop: 2,
  },
  emptyTimeline: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  deleteBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.danger + '33',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
