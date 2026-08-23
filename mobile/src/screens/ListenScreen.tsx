/**
 * SETU Mobile — Listen.
 *
 * Roughly 40% of dyslexic and ADHD adults also carry anxiety or depression, and
 * the guidance for this project was to give them somewhere to put the
 * frustration rather than leaving it in the workflow. So this is a listener, not
 * a coach: it reflects, names, validates, and offers one small next thing.
 *
 * Two things are deliberate and load-bearing:
 *
 *  - Entries never leave the phone. They go to a local-only store with no
 *    background mirror, unlike every other artefact in the app.
 *  - The crisis path is decided on the server before any model is called, so a
 *    risk reply is fixed, reviewed text with real helplines rather than
 *    something sampled. This screen renders that payload verbatim and makes the
 *    numbers dialable — on a phone, that is one tap to a human.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Phone,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react-native';

import { Palette } from '../constants/themes';
import { RADIUS, SPACING } from '../constants/theme';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { api } from '../services/api';
import { tts } from '../services/tts';
import { award } from '../services/progress';
import { addJournalEntry, clearJournal, getJournal } from '../services/localStore';
import { CrisisHelpline, JournalEntry, ListenResult } from '../types';
import { Text, Heading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { formatRelativeDate } from '../utils/formatters';

const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Flat' },
  { value: 4, emoji: '🙂', label: 'Alright' },
  { value: 5, emoji: '😌', label: 'Good' },
];

export const ListenScreen: React.FC = () => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  const [entry, setEntry] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [response, setResponse] = useState<ListenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [showJournal, setShowJournal] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    getJournal().then(setJournal);
    return () => {
      tts.stop();
    };
  }, []);

  const spokenReply = useMemo(() => {
    if (!response || response.crisis) return '';
    return [response.reflection, response.validation, response.oneSmallThing]
      .filter(Boolean)
      .join(' ');
  }, [response]);

  const submit = async () => {
    const text = entry.trim();
    if (!text || loading) return;

    await tts.stop();
    setSpeaking(false);
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await api.listen(text, mood);
      setResponse(result);

      // A crisis turn is not a scored activity. Attaching points to someone
      // disclosing risk would be grotesque.
      if (!result.crisis) award('checkIn');

      setJournal(
        await addJournalEntry({
          id: `j_${Date.now()}`,
          text,
          mood,
          at: new Date().toISOString(),
          reflection: result.crisis ? null : result.reflection || null,
        })
      );
      setEntry('');
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not reach the engine. What you wrote is still here — nothing was lost.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeak = () => {
    if (speaking) {
      tts.stop();
      setSpeaking(false);
      return;
    }
    if (!spokenReply) return;
    setSpeaking(true);
    tts.speak(spokenReply, {
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const confirmClearJournal = () => {
    Alert.alert(
      'Delete every check-in?',
      'This removes all saved check-ins from this phone. It cannot be undone.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            await clearJournal();
            setJournal([]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Kicker color={COLORS.magenta}>A quiet room</Kicker>
          <Heading variant="titleLg">Say it here first</Heading>
          <Text variant="bodySm" color={COLORS.textMuted} style={{ marginTop: 6 }}>
            Somewhere to put the frustration before it follows you into the next task. Nothing you
            write leaves this phone, and no one else can read it.
          </Text>
        </View>

        {/* Mood */}
        <View style={styles.section}>
          <Kicker>How is today going, roughly?</Kicker>
          <View style={styles.moodRow}>
            {MOODS.map((option) => {
              const selected = mood === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  activeOpacity={0.8}
                  onPress={() => setMood(selected ? null : option.value)}
                  style={[styles.moodChip, selected ? styles.moodChipSelected : null]}
                >
                  <Text variant="titleSm">{option.emoji}</Text>
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={selected ? COLORS.cyanDark : COLORS.textMuted}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Entry */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Kicker>What is going on?</Kicker>
            <VoiceInputButton
              onTranscript={(text) => setEntry((prev) => (prev ? `${prev} ${text}` : text))}
              showLabel
              label="Speak it"
              size={40}
            />
          </View>

          <Input
            placeholder="Everything took twice as long today and I still got asked why it wasn't done…"
            value={entry}
            onChangeText={setEntry}
            multiline
            numberOfLines={6}
            accessibilityLabel="What is going on?"
          />

          <Button
            title={loading ? 'Listening…' : 'Say it'}
            variant="primary"
            size="md"
            loading={loading}
            disabled={!entry.trim()}
            icon={<Send size={16} color={COLORS.textInverse} />}
            onPress={submit}
            style={{ marginTop: SPACING.sm }}
          />

          {error ? (
            <Text variant="bodySm" color={COLORS.magenta} style={{ marginTop: SPACING.sm }}>
              {error}
            </Text>
          ) : null}
        </View>

        {/* Reply */}
        {response?.crisis ? (
          <CrisisPanel response={response} />
        ) : response ? (
          <View style={styles.replyCard} accessibilityLiveRegion="polite">
            <View style={styles.replyHeader}>
              <View style={styles.replyBadge}>
                <Heart size={14} color={COLORS.magenta} />
                <Text variant="caption" weight="bold" color={COLORS.magenta} style={{ marginLeft: 5 }}>
                  Heard you
                </Text>
              </View>

              {spokenReply ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={speaking ? 'Stop reading aloud' : 'Read this back to me'}
                  onPress={toggleSpeak}
                  style={styles.speakButton}
                >
                  {speaking ? (
                    <VolumeX size={15} color={COLORS.magenta} />
                  ) : (
                    <Volume2 size={15} color={COLORS.cyan} />
                  )}
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={speaking ? COLORS.magenta : COLORS.cyan}
                    style={{ marginLeft: 5 }}
                  >
                    {speaking ? 'Stop' : 'Read it back'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {response.reflection ? (
              <Text variant="body" style={{ marginTop: SPACING.md }}>
                {response.reflection}
              </Text>
            ) : null}

            {response.namedFeelings?.length ? (
              <View style={styles.feelingRow}>
                {response.namedFeelings.map((feeling) => (
                  <View key={feeling} style={styles.feelingChip}>
                    <Text variant="caption" weight="semibold" color={COLORS.magentaDark}>
                      {feeling}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {response.validation ? (
              <Text variant="bodySm" color={COLORS.textMuted} style={{ marginTop: SPACING.md }}>
                {response.validation}
              </Text>
            ) : null}

            {response.groundingExercise ? (
              <View style={styles.groundingCard}>
                <View style={styles.groundingHeader}>
                  <Wind size={15} color={COLORS.cyanDark} />
                  <Text variant="bodySm" weight="bold" style={{ marginLeft: 6, flex: 1 }}>
                    {response.groundingExercise.name}
                  </Text>
                  <Text variant="caption" color={COLORS.textMuted}>
                    {response.groundingExercise.durationMinutes} min
                  </Text>
                </View>
                {response.groundingExercise.steps.map((groundingStep, index) => (
                  <View key={index} style={styles.groundingStep}>
                    <Text variant="caption" weight="bold" color={COLORS.cyanDark}>
                      {index + 1}
                    </Text>
                    <Text variant="bodySm" style={{ flex: 1, marginLeft: SPACING.sm }}>
                      {groundingStep}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {response.oneSmallThing ? (
              <View style={styles.smallThing}>
                <Kicker color={COLORS.yellowDark}>One small thing, if you want it</Kicker>
                <Text variant="bodySm" weight="semibold" style={{ marginTop: 2 }}>
                  {response.oneSmallThing}
                </Text>
              </View>
            ) : null}

            {response.openQuestion ? (
              <Text variant="bodySm" color={COLORS.textMuted} style={{ marginTop: SPACING.md }}>
                {response.openQuestion}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Journal */}
        <View style={styles.section}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: showJournal }}
            onPress={() => setShowJournal((current) => !current)}
            style={styles.journalToggle}
          >
            <Text variant="bodySm" weight="semibold">
              Earlier check-ins ({journal.length})
            </Text>
            {showJournal ? (
              <ChevronUp size={16} color={COLORS.textMuted} />
            ) : (
              <ChevronDown size={16} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>

          {showJournal ? (
            <View style={{ marginTop: SPACING.sm }}>
              {journal.length === 0 ? (
                <Text variant="bodySm" color={COLORS.textMuted}>
                  Nothing saved yet. Whatever you write here stays on this phone.
                </Text>
              ) : (
                <>
                  {journal.map((item) => (
                    <View key={item.id} style={styles.journalEntry}>
                      <View style={styles.journalMeta}>
                        <Text variant="caption" color={COLORS.textSubtle}>
                          {formatRelativeDate(item.at)}
                        </Text>
                        {item.mood ? (
                          <Text variant="caption">
                            {MOODS.find((m) => m.value === item.mood)?.emoji}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="bodySm">{item.text}</Text>
                      {item.reflection ? (
                        <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: 4 }}>
                          {item.reflection}
                        </Text>
                      ) : null}
                    </View>
                  ))}

                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={confirmClearJournal}
                    style={styles.clearJournal}
                  >
                    <Trash2 size={14} color={COLORS.magenta} />
                    <Text variant="caption" weight="semibold" color={COLORS.magenta} style={{ marginLeft: 5 }}>
                      Delete every check-in
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </View>

        <Text variant="caption" color={COLORS.textSubtle} style={styles.disclaimer}>
          SETU is not a therapist and not a crisis service. If things are heavy, please talk to a
          person you trust or a helpline.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/* Crisis panel                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The fixed crisis response.
 *
 * Rendered verbatim from the server — the message, the helplines and the
 * immediate step are reviewed text that no model touched, and nothing here
 * summarises, reorders or rephrases them. The one line written locally is the
 * reassurance about where the entry is stored, because the server's copy says
 * "browser" and on a phone that would simply be wrong.
 */
const CrisisPanel: React.FC<{ response: ListenResult }> = ({ response }) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  const reach = async (helpline: CrisisHelpline) => {
    const contact = helpline.contact || '';
    const isUrl = /^https?:\/\//i.test(contact);
    // "14416 or 1-800-891-4416" — dial the first number offered.
    const number = contact.split(/\s+or\s+/i)[0].replace(/[^\d+]/g, '');
    const target = isUrl ? contact : `tel:${number}`;

    try {
      await Linking.openURL(target);
    } catch (_) {
      Alert.alert(helpline.name, contact);
    }
  };

  return (
    <View style={styles.crisisCard} accessibilityLiveRegion="assertive">
      <Kicker color={COLORS.magenta}>Please talk to someone tonight</Kicker>

      <Text variant="body" weight="medium" style={{ marginTop: SPACING.sm }}>
        {response.message}
      </Text>

      {response.languageNote ? (
        <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: SPACING.sm }}>
          {response.languageNote}
        </Text>
      ) : null}

      <View style={{ marginTop: SPACING.lg }}>
        {(response.helplines || []).map((helpline) => (
          <TouchableOpacity
            key={helpline.name}
            accessibilityRole="button"
            accessibilityLabel={`${helpline.name}, ${helpline.contact}, ${helpline.hours}`}
            activeOpacity={0.85}
            onPress={() => reach(helpline)}
            style={styles.helpline}
          >
            <View style={styles.helplineIcon}>
              <Phone size={16} color={COLORS.textInverse} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" weight="bold">
                {helpline.name}
              </Text>
              <Text variant="body" weight="bold" color={COLORS.magenta}>
                {helpline.contact}
              </Text>
              <Text variant="caption" color={COLORS.textMuted}>
                {helpline.region} · {helpline.hours}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {response.immediateStep ? (
        <Text variant="bodySm" weight="semibold" style={styles.immediateStep}>
          {response.immediateStep}
        </Text>
      ) : null}

      <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: SPACING.md }}>
        You are welcome to stay on this screen. What you wrote is on this phone only, and it is not
        sent anywhere unless you choose to.
      </Text>
    </View>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.bg,
    },
    body: {
      padding: SPACING.lg,
      paddingBottom: SPACING.huge * 2,
      gap: SPACING.xl,
    },
    header: {
      gap: 2,
    },
    section: {
      gap: SPACING.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    moodRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    moodChip: {
      minWidth: 62,
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.divider,
      backgroundColor: t.surface,
    },
    moodChipSelected: {
      borderColor: t.cyan,
      backgroundColor: t.cyanLight,
    },
    replyCard: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.divider,
      borderLeftWidth: 4,
      borderLeftColor: t.magenta,
      padding: SPACING.lg,
    },
    replyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    replyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: 5,
      borderRadius: RADIUS.pill,
      backgroundColor: t.magentaLight,
    },
    speakButton: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.pill,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.divider,
    },
    feelingRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.md,
    },
    feelingChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: t.magentaLight,
    },
    groundingCard: {
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.cyanLight,
      borderWidth: 1,
      borderColor: t.cyanBorder,
    },
    groundingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    groundingStep: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 4,
    },
    smallThing: {
      marginTop: SPACING.lg,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.yellowLight,
      borderWidth: 1,
      borderColor: t.yellow,
    },
    journalToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.divider,
      backgroundColor: t.surface,
    },
    journalEntry: {
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: t.dividerSubtle,
    },
    journalMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    clearJournal: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: 44,
      marginTop: SPACING.sm,
    },
    disclaimer: {
      textAlign: 'center',
      paddingHorizontal: SPACING.lg,
    },
    crisisCard: {
      backgroundColor: t.magentaLight,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: t.magenta,
      padding: SPACING.lg,
    },
    helpline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.divider,
      marginBottom: SPACING.sm,
      minHeight: 64,
    },
    helplineIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.magenta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    immediateStep: {
      marginTop: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.divider,
    },
  });

export default ListenScreen;
