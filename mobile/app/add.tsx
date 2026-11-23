import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useParcels } from '../src/context/ParcelsContext';
import { api } from '../src/services/api';
import { CATEGORIES, COLORS, SHADOW_CARD } from '../src/theme/tokens';
import { CarrierDetectionResult, CarrierOption, ItemCategory } from '../src/types';

const SAMPLE_MESSAGES = [
  {
    label: '🇯🇵 Amazon Japan + DHL',
    text: 'Hi! Your Nintendo Switch Pro Controller from Amazon has shipped via DHL Express. Tracking AWB: 4928104736. Arriving Dec 2.',
  },
  {
    label: '🇨🇳 AliExpress + China Post',
    text: 'Order #8823192201 dispatched! Item: Espresso Tamper & Coffee Scale from AliExpress. AWB: RR829104652CN',
  },
  {
    label: '🇺🇸 Nike US + UPS',
    text: 'Great news! Your Running Shoes from Nike US is on the way via UPS. Tracking number: 1Z999AA10876543210.',
  },
];

export default function AddParcelScreen() {
  const router = useRouter();
  const { createParcel, showToast } = useParcels();

  const [smartText, setSmartText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedBadge, setParsedBadge] = useState<string | null>(null);

  const [awb, setAwb] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [merchant, setMerchant] = useState('');
  const [itemCategory, setItemCategory] = useState<ItemCategory>('other');
  const [itemEmoji, setItemEmoji] = useState('📦');
  const [itemNotes, setItemNotes] = useState('');
  const [orderUrl, setOrderUrl] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState<string | null>(null);

  const [detectedCarrier, setDetectedCarrier] = useState<CarrierDetectionResult | null>(null);
  const [carrierOverride, setCarrierOverride] = useState('auto');
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [showCarrierPicker, setShowCarrierPicker] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .listCarriers()
      .then((res) => setCarriers(res.carriers))
      .catch(() => {});
  }, []);

  // Live worldwide carrier auto-detection as the user types/pastes an AWB
  useEffect(() => {
    const cleaned = awb.trim();
    if (cleaned.length < 6) {
      setDetectedCarrier(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .detectCarrier(cleaned, `${smartText} ${merchant}`)
        .then((res) => setDetectedCarrier(res))
        .catch(() => {});
    }, 280);
    return () => clearTimeout(timer);
  }, [awb, smartText, merchant]);

  async function runSmartPaste(textToParse: string) {
    const trimmed = textToParse.trim();
    if (!trimmed) return;
    setParsing(true);
    setErrorMsg(null);
    try {
      const result = await api.smartPaste(trimmed);
      const foundBits: string[] = [];

      if (result.awb) {
        setAwb(result.awb);
        foundBits.push(`AWB ${result.awb}`);
      }
      if (result.carrier) {
        setDetectedCarrier(result.carrier);
        setCarrierOverride('auto');
        foundBits.push(result.carrier.carrierName);
      }
      if (result.itemTitle) {
        setItemTitle(result.itemTitle);
        foundBits.push(`"${result.itemTitle}"`);
      }
      if (result.merchant) {
        setMerchant(result.merchant);
        foundBits.push(result.merchant);
      }
      if (result.itemCategory) setItemCategory(result.itemCategory);
      if (result.itemEmoji) setItemEmoji(result.itemEmoji);
      if (result.orderUrl) setOrderUrl(result.orderUrl);
      if (result.estimatedDelivery) setEstimatedDelivery(result.estimatedDelivery);

      setParsedBadge(
        foundBits.length > 0
          ? `Extracted: ${foundBits.join(' • ')}`
          : 'No AWB found — you can type it below.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Smart Paste failed — check backend connection.');
    } finally {
      setParsing(false);
    }
  }

  async function handleClipboardPaste() {
    try {
      const clip = await Clipboard.getStringAsync();
      if (!clip || !clip.trim()) {
        showToast({
          title: 'Clipboard is empty',
          body: 'Copy an AWB, SMS, WhatsApp forward, or order email first.',
          tone: 'info',
        });
        return;
      }
      setSmartText(clip);
      await runSmartPaste(clip);
    } catch {
      showToast({
        title: 'Paste directly in the box',
        body: 'Tap inside the Smart Paste field and press Paste.',
        tone: 'info',
      });
    }
  }

  async function handleSubmit() {
    const cleanAwb = awb.trim();
    const cleanTitle = itemTitle.trim();
    if (cleanAwb.length < 6) {
      setErrorMsg('Please drop a valid AWB or tracking number (at least 6 characters).');
      return;
    }
    if (!cleanTitle) {
      setErrorMsg("Give this parcel a quick name (e.g. 'Running Shoes' or 'Gift for Mom') so you always know what's coming!");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const parcel = await createParcel({
        awb: cleanAwb,
        itemTitle: cleanTitle,
        carrierCode: carrierOverride,
        itemCategory,
        itemEmoji,
        merchant: merchant.trim(),
        itemNotes: itemNotes.trim(),
        itemImageUrl: itemImageUrl.trim(),
        orderUrl: orderUrl.trim(),
        estimatedDelivery,
        hintText: smartText.trim() || undefined,
      });
      router.replace(`/parcel/${parcel.id}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not start tracking this AWB.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Smart Paste Card */}
        <View style={styles.smartCard}>
          <View style={styles.smartHeader}>
            <View style={styles.smartTitleRow}>
              <Ionicons name="sparkles" size={18} color={COLORS.primary} />
              <Text style={styles.smartTitle}>Smart Paste (SMS, WhatsApp, or Email)</Text>
            </View>
            <Pressable onPress={handleClipboardPaste} style={styles.clipBtn}>
              <Ionicons name="clipboard-outline" size={14} color={COLORS.primary} />
              <Text style={styles.clipBtnText}>Paste</Text>
            </Pressable>
          </View>

          <Text style={styles.smartHint}>
            Paste the whole shipping message — we'll pull out the AWB, carrier, store, and what's inside automatically.
          </Text>

          <TextInput
            value={smartText}
            onChangeText={setSmartText}
            placeholder="e.g. Your Sony Headphones from Amazon shipped via DHL. AWB: 7829401532..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
            style={styles.smartInput}
          />

          <View style={styles.smartActions}>
            <Pressable
              onPress={() => runSmartPaste(smartText)}
              disabled={parsing || !smartText.trim()}
              style={[
                styles.extractBtn,
                (!smartText.trim() || parsing) && styles.extractBtnDisabled,
              ]}
            >
              {parsing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="flash" size={15} color="#FFFFFF" />
              )}
              <Text style={styles.extractBtnText}>Auto-Fill Details</Text>
            </Pressable>

            {smartText.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSmartText('');
                  setParsedBadge(null);
                }}
                style={styles.clearLink}
              >
                <Text style={styles.clearLinkText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {parsedBadge ? (
            <View style={styles.parsedPill}>
              <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
              <Text style={styles.parsedPillText}>{parsedBadge}</Text>
            </View>
          ) : null}

          {/* Quick Demo Sample Chips */}
          <Text style={styles.tryLabel}>Or test Smart Paste with a sample message:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.samplesRow}
          >
            {SAMPLE_MESSAGES.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => {
                  setSmartText(s.text);
                  runSmartPaste(s.text);
                }}
                style={styles.sampleChip}
              >
                <Text style={styles.sampleChipText}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Core AWB + What's Coming Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionHeading}>1. Drop the AWB</Text>
          <Text style={styles.fieldLabel}>AWB / Tracking Number *</Text>
          <TextInput
            value={awb}
            onChangeText={(t) => {
              setAwb(t);
              setErrorMsg(null);
            }}
            placeholder="Paste any global AWB (DHL, UPS, FedEx, China Post...)"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, styles.monoInput]}
          />

          {/* Live Worldwide Auto-Detected Carrier Banner */}
          {detectedCarrier ? (
            <View style={styles.detectedBanner}>
              <View style={styles.detectedLeft}>
                <Text style={styles.detectedFlag}>{detectedCarrier.originFlag || '🌍'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detectedName}>
                    Auto-detected: {detectedCarrier.carrierName}
                  </Text>
                  <Text style={styles.detectedReason}>{detectedCarrier.reason}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowCarrierPicker((v) => !v)}
                style={styles.changeBtn}
              >
                <Text style={styles.changeBtnText}>
                  {carrierOverride === 'auto' ? 'Change' : 'Auto'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showCarrierPicker && carriers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carrierList}
            >
              {carriers.map((c) => {
                const active = carrierOverride === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCarrierOverride(c.code);
                      setShowCarrierPicker(false);
                    }}
                    style={[styles.carrierChip, active && styles.carrierChipActive]}
                  >
                    <Text style={[styles.carrierChipText, active && styles.carrierChipTextActive]}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>2. What's Coming Inside?</Text>
          <Text style={styles.sectionSub}>
            So every update says the item name instead of a random tracking code.
          </Text>

          {/* Visual Category & Emoji Picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {CATEGORIES.map((cat) => {
              const selected = itemCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setItemCategory(cat.id as ItemCategory);
                    setItemEmoji(cat.emoji);
                  }}
                  style={[styles.catChip, selected && styles.catChipActive]}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, selected && styles.catLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>What is inside this parcel? *</Text>
          <View style={styles.titleInputRow}>
            <View style={styles.emojiPreview}>
              <Text style={{ fontSize: 22 }}>{itemEmoji}</Text>
            </View>
            <TextInput
              value={itemTitle}
              onChangeText={(t) => {
                setItemTitle(t);
                setErrorMsg(null);
              }}
              placeholder="e.g. Sony Headphones, Mom's Birthday Watch..."
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Store / Sender (optional)</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Amazon, AliExpress, Etsy, Apple, Friend in UK"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Personal Note (optional)</Text>
          <TextInput
            value={itemNotes}
            onChangeText={setItemNotes}
            placeholder="e.g. Size 9 blue, fragile gift, paid customs upfront"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <Pressable
            onPress={() => setShowMoreFields((v) => !v)}
            style={styles.moreToggle}
          >
            <Ionicons
              name={showMoreFields ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.primary}
            />
            <Text style={styles.moreToggleText}>
              {showMoreFields ? 'Hide optional links' : 'Add product photo URL or order link'}
            </Text>
          </Pressable>

          {showMoreFields ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Product Image URL (optional)</Text>
              <TextInput
                value={itemImageUrl}
                onChangeText={setItemImageUrl}
                placeholder="https://..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Order Page Link (optional)</Text>
              <TextInput
                value={orderUrl}
                onChangeText={setOrderUrl}
                placeholder="https://..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          ) : null}
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            submitting && { opacity: 0.7 },
            pressed && { transform: [{ scale: 0.99 }] },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.submitBtnText}>
            {submitting ? 'Starting Worldwide Tracking...' : 'Start Tracking & Alert Me'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: {
    padding: 18,
    paddingBottom: 44,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  smartCard: {
    backgroundColor: COLORS.primaryTint,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    marginBottom: 16,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  smartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  smartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  clipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  clipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  smartHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  smartInput: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 74,
    textAlignVertical: 'top',
  },
  smartActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  extractBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  extractBtnDisabled: {
    opacity: 0.45,
  },
  extractBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clearLink: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  clearLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  parsedPill: {
    marginTop: 10,
    backgroundColor: COLORS.successBg,
    borderRadius: 10,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  parsedPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  tryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  samplesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sampleChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sampleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW_CARD,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 10,
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
    marginBottom: 4,
  },
  monoInput: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  detectedBanner: {
    marginTop: 8,
    backgroundColor: COLORS.infoBg,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.info + '33',
  },
  detectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detectedFlag: {
    fontSize: 20,
  },
  detectedName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  detectedReason: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  changeBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  carrierList: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 10,
  },
  carrierChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
  },
  carrierChipActive: {
    backgroundColor: COLORS.primary,
  },
  carrierChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  carrierChipTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceMuted,
    marginVertical: 16,
  },
  catRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  catEmoji: { fontSize: 15 },
  catLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  catLabelActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emojiPreview: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  moreToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  errorBox: {
    marginTop: 14,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.danger,
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
