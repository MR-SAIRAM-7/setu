/**
 * SETU Mobile — Accessibility Context
 * -----------------------------------
 * Manages user accessibility preferences across the application:
 * Typeface, Text Scaling, Motion Reduction, Bionic Reading, Reading Ruler,
 * Speech synthesis rate, and Onboarding completion state.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserPreferences,
  FontStyleOption,
  TextSizeOption,
  MotionOption,
  ReadingProfile,
} from '../types';
import {
  getStoredPreferences,
  saveStoredPreferences,
  DEFAULT_PREFERENCES,
} from '../services/storage';
import { SIZE_SCALE } from '../constants/theme';
import { tts } from '../services/tts';

interface AccessibilityContextValue {
  preferences: UserPreferences;
  font: FontStyleOption;
  size: TextSizeOption;
  sizeScale: number;
  motion: MotionOption;
  bionic: boolean;
  readingRuler: boolean;
  speechRate: number;
  speechPitch: number;
  profile: ReadingProfile[];
  hasCompletedOnboarding: boolean;
  customApiUrl: string;
  isLoading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setFont: (font: FontStyleOption) => Promise<void>;
  setSize: (size: TextSizeOption) => Promise<void>;
  setMotion: (motion: MotionOption) => Promise<void>;
  toggleBionic: () => Promise<void>;
  toggleReadingRuler: () => Promise<void>;
  setSpeechRate: (rate: number) => Promise<void>;
  setSpeechPitch: (pitch: number) => Promise<void>;
  setProfile: (profile: ReadingProfile[]) => Promise<void>;
  setCustomApiUrl: (url: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const stored = await getStoredPreferences();
        setPreferences(stored);
        tts.setRate(stored.speechRate);
        tts.setPitch(stored.speechPitch);
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    const updated = await saveStoredPreferences(updates);
    setPreferences(updated);
    if (updates.speechRate !== undefined) tts.setRate(updates.speechRate);
    if (updates.speechPitch !== undefined) tts.setPitch(updates.speechPitch);
  };

  const setFont = (font: FontStyleOption) => updatePreferences({ font });
  const setSize = (size: TextSizeOption) => updatePreferences({ size });
  const setMotion = (motion: MotionOption) => updatePreferences({ motion });
  const toggleBionic = () => updatePreferences({ bionic: !preferences.bionic });
  const toggleReadingRuler = () =>
    updatePreferences({ readingRuler: !preferences.readingRuler });
  const setSpeechRate = (speechRate: number) => updatePreferences({ speechRate });
  const setSpeechPitch = (speechPitch: number) => updatePreferences({ speechPitch });
  const setProfile = (profile: ReadingProfile[]) => updatePreferences({ profile });
  const setCustomApiUrl = (customApiUrl: string) => updatePreferences({ customApiUrl });
  const completeOnboarding = () =>
    updatePreferences({ hasCompletedOnboarding: true });

  const sizeScale = (SIZE_SCALE as Record<string, number>)[preferences.size] || 1.0;

  return (
    <AccessibilityContext.Provider
      value={{
        preferences,
        font: preferences.font,
        size: preferences.size,
        sizeScale,
        motion: preferences.motion,
        bionic: preferences.bionic,
        readingRuler: preferences.readingRuler,
        speechRate: preferences.speechRate,
        speechPitch: preferences.speechPitch,
        profile: preferences.profile,
        hasCompletedOnboarding: preferences.hasCompletedOnboarding,
        customApiUrl: preferences.customApiUrl,
        isLoading,
        updatePreferences,
        setFont,
        setSize,
        setMotion,
        toggleBionic,
        toggleReadingRuler,
        setSpeechRate,
        setSpeechPitch,
        setProfile,
        setCustomApiUrl,
        completeOnboarding,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
