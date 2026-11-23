import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, STAGE_META } from '../theme/tokens';
import { ParcelStage } from '../types';

const STEPS = ['Ordered', 'Transit', 'Customs', 'Local', 'Delivered'];

interface Props {
  stage: ParcelStage;
  showLabels?: boolean;
}

export function JourneyProgress({ stage, showLabels = false }: Props) {
  const meta = STAGE_META[stage] ?? STAGE_META.pending;
  const activeStep = meta.stepIndex;
  const isDanger = stage === 'exception';
  const fillColor = isDanger
    ? COLORS.danger
    : stage === 'delivered'
    ? COLORS.success
    : stage === 'out_for_delivery'
    ? COLORS.accent
    : COLORS.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {STEPS.map((label, idx) => {
          const isReached = idx <= activeStep;
          const isCurrent = idx === activeStep;
          return (
            <React.Fragment key={label}>
              <View
                style={[
                  styles.dot,
                  isReached && { backgroundColor: fillColor, borderColor: fillColor },
                  isCurrent && styles.dotCurrent,
                ]}
              />
              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.line,
                    idx < activeStep && { backgroundColor: fillColor },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {showLabels && (
        <View style={styles.labelsRow}>
          {STEPS.map((label, idx) => {
            const isCurrent = idx === activeStep;
            const isReached = idx <= activeStep;
            return (
              <Text
                key={label}
                style={[
                  styles.stepLabel,
                  isReached && styles.stepLabelReached,
                  isCurrent && { color: fillColor, fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
  },
  dotCurrent: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  stepLabelReached: {
    color: COLORS.textSecondary,
  },
});
