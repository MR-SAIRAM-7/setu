/**
 * SETU Mobile — Seven Cognitive Accessibility Modes Screen
 * --------------------------------------------------------
 * 1. Start (Break task freeze & executive paralysis)
 * 2. Simplify (Plain language rewrite at Grade 6)
 * 3. Learn (Study notes, mind map & interactive self-quiz)
 * 4. Meet (Meeting rescue: actions, deadlines, decoded jargon)
 * 5. Practice (Rehearse difficult conversations across tones)
 * 6. Write (Accessible writing check & clarity fixes)
 * 7. Guide (Step-by-step workflow breakdown)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  PlayCircle,
  Waves,
  GraduationCap,
  Users,
  MessageCircle,
  PenTool,
  Route,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { BionicText } from '../components/BionicText';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { api } from '../services/api';
import { tts } from '../services/tts';
import { saveSummaryAndSync } from '../services/storage';
import {
  CognitiveModeKey,
  StartModeResult,
  SimplifyModeResult,
  LearnModeResult,
  MeetModeResult,
  PracticeModeResult,
  WriteModeResult,
  GuideModeResult,
} from '../types';
import { WORKED_EXAMPLES } from '../constants/seedExamples';

export const MODES_CONFIG = [
  {
    key: 'start' as CognitiveModeKey,
    name: 'Start',
    icon: PlayCircle,
    tint: COLORS.yellow,
    tagline: 'Break task freeze',
    blurb: 'Turns something you have been avoiding into one ten-minute action small enough to actually begin.',
    fieldLabel: 'What are you stuck on or putting off?',
    placeholder: 'e.g. writing my quarterly report or filing reimbursement…',
    rows: 3,
    workedExample: WORKED_EXAMPLES.start,
  },
  {
    key: 'simplify' as CognitiveModeKey,
    name: 'Simplify',
    icon: Waves,
    tint: COLORS.cyan,
    tagline: 'Plain language rewrite',
    blurb: 'Rewrites dense or legal text at a Grade 6 reading level without dropping a single fact.',
    fieldLabel: 'Paste the dense text, notice, or clause',
    placeholder: 'Paste government policies, legal clauses, or academic abstracts…',
    rows: 5,
    workedExample: WORKED_EXAMPLES.simplify,
  },
  {
    key: 'learn' as CognitiveModeKey,
    name: 'Learn',
    icon: GraduationCap,
    tint: COLORS.magenta,
    tagline: 'Study notes & self-quiz',
    blurb: 'A summary, a branching outline, and a self-quiz, built from whatever you paste in.',
    fieldLabel: 'Paste study notes, lecture content, or articles',
    placeholder: 'Paste lecture transcripts, textbook chapters, or reference material…',
    rows: 5,
    workedExample: WORKED_EXAMPLES.learn,
  },
  {
    key: 'meet' as CognitiveModeKey,
    name: 'Meet',
    icon: Users,
    tint: COLORS.cyan,
    tagline: 'Meeting rescue',
    blurb: 'Pulls the decisions, owners and deadlines out of a transcript, and decodes the jargon.',
    fieldLabel: 'Paste meeting transcript or raw notes',
    placeholder: 'Paste Zoom transcript, Slack discussion, or meeting notes…',
    rows: 5,
    workedExample: WORKED_EXAMPLES.meet,
  },
  {
    key: 'practice' as CognitiveModeKey,
    name: 'Practice',
    icon: MessageCircle,
    tint: COLORS.magenta,
    tagline: 'Rehearse it first',
    blurb: 'Scripts for a hard conversation in a few different tones before you have it for real.',
    fieldLabel: 'What conversation do you need to prepare for?',
    placeholder: 'e.g. asking my team lead for an extra two days on a sprint task…',
    rows: 3,
    workedExample: WORKED_EXAMPLES.practice,
  },
  {
    key: 'write' as CognitiveModeKey,
    name: 'Write',
    icon: PenTool,
    tint: COLORS.yellow,
    tagline: 'Accessible writing check',
    blurb: 'Checks your draft for reading level, passive voice, and sentences that lose people.',
    fieldLabel: 'Paste your draft text or message',
    placeholder: 'Paste your email draft, documentation section, or announcement…',
    rows: 5,
    workedExample: WORKED_EXAMPLES.write,
  },
  {
    key: 'guide' as CognitiveModeKey,
    name: 'Guide',
    icon: Route,
    tint: COLORS.ink,
    tagline: 'Step-by-step workflow',
    blurb: 'Turns any workflow into numbered steps, each with a clear signal that it worked.',
    fieldLabel: 'What process or goal do you need broken down?',
    placeholder: 'e.g. submitting an expense report, setting up SSH keys, or appealing a ticket…',
    rows: 3,
    workedExample: WORKED_EXAMPLES.guide,
  },
];

export const ModesScreen: React.FC<{ route?: any; navigation?: any }> = ({
  route,
  navigation,
}) => {
  const [selectedModeKey, setSelectedModeKey] = useState<CognitiveModeKey>(
    route?.params?.initialMode || 'start'
  );
  const [inputText, setInputText] = useState(route?.params?.initialInput || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, number>>({});
  const [isSpeakingResult, setIsSpeakingResult] = useState(false);

  const activeMode = MODES_CONFIG.find((m) => m.key === selectedModeKey) || MODES_CONFIG[0];

  useEffect(() => {
    if (route?.params?.initialMode) {
      setSelectedModeKey(route.params.initialMode);
    }
    if (route?.params?.initialInput) {
      setInputText(route.params.initialInput);
    }
  }, [route?.params]);

  useEffect(() => {
    // When switching mode, display worked example by default if no user result
    setResult(activeMode.workedExample);
    setSelectedQuizAnswers({});
    if (!route?.params?.initialInput) {
      setInputText('');
    }
  }, [selectedModeKey]);

  const handleRunMode = async () => {
    const text = inputText.trim();
    if (!text) {
      setResult(activeMode.workedExample);
      return;
    }

    setIsLoading(true);
    try {
      let res: any;
      switch (selectedModeKey) {
        case 'start':
          res = await api.start(text);
          break;
        case 'simplify':
          res = await api.simplify(text);
          break;
        case 'learn':
          res = await api.learn(text);
          break;
        case 'meet':
          res = await api.meet(text);
          break;
        case 'practice':
          res = await api.practice(text);
          break;
        case 'write':
          res = await api.write(text);
          break;
        case 'guide':
          res = await api.guide(text);
          break;
      }
      const finalResult = res || activeMode.workedExample;
      setResult(finalResult);

      // Persist to local storage and sync to MongoDB
      try {
        saveSummaryAndSync({
          id: `sum_${Date.now()}`,
          modeKey: selectedModeKey,
          modeName: activeMode.name,
          input: text,
          result: finalResult,
          createdAt: new Date().toISOString(),
        });
      } catch (_) {}
    } catch (err) {
      setResult(activeMode.workedExample);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSpeakResult = () => {
    if (isSpeakingResult) {
      tts.stop();
      setIsSpeakingResult(false);
      return;
    }

    let speechText = '';
    if (selectedModeKey === 'start') {
      speechText = `${result.supportiveMessage}. Next 10 minute action: ${result.immediateTenMinuteAction}`;
    } else if (selectedModeKey === 'simplify') {
      speechText = `${result.plainLanguageRewrite}`;
    } else if (selectedModeKey === 'learn') {
      speechText = `${result.summary}`;
    } else if (selectedModeKey === 'meet') {
      speechText = `${result.summary}`;
    } else if (selectedModeKey === 'practice') {
      speechText = `${result.openingLine}. ${result.suggestedResponses?.[0]?.text || ''}`;
    } else if (selectedModeKey === 'write') {
      speechText = `${result.improvedText}`;
    } else if (selectedModeKey === 'guide') {
      speechText = `Workflow: ${result.workflowName}. Step 1: ${result.steps?.[0]?.title}. ${result.steps?.[0]?.actionRequired}`;
    }

    if (speechText) {
      setIsSpeakingResult(true);
      tts.speak(speechText, {
        onDone: () => setIsSpeakingResult(false),
        onError: () => setIsSpeakingResult(false),
      });
    }
  };

  const handleSelectQuizOption = (qIdx: number, oIdx: number) => {
    setSelectedQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Horizontal Mode Selection Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeTabsStrip}
        >
          {MODES_CONFIG.map((mode) => {
            const isSelected = mode.key === selectedModeKey;
            const IconComp = mode.icon;
            return (
              <TouchableOpacity
                key={mode.key}
                activeOpacity={0.8}
                style={[
                  styles.modeTabButton,
                  isSelected ? styles.modeTabButtonActive : {},
                ]}
                onPress={() => setSelectedModeKey(mode.key)}
              >
                <IconComp
                  size={16}
                  color={isSelected ? mode.tint : COLORS.textMuted}
                />
                <Text
                  variant="bodySm"
                  weight={isSelected ? 'bold' : 'normal'}
                  color={isSelected ? COLORS.text : COLORS.textMuted}
                  style={{ marginLeft: 6 }}
                >
                  {mode.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Mode Header */}
          <View style={styles.modeHeaderBox}>
            <View style={styles.modeTitleRow}>
              <Tag label={activeMode.tagline} variant="cyan" />
              <TouchableOpacity
                style={styles.ttsBtn}
                onPress={handleToggleSpeakResult}
              >
                {isSpeakingResult ? (
                  <VolumeX size={16} color={COLORS.magenta} />
                ) : (
                  <Volume2 size={16} color={COLORS.cyan} />
                )}
                <Text
                  variant="caption"
                  color={isSpeakingResult ? COLORS.magenta : COLORS.cyan}
                  weight="semibold"
                  style={{ marginLeft: 4 }}
                >
                  {isSpeakingResult ? 'Stop Audio' : 'Read Aloud'}
                </Text>
              </TouchableOpacity>
            </View>

            <Heading variant="title" style={{ marginTop: 6, marginBottom: 2 }}>
              {activeMode.name}
            </Heading>
            <Text variant="bodySm" color={COLORS.textMuted}>
              {activeMode.blurb}
            </Text>
          </View>

          {/* Mode Input Field */}
          <Card elevated style={styles.inputCard}>
            <Input
              label={activeMode.fieldLabel}
              placeholder={activeMode.placeholder}
              value={inputText}
              onChangeText={setInputText}
              multiline
              numberOfLines={activeMode.rows}
              trailingIcon={
                <VoiceInputButton
                  onTranscript={(text) => setInputText(text)}
                  size={32}
                />
              }
            />

            <View style={styles.actionButtonsRow}>
              <Button
                title={`Run ${activeMode.name}`}
                variant="primary"
                size="md"
                loading={isLoading}
                icon={<Sparkles size={16} color={COLORS.textInverse} />}
                onPress={handleRunMode}
                style={{ flex: 1 }}
              />
              <Button
                title="Worked example"
                variant="secondary"
                size="md"
                onPress={() => {
                  setInputText('');
                  setResult(activeMode.workedExample);
                }}
              />
            </View>
          </Card>

          {/* RESULT CONTAINER */}
          {result && (
            <View style={styles.resultSection}>
              <Kicker color={activeMode.tint} style={{ marginBottom: 4 }}>
                Last Result · {activeMode.name} Mode
              </Kicker>

              {/* 1. START RESULT */}
              {selectedModeKey === 'start' && (
                <Card plateColor={COLORS.yellow} elevated style={styles.resultCard}>
                  <Text variant="body" weight="medium" style={{ marginBottom: SPACING.md }}>
                    {result.supportiveMessage}
                  </Text>

                  <View style={styles.actionHighlightBox}>
                    <Kicker color={COLORS.yellowDark}>Next 10-Minute Physical Step</Kicker>
                    <BionicText
                      text={result.immediateTenMinuteAction}
                      variant="bodyLg"
                      style={{ fontWeight: 'bold', marginTop: 2 }}
                    />
                  </View>

                  <Text variant="bodySm" weight="bold" style={{ marginTop: SPACING.md, marginBottom: SPACING.xs }}>
                    Micro-Steps Breakdown:
                  </Text>
                  {result.microSteps?.map((step: string, idx: number) => (
                    <View key={`step-${idx}`} style={styles.microStepRow}>
                      <CheckCircle2 size={16} color={COLORS.success} style={{ marginTop: 2 }} />
                      <Text variant="bodySm" style={{ marginLeft: 8, flex: 1 }}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* 2. SIMPLIFY RESULT */}
              {selectedModeKey === 'simplify' && (
                <Card plateColor={COLORS.cyan} elevated style={styles.resultCard}>
                  <Tag label={result.readabilityGrade} variant="cyan" />
                  <View style={styles.plainRewriteBox}>
                    <BionicText
                      text={result.plainLanguageRewrite}
                      variant="bodyLg"
                      color={COLORS.text}
                    />
                  </View>

                  <Text variant="bodySm" weight="bold" style={{ marginTop: SPACING.md, marginBottom: SPACING.xs }}>
                    Key Takeaways:
                  </Text>
                  {result.keyTakeaways?.map((item: string, idx: number) => (
                    <View key={`takeaway-${idx}`} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text variant="bodySm" style={{ flex: 1 }}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* 3. LEARN RESULT */}
              {selectedModeKey === 'learn' && (
                <Card plateColor={COLORS.magenta} elevated style={styles.resultCard}>
                  <Text variant="bodySm" weight="bold" color={COLORS.magenta}>
                    Study Summary:
                  </Text>
                  <BionicText text={result.summary} variant="body" style={{ marginVertical: SPACING.xs }} />

                  {/* Interactive Self-Quiz */}
                  <Text variant="bodySm" weight="bold" style={{ marginTop: SPACING.md, marginBottom: SPACING.xs }}>
                    Interactive Knowledge Quiz:
                  </Text>
                  {result.quiz?.map((q: any, qIdx: number) => {
                    const answered = selectedQuizAnswers[qIdx] !== undefined;
                    const selectedOpt = selectedQuizAnswers[qIdx];
                    return (
                      <View key={`quiz-${qIdx}`} style={styles.quizBlock}>
                        <Text variant="bodySm" weight="bold">
                          {qIdx + 1}. {q.question}
                        </Text>
                        {q.options?.map((opt: string, oIdx: number) => {
                          const isPicked = selectedOpt === oIdx;
                          const isCorrect = oIdx === q.answerIndex;
                          return (
                            <TouchableOpacity
                              key={`opt-${oIdx}`}
                              activeOpacity={0.8}
                              style={[
                                styles.quizOption,
                                isPicked
                                  ? isCorrect
                                    ? styles.quizCorrect
                                    : styles.quizIncorrect
                                  : {},
                              ]}
                              onPress={() => handleSelectQuizOption(qIdx, oIdx)}
                            >
                              <Text
                                variant="caption"
                                weight={isPicked ? 'bold' : 'normal'}
                                color={
                                  isPicked
                                    ? isCorrect
                                      ? COLORS.success
                                      : COLORS.magenta
                                    : COLORS.text
                                }
                              >
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        {answered && (
                          <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: 4 }}>
                            Explanation: {q.explanation}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </Card>
              )}

              {/* 4. MEET RESULT */}
              {selectedModeKey === 'meet' && (
                <Card plateColor={COLORS.cyan} elevated style={styles.resultCard}>
                  <Text variant="body" weight="medium" style={{ marginBottom: SPACING.md }}>
                    {result.summary}
                  </Text>

                  <Text variant="bodySm" weight="bold" style={{ marginBottom: SPACING.xs }}>
                    Action Items & Deadlines:
                  </Text>
                  {result.actionItems?.map((item: any, idx: number) => (
                    <View key={`action-${idx}`} style={styles.actionItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySm" weight="bold">
                          {item.task}
                        </Text>
                        <Text variant="caption" color={COLORS.textMuted}>
                          Owner: {item.owner} · Deadline: {item.deadline}
                        </Text>
                      </View>
                      <Tag
                        label={item.priority}
                        variant={item.priority === 'High' ? 'magenta' : 'neutral'}
                      />
                    </View>
                  ))}
                </Card>
              )}

              {/* 5. PRACTICE RESULT */}
              {selectedModeKey === 'practice' && (
                <Card plateColor={COLORS.magenta} elevated style={styles.resultCard}>
                  <Kicker color={COLORS.magenta}>Scenario Context</Kicker>
                  <Text variant="bodySm" color={COLORS.textMuted} style={{ marginBottom: SPACING.md }}>
                    {result.scenarioContext}
                  </Text>

                  <Text variant="bodySm" weight="bold" style={{ marginBottom: SPACING.xs }}>
                    Suggested Scripts:
                  </Text>
                  {result.suggestedResponses?.map((resp: any, idx: number) => (
                    <View key={`resp-${idx}`} style={styles.scriptBox}>
                      <Tag label={resp.tone} variant="magenta" />
                      <BionicText
                        text={resp.text}
                        variant="body"
                        style={{ marginTop: 6 }}
                      />
                    </View>
                  ))}
                </Card>
              )}

              {/* 6. WRITE RESULT */}
              {selectedModeKey === 'write' && (
                <Card plateColor={COLORS.yellow} elevated style={styles.resultCard}>
                  <Tag label={result.originalGradeLevel} variant="yellow" />
                  <View style={styles.plainRewriteBox}>
                    <BionicText text={result.improvedText} variant="bodyLg" />
                  </View>

                  <Text variant="bodySm" weight="bold" style={{ marginTop: SPACING.md, marginBottom: SPACING.xs }}>
                    Clarity Fixes:
                  </Text>
                  {result.clarityFixes?.map((fix: any, idx: number) => (
                    <View key={`fix-${idx}`} style={styles.clarityBox}>
                      <Text variant="caption" color={COLORS.magenta} style={{ textDecorationLine: 'line-through' }}>
                        {fix.originalSnippet}
                      </Text>
                      <Text variant="bodySm" weight="bold" color={COLORS.success} style={{ marginTop: 2 }}>
                        {fix.suggestedSnippet}
                      </Text>
                      <Text variant="caption" color={COLORS.textMuted} style={{ marginTop: 2 }}>
                        Reason: {fix.reason}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* 7. GUIDE RESULT */}
              {selectedModeKey === 'guide' && (
                <Card plateColor={COLORS.ink} elevated style={styles.resultCard}>
                  <Text variant="titleSm" weight="bold" style={{ marginBottom: SPACING.md }}>
                    {result.workflowName} ({result.totalSteps} Steps)
                  </Text>

                  {result.steps?.map((step: any, idx: number) => (
                    <View key={`guide-step-${idx}`} style={styles.guideStepBox}>
                      <View style={styles.stepNumCircle}>
                        <Text variant="bodySm" weight="bold" color={COLORS.textInverse}>
                          {step.stepNumber}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text variant="bodySm" weight="bold">
                          {step.title}
                        </Text>
                        <Text variant="bodySm" style={{ marginVertical: 2 }}>
                          {step.actionRequired}
                        </Text>
                        <Text variant="caption" color={COLORS.cyanDark}>
                          Signal: {step.tip}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  modeTabsStrip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.dividerSubtle,
  },
  modeTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  modeTabButtonActive: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.cyan,
  },
  scrollBody: {
    padding: SPACING.md,
    paddingBottom: SPACING.huge,
  },
  modeHeaderBox: {
    marginBottom: SPACING.md,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  inputCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  resultSection: {
    marginTop: SPACING.xs,
  },
  resultCard: {
    padding: SPACING.lg,
  },
  actionHighlightBox: {
    backgroundColor: COLORS.yellowLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.yellow,
  },
  microStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  plainRewriteBox: {
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cyan,
    marginTop: 6,
    marginRight: 8,
  },
  quizBlock: {
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  quizOption: {
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  quizCorrect: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  quizIncorrect: {
    backgroundColor: COLORS.magentaLight,
    borderColor: COLORS.magenta,
  },
  actionItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  scriptBox: {
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  clarityBox: {
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  guideStepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
