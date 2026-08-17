/**
 * SETU Mobile — Focus Session Timer Widget
 * ----------------------------------------
 * 25-minute Pomodoro timer widget with quick play/pause/reset buttons.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Pause, RotateCcw, Timer } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Text, Kicker } from './Typography';
import { useFocus } from '../context/FocusContext';

export const FocusTimerWidget: React.FC = () => {
  const {
    isActive,
    isPaused,
    formattedTime,
    totalSessionsCompleted,
    startSession,
    pauseSession,
    resetSession,
  } = useFocus();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Timer size={14} color={isActive && !isPaused ? COLORS.cyan : COLORS.textSubtle} />
          <Kicker
            color={isActive && !isPaused ? COLORS.cyan : COLORS.textSubtle}
            style={styles.kicker}
          >
            Focus Session
          </Kicker>
        </View>
        {totalSessionsCompleted > 0 && (
          <Text variant="caption" color={COLORS.textMuted}>
            {totalSessionsCompleted} completed
          </Text>
        )}
      </View>

      <View style={styles.bodyRow}>
        <Text
          variant="titleLg"
          weight="bold"
          color={isActive && !isPaused ? COLORS.cyan : COLORS.textMuted}
          style={styles.tabularClock}
        >
          {formattedTime}
        </Text>

        <View style={styles.controlsRow}>
          {isActive && !isPaused ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Pause focus session"
              style={[styles.controlBtn, styles.pauseBtn]}
              onPress={pauseSession}
            >
              <Pause size={16} color={COLORS.textInverse} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Start focus session"
              style={[styles.controlBtn, styles.playBtn]}
              onPress={startSession}
            >
              <Play size={16} color={COLORS.textInverse} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Reset focus session"
            style={[styles.controlBtn, styles.resetBtn]}
            onPress={resetSession}
          >
            <RotateCcw size={15} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text variant="caption" color={COLORS.textSubtle} style={styles.stateNote}>
        {isActive && !isPaused
          ? 'Deep work in progress — gentle chime at 00:00'
          : isPaused
          ? 'Session paused — resume when ready'
          : '25 minutes of quiet focus, then a calm break'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kicker: {
    marginLeft: 6,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabularClock: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.5,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  playBtn: {
    backgroundColor: COLORS.cyan,
  },
  pauseBtn: {
    backgroundColor: COLORS.yellowDark,
  },
  resetBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  stateNote: {
    marginTop: SPACING.xs,
  },
});
