/**
 * SETU Mobile — Accessible Typography Components
 * ----------------------------------------------
 * Automatically applies active font family preference (Source Serif / Atkinson Hyperlegible / System)
 * and scaling multiplier (Normal / Comfortable / Large) to all text.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { COLORS, FONT_SIZES } from '../constants/theme';
import { useAccessibility } from '../context/AccessibilityContext';

export interface AccessibleTextProps extends RNTextProps {
  variant?: 'h1' | 'titleLg' | 'title' | 'titleSm' | 'bodyLg' | 'body' | 'bodySm' | 'caption' | 'kicker';
  color?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | '800';
  italic?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
}

export const Text: React.FC<AccessibleTextProps> = ({
  children,
  variant = 'body',
  color = COLORS.text,
  weight = 'normal',
  italic = false,
  align = 'left',
  style,
  ...rest
}) => {
  const { font, sizeScale } = useAccessibility();

  const getFontFamily = () => {
    if (font === 'hyper') {
      return 'sans-serif'; // Atkinson Hyperlegible fallback
    }
    if (font === 'system') {
      return undefined; // System default
    }
    // Default serif for Broadsheet
    return 'serif';
  };

  const getFontSize = () => {
    const base = FONT_SIZES[variant] || FONT_SIZES.body;
    return Math.round(base * sizeScale);
  };

  const getLineHeight = (fontSize: number) => {
    if (variant === 'h1' || variant === 'titleLg') {
      return Math.round(fontSize * 1.15);
    }
    if (variant === 'kicker') {
      return Math.round(fontSize * 1.4);
    }
    return Math.round(fontSize * 1.45);
  };

  const fontSize = getFontSize();
  const lineHeight = getLineHeight(fontSize);

  const customStyle: TextStyle = {
    fontFamily: getFontFamily(),
    fontSize,
    lineHeight,
    color,
    textAlign: align,
    fontStyle: italic ? 'italic' : 'normal',
    fontWeight:
      weight === 'bold' || variant === 'h1' || variant === 'titleLg' || variant === 'title'
        ? '700'
        : weight === 'semibold' || variant === 'titleSm'
        ? '600'
        : weight === 'medium' || variant === 'kicker'
        ? '600'
        : '400',
    letterSpacing: variant === 'kicker' ? 0.8 : undefined,
    textTransform: variant === 'kicker' ? 'uppercase' : undefined,
  };

  return (
    <RNText style={[customStyle, style]} {...rest}>
      {children}
    </RNText>
  );
};

export const Heading: React.FC<AccessibleTextProps> = (props) => (
  <Text variant="h1" weight="bold" {...props} />
);

export const Subheading: React.FC<AccessibleTextProps> = (props) => (
  <Text variant="titleSm" weight="semibold" color={COLORS.textMuted} {...props} />
);

export const Kicker: React.FC<AccessibleTextProps> = ({
  color = COLORS.cyan,
  ...props
}) => <Text variant="kicker" color={color} weight="semibold" {...props} />;
