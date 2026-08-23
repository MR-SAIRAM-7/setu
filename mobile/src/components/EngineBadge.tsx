/**
 * SETU Mobile — Engine Status Indicator Badge
 * --------------------------------------------
 * Displays engine connection readiness with the 4-state model matching
 * the web frontend: 'checking' | 'ok' | 'nokey' | 'down'.
 * Breathing pulse animation when engine is connected.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text } from './Typography';
import { useIdentity, EngineState } from '../context/IdentityContext';
import { useAccessibility } from '../context/AccessibilityContext';

interface BadgeConfig {
  dotColor: string;
  label: string;
  pulse: boolean;
  hint: string;
}

const BADGE_CONFIGS: Record<EngineState, BadgeConfig> = {
  checking: {
    dotColor: COLORS.textSubtle,
    label: 'Checking engine…',
    pulse: false,
    hint: 'Connecting to the SETU backend',
  },
  ok: {
    dotColor: COLORS.cyan,
    label: 'Engine ready', // overridden below if DB is also connected
    pulse: true,
    hint: 'Connected to OpenRouter AI',
  },
  nokey: {
    dotColor: COLORS.yellowDark,
    label: 'No AI key set',
    pulse: false,
    hint: 'Set OPENROUTER_API_KEY in backend .env',
  },
  down: {
    dotColor: COLORS.magenta,
    label: 'Engine offline',
    pulse: false,
    hint: 'Start the backend: npm start in /backend',
  },
};

export const EngineBadge: React.FC = () => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { engineState, isDbConnected } = useIdentity();
  const { motion } = useAccessibility();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const config = BADGE_CONFIGS[engineState] || BADGE_CONFIGS.down;

  // Override label when DB is also connected
  const displayLabel =
    engineState === 'ok' && isDbConnected ? 'Engine & DB ready' : config.label;

  useEffect(() => {
    if (motion === 'reduced' || !config.pulse) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [motion, config.pulse, pulseAnim]);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`System status: ${displayLabel}`}
      accessibilityHint={config.hint}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: config.dotColor,
            opacity: pulseAnim,
          },
        ]}
      />
      <Text variant="caption" color={COLORS.textMuted} weight="medium">
        {displayLabel}
      </Text>
    </View>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    backgroundColor: t.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
    alignSelf: 'flex-start',
    minHeight: 48,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
});
