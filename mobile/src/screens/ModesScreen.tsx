/**
 * SETU Mobile — the cognitive modes.
 *
 *  1. Start     break task freeze and executive paralysis
 *  2. Simplify  plain-language rewrite at roughly Grade 6
 *  3. Learn     study notes, outline, and a self-quiz
 *  4. Meet      meeting rescue: actions, owners, deadlines, decoded jargon
 *  5. Practice  rehearse a hard conversation in several tones
 *  6. Write     accessible writing check and clarity fixes
 *  7. Guide     any process, broken into numbered steps
 *  8. Numbers   arithmetic explained with countable objects, for dyscalculia
 *
 * Every mode opens on a worked example rather than an empty field. A blank
 * screen with a prompt is its own small executive barrier, and the example
 * doubles as the explanation of what the mode actually does.
 *
 * Mode tints are resolved from the live palette at render rather than baked
 * into the config, because process yellow on newsprint and process yellow on a
 * near-black ground are not the same colour.
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
  Calculator,
  Copy,
  Share2,
  Info,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { BionicText } from '../components/BionicText';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { NumberStory } from '../components/NumberStory';
import { api } from '../services/api';
import { tts } from '../services/tts';
import { saveSummaryAndSync } from '../services/storage';
import { award } from '../services/progress';
import { copyToClipboard, modeResultToMarkdown, shareText } from '../services/exportUtils';
import {
  CognitiveModeKey,
  StartModeResult,
  SimplifyModeResult,
  LearnModeResult,
  MeetModeResult,
  PracticeModeResult,
  WriteModeResult,
  GuideModeResult,
  NumbersModeResult,
} from '../types';
import { WORKED_EXAMPLES } from '../constants/seedExamples';

/** Which plate a mode is inked in. Resolved against the live palette at render. */
export type PlateKey = 'cyan' | 'magenta' | 'yellow' | 'ink';

export const MODES_CONFIG = [
  {
    key: 'start' as CognitiveModeKey,
    name: 'Start',
    icon: PlayCircle,
    tintKey: 'yellow' as PlateKey,
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
    tintKey: 'cyan' as PlateKey,
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
    tintKey: 'magenta' as PlateKey,
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
    tintKey: 'cyan' as PlateKey,
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
    tintKey: 'magenta' as PlateKey,
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
    tintKey: 'yellow' as PlateKey,
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
    tintKey: 'ink' as PlateKey,
    tagline: 'Step-by-step workflow',
    blurb: 'Turns any workflow into numbered steps, each with a clear signal that it worked.',
    fieldLabel: 'What process or goal do you need broken down?',
    placeholder: 'e.g. submitting an expense report, setting up SSH keys, or appealing a ticket…',
    rows: 3,
    workedExample: WORKED_EXAMPLES.guide,
  },
  {
    key: 'numbers' as CognitiveModeKey,
    name: 'Numbers',
    icon: Calculator,
    tintKey: 'magenta' as PlateKey,
    tagline: 'Sums with objects',
    blurb:
      'Works a sum through as a short story with countable things on a table, one step at a time, instead of notation.',
    fieldLabel: 'What sum or number problem is in the way?',
    placeholder: 'e.g. splitting a 2,400 rupee bill four ways, or 15% off 899…',
    rows: 3,
    workedExample: WORKED_EXAMPLES.numbers,
  },
];

export const ModesScreen: React.FC<{ route?: any; navigation?: any }> = ({
  route,
  navigation,
}) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [selectedModeKey, setSelectedModeKey] = useState<CognitiveModeKey>(
    route?.params?.initialMode || 'start'
  );
  const [inputText, setInputText] = useState(route?.params?.initialInput || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, number>>({});
  const [isSpeakingResult, setIsSpeakingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUserResult, setIsUserResult] = useState(false);

  const activeMode = MODES_CONFIG.find((m) => m.key === selectedModeKey) || MODES_CONFIG[0];
  const tint = COLORS[activeMode.tintKey];

  useEffect(() => {
    if (route?.params?.initialMode) {
      setSelectedModeKey(route.params.initialMode);
    }
    if (route?.params?.initialInput) {
      setInputText(route.params.initialInput);
    }
  }, [route?.params]);

  useEffect(() => {
    // Switching mode opens on the worked example. An empty result panel is its
    // own small barrier, and the example doubles as the explanation.
    tts.stop();
    setIsSpeakingResult(false);
    setResult(activeMode.workedExample);
    setIsUserResult(false);
    setSelectedQuizAnswers({});
    setError(null);
    if (!route?.params?.initialInput) {
      setInputText('');
    }
  }, [selectedModeKey]);

  useEffect(
    () => () => {
      tts.stop();
    },
    []
  );

  const handleRunMode = async () => {
    const text = inputText.trim();
    if (!text) {
      setResult(activeMode.workedExample);
      return;
    }

    setIsLoading(true);
    setError(null);
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
        case 'numbers':
          res = await api.numbers(text);
          break;
      }

      if (!res) throw new Error('The engine returned nothing for that.');

      setResult(res);
      setIsUserResult(true);
      setSelectedQuizAnswers({});
      award('modeRun');

      saveSummaryAndSync({
        id: `sum_${Date.now()}`,
        modeKey: selectedModeKey,
        modeName: activeMode.name,
        input: text,
        result: res,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    } catch (err: any) {
      // Falling back to the worked example silently was the old behaviour, and
      // it is worse than useless here: the user reads somebody else's answer as
      // if it were theirs. Say what happened and keep what they typed.
      setError(
        err?.message ||
          'Could not reach the engine. What you typed is still here — try again in a moment.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resultMarkdown = () => modeResultToMarkdown(selectedModeKey, result, inputText);

  const handleCopy = async () => {
    const ok = await copyToClipboard(resultMarkdown());
    if (!ok) setError('Could not copy that to the clipboard.');
  };

  const handleShare = async () => {
    await shareText(resultMarkdown(), `SETU ${activeMode.name}`, 'md');
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
    } else if (selectedModeKey === 'numbers') {
      speechText = `${result.plainQuestion}. ${result.story}. The answer is ${result.answer}.`;
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
    // Only the first answer to a question counts, and only a correct one pays —
    // otherwise tapping every option in turn farms points and the number stops
    // meaning anything.
    const alreadyAnswered = selectedQuizAnswers[qIdx] !== undefined;
    setSelectedQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));

    if (!alreadyAnswered && result?.quiz?.[qIdx]?.answerIndex === oIdx) {
      award('quizCorrect');
    }
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
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${mode.name} — ${mode.tagline}`}
                style={[
                  styles.modeTabButton,
                  isSelected ? styles.modeTabButtonActive : {},
                ]}
                onPress={() => setSelectedModeKey(mode.key)}
              >
                <IconComp
                  size={16}
                  color={isSelected ? COLORS[mode.tintKey] : COLORS.textMuted}
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
                  setError(null);
                  setResult(activeMode.workedExample);
                  setIsUserResult(false);
                  setSelectedQuizAnswers({});
                }}
              />
            </View>

            {error ? (
              <Text variant="bodySm" color={COLORS.magenta} style={{ marginTop: SPACING.sm }}>
                {error}
              </Text>
            ) : null}
          </Card>

          {/* RESULT CONTAINER */}
          {result && (
            <View style={styles.resultSection}>
              {isUserResult && result?.fallback ? (
                <View style={styles.fallbackNotice}>
                  <Info size={14} color={COLORS.yellowDark} />
                  <Text
                    variant="caption"
                    color={COLORS.text}
                    style={{ flex: 1, marginLeft: SPACING.sm }}
                  >
                    {result.languageFallback
                      ? 'The AI engine was unavailable, so this came from the built-in offline engine — which only writes English. It is rougher than usual, and not in the language you chose.'
                      : 'The AI engine was unavailable, so this came from the built-in offline engine. It is rougher than usual — worth running again in a few minutes.'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.resultHeader}>
                <Kicker color={tint}>
                  {isUserResult ? `Your ${activeMode.name} result` : `${activeMode.name} — worked example`}
                </Kicker>

                <View style={styles.exportRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Copy this result"
                    onPress={handleCopy}
                    style={styles.exportButton}
                  >
                    <Copy size={14} color={COLORS.cyan} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Share this result"
                    onPress={handleShare}
                    style={styles.exportButton}
                  >
                    <Share2 size={14} color={COLORS.cyan} />
                  </TouchableOpacity>
                </View>
              </View>

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

              {/* 8. NUMBERS RESULT — the objects are the explanation */}
              {selectedModeKey === 'numbers' && (
                <NumberStory
                  data={result as NumbersModeResult}
                  onSolved={() => award('numbersSolved')}
                />
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.bg,
  },
  container: {
    flex: 1,
  },
  modeTabsStrip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.dividerSubtle,
  },
  modeTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  modeTabButtonActive: {
    backgroundColor: t.bg,
    borderColor: t.cyan,
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
    backgroundColor: t.surface,
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
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: t.yellowLight,
    borderWidth: 1,
    borderColor: t.yellow,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exportRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  exportButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.divider,
  },
  resultCard: {
    padding: SPACING.lg,
  },
  actionHighlightBox: {
    backgroundColor: t.yellowLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: t.yellow,
  },
  microStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  plainRewriteBox: {
    backgroundColor: t.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
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
    backgroundColor: t.cyan,
    marginTop: 6,
    marginRight: 8,
  },
  quizBlock: {
    backgroundColor: t.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  quizOption: {
    padding: SPACING.sm,
    backgroundColor: t.surface,
    borderRadius: RADIUS.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  quizCorrect: {
    backgroundColor: t.successLight,
    borderColor: t.success,
  },
  quizIncorrect: {
    backgroundColor: t.magentaLight,
    borderColor: t.magenta,
  },
  actionItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    backgroundColor: t.bg,
    borderRadius: RADIUS.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  scriptBox: {
    backgroundColor: t.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  clarityBox: {
    backgroundColor: t.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  guideStepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: t.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
