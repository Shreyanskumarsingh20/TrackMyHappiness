import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STAGE_META } from '../theme/tokens';
import { ParcelStage } from '../types';

interface Props {
  stage: ParcelStage;
  compact?: boolean;
}

export function StatusBadge({ stage, compact = false }: Props) {
  const meta = STAGE_META[stage] ?? STAGE_META.pending;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }, compact && styles.badgeCompact]}>
      <Ionicons name={meta.icon as any} size={compact ? 12 : 14} color={meta.color} />
      <Text style={[styles.text, { color: meta.color }, compact && styles.textCompact]}>
        {compact ? meta.shortLabel : meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  textCompact: {
    fontSize: 11,
  },
});
