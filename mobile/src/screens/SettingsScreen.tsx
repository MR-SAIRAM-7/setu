/**
 * SETU Mobile — Settings & Accessibility Customization Screen
 * -----------------------------------------------------------
 * Faithfully maps to Broadsheet Design Guidelines:
 * - Reading Preferences (Typeface, Text Scaling, Motion, Bionic, Reading ruler)
 * - Speech synthesis controls (Speed & Pitch) with live voice tester
 * - Backend server engine probe & customizable API URL (shared with Web & Extension)
 * - Anonymous device identity & local data wiping / reference library restore
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Sparkles,
  Volume2,
  Server,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  BookOpen,
  Sliders,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { useAccessibility } from '../context/AccessibilityContext';
import { useIdentity } from '../context/IdentityContext';
import { clearAllLocalData, restoreReferenceLibrary } from '../services/storage';
import { api } from '../services/api';
import { tts } from '../services/tts';
import { FontStyleOption, TextSizeOption, MotionOption } from '../types';
import * as Haptics from 'expo-haptics';

export const SettingsScreen: React.FC = () => {
  const {
    font,
    size,
    motion,
    bionic,
    readingRuler,
    speechRate,
    speechPitch,
    customApiUrl,
    setFont,
    setSize,
    setMotion,
    toggleBionic,
    toggleReadingRuler,
    setSpeechRate,
    setSpeechPitch,
    setCustomApiUrl,
  } = useAccessibility();

  const {
    userId,
    engineState,
    isEngineReady,
    isAiConfigured,
    isDbConnected,
    healthInfo,
    checkHealth,
    resetIdentity,
  } = useIdentity();

  const [apiUrlInput, setApiUrlInput] = useState(customApiUrl);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);

  useEffect(() => {
    setApiUrlInput(customApiUrl);
  }, [customApiUrl]);

  const handleSaveApiUrl = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    await setCustomApiUrl(apiUrlInput.trim());
    await checkHealth();
    Alert.alert('Backend URL Saved', 'Engine connection settings have been updated.');
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}
      const res = await api.healthAi();
      if (res && res.ok) {
        setAiTestResult(
          `AI Probe Success! Provider: ${res.provider || 'OpenRouter'} · Model: ${res.model || 'active'}`
        );
      } else {
        setAiTestResult(`AI Probe: ${res?.reason || 'Engine offline or fallback rule engine active.'}`);
      }
    } catch (err: any) {
      setAiTestResult(`AI Probe: ${err.message || 'Offline fallback rule engine active.'}`);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleTestVoice = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    tts.speak('This is your current speech synthesis speed and pitch setting in SETU.');
  };

  const handleResetUserId = async () => {
    Alert.alert(
      'Reset Device ID',
      'This will generate a new anonymous identity. Your maps will stay stored locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset ID',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
            await resetIdentity();
            Alert.alert('Identity Refreshed', 'A new anonymous ID was assigned.');
          },
        },
      ]
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Wipe All Local Data',
      'This will permanently delete all stored mind maps, custom settings, and conversation logs on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (_) {}
            await clearAllLocalData();
            await restoreReferenceLibrary();
            Alert.alert('Data Wiped', 'App storage reset to clean baseline.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Screen Header */}
        <View style={styles.header}>
          <Kicker color={COLORS.cyan}>Preferences & Engine</Kicker>
          <Heading variant="h1" style={{ marginTop: 2 }}>
            Settings
          </Heading>
          <Text variant="bodySm" color={COLORS.textMuted}>
            Personalize typography, voice feedback, backend endpoints, and data controls.
          </Text>
        </View>

        {/* 1. READING PREFERENCES */}
        <View style={styles.section}>
          <Kicker color={COLORS.cyan}>Accessibility Core</Kicker>
          <Subheading variant="titleSm" style={{ marginTop: 2, marginBottom: SPACING.sm }}>
            Reading & Typography
          </Subheading>

          {/* Typeface Selector */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Typeface
          </Text>
          <View style={styles.optionsRow}>
            {(
              [
                { id: 'serif', label: 'Source Serif' },
                { id: 'hyper', label: 'Hyperlegible' },
                { id: 'system', label: 'System Sans' },
              ] as { id: FontStyleOption; label: string }[]
            ).map((item) => (
              <Button
                key={item.id}
                variant={font === item.id ? 'primary' : 'secondary'}
                size="sm"
                title={item.label}
                onPress={() => setFont(item.id)}
                style={styles.optionBtn}
              />
            ))}
          </View>

          {/* Text Size Multiplier */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Text Scaling
          </Text>
          <View style={styles.optionsRow}>
            {(
              [
                { id: 'normal', label: 'Normal (1.0×)' },
                { id: 'comfortable', label: 'Comfortable (1.1×)' },
                { id: 'large', label: 'Large (1.22×)' },
              ] as { id: TextSizeOption; label: string }[]
            ).map((item) => (
              <Button
                key={item.id}
                variant={size === item.id ? 'primary' : 'secondary'}
                size="sm"
                title={item.label}
                onPress={() => setSize(item.id)}
                style={styles.optionBtn}
              />
            ))}
          </View>

          {/* Motion Sensitivity */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Motion & Transitions
          </Text>
          <View style={styles.optionsRow}>
            {(
              [
                { id: 'movement', label: 'Let things move' },
                { id: 'reduced', label: 'Keep it still' },
              ] as { id: MotionOption; label: string }[]
            ).map((item) => (
              <Button
                key={item.id}
                variant={motion === item.id ? 'primary' : 'secondary'}
                size="sm"
                title={item.label}
                onPress={() => setMotion(item.id)}
                style={styles.optionBtn}
              />
            ))}
          </View>

          {/* Dyslexia Quick Features */}
          <View style={styles.togglesCard}>
            <TouchableOpacity
              style={[styles.toggleRow, bionic ? styles.toggleRowActive : {}]}
              onPress={toggleBionic}
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Bionic Reading Anchors"
              accessibilityState={{ checked: bionic }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">
                  Bionic Reading Anchors
                </Text>
                <Text variant="caption" color={COLORS.textMuted}>
                  Bolds initial word letters to accelerate saccadic eye jumping
                </Text>
              </View>
              <Tag label={bionic ? 'Active' : 'Off'} variant={bionic ? 'cyan' : 'neutral'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleRow, readingRuler ? styles.toggleRowActive : {}]}
              onPress={toggleReadingRuler}
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel="Movable Reading Ruler"
              accessibilityState={{ checked: readingRuler }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">
                  Movable Reading Ruler
                </Text>
                <Text variant="caption" color={COLORS.textMuted}>
                  Draggable focus guide line eliminating paragraph crowding
                </Text>
              </View>
              <Tag
                label={readingRuler ? 'Active' : 'Off'}
                variant={readingRuler ? 'cyan' : 'neutral'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. VOICE & AUDIO PREFERENCES */}
        <View style={styles.section}>
          <Kicker color={COLORS.cyan}>Speech Synthesis</Kicker>
          <Subheading variant="titleSm" style={{ marginTop: 2, marginBottom: SPACING.sm }}>
            Text-to-Speech Settings
          </Subheading>

          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Playback Speed
          </Text>
          <View style={styles.optionsRow}>
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <Button
                key={`rate-${rate}`}
                variant={speechRate === rate ? 'primary' : 'secondary'}
                size="sm"
                title={`${rate}×`}
                onPress={() => setSpeechRate(rate)}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Voice Pitch
          </Text>
          <View style={styles.optionsRow}>
            {[0.8, 1.0, 1.2].map((pitch) => (
              <Button
                key={`pitch-${pitch}`}
                variant={speechPitch === pitch ? 'primary' : 'secondary'}
                size="sm"
                title={pitch === 0.8 ? 'Low' : pitch === 1.0 ? 'Natural' : 'Higher'}
                onPress={() => setSpeechPitch(pitch)}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          <Button
            title="Test voice speech"
            variant="secondary"
            size="md"
            icon={<Volume2 size={16} color={COLORS.cyan} />}
            onPress={handleTestVoice}
            style={{ marginTop: SPACING.sm }}
          />
        </View>

        {/* 3. ENGINE & BACKEND CONNECTION */}
        <View style={styles.section}>
          <Kicker color={COLORS.cyan}>AI & Persistence</Kicker>
          <Subheading variant="titleSm" style={{ marginTop: 2, marginBottom: SPACING.sm }}>
            SETU Engine Connection
          </Subheading>

          <Card elevated style={styles.engineCard}>
            <View style={styles.probeRow}>
              <Text variant="bodySm" weight="bold">
                Backend Engine:
              </Text>
              <Tag
                label={
                  engineState === 'ok'
                    ? 'Online'
                    : engineState === 'nokey'
                    ? 'No AI Key'
                    : engineState === 'checking'
                    ? 'Checking…'
                    : 'Offline Mode'
                }
                variant={engineState === 'ok' ? 'cyan' : engineState === 'nokey' ? 'yellow' : 'neutral'}
              />
            </View>

            <View style={styles.probeRow}>
              <Text variant="bodySm" weight="bold">
                MongoDB Persistence:
              </Text>
              <Tag
                label={isDbConnected ? 'Connected' : 'Local Fallback'}
                variant={isDbConnected ? 'cyan' : 'neutral'}
              />
            </View>

            <Input
              label="Backend Server URL"
              hint="Android emulator uses http://10.0.2.2:3000, physical devices use your LAN or cloud URL"
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={{ marginTop: SPACING.sm }}
            />

            <View style={styles.engineBtnRow}>
              <Button
                title="Save URL"
                variant="primary"
                size="sm"
                onPress={handleSaveApiUrl}
                style={{ flex: 1 }}
              />
              <Button
                title="Test AI Probe"
                variant="secondary"
                size="sm"
                loading={isTestingAi}
                onPress={handleTestAiConnection}
                style={{ flex: 1 }}
              />
            </View>

            {aiTestResult && (
              <Text
                variant="caption"
                color={aiTestResult.includes('Success') ? COLORS.cyanDark : COLORS.magenta}
                style={{ marginTop: SPACING.sm }}
              >
                {aiTestResult}
              </Text>
            )}
          </Card>
        </View>

        {/* 4. PRIVACY & DEVICE DATA */}
        <View style={styles.section}>
          <Kicker color={COLORS.magenta}>Privacy & Local Data</Kicker>
          <Subheading variant="titleSm" style={{ marginTop: 2, marginBottom: SPACING.sm }}>
            Device Identity & Memory
          </Subheading>

          <Card elevated style={styles.dataCard}>
            <Text variant="caption" color={COLORS.textMuted}>
              Anonymous Device ID:
            </Text>
            <Text variant="bodySm" weight="bold" color={COLORS.text} style={{ marginBottom: SPACING.xs }}>
              {userId || 'Loading…'}
            </Text>

            <Text variant="caption" color={COLORS.textMuted} style={{ marginBottom: SPACING.md }}>
              SETU does not require accounts or logins. Your identity is a local anonymous token shared
              transparently across local engine requests.
            </Text>

            <View style={styles.dataButtonsRow}>
              <Button
                title="Reset device ID"
                variant="secondary"
                size="sm"
                onPress={handleResetUserId}
                style={{ flex: 1 }}
              />
              <Button
                title="Delete all data"
                variant="destructive"
                size="sm"
                icon={<Trash2 size={14} color={COLORS.textInverse} />}
                onPress={handleClearAllData}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>

        {/* 5. ABOUT SETU & HACKATHON */}
        <View style={[styles.section, { marginBottom: SPACING.huge }]}>
          <Kicker color={COLORS.cyan}>Hack4Positive 2026</Kicker>
          <Text variant="bodySm" weight="bold" style={{ marginTop: 2 }}>
            SETU — Cognitive Operating System
          </Text>
          <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: 4 }}>
            Built for Disability Inclusion & Accessibility. Empowering ADHD, dyslexic, and
            neurodivergent minds with plain-language transformations, interactive visual mind
            maps, and focus assistance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.huge,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  groupLabel: {
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  optionBtn: {
    flex: 1,
  },
  togglesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
    marginTop: SPACING.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  toggleRowActive: {
    backgroundColor: COLORS.cyanLight,
  },
  engineCard: {
    padding: SPACING.md,
  },
  probeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  engineBtnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dataCard: {
    padding: SPACING.md,
  },
  dataButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
});
