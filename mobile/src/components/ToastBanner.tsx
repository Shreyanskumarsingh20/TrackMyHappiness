import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParcels } from '../context/ParcelsContext';
import { COLORS, SHADOW_FAB } from '../theme/tokens';

export function ToastBanner() {
  const { toast, dismissToast } = useParcels();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  const bg =
    toast.tone === 'danger'
      ? COLORS.danger
      : toast.tone === 'warning'
      ? COLORS.accentDark
      : toast.tone === 'success'
      ? COLORS.primary
      : '#1E293B';

  return (
    <View style={[styles.container, { top: Math.max(12, insets.top + 8) }]} pointerEvents="box-none">
      <Pressable onPress={dismissToast} style={[styles.banner, { backgroundColor: bg }]}>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={2}>
            {toast.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>
        <Ionicons name="close" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  banner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...SHADOW_FAB,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
