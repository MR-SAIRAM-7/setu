/**
 * SETU Mobile — Settings.
 *
 * For most apps settings are a place you visit once. Here they are part of the
 * product: the typeface, the ground colour, the tint, the language and the voice
 * are the accommodations themselves, and people change them as their day and
 * their eyes change. So everything is one screen, grouped by what it affects
 * rather than by which subsystem implements it, and every control takes effect
 * immediately rather than behind a save button.
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
  Volume2,
  Trash2,
  Languages,
  Palette as PaletteIcon,
  TrendingUp,
  Check,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { useAccessibility } from '../context/AccessibilityContext';
import { useIdentity } from '../context/IdentityContext';
import { clearAllLocalData, restoreReferenceLibrary } from '../services/storage';
import { api } from '../services/api';
import { tts } from '../services/tts';
import {
  FontStyleOption,
  TextSizeOption,
  MotionOption,
  SpacingOption,
  ThemeOption,
  SarvamVoice,
} from '../types';
import { LANGUAGES, languageSample } from '../constants/languages';
import { COLOR_OVERLAYS, OVERLAY_LABELS, THEME_LABELS, paletteFor } from '../constants/themes';
import { DEFAULT_API_URL, isCustomApiUrl } from '../constants/config';
import * as Haptics from 'expo-haptics';

const THEME_ORDER: ThemeOption[] = ['broadsheet', 'cream', 'pastel', 'sage', 'velvet', 'contrast'];

export const SettingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const {
    font,
    size,
    motion,
    bionic,
    readingRuler,
    speechRate,
    speechPitch,
    customApiUrl,
    theme,
    spacing,
    language,
    voice,
    speakOnTap,
    colorOverlay,
    colorOverlayOpacity,
    setFont,
    setSize,
    setMotion,
    toggleBionic,
    toggleReadingRuler,
    setSpeechRate,
    setSpeechPitch,
    setCustomApiUrl,
    setTheme,
    setSpacing,
    setLanguage,
    setVoice,
    toggleSpeakOnTap,
    setColorOverlay,
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
  const [voices, setVoices] = useState<SarvamVoice[]>([]);
  const [naturalVoice, setNaturalVoice] = useState<boolean | null>(null);

  useEffect(() => {
    setApiUrlInput(customApiUrl);
  }, [customApiUrl]);

  // The speaker list is a property of whichever engine we are pointed at, so it
  // is re-asked whenever the address changes rather than fetched once at mount.
  useEffect(() => {
    let cancelled = false;
    tts.probeNaturalVoice(true).then(async (available) => {
      if (cancelled) return;
      setNaturalVoice(available);
      setVoices(available ? await tts.getVoiceCatalogue() : []);
    });
    return () => {
      cancelled = true;
    };
  }, [customApiUrl]);

  const handleSaveApiUrl = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    await setCustomApiUrl(apiUrlInput.trim());
    await checkHealth();
    Alert.alert(
      'Engine address saved',
      apiUrlInput.trim()
        ? `SETU will talk to ${apiUrlInput.trim()}.`
        : 'SETU is back to the engine this build ships with.'
    );
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
          `AI Probe Success! Provider: ${res.provider || 'Gemini'} · Model: ${res.model || 'active'}`
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
    // Spoken in the chosen language, not in English, so the test actually
    // demonstrates the thing being configured.
    tts.speak(languageSample(language));
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

  /**
   * Erase the copy held on this phone.
   *
   * The wording here is careful on purpose, and it used to be wrong. The button
   * said "Delete all data" and the dialog said "permanently delete all stored
   * mind maps, custom settings, and conversation logs" — but maps, summaries,
   * settings and progress are mirrored to the engine as they are written, and
   * this clears AsyncStorage only. So the old copy promised a purge and
   * delivered a local wipe.
   *
   * Worse than the inaccuracy: `AsyncStorage.clear()` also discards the
   * anonymous device id, which is the only handle the server copy is filed
   * under. Pressing it left the data on the server AND made it unreachable, so
   * a user who wanted it gone ended up in the one state where it can never be
   * deleted. The id is therefore preserved across the wipe, and the dialog says
   * plainly what stays behind.
   */
  const handleClearAllData = async () => {
    Alert.alert(
      'Erase this phone’s copy',
      'This clears the mind maps, summaries, settings, check-in journal and parking lot held on this device, and puts the app back to a fresh state.\n\n' +
        'It does not delete the copies already sent to the SETU engine. Those stay filed under your anonymous device ID, which is kept so they remain reachable rather than orphaned.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase local copy',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (_) {}
            await clearAllLocalData({ keepIdentity: true });
            await restoreReferenceLibrary();
            Alert.alert(
              'Local copy erased',
              'This device is back to a fresh state. Your anonymous ID was kept, so anything already on the engine is still yours.'
            );
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
          <Kicker color={COLORS.cyan}>Make it readable for you</Kicker>
          <Heading variant="h1" style={{ marginTop: 2 }}>
            Settings
          </Heading>
          <Text variant="bodySm" color={COLORS.textMuted}>
            Change anything here at any time. Nothing needs saving and nothing is permanent.
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
                { id: 'serif', label: 'Serif' },
                { id: 'system', label: 'System sans' },
                { id: 'hyper', label: 'Hyperlegible' },
                { id: 'lexend', label: 'Lexend' },
                { id: 'dyslexic', label: 'Dyslexia-friendly' },
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

          {/* Ground colour. Not a light/dark switch — see constants/themes.ts. */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Page colour
          </Text>
          <View style={styles.swatchRow}>
            {THEME_ORDER.map((option) => {
              const palette = paletteFor(option);
              const selected = theme === option;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${THEME_LABELS[option].name}. ${THEME_LABELS[option].blurb}`}
                  onPress={() => setTheme(option)}
                  style={[styles.swatch, selected ? styles.swatchSelected : null]}
                >
                  <View style={[styles.swatchChip, { backgroundColor: palette.bg }]}>
                    <View style={[styles.swatchInk, { backgroundColor: palette.text }]} />
                    <View style={[styles.swatchInk, { backgroundColor: palette.cyan }]} />
                    {selected ? <Check size={12} color={palette.text} /> : null}
                  </View>
                  <Text
                    variant="caption"
                    weight={selected ? 'bold' : 'normal'}
                    color={selected ? COLORS.text : COLORS.textMuted}
                    align="center"
                  >
                    {THEME_LABELS[option].name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Line spacing */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Line spacing
          </Text>
          <View style={styles.optionsRow}>
            {(
              [
                { id: 'normal', label: 'Normal' },
                { id: 'relaxed', label: 'Relaxed' },
                { id: 'spacious', label: 'Spacious' },
              ] as { id: SpacingOption; label: string }[]
            ).map((item) => (
              <Button
                key={item.id}
                variant={spacing === item.id ? 'primary' : 'secondary'}
                size="sm"
                title={item.label}
                onPress={() => setSpacing(item.id)}
                style={styles.optionBtn}
              />
            ))}
          </View>

          {/* Colour film for visual stress */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Colour tint over the screen
          </Text>
          <Text variant="caption" color={COLORS.textMuted} style={{ marginBottom: SPACING.xs }}>
            If text seems to shimmer or swim on a plain background, a tint often settles it. Which
            colour helps is personal — try a few.
          </Text>
          <View style={styles.swatchRow}>
            {Object.keys(COLOR_OVERLAYS).map((key) => {
              const tint = COLOR_OVERLAYS[key];
              const selected = (colorOverlay || 'none') === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${OVERLAY_LABELS[key]} tint`}
                  onPress={() => setColorOverlay(key)}
                  style={[styles.swatch, selected ? styles.swatchSelected : null]}
                >
                  <View
                    style={[
                      styles.swatchChip,
                      { backgroundColor: tint || COLORS.surface, justifyContent: 'center' },
                    ]}
                  >
                    {selected ? <Check size={12} color={COLORS.text} /> : null}
                  </View>
                  <Text
                    variant="caption"
                    color={selected ? COLORS.text : COLORS.textMuted}
                    align="center"
                  >
                    {OVERLAY_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {colorOverlay && colorOverlay !== 'none' ? (
            <View style={styles.optionsRow}>
              {[0.08, 0.12, 0.2, 0.3].map((value) => (
                <Button
                  key={`tint-${value}`}
                  variant={
                    Math.abs((colorOverlayOpacity || 0.12) - value) < 0.01 ? 'primary' : 'secondary'
                  }
                  size="sm"
                  title={`${Math.round(value * 100)}%`}
                  onPress={() => setColorOverlay(colorOverlay, value)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          ) : null}

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
                  Bold the start of each word
                </Text>
                <Text variant="caption" color={COLORS.textMuted}>
                  Some readers find it helps them keep their place. The evidence for it is weak, so
                  it is off by default — try it and keep it only if it actually helps you.
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
                  Reading ruler
                </Text>
                <Text variant="caption" color={COLORS.textMuted}>
                  A movable band that isolates one line at a time, so your eye cannot skip or repeat
                  a line in a dense paragraph.
                </Text>
              </View>
              <Tag
                label={readingRuler ? 'Active' : 'Off'}
                variant={readingRuler ? 'cyan' : 'neutral'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. LANGUAGE, VOICE & READING ALOUD */}
        <View style={styles.section}>
          <Kicker color={COLORS.cyan}>Language & voice</Kicker>
          <Subheading variant="titleSm" style={{ marginTop: 2, marginBottom: SPACING.sm }}>
            How SETU talks to you
          </Subheading>

          <View style={styles.noteRow}>
            <Languages size={15} color={COLORS.cyan} />
            <Text variant="caption" color={COLORS.textMuted} style={{ flex: 1, marginLeft: 8 }}>
              One choice covers both halves: the language answers come back in, and the language
              they are read aloud in. Setting only one gives you a Hindi voice reading English.
            </Text>
          </View>

          <View style={styles.languageGrid}>
            {LANGUAGES.map((item) => {
              const selected = language === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.name}, ${item.native}`}
                  onPress={() => setLanguage(item.code)}
                  style={[styles.languageChip, selected ? styles.languageChipSelected : null]}
                >
                  <Text
                    variant="bodySm"
                    weight={selected ? 'bold' : 'normal'}
                    color={selected ? COLORS.cyanDark : COLORS.text}
                  >
                    {item.native}
                  </Text>
                  <Text variant="caption" color={COLORS.textMuted}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Natural voice picker, only when the engine actually offers one */}
          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Voice
          </Text>

          {naturalVoice === null ? (
            <Text variant="caption" color={COLORS.textMuted}>
              Checking which voices this engine has...
            </Text>
          ) : naturalVoice ? (
            <View style={styles.voiceGrid}>
              {voices.map((item) => {
                const selected = voice === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.label}, ${item.note}`}
                    onPress={async () => {
                      await setVoice(item.id);
                      tts.speak(languageSample(language));
                    }}
                    style={[styles.voiceChip, selected ? styles.voiceChipSelected : null]}
                  >
                    <Text
                      variant="bodySm"
                      weight={selected ? 'bold' : 'normal'}
                      color={selected ? COLORS.cyanDark : COLORS.text}
                    >
                      {item.label}
                    </Text>
                    <Text variant="caption" color={COLORS.textMuted}>
                      {item.note}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text variant="caption" color={COLORS.textMuted}>
              This engine has no natural voice configured, so SETU is using the synthesiser built
              into your phone. Everything still reads aloud - it just sounds more robotic.
            </Text>
          )}

          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: speakOnTap }}
            accessibilityLabel="Speak mind map branches when tapped"
            onPress={toggleSpeakOnTap}
            style={[styles.toggleRow, speakOnTap ? styles.toggleRowActive : null]}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" weight="semibold">
                Read a branch when I tap it
              </Text>
              <Text variant="caption" color={COLORS.textMuted}>
                A map of silent text is still a wall of words. Pairing each branch with audio is what
                makes the diagram readable.
              </Text>
            </View>
            <Tag label={speakOnTap ? 'On' : 'Off'} variant={speakOnTap ? 'cyan' : 'neutral'} />
          </TouchableOpacity>

          <Text variant="bodySm" weight="semibold" style={styles.groupLabel}>
            Reading pace
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
            Pitch
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
            title="Hear how that sounds"
            variant="secondary"
            size="md"
            icon={<Volume2 size={16} color={COLORS.cyan} />}
            onPress={handleTestVoice}
            style={{ marginTop: SPACING.sm }}
          />
        </View>

        {/* 3. MOMENTUM */}
        <View style={styles.section}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open Momentum - points, streak and milestones"
            onPress={() => navigation?.navigate('Momentum')}
            style={styles.linkRow}
          >
            <TrendingUp size={18} color={COLORS.cyan} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text variant="bodySm" weight="semibold">
                Momentum
              </Text>
              <Text variant="caption" color={COLORS.textMuted}>
                Points, streak and milestones - and the switch to turn the notifications off
              </Text>
            </View>
          </TouchableOpacity>
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
              label="Engine address"
              hint={
                isCustomApiUrl(customApiUrl)
                  ? `Leave this empty to go back to the engine this build ships with (${DEFAULT_API_URL}).`
                  : `Using the engine this build ships with: ${DEFAULT_API_URL}. Only change this if you are running your own.`
              }
              placeholder={DEFAULT_API_URL}
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
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

            {/*
              What this paragraph has to do is say where the data actually is.

              It used to say the identity was "a local anonymous token shared
              transparently across local engine requests", which reads as though
              nothing leaves the phone. Maps, summaries, settings and progress
              are all mirrored to the engine under this ID as they are written.
              Someone deciding whether to type something into this app is
              entitled to know that in one sentence, on this screen, rather than
              inferring it.
            */}
            <Text variant="caption" color={COLORS.textMuted} style={{ marginBottom: SPACING.md }}>
              There are no accounts and no logins — this random ID is the only thing identifying
              you, and it is created on this phone. Your mind maps, summaries, settings and progress
              are copied to the SETU engine under it, so they survive a reinstall. Your check-in
              journal and parking lot are not: those stay on this device only.
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
                title="Erase local copy"
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

          {/*
            Typeface attribution.

            The three faces are redistributed inside the app, and the SIL Open
            Font Licence asks that the notice travel with them. The full text is
            at assets/fonts/NOTICE.txt; this is the acknowledgement a user can
            actually see. The last sentence is here for the same reason it is in
            that file — the app offers Hyperlegible because some readers find it
            more comfortable, not because a typeface treats anything.
          */}
          <Text variant="caption" color={COLORS.textSubtle} style={{ marginTop: SPACING.md }}>
            Typefaces: Atkinson Hyperlegible (Braille Institute of America), Lexend, and Source
            Serif 4 (Adobe) — all under the SIL Open Font License 1.1. A typeface is a comfort
            setting here, not a treatment; the accommodation with evidence behind it is the letter
            spacing above.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.bg,
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
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  swatch: {
    width: 76,
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: t.cyan,
    backgroundColor: t.cyanLight,
  },
  swatchChip: {
    width: '100%',
    height: 38,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: t.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  swatchInk: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.divider,
    marginBottom: SPACING.md,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  languageChip: {
    minWidth: 96,
    flexGrow: 1,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: t.divider,
    backgroundColor: t.surface,
  },
  languageChipSelected: {
    borderColor: t.cyan,
    borderWidth: 1.5,
    backgroundColor: t.cyanLight,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  voiceChip: {
    minWidth: 108,
    flexGrow: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: t.divider,
    backgroundColor: t.surface,
  },
  voiceChipSelected: {
    borderColor: t.cyan,
    borderWidth: 1.5,
    backgroundColor: t.cyanLight,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.divider,
  },
  optionBtn: {
    flex: 1,
  },
  togglesCard: {
    backgroundColor: t.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
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
    backgroundColor: t.cyanLight,
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
