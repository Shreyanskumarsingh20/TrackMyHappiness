import { Platform } from 'react-native';
import { ParcelStage } from '../types';

export const COLORS = {
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F3EFE9',
  border: '#E9E2D8',
  borderStrong: '#D7CCC0',

  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  primaryTint: '#F0FDFA',

  accent: '#F97316',
  accentSoft: '#FFEDD5',
  accentDark: '#C2410C',

  text: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#8A8179',

  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  info: '#0284C7',
  infoBg: '#F0F9FF',
  slate: '#475569',
  slateBg: '#F1F5F9',
};

export const STAGE_META: Record<
  ParcelStage,
  { label: string; shortLabel: string; color: string; bg: string; icon: string; stepIndex: number }
> = {
  pending: {
    label: 'Tracking Added',
    shortLabel: 'Added',
    color: COLORS.slate,
    bg: COLORS.slateBg,
    icon: 'time-outline',
    stepIndex: 0,
  },
  info_received: {
    label: 'Label Created',
    shortLabel: 'Ordered',
    color: COLORS.slate,
    bg: COLORS.slateBg,
    icon: 'document-text-outline',
    stepIndex: 0,
  },
  in_transit: {
    label: 'In Transit',
    shortLabel: 'Transit',
    color: COLORS.info,
    bg: COLORS.infoBg,
    icon: 'airplane-outline',
    stepIndex: 1,
  },
  customs: {
    label: 'Customs',
    shortLabel: 'Customs',
    color: COLORS.warning,
    bg: COLORS.warningBg,
    icon: 'shield-checkmark-outline',
    stepIndex: 2,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    shortLabel: 'Today!',
    color: COLORS.accentDark,
    bg: COLORS.accentSoft,
    icon: 'bicycle-outline',
    stepIndex: 3,
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    color: COLORS.success,
    bg: COLORS.successBg,
    icon: 'checkmark-circle',
    stepIndex: 4,
  },
  exception: {
    label: 'Needs Attention',
    shortLabel: 'Alert',
    color: COLORS.danger,
    bg: COLORS.dangerBg,
    icon: 'alert-circle',
    stepIndex: 2,
  },
  expired: {
    label: 'No Updates',
    shortLabel: 'Stale',
    color: COLORS.slate,
    bg: COLORS.slateBg,
    icon: 'help-circle-outline',
    stepIndex: 0,
  },
};

export const SHADOW_CARD = Platform.select({
  ios: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: {
    elevation: 2,
  },
  default: {
    boxShadow: '0px 4px 16px rgba(28, 25, 23, 0.06)',
  } as any,
});

export const SHADOW_FAB = Platform.select({
  ios: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  android: {
    elevation: 6,
  },
  default: {
    boxShadow: '0px 8px 20px rgba(15, 118, 110, 0.30)',
  } as any,
});

export const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'electronics', label: 'Tech', emoji: '🎧' },
  { id: 'fashion', label: 'Fashion', emoji: '👟' },
  { id: 'home', label: 'Home', emoji: '🛋️' },
  { id: 'gift', label: 'Gift', emoji: '🎁' },
  { id: 'beauty', label: 'Beauty', emoji: '✨' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'food', label: 'Food', emoji: '☕' },
  { id: 'hobby', label: 'Hobby', emoji: '🎮' },
  { id: 'health', label: 'Health', emoji: '💊' },
  { id: 'other', label: 'Other', emoji: '📦' },
];
