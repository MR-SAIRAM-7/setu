/**
 * SETU Mobile — text.
 *
 * Every piece of text in the app goes through here, which is the only way the
 * four reading preferences can be honoured everywhere: typeface, size, line
 * spacing and letter spacing. A screen that reaches for `<RNText>` directly
 * opts out of all four, and the symptom — one paragraph that ignores the large
 * text setting — reads as a rendering bug rather than a missed prop.
 *
 * Typefaces are limited to what the phone actually has. The app used to offer
 * Atkinson Hyperlegible, Lexend and OpenDyslexic; none was bundled or loaded,
 * so all three silently rendered as the serif. Letter spacing is offered
 * instead, and it does more of the work those fonts were chosen for — the
 * evidence for increased tracking is better than the evidence for any
 * particular dyslexia typeface, and it applies to whatever glyphs are on screen.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle, Platform } from 'react-native';

import { FONT_SIZES, LETTER_SPACING } from '../constants/theme';
import { useThemeColors } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';

export interface AccessibleTextProps extends RNTextProps {
  variant?:
    | 'h1'
    | 'titleLg'
    | 'title'
    | 'titleSm'
    | 'bodyLg'
    | 'body'
    | 'bodySm'
    | 'caption'
    | 'kicker';
  color?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | '800';
  italic?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * The family name for a preference.
 *
 * `system` returns undefined on purpose: that is what makes the text follow
 * whatever the phone itself is set to, including a user's own font choice in
 * the OS accessibility settings.
 */
export function fontFamilyFor(font: string): string | undefined {
  if (font === 'system') return undefined;
  if (font === 'sans') {
    // iOS has no generic 'sans-serif' family, so naming one there produces a
    // silent fallback to the system face rather than an error.
    return Platform.select({ android: 'sans-serif', default: undefined });
  }
  return 'serif';
}

export const Text: React.FC<AccessibleTextProps> = ({
  children,
  variant = 'body',
  color,
  weight = 'normal',
  italic = false,
  align = 'left',
  style,
  ...rest
}) => {
  const COLORS = useThemeColors();
  const { font, sizeScale, spacingScale, letterSpacing } = useAccessibility();

  const fontSize = Math.round((FONT_SIZES[variant] || FONT_SIZES.body) * sizeScale);

  const lineRatio =
    variant === 'h1' || variant === 'titleLg' ? 1.15 : variant === 'kicker' ? 1.4 : 1.45;
  const lineHeight = Math.round(fontSize * lineRatio * spacingScale);

  const tracking =
    variant === 'kicker'
      ? 0.8
      : (LETTER_SPACING as Record<string, number>)[letterSpacing] || 0;

  const resolved: TextStyle = {
    fontFamily: fontFamilyFor(font),
    fontSize,
    lineHeight,
    color: color || COLORS.text,
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
    letterSpacing: tracking || undefined,
    textTransform: variant === 'kicker' ? 'uppercase' : undefined,
  };

  return (
    <RNText style={[resolved, style]} {...rest}>
      {children}
    </RNText>
  );
};

export const Heading: React.FC<AccessibleTextProps> = (props) => (
  <Text variant="h1" weight="bold" {...props} />
);

export const Subheading: React.FC<AccessibleTextProps> = (props) => {
  const COLORS = useThemeColors();
  return <Text variant="titleSm" weight="semibold" color={COLORS.textMuted} {...props} />;
};

export const Kicker: React.FC<AccessibleTextProps> = (props) => {
  const COLORS = useThemeColors();
  return <Text variant="kicker" color={COLORS.cyan} weight="semibold" {...props} />;
};
