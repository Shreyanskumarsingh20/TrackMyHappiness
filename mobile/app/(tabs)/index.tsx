import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParcelCard } from '../../src/components/ParcelCard';
import { useParcels } from '../../src/context/ParcelsContext';
import { COLORS, SHADOW_CARD, SHADOW_FAB } from '../../src/theme/tokens';

type FilterTab = 'all' | 'incoming' | 'attention' | 'delivered';

export default function HomeScreen() {
  const router = useRouter();
  const { parcels, settings, loading, refreshing, connectionError, refreshData } = useParcels();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const incoming = parcels.filter((p) => p.status !== 'delivered' && p.status !== 'expired');
    const outToday = parcels.filter((p) => p.status === 'out_for_delivery');
    const attention = parcels.filter((p) => p.status === 'exception' || p.status === 'customs');
    const delivered = parcels.filter((p) => p.status === 'delivered');
    return {
      incomingCount: incoming.length,
      outTodayCount: outToday.length,
      attentionCount: attention.length,
      deliveredCount: delivered.length,
      firstAttention: attention[0] ?? null,
    };
  }, [parcels]);

  const filteredParcels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parcels.filter((p) => {
      if (filter === 'incoming' && (p.status === 'delivered' || p.status === 'expired')) return false;
      if (filter === 'attention' && p.status !== 'exception' && p.status !== 'customs') return false;
      if (filter === 'delivered' && p.status !== 'delivered') return false;

      if (!q) return true;
      return (
        p.itemTitle.toLowerCase().includes(q) ||
        p.awb.toLowerCase().includes(q) ||
        p.merchant.toLowerCase().includes(q) ||
        p.carrierName.toLowerCase().includes(q) ||
        p.itemNotes.toLowerCase().includes(q) ||
        p.originCountry.toLowerCase().includes(q)
      );
    });
  }, [parcels, filter, search]);

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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandOverline}>TRACK MY HAPPINESS</Text>
            <Text style={styles.heading}>What's Coming ✨</Text>
            <Text style={styles.subheading}>
              {stats.incomingCount === 0
                ? 'Drop any worldwide AWB — we watch it for you.'
                : `${stats.incomingCount} parcel${stats.incomingCount === 1 ? '' : 's'} on the way${
                    stats.outTodayCount > 0 ? ` • ${stats.outTodayCount} arriving today!` : ''
                  }`}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.enginePill}
          >
            <View
              style={[
                styles.engineDot,
                {
                  backgroundColor:
                    settings?.activeProvider === 'simulator' ? COLORS.accent : COLORS.success,
                },
              ]}
            />
            <Text style={styles.engineText}>
              {settings?.activeProvider === 'free_direct'
                ? 'Free Live'
                : settings?.activeProvider === 'whereparcel'
                ? 'WhereParcel'
                : settings?.activeProvider === 'simulator'
                ? 'Demo Sim'
                : settings?.activeProvider?.toUpperCase() || 'Live'}
            </Text>
          </Pressable>
        </View>

        {/* Backend connection alert if offline */}
        {connectionError ? (
          <View style={styles.errorBanner}>
            <View style={styles.errorLeft}>
              <Ionicons name="cloud-offline-outline" size={20} color={COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>Backend server unreachable</Text>
                <Text style={styles.errorSub}>
                  Start the backend (`npm run dev:backend`) or set your computer's LAN IP in Settings.
                </Text>
              </View>
            </View>
            <View style={styles.errorActions}>
              <Pressable onPress={() => refreshData(false)} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/(tabs)/settings')} style={styles.configBtn}>
                <Text style={styles.configBtnText}>Server URL</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Summary KPI Strip */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statCard, filter === 'incoming' && styles.statCardActive]}
            onPress={() => setFilter(filter === 'incoming' ? 'all' : 'incoming')}
          >
            <Text style={[styles.statNum, { color: COLORS.primary }]}>{stats.incomingCount}</Text>
            <Text style={styles.statLabel}>On the way</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, styles.statCardAccent]}
            onPress={() => setFilter('incoming')}
          >
            <Text style={[styles.statNum, { color: COLORS.accentDark }]}>{stats.outTodayCount}</Text>
            <Text style={styles.statLabel}>Out today</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, filter === 'delivered' && styles.statCardActive]}
            onPress={() => setFilter(filter === 'delivered' ? 'all' : 'delivered')}
          >
            <Text style={[styles.statNum, { color: COLORS.success }]}>{stats.deliveredCount}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </Pressable>
        </View>

        {/* Customs / Attention Banner */}
        {stats.firstAttention ? (
          <Pressable
            style={styles.attentionBanner}
            onPress={() => router.push(`/parcel/${stats.firstAttention!.id}`)}
          >
            <View style={styles.attentionIcon}>
              <Ionicons
                name={stats.firstAttention.status === 'exception' ? 'alert-circle' : 'shield-half'}
                size={20}
                color={
                  stats.firstAttention.status === 'exception' ? COLORS.danger : COLORS.warning
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attentionTitle}>
                {stats.attentionCount > 1
                  ? `${stats.attentionCount} parcels in customs / needing attention`
                  : `${stats.firstAttention.itemEmoji} ${stats.firstAttention.itemTitle}`}
              </Text>
              <Text style={styles.attentionSub} numberOfLines={1}>
                {stats.firstAttention.statusSummary}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.warning} />
          </Pressable>
        ) : null}

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by what's inside, store, country, or AWB..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {(
            [
              { id: 'all', label: `All (${parcels.length})` },
              { id: 'incoming', label: `On the Way (${stats.incomingCount})` },
              { id: 'attention', label: `Customs / Alert (${stats.attentionCount})` },
              { id: 'delivered', label: `Delivered (${stats.deliveredCount})` },
            ] as { id: FilterTab; label: string }[]
          ).map((chip) => {
            const active = filter === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setFilter(chip.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Parcel Cards */}
        {loading && parcels.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.emptySub}>Checking your incoming parcels...</Text>
          </View>
        ) : filteredParcels.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>
              {search || filter !== 'all' ? 'No matching parcels' : 'No parcels tracked yet'}
            </Text>
            <Text style={styles.emptySub}>
              {search || filter !== 'all'
                ? 'Try clearing your search or switching filters.'
                : 'Just paste an SMS/email or drop any worldwide AWB — we’ll remember what’s inside and alert you on every important move.'}
            </Text>
            {!search && filter === 'all' ? (
              <Pressable onPress={() => router.push('/add')} style={styles.emptyCta}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyCtaText}>Drop Your First AWB</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredParcels.map((parcel) => (
              <ParcelCard
                key={parcel.id}
                parcel={parcel}
                onPress={() => router.push(`/parcel/${parcel.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Drop AWB Button */}
      <Pressable
        onPress={() => router.push('/add')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Drop AWB</Text>
      </Pressable>
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
    paddingBottom: 110,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  brandOverline: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.primary,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  subheading: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  enginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  engineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  engineText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  errorBanner: {
    marginTop: 14,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.danger + '33',
    gap: 10,
  },
  errorLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  errorSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  retryBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  configBtn: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  configBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_CARD,
  },
  statCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
  },
  statCardAccent: {
    backgroundColor: '#FFFBF5',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  attentionBanner: {
    marginTop: 14,
    backgroundColor: COLORS.warningBg,
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F59E0B55',
  },
  attentionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  attentionSub: {
    fontSize: 12,
    color: COLORS.warning,
    marginTop: 2,
  },
  searchBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    marginTop: 2,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  emptyEmoji: {
    fontSize: 42,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    ...SHADOW_FAB,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
