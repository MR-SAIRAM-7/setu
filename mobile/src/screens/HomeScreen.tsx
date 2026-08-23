/**
 * SETU Mobile — Home.
 *
 * The launchpad, ordered by what someone opening the app is most likely to be
 * in the middle of: ask a question, scan the thing in front of them, pick a
 * mode, or pick up a map they already made.
 *
 * The quick toggles sit near the top on purpose. Whether the ruler or the tint
 * is on is not a setup decision that gets made once; it changes with the hour,
 * the light and how tired someone is, and burying it two screens deep means it
 * simply does not get used.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import {
  Sparkles,
  Camera,
  PlayCircle,
  Waves,
  GraduationCap,
  Users,
  MessageCircle,
  PenTool,
  Route,
  ArrowRight,
  BookOpen,
  Volume2,
  VolumeX,
  Calculator,
  Heart,
  TrendingUp,
  Flame,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, PLATE_COLORS } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { FocusTimerWidget } from '../components/FocusTimerWidget';
import { EngineBadge } from '../components/EngineBadge';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useFocus } from '../context/FocusContext';
import { getSavedMindMaps } from '../services/storage';
import { MindMapDocument, CognitiveModeKey } from '../types';
import { tts } from '../services/tts';
import { getProgress, getRank, subscribeProgress } from '../services/progress';
import { languageSample } from '../constants/languages';
import { formatRelativeDate, truncateText } from '../utils/formatters';

export interface HomeScreenProps {
  navigation: any;
}

type PlateKey = 'cyan' | 'magenta' | 'yellow' | 'ink';

const MODES_PREVIEWS: {
  key: CognitiveModeKey;
  name: string;
  tagline: string;
  tintKey: PlateKey;
  icon: any;
}[] = [
  {
    key: 'start',
    name: 'Start',
    tagline: 'Break task freeze',
    tintKey: 'yellow',
    icon: PlayCircle,
  },
  {
    key: 'simplify',
    name: 'Simplify',
    tagline: 'Plain language rewrite',
    tintKey: 'cyan',
    icon: Waves,
  },
  {
    key: 'learn',
    name: 'Learn',
    tagline: 'Study notes & self-quiz',
    tintKey: 'magenta',
    icon: GraduationCap,
  },
  {
    key: 'meet',
    name: 'Meet',
    tagline: 'Decisions & action items',
    tintKey: 'cyan',
    icon: Users,
  },
  {
    key: 'practice',
    name: 'Practice',
    tagline: 'Rehearse conversations',
    tintKey: 'magenta',
    icon: MessageCircle,
  },
  {
    key: 'write',
    name: 'Write',
    tagline: 'Accessible writing check',
    tintKey: 'yellow',
    icon: PenTool,
  },
  {
    key: 'guide',
    name: 'Guide',
    tagline: 'Step-by-step workflow',
    tintKey: 'ink',
    icon: Route,
  },
  {
    key: 'numbers',
    name: 'Numbers',
    tagline: 'Sums with objects',
    tintKey: 'magenta',
    icon: Calculator,
  },
];

/**
 * One line a day, rotated.
 *
 * These are the features people do not find on their own — every one of them
 * came out of watching somebody miss it. Nothing here is a productivity slogan.
 */
const TIPS = [
  'Tap the microphone anywhere you can type. Dictation handles all eleven languages.',
  'The 25-minute focus session keeps running while you use another app.',
  'The reading ruler isolates one line at a time. It is in Settings, or the ribbon above.',
  'Tap a mind map branch to hear it read aloud instead of decoding it.',
  'The pin button parks a thought so you can let go of it and finish what you were doing.',
  'If text seems to shimmer, try a colour tint in Settings. Which colour helps is personal.',
  'Every mode opens on a worked example, so no screen is ever blank.',
  'Numbers mode explains a sum with countable things rather than notation.',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { bionic, readingRuler, language, toggleBionic, toggleReadingRuler } = useAccessibility();
  const { totalSessionsCompleted } = useFocus();
  const [researchTopic, setResearchTopic] = useState('');
  const [recentMaps, setRecentMaps] = useState<MindMapDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [progress, setProgress] = useState(getProgress);

  useEffect(() => subscribeProgress(setProgress), []);

  const loadData = async () => {
    try {
      const maps = await getSavedMindMaps();
      setRecentMaps(maps.slice(0, 4));
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartResearch = (topicToResearch?: string) => {
    const query = topicToResearch || researchTopic.trim();
    if (!query) return;
    navigation.navigate('MindMapTab', {
      screen: 'MindMapScreen',
      params: { initialTopic: query },
    });
    setResearchTopic('');
  };

  const handleVoiceTranscript = (text: string) => {
    setResearchTopic(text);
    handleStartResearch(text);
  };

  const handleToggleTtsSample = () => {
    if (isSpeaking) {
      tts.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      // Spoken in the chosen language, so the sample demonstrates the voice the
      // user will actually get rather than an English one.
      tts.speak(languageSample(language), {
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  const getTipOfTheDay = () => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return TIPS[dayOfYear % TIPS.length];
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.cyan]}
            tintColor={COLORS.cyan}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View>
            <Text variant="titleLg" weight="bold" color={COLORS.text}>
              SETU Sanctuary
            </Text>
            <Text variant="caption" color={COLORS.textMuted}>
              Cognitive accessibility for ADHD & dyslexic minds
            </Text>
          </View>
          <EngineBadge />
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock} accessible={true} accessibilityRole="text" accessibilityLabel={`${recentMaps.length} Maps saved`}>
            <Text variant="titleSm" weight="bold" color={COLORS.text}>{recentMaps.length}</Text>
            <Text variant="caption" color={COLORS.textMuted}>Maps saved</Text>
          </View>
          <View style={styles.statBlock} accessible={true} accessibilityRole="text" accessibilityLabel={`${totalSessionsCompleted} Focus sessions`}>
            <Text variant="titleSm" weight="bold" color={COLORS.text}>{totalSessionsCompleted}</Text>
            <Text variant="caption" color={COLORS.textMuted}>Focus sessions</Text>
          </View>
          <TouchableOpacity
            style={styles.statBlock}
            accessibilityRole="button"
            accessibilityLabel={`${progress.streakDays} day streak. Open Momentum.`}
            onPress={() => navigation.navigate('Momentum')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Flame size={13} color={COLORS.yellowDark} />
              <Text variant="titleSm" weight="bold" style={{ marginLeft: 3 }}>
                {progress.streakDays}
              </Text>
            </View>
            <Text variant="caption" color={COLORS.textMuted}>Day streak</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statBlock}
            accessibilityRole="button"
            accessibilityLabel={`${progress.points} points, ${getRank(progress.points).name}. Open Momentum.`}
            onPress={() => navigation.navigate('Momentum')}
          >
            <Text variant="titleSm" weight="bold" color={COLORS.text}>{progress.points}</Text>
            <Text variant="caption" color={COLORS.textMuted}>Points</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Accessibility Toggles Ribbon */}
        <View style={styles.accessibilityRibbon}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Bold word starts, currently ${bionic ? 'on' : 'off'}`}
            activeOpacity={0.8}
            style={[styles.ribbonChip, bionic ? styles.ribbonChipActive : {}]}
            onPress={toggleBionic}
          >
            <Sparkles size={14} color={bionic ? COLORS.cyanDark : COLORS.textMuted} />
            <Text
              variant="caption"
              weight={bionic ? 'semibold' : 'normal'}
              color={bionic ? COLORS.cyanDark : COLORS.text}
              style={{ marginLeft: 4 }}
            >
              Bold word starts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Reading ruler, currently ${readingRuler ? 'on' : 'off'}`}
            activeOpacity={0.8}
            style={[styles.ribbonChip, readingRuler ? styles.ribbonChipActive : {}]}
            onPress={toggleReadingRuler}
          >
            <BookOpen
              size={14}
              color={readingRuler ? COLORS.cyanDark : COLORS.textMuted}
            />
            <Text
              variant="caption"
              weight={readingRuler ? 'semibold' : 'normal'}
              color={readingRuler ? COLORS.cyanDark : COLORS.text}
              style={{ marginLeft: 4 }}
            >
              Reading ruler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? 'Stop the sample' : 'Hear how the voice sounds'}
            activeOpacity={0.8}
            style={[styles.ribbonChip, isSpeaking ? styles.ribbonChipActive : {}]}
            onPress={handleToggleTtsSample}
          >
            {isSpeaking ? (
              <VolumeX size={14} color={COLORS.magenta} />
            ) : (
              <Volume2 size={14} color={COLORS.textMuted} />
            )}
            <Text
              variant="caption"
              weight={isSpeaking ? 'semibold' : 'normal'}
              color={isSpeaking ? COLORS.magenta : COLORS.text}
              style={{ marginLeft: 4 }}
            >
              {isSpeaking ? 'Stop' : 'Hear the voice'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Focus Session Pomodoro Widget */}
        <FocusTimerWidget />

        {/* Research Input Hero Box */}
        <Card elevated style={styles.heroResearchCard}>
          <Kicker color={COLORS.magenta}>One question in. One map out.</Kicker>
          <Heading variant="title" style={{ marginTop: 2, marginBottom: 4 }}>
            Understand it in one look.
          </Heading>
          <Text variant="bodySm" color={COLORS.textMuted} style={{ marginBottom: SPACING.md }}>
            Ask about anything in plain language. SETU researches it and lays it out as an
            interactive mind map you open one branch at a time.
          </Text>

          <Input
            placeholder="How does a transformer neural network work?"
            value={researchTopic}
            onChangeText={setResearchTopic}
            returnKeyType="search"
            onSubmitEditing={() => handleStartResearch()}
            trailingIcon={<VoiceInputButton onTranscript={handleVoiceTranscript} size={36} />}
          />

          <View style={styles.heroActionsRow}>
            <Button
              title="Draw map"
              variant="primary"
              size="md"
              icon={<Sparkles size={16} color={COLORS.textInverse} />}
              onPress={() => handleStartResearch()}
              accessibilityLabel="Draw map from research topic"
              style={{ flex: 1 }}
            />
            <Button
              title="Scan OCR"
              variant="secondary"
              size="md"
              icon={<Camera size={16} color={COLORS.text} />}
              onPress={() => navigation.navigate('CameraOCR')}
              accessibilityLabel="Scan document with OCR"
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Seven Cognitive Modes Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Kicker color={COLORS.cyan}>Cognitive Assistance</Kicker>
            <Subheading variant="titleSm">Seven Accessibility Tools</Subheading>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View all cognitive modes"
            onPress={() => navigation.navigate('ModesTab')}
            style={styles.viewAllRow}
          >
            <Text variant="caption" color={COLORS.cyan} weight="semibold">
              View all
            </Text>
            <ArrowRight size={14} color={COLORS.cyan} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modesScroll}
        >
          {MODES_PREVIEWS.map((mode) => {
            const IconComp = mode.icon;
            const tint = COLORS[mode.tintKey];
            return (
              <Card
                key={mode.key}
                plateColor={tint}
                elevated
                style={styles.modeCard}
                onPress={() =>
                  navigation.navigate('ModesTab', {
                    screen: 'ModesScreen',
                    params: { initialMode: mode.key },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${mode.name} mode: ${mode.tagline}`}
                accessibilityHint={`Opens ${mode.name} cognitive mode`}
              >
                <View style={[styles.modeIconCircle, { backgroundColor: COLORS.surfaceAlt }]}>
                  <IconComp size={20} color={tint} />
                </View>
                <Text variant="body" weight="bold" color={COLORS.text} style={{ marginTop: 6 }}>
                  {mode.name}
                </Text>
                <Text variant="caption" color={COLORS.textMuted} numberOfLines={2}>
                  {mode.tagline}
                </Text>
              </Card>
            );
          })}
        </ScrollView>

        {/* Tip of the day */}
        <Card style={styles.tipCard} elevated={false}>
          <View style={styles.tipHeader}>
            <Sparkles size={16} color={COLORS.yellowDark} />
            <Text variant="caption" weight="bold" color={COLORS.yellowDark} style={{ marginLeft: 6 }}>
              Something you might not have found
            </Text>
          </View>
          <Text variant="bodySm" color={COLORS.text} style={{ lineHeight: 20 }}>
            {getTipOfTheDay()}
          </Text>
        </Card>

        {/* Recent Mind Maps Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Kicker color={COLORS.cyan}>Your Library</Kicker>
            <Subheading variant="titleSm">Recent Researched Maps</Subheading>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View all items in your library"
            onPress={() => navigation.navigate('LibraryTab')}
            style={styles.viewAllRow}
          >
            <Text variant="caption" color={COLORS.cyan} weight="semibold">
              Library
            </Text>
            <ArrowRight size={14} color={COLORS.cyan} />
          </TouchableOpacity>
        </View>

        {recentMaps.length === 0 ? (
          <Card style={styles.emptyStateCard} elevated={false}>
            <Route size={32} color={COLORS.textMuted} style={{ marginBottom: SPACING.sm }} />
            <Text variant="body" weight="semibold" color={COLORS.text}>
              Your research maps will appear here
            </Text>
            <Text variant="bodySm" color={COLORS.textMuted} style={{ textAlign: 'center', marginTop: 4, marginBottom: SPACING.md }}>
              Start your first research session above to build your personal knowledge library.
            </Text>
            <Button
              title="Start Research"
              variant="secondary"
              icon={<Sparkles size={16} color={COLORS.text} />}
              onPress={() => handleStartResearch()}
              accessibilityLabel="Start your first research session"
            />
          </Card>
        ) : (
          <View style={styles.recentMapsStack}>
            {recentMaps.map((item, index) => (
              <Card
                key={item.id || item._id}
                elevated
                plateColor={PLATE_COLORS[index % PLATE_COLORS.length]}
                style={styles.recentMapCard}
                onPress={() =>
                  navigation.navigate('MindMapTab', {
                    screen: 'MindMapScreen',
                    params: { selectedMap: item },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Open map: ${item.topic}`}
                accessibilityHint="Opens the mind map for viewing"
              >
                <View style={styles.mapCardHeader}>
                  <Tag
                    label={item.sourceType === 'seed' ? 'Reference Library' : 'Researched Map'}
                    variant={item.sourceType === 'seed' ? 'neutral' : 'cyan'}
                  />
                  <Text variant="caption" color={COLORS.textSubtle}>
                    {item.createdAt ? formatRelativeDate(item.createdAt) : 'Recently'} · {item.totalTopics || 12} branches
                  </Text>
                </View>

                <Text variant="body" weight="bold" color={COLORS.text} style={{ marginTop: 4 }}>
                  {item.topic}
                </Text>
                <Text variant="caption" color={COLORS.textMuted} numberOfLines={2} style={{ marginTop: 2 }}>
                  {truncateText(item.summary, 80)}
                </Text>
              </Card>
            ))}
          </View>
        )}
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
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  accessibilityRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  ribbonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
    minHeight: 48,
  },
  ribbonChipActive: {
    backgroundColor: t.cyanLight,
    borderColor: t.cyanBorder,
  },
  heroResearchCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: t.cyan,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    minHeight: 48,
    paddingHorizontal: SPACING.sm,
  },
  modesScroll: {
    paddingRight: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  modeCard: {
    width: 140,
    minHeight: 120,
    padding: SPACING.md,
  },
  modeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    backgroundColor: t.yellowLight,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 0,
    borderLeftWidth: 4,
    borderLeftColor: t.yellow,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  recentMapsStack: {
    gap: SPACING.sm,
  },
  recentMapCard: {
    padding: SPACING.md,
    minHeight: 48,
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emptyStateCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: t.surface,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: t.divider,
  },
});
