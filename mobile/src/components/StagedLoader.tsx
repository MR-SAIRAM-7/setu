/**
 * SETU Mobile — Staged Progress Loader
 * ------------------------------------
 * Progressive 3-stage loading component that names what is actually happening
 * instead of presenting a frustrating dead spinner:
 * 1. Reading around the topic
 * 2. Finding the branches
 * 3. Drawing your map
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { BookOpen, GitBranch, PenTool } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Text } from './Typography';

export interface StagedLoaderProps {
  currentStage?: number; // 0, 1, 2
  autoAdvance?: boolean;
}

const STAGES = [
  { label: 'Reading around the topic', icon: BookOpen },
  { label: 'Finding the branches', icon: GitBranch },
  { label: 'Drawing your map', icon: PenTool },
];

export const StagedLoader: React.FC<StagedLoaderProps> = ({
  currentStage: propStage,
  autoAdvance = true,
}) => {
  const [stage, setStage] = useState(propStage || 0);

  useEffect(() => {
    if (propStage !== undefined) {
      setStage(propStage);
      return;
    }

    if (!autoAdvance) return;

    const t1 = setTimeout(() => setStage(1), 1800);
    const t2 = setTimeout(() => setStage(2), 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [propStage, autoAdvance]);

  return (
    <View style={styles.container}>
      {STAGES.map((s, idx) => {
        const IconComponent = s.icon;
        const isActive = idx === stage;
        const isDone = idx < stage;

        return (
          <View key={`stage-${idx}`} style={styles.stageRow}>
            <View
              style={[
                styles.iconBox,
                isActive ? styles.activeIconBox : isDone ? styles.doneIconBox : styles.idleIconBox,
              ]}
            >
              {isActive ? (
                <ActivityIndicator size="small" color={COLORS.cyan} />
              ) : (
                <IconComponent
                  size={16}
                  color={isDone ? COLORS.cyanDark : COLORS.textSubtle}
                />
              )}
            </View>

            <Text
              variant="body"
              weight={isActive ? 'semibold' : 'normal'}
              color={isActive ? COLORS.cyanDark : isDone ? COLORS.text : COLORS.textSubtle}
              style={[styles.stageLabel, !isActive && !isDone ? { opacity: 0.5 } : {}]}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
    marginVertical: SPACING.md,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xs + 2,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  activeIconBox: {
    backgroundColor: COLORS.cyanLight,
    borderWidth: 1,
    borderColor: COLORS.cyanBorder,
  },
  doneIconBox: {
    backgroundColor: COLORS.cyanLight,
  },
  idleIconBox: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  stageLabel: {
    flex: 1,
  },
});
