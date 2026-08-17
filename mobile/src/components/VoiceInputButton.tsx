/**
 * SETU Mobile — Voice Input Dictation Button
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS } from '../constants/theme';

export interface VoiceInputButtonProps {
  onTranscript?: (text: string) => void;
  size?: number;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  size = 44,
}) => {
  const [isListening, setIsListening] = useState(false);

  const handleToggleVoice = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      // Simulated voice prompt recognition for accessibility demo
      setTimeout(() => {
        setIsListening(false);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}
        onTranscript?.('Explain how neural attention works in plain words');
      }, 2500);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
      activeOpacity={0.7}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        isListening ? styles.activeButton : styles.idleButton,
      ]}
      onPress={handleToggleVoice}
    >
      {isListening ? (
        <MicOff size={size * 0.45} color={COLORS.magenta} />
      ) : (
        <Mic size={size * 0.45} color={COLORS.cyan} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  activeButton: {
    backgroundColor: COLORS.magentaLight,
    borderWidth: 1.5,
    borderColor: COLORS.magenta,
  },
});
