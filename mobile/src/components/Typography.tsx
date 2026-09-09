/**
 * SETU Mobile — Accessible Typography Components
 * ----------------------------------------------
 * Applies the reader's font, size AND spacing preferences to every piece of
 * text in the app.
 *
 * SPACING IS THE ONE THAT MATTERS MOST, and it used to be missing.
 *
 * `spacing` was stored in preferences and offered in Settings, and nothing read
 * it — this component set `letterSpacing` only on decorative kickers. So a
 * dyslexic reader could move that control and watch nothing happen, while the
 * one typographic manipulation with a controlled result behind it did not exist
 * on this surface at all.
 *
 * Zorzi et al. (PNAS 2012) widened letter spacing for dyslexic children and
 * measured roughly a 20% reading-speed gain and about half the errors, with no
 * training. The mechanism is reduced visual crowding, which is elevated in
 * dyslexia. That is a larger effect than most reading interventions produce
 * after weeks of work, and it costs nothing.
 *
 * Word spacing rises with letter spacing deliberately: widening letters alone
 * makes word boundaries harder to find, trading one crowding problem for
 * another.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { COLORS, FONT_SIZES } from '../constants/theme';
import { familyFor, weightFor } from '../constants/fonts';
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
  const { font, sizeScale, spacing } = useAccessibility();

  const getFontSize = () => {
    const base = FONT_SIZES[variant] || FONT_SIZES.body;
    return Math.round(base * sizeScale);
  };

  /**
   * Letter and word spacing, in points, for the current size.
   *
   * Expressed as a fraction of the font size rather than a fixed number of
   * points, because React Native's `letterSpacing` is absolute: a value tuned
   * for 16pt body text is invisible at 30pt and overwhelming at 11pt.
   *
   * `relaxed` is the evidence-backed dose and is the default. `normal` is the
   * unstyled base, kept for readers who prefer tight text; `spacious` reaches
   * the full magnitude the study tested.
   */
  const getSpacing = (fontSize: number) => {
    if (spacing === 'spacious') {
      return { letterSpacing: fontSize * 0.18, wordSpacing: fontSize * 0.24 };
    }
    if (spacing === 'relaxed') {
      return { letterSpacing: fontSize * 0.12, wordSpacing: fontSize * 0.16 };
    }
    return { letterSpacing: 0, wordSpacing: 0 };
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
  const track = getSpacing(fontSize);

  const fontWeight: TextStyle['fontWeight'] =
    weight === 'bold' || weight === '800' || variant === 'h1' || variant === 'titleLg' || variant === 'title'
      ? '700'
      : weight === 'semibold' || variant === 'titleSm'
      ? '600'
      : weight === 'medium' || variant === 'kicker'
      ? '600'
      : '400';

  const customStyle: TextStyle = {
    /*
     * The family is chosen by weight, not just by preference.
     *
     * React Native on Android will not synthesise bold from a single custom
     * face: setting fontWeight '700' on a family with only a regular file is
     * silently ignored, and every heading in the app flattens to body weight
     * with no error anywhere. So the bold file is selected by name.
     */
    fontFamily: familyFor(font, weightFor(fontWeight)),
    fontSize,
    lineHeight,
    color,
    textAlign: align,
    fontStyle: italic ? 'italic' : 'normal',
    fontWeight,
    /*
     * Kickers keep their own decorative tracking; everything else follows the
     * reader's setting. Headings are excluded from the widened spacing because
     * at 28pt+ the crowding this fixes is not present, and the extra tracking
     * reads as a stylistic choice rather than an accommodation.
     */
    letterSpacing:
      variant === 'kicker'
        ? 0.8
        : variant === 'h1' || variant === 'titleLg'
        ? undefined
        : track.letterSpacing || undefined,
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
