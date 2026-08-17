/**
 * SETU Mobile — Bionic Reading Component
 * ---------------------------------------
 * Calculates the fixation anchor length for each word and renders the prefix in bold
 * to guide saccadic eye movements for dyslexic and ADHD readers.
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleProp } from 'react-native';
import { Text } from './Typography';
import { useAccessibility } from '../context/AccessibilityContext';
import { COLORS } from '../constants/theme';

interface BionicTextProps {
  text: string;
  forceBionic?: boolean;
  variant?: 'h1' | 'titleLg' | 'title' | 'titleSm' | 'bodyLg' | 'body' | 'bodySm' | 'caption' | 'kicker';
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function getFixationLength(word: string): number {
  const clean = word.replace(/^[^\w]+|[^\w]+$/g, '');
  const len = clean.length;
  if (len <= 3) return 1;
  if (len <= 6) return 2;
  if (len <= 8) return 3;
  return Math.ceil(len * 0.4);
}

export const BionicText: React.FC<BionicTextProps> = ({
  text,
  forceBionic,
  variant = 'body',
  color = COLORS.text,
  style,
}) => {
  const { bionic } = useAccessibility();
  const isEnabled = forceBionic !== undefined ? forceBionic : bionic;

  if (!text) return null;

  if (!isEnabled) {
    return (
      <Text variant={variant} color={color} style={style}>
        {text}
      </Text>
    );
  }

  // Split text by whitespace while preserving punctuation
  const tokens = text.split(/(\s+)/);

  return (
    <Text variant={variant} color={color} style={style}>
      {tokens.map((token, index) => {
        if (/^\s+$/.test(token)) {
          return token;
        }

        const leadingMatch = token.match(/^[^\w]+/);
        const leading = leadingMatch ? leadingMatch[0] : '';
        const rest = token.slice(leading.length);

        const trailingMatch = rest.match(/[^\w]+$/);
        const trailing = trailingMatch ? trailingMatch[0] : '';
        const coreWord = rest.slice(0, rest.length - trailing.length);

        if (!coreWord) {
          return token;
        }

        const fixationLen = getFixationLength(coreWord);
        const prefix = coreWord.slice(0, fixationLen);
        const suffix = coreWord.slice(fixationLen);

        return (
          <RNText key={`bionic-${index}`}>
            {leading}
            <RNText style={{ fontWeight: '800' }}>{prefix}</RNText>
            <RNText>{suffix}</RNText>
            {trailing}
          </RNText>
        );
      })}
    </Text>
  );
};
