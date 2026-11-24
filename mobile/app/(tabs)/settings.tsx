import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useParcels } from '../../src/context/ParcelsContext';
import { COLORS, SHADOW_CARD } from '../../src/theme/tokens';
import { NotificationRules, TrackingProviderId } from '../../src/types';

interface ProviderOption {
  id: TrackingProviderId;
  name: string;
  badge: string;
  desc: string;
  keyLabel?: string;
  keyPlaceholder?: string;
  signupUrl?: string;
}

const FREE_PROVIDERS: ProviderOption[] = [
  {
    id: 'free_direct',
    name: 'Free Live Direct ($0 — No API Key)',
    badge: 'FREE',
    desc: 'Live keyless lookups for Japan Post & Cainiao/China cross-border parcels + optional free DHL Developer key + 1-tap official carrier links.',
  },
  {
    id: 'whereparcel',
    name: 'WhereParcel Free Tier (~200 Couriers)',
    badge: 'FREE 1K/MO',
    desc: '1,000 trackings/month free forever, no credit card required — covers Japan Post, DHL, UPS, FedEx, USPS, Royal Mail, China Post, India Post & more.',
    keyLabel: 'WhereParcel Key (format: API_KEY:SECRET_KEY)',
    keyPlaceholder: 'your_api_key:your_secret_key',
    signupUrl: 'https://whereparcel.com',
  },
];

const OPTIONAL_PAID_PROVIDERS: ProviderOption[] = [
  {
    id: '17track',
    name: '17TRACK API (2,500+ Couriers)',
    badge: 'PRO',
    desc: 'Enterprise global courier aggregator with automatic carrier detection.',
    keyLabel: '17TRACK API Token (17token)',
    keyPlaceholder: 'Paste 17TRACK token',
  },
  {
    id: 'ship24',
    name: 'Ship24 API (1,500+ Couriers)',
    badge: 'PRO',
    desc: 'Cross-border handoff tracking aggregator.',
    keyLabel: 'Ship24 Bearer API Key',
    keyPlaceholder: 'Paste Ship24 key',
  },
  {
    id: 'trackingmore',
    name: 'TrackingMore API (1,300+ Couriers)',
    badge: 'PRO',
    desc: 'Global & regional courier tracking API.',
    keyLabel: 'TrackingMore API Key',
    keyPlaceholder: 'Paste TrackingMore key',
  },
  {
    id: 'simulator',
    name: 'Offline Simulator (Testing Only)',
    badge: 'TEST',
    desc: 'Generate simulated milestones for local UI testing.',
  },
];

const DESTINATIONS = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'Singapore',
  'UAE',
];

export default function SettingsScreen() {
  const { settings, backendUrl, updateSettings, updateBackendUrl, showToast } = useParcels();

  const [serverInput, setServerInput] = useState(backendUrl);
  const [testingConn, setTestingConn] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<TrackingProviderId>(
    settings?.activeProvider ?? 'free_direct'
  );
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [dhlKeyInput, setDhlKeyInput] = useState('');
  const [showPaidProviders, setShowPaidProviders] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);

  useEffect(() => {
    setServerInput(backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    if (settings?.activeProvider) {
      setSelectedProvider(settings.activeProvider);
      if (['17track', 'ship24', 'trackingmore'].includes(settings.activeProvider)) {
        setShowPaidProviders(true);
      }
    }
  }, [settings?.activeProvider]);

  const allProviders = [...FREE_PROVIDERS, ...OPTIONAL_PAID_PROVIDERS];
  const currentProviderMeta = allProviders.find((p) => p.id === selectedProvider);

  async function handleSaveProvider() {
    setSavingProvider(true);
    try {
      const apiKeys: Partial<
        Record<'whereparcel' | 'dhl' | '17track' | 'ship24' | 'trackingmore', string>
      > = {};

      if (
        selectedProvider !== 'simulator' &&
        selectedProvider !== 'free_direct' &&
        apiKeyInput.trim()
      ) {
        apiKeys[selectedProvider] = apiKeyInput.trim();
      }
      if (dhlKeyInput.trim()) {
        apiKeys.dhl = dhlKeyInput.trim();
      }

      await updateSettings({
        activeProvider: selectedProvider,
        apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
      });
      setApiKeyInput('');
      setDhlKeyInput('');
      showToast({
        title: 'Tracking engine updated',
        body: `Active engine: ${currentProviderMeta?.name ?? selectedProvider}`,
        tone: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Could not save settings',
        body: err?.message || 'Check backend connection',
        tone: 'danger',
      });
    } finally {
      setSavingProvider(false);
    }
  }

  async function toggleRule(key: keyof NotificationRules, val: boolean) {
    try {
      await updateSettings({ notificationRules: { [key]: val } });
    } catch (err: any) {
      showToast({
        title: 'Failed to update rule',
        body: err?.message || 'Check connection',
        tone: 'danger',
      });
    }
  }

  async function handleSaveServer() {
    setTestingConn(true);
    try {
      const ok = await updateBackendUrl(serverInput);
      if (!ok) {
        showToast({
          title: 'Could not reach server',
          body: 'Make sure the backend is running and reachable on your Wi-Fi.',
          tone: 'danger',
        });
      }
    } finally {
      setTestingConn(false);
    }
  }

  const rules = settings?.notificationRules;

  function renderProviderRow(p: ProviderOption) {
    const active = selectedProvider === p.id;
    const isConfigured =
      settings?.configuredProviders?.[p.id] ?? (p.id === 'simulator' || p.id === 'free_direct');
    const isFree = p.badge.startsWith('FREE');

    return (
      <Pressable
        key={p.id}
        onPress={() => setSelectedProvider(p.id)}
        style={[styles.providerRow, active && styles.providerRowActive]}
      >
        <View style={styles.providerHeader}>
          <Ionicons
            name={active ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={active ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={styles.providerName}>{p.name}</Text>
          <View style={[styles.badgePill, isFree ? styles.badgeFree : styles.badgeNeutral]}>
            <Text style={[styles.badgeText, isFree ? styles.badgeTextFree : styles.badgeTextNeutral]}>
              {isConfigured && !isFree ? 'Ready' : p.badge}
            </Text>
          </View>
        </View>
        <Text style={styles.providerDesc}>{p.desc}</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.overline}>CONFIGURATION</Text>
        <Text style={styles.heading}>Tracking & Alerts</Text>
        <Text style={styles.sub}>
          100% free live tracking built in — zero subscriptions required.
        </Text>

        {/* Global Tracking Provider Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌍 Tracking Engine ($0 Free Options)</Text>
          <Text style={styles.cardSub}>
            Free Live Direct works immediately for Japan Post & cross-border China parcels. Add a free WhereParcel key (no card) for 1,000/month across ~200 couriers!
          </Text>

          {FREE_PROVIDERS.map(renderProviderRow)}

          {/* Optional Free DHL Developer key when in Free Live Direct */}
          {selectedProvider === 'free_direct' ? (
            <View style={styles.keyBox}>
              <View style={styles.keyLabelRow}>
                <Text style={styles.fieldLabel}>
                  Optional: Free DHL Developer API Key (developer.dhl.com)
                </Text>
                {settings?.configuredProviders?.dhl ? (
                  <Text style={styles.savedTag}>Saved ✓</Text>
                ) : null}
              </View>
              <TextInput
                value={dhlKeyInput}
                onChangeText={setDhlKeyInput}
                placeholder={
                  settings?.configuredProviders?.dhl
                    ? 'DHL key saved — paste new key to replace'
                    : 'Optional free DHL-API-Key for live DHL Express'
                }
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          ) : null}

          {/* API Key Input for keyed providers (WhereParcel / optional paid) */}
          {currentProviderMeta?.keyLabel ? (
            <View style={styles.keyBox}>
              <View style={styles.keyLabelRow}>
                <Text style={styles.fieldLabel}>{currentProviderMeta.keyLabel}</Text>
                {currentProviderMeta.signupUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(currentProviderMeta.signupUrl!).catch(() => {})}
                  >
                    <Text style={styles.getKeyLink}>Get Free Key ↗</Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder={
                  settings?.configuredProviders?.[selectedProvider]
                    ? 'Key saved — paste a new key to replace'
                    : currentProviderMeta.keyPlaceholder || 'Paste your API key here'
                }
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable
                onPress={async () => {
                  const hook = `${backendUrl}/api/webhooks/${selectedProvider}`;
                  await Clipboard.setStringAsync(hook);
                  showToast({ title: 'Webhook URL copied', body: hook, tone: 'info' });
                }}
                style={styles.webhookRow}
              >
                <Ionicons name="link-outline" size={14} color={COLORS.primary} />
                <Text style={styles.webhookText} numberOfLines={1}>
                  Webhook: {backendUrl}/api/webhooks/{selectedProvider}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Collapsible Optional Business Aggregators */}
          <Pressable
            onPress={() => setShowPaidProviders((v) => !v)}
            style={styles.collapseBtn}
          >
            <Ionicons
              name={showPaidProviders ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={COLORS.textSecondary}
            />
            <Text style={styles.collapseBtnText}>
              {showPaidProviders
                ? 'Hide advanced / paid aggregators'
                : 'Advanced / Paid APIs (17TRACK / Ship24 / TrackingMore) & Test Mode'}
            </Text>
          </Pressable>

          {showPaidProviders ? (
            <View style={{ marginTop: 8 }}>{OPTIONAL_PAID_PROVIDERS.map(renderProviderRow)}</View>
          ) : null}

          <Pressable
            onPress={handleSaveProvider}
            disabled={savingProvider}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {savingProvider ? 'Saving...' : 'Save Tracking Engine'}
            </Text>
          </Pressable>
        </View>

        {/* Smart Important Notification Rules */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔔 Important Update Filters</Text>
          <Text style={styles.cardSub}>
            Only get pinged for milestones that actually matter — never noisy warehouse scans.
          </Text>

          {rules ? (
            <>
              <RuleRow
                label="Mute minor sorting hub scans"
                hint="Recommended — hides routine transit scans from alerts"
                value={rules.muteMinorHubScans}
                onChange={(v) => toggleRule('muteMinorHubScans', v)}
              />
              <RuleRow
                label="Out for delivery alerts"
                hint="Know the morning your parcel is on the van"
                value={rules.notifyOnOutForDelivery}
                onChange={(v) => toggleRule('notifyOnOutForDelivery', v)}
              />
              <RuleRow
                label="Customs & import clearance"
                hint="Alerts on customs arrival, KYC holds, and release"
                value={rules.notifyOnCustoms}
                onChange={(v) => toggleRule('notifyOnCustoms', v)}
              />
              <RuleRow
                label="Delays & delivery exceptions"
                hint="Immediate alert for failed attempts or address issues"
                value={rules.notifyOnException}
                onChange={(v) => toggleRule('notifyOnException', v)}
              />
              <RuleRow
                label="International country arrival"
                hint="When parcel leaves origin or lands in your country"
                value={rules.notifyOnInternationalArrival}
                onChange={(v) => toggleRule('notifyOnInternationalArrival', v)}
              />
              <RuleRow
                label="Delivered confirmation"
                hint="Celebrate when your parcel arrives safely"
                value={rules.notifyOnDelivered}
                onChange={(v) => toggleRule('notifyOnDelivered', v)}
              />
            </>
          ) : (
            <Text style={styles.cardSub}>Connect to backend to edit notification rules.</Text>
          )}
        </View>

        {/* Destination Country (wrapped so every chip is cleanly visible) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Your Destination Country</Text>
          <View style={styles.destGrid}>
            {DESTINATIONS.map((country) => {
              const active = settings?.defaultDestinationCountry === country;
              return (
                <Pressable
                  key={country}
                  onPress={() =>
                    updateSettings({ defaultDestinationCountry: country }).catch((err: any) =>
                      showToast({
                        title: 'Could not update country',
                        body: err?.message || 'Try again.',
                        tone: 'danger',
                      })
                    )
                  }
                  style={[styles.destChip, active && styles.destChipActive]}
                >
                  <Text style={[styles.destText, active && styles.destTextActive]}>{country}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Backend Server URL */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🖥️ Backend Server URL</Text>
          <Text style={styles.cardSub}>
            Auto-detected when using Expo Go. If testing on a real phone over Wi-Fi, enter your computer's local IP (e.g. http://192.168.1.5:4000).
          </Text>
          <TextInput
            value={serverInput}
            onChangeText={setServerInput}
            placeholder="http://localhost:4000"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable onPress={handleSaveServer} disabled={testingConn} style={styles.secondaryBtn}>
            <Ionicons name="pulse-outline" size={16} color={COLORS.primary} />
            <Text style={styles.secondaryBtnText}>
              {testingConn ? 'Testing...' : 'Save & Test Connection'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RuleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.ruleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.ruleLabel}>{label}</Text>
        <Text style={styles.ruleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.borderStrong, true: COLORS.primary + '88' }}
        thumbColor={value ? COLORS.primary : '#F4F3F4'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 44,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
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
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOW_CARD,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  providerRow: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    marginBottom: 8,
  },
  providerRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeFree: {
    backgroundColor: COLORS.successBg,
  },
  badgeNeutral: {
    backgroundColor: COLORS.surfaceMuted,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextFree: {
    color: COLORS.success,
  },
  badgeTextNeutral: {
    color: COLORS.textSecondary,
  },
  providerDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
    marginLeft: 28,
    lineHeight: 17,
  },
  keyBox: {
    marginTop: 8,
    marginBottom: 6,
  },
  keyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    flex: 1,
  },
  savedTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  getKeyLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.text,
  },
  webhookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  webhookText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  collapseBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primaryTint,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  secondaryBtnText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceMuted,
  },
  ruleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  ruleHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  destGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
  },
  destChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  destChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  destText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  destTextActive: {
    color: '#FFFFFF',
  },
});
