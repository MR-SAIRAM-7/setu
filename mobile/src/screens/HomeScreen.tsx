/**
 * SETU Mobile — Sanctuary Home Dashboard Screen
 * ---------------------------------------------
 * Central launchpad for cognitive accessibility:
 * - Engine status & focus session timer
 * - Instant research prompt with voice input
 * - Camera OCR document scanner
 * - 7 Cognitive Mode quick cards
 * - Recent mind maps library
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
  Info,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, PLATE_COLORS } from '../constants/theme';
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
import { formatRelativeDate, truncateText } from '../utils/formatters';

export interface HomeScreenProps {
  navigation: any;
}

const MODES_PREVIEWS: {
  key: CognitiveModeKey;
  name: string;
  tagline: string;
  tint: string;
  icon: any;
}[] = [
  {
    key: 'start',
    name: 'Start',
    tagline: 'Break task freeze',
    tint: COLORS.yellow,
    icon: PlayCircle,
  },
  {
    key: 'simplify',
    name: 'Simplify',
    tagline: 'Plain language rewrite',
    tint: COLORS.cyan,
    icon: Waves,
  },
  {
    key: 'learn',
    name: 'Learn',
    tagline: 'Study notes & self-quiz',
    tint: COLORS.magenta,
    icon: GraduationCap,
  },
  {
    key: 'meet',
    name: 'Meet',
    tagline: 'Decisions & action items',
    tint: COLORS.cyan,
    icon: Users,
  },
  {
    key: 'practice',
    name: 'Practice',
    tagline: 'Rehearse conversations',
    tint: COLORS.magenta,
    icon: MessageCircle,
  },
  {
    key: 'write',
    name: 'Write',
    tagline: 'Accessible writing check',
    tint: COLORS.yellow,
    icon: PenTool,
  },
  {
    key: 'guide',
    name: 'Guide',
    tagline: 'Step-by-step workflow',
    tint: COLORS.ink,
    icon: Route,
  },
];

const TIPS = [
  "Bionic Reading bolds the first half of every word to guide your eye.",
  "The 25-minute focus session follows the Pomodoro technique — built for ADHD working memory.",
  "Use the Reading Ruler to isolate one line at a time.",
  "Voice input lets you ask questions without typing.",
  "Every mode has a worked example. Tap any card to see it in action."
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { bionic, readingRuler, toggleBionic, toggleReadingRuler } = useAccessibility();
  const { totalSessionsCompleted } = useFocus();
  const [researchTopic, setResearchTopic] = useState('');
  const [recentMaps, setRecentMaps] = useState<MindMapDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

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
      tts.speak(
        'Welcome to SETU Sanctuary. A bridge between dense digital worlds and the neurodivergent mind.',
        {
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        }
      );
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
          <View style={styles.statBlock} accessible={true} accessibilityRole="text" accessibilityLabel="7 Cognitive modes">
            <Text variant="titleSm" weight="bold" color={COLORS.text}>7</Text>
            <Text variant="caption" color={COLORS.textMuted}>Cognitive modes</Text>
          </View>
          <View style={styles.statBlock} accessible={true} accessibilityRole="text" accessibilityLabel="0 bytes uploaded">
            <Text variant="titleSm" weight="bold" color={COLORS.text}>0</Text>
            <Text variant="caption" color={COLORS.textMuted}>Bytes uploaded</Text>
          </View>
        </View>

        {/* Quick Accessibility Toggles Ribbon */}
        <View style={styles.accessibilityRibbon}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Toggle Bionic Reading, currently ${bionic ? 'ON' : 'OFF'}`}
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
              Bionic Reading {bionic ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Toggle Reading Ruler, currently ${readingRuler ? 'ON' : 'OFF'}`}
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
              Reading Ruler {readingRuler ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? 'Stop TTS Audio' : 'Play TTS Audio sample'}
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
              {isSpeaking ? 'Stop TTS' : 'TTS Audio'}
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
            return (
              <Card
                key={mode.key}
                plateColor={mode.tint}
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
                <View style={[styles.modeIconCircle, { backgroundColor: `${mode.tint}20` }]}>
                  <IconComp size={20} color={mode.tint} />
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
            <Info size={16} color={COLORS.yellowDark} />
            <Text variant="caption" weight="bold" color={COLORS.yellowDark} style={{ marginLeft: 6 }}>
              Tip of the Day
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
    minHeight: 48,
  },
  ribbonChipActive: {
    backgroundColor: COLORS.cyanLight,
    borderColor: COLORS.cyanBorder,
  },
  heroResearchCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.cyan,
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
    backgroundColor: COLORS.yellowLight,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 0,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.yellow,
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
    backgroundColor: COLORS.surface,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
});
