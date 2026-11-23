import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/tokens';
import { TrackingEvent } from '../types';
import { formatEventDateTime } from '../utils/date';

interface Props {
  event: TrackingEvent;
  isLatest: boolean;
  isLast: boolean;
}

export function TimelineItem({ event, isLatest, isLast }: Props) {
  const isCritical = event.importance === 'critical';
  const isImportant = event.importance === 'important';
  const isMinor = event.importance === 'minor';

  const dotColor = isCritical
    ? COLORS.danger
    : event.stage === 'delivered'
    ? COLORS.success
    : event.stage === 'out_for_delivery'
    ? COLORS.accent
    : isImportant
    ? COLORS.primary
    : COLORS.borderStrong;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor },
            isLatest && styles.dotLatest,
            isMinor && styles.dotMinor,
          ]}
        />
        {!isLast && <View style={styles.line} />}
      </View>

      <View
        style={[
          styles.content,
          isCritical && styles.contentCritical,
          isLatest && !isCritical && styles.contentLatest,
          isMinor && styles.contentMinor,
        ]}
      >
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              isCritical && { color: COLORS.danger },
              isMinor && styles.titleMinor,
            ]}
          >
            {event.friendlyTitle}
          </Text>
          {isCritical ? (
            <View style={[styles.tag, { backgroundColor: COLORS.dangerBg }]}>
              <Text style={[styles.tagText, { color: COLORS.danger }]}>ATTENTION</Text>
            </View>
          ) : isImportant ? (
            <View style={[styles.tag, { backgroundColor: COLORS.primaryTint }]}>
              <Text style={[styles.tagText, { color: COLORS.primary }]}>KEY UPDATE</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.summary, isMinor && styles.summaryMinor]}>{event.friendlySummary}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatEventDateTime(event.occurredAt)}</Text>
          {event.location ? <Text style={styles.metaText}>• {event.location}</Text> : null}
        </View>

        {event.rawDescription && event.rawDescription !== event.friendlySummary ? (
          <Text style={styles.rawText} numberOfLines={2}>
            Carrier scan: {event.rawDescription}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: 18,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
  },
  dotLatest: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLORS.primarySoft,
  },
  dotMinor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contentLatest: {
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primaryTint,
  },
  contentCritical: {
    borderColor: COLORS.danger + '66',
    backgroundColor: COLORS.dangerBg,
  },
  contentMinor: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.surfaceMuted,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  titleMinor: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  summary: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 4,
    lineHeight: 19,
  },
  summaryMinor: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  rawText: {
    marginTop: 5,
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
