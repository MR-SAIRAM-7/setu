/**
 * SETU Mobile — mind map research and explorer.
 *
 * Turns a question into a branching map, then lets the reader go deeper on any
 * branch or ask about it in words.
 *
 * Tapping a branch reads it aloud. That is not a convenience feature: the
 * clinical guidance for this project was explicit that diagrams only work for
 * this audience when paired with audio on interaction. A map made of silent text
 * is, for a reader whose difficulty is decoding rather than eyesight, just a
 * differently-shaped wall of words.
 *
 * The chat turn is streamed rather than awaited whole. A research answer takes
 * tens of seconds end to end, and watching a spinner for that long is exactly
 * the wait an ADHD reader will not sit through.
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
  Share2,
  Volume2,
  Send,
  MessageSquare,
  Network,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text, Heading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { MindMapCanvas } from '../components/MindMapCanvas';
import { NodeDetailSheet } from '../components/NodeDetailSheet';
import { StagedLoader } from '../components/StagedLoader';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { SEED_MIND_MAPS } from '../services/seedData';
import { api, streamChat } from '../services/api';
import { saveMindMap } from '../services/storage';
import { tts } from '../services/tts';
import { award } from '../services/progress';
import { useAccessibility } from '../context/AccessibilityContext';
import { copyToClipboard, mapToMarkdown, mapToOutline, shareText } from '../services/exportUtils';
import { MindMapDocument, MindMapNode, PlacedNode, ChatMessage } from '../types';
import * as Haptics from 'expo-haptics';

export interface MindMapScreenProps {
  route?: any;
  navigation?: any;
}

export const MindMapScreen: React.FC<MindMapScreenProps> = ({ route, navigation }) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const initialMap = route?.params?.selectedMap || SEED_MIND_MAPS[0];
  const initialTopic = route?.params?.initialTopic || '';

  const [currentMap, setCurrentMap] = useState<MindMapDocument>(initialMap);
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<PlacedNode | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isExpandingNode, setIsExpandingNode] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas');

  // Conversational Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm_welcome',
      role: 'assistant',
      content: `I’ve mapped "${currentMap.topic}". Tap any branch to read key facts or ask follow-up questions.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  const { speakOnTap } = useAccessibility();

  useEffect(
    () => () => {
      tts.stop();
    },
    []
  );

  useEffect(() => {
    if (route?.params?.selectedMap) {
      setCurrentMap(route.params.selectedMap);
      setCollapsedIds(new Set());
    } else if (route?.params?.initialTopic) {
      handlePerformResearch(route.params.initialTopic);
    }
  }, [route?.params]);

  const handlePerformResearch = async (queryTopic?: string) => {
    const topic = (queryTopic || topicInput).trim();
    if (!topic) return;

    setIsLoading(true);
    setSelectedNode(null);
    setResearchError(null);
    setCollapsedIds(new Set());

    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const result = await api.mindMap(topic);

      // The engine returns the saved record itself, so the tree is on `root`.
      // An older build read `result.map` here, which is always undefined and
      // produced a document with nothing to draw.
      const newDoc: MindMapDocument = {
        id: `map_${Date.now()}`,
        topic,
        summary: result.summary || `Researched overview of ${topic}`,
        root: result.root,
        totalTopics: result.totalTopics || 10,
        sourceType: 'query',
        createdAt: new Date().toISOString(),
      };

      setCurrentMap(newDoc);
      award('mapCreated');
      await saveMindMap(newDoc);
      try {
        api.saveMindMapToDb(newDoc);
      } catch (_) {}

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'assistant',
          content: `Here is the interactive mind map for "${topic}". ${result.summary}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error: any) {
      // No invented map. A generic "Fundamentals / Real-world Application" tree
      // looks like a researched answer and is not one, and a reader who cannot
      // easily evaluate text is exactly the reader who will take it as read.
      // Whatever map was already open stays open, which is more useful than a
      // blank screen anyway.
      setResearchError(
        error?.message ||
          'Could not research that topic just now. The map already open is still yours to explore.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Read a branch aloud when it is opened.
   *
   * Label then detail, in that order, because the label is the thing being
   * located and the detail is what it means. Marked `quiet` so it does not fire
   * a haptic — the tap already gave one.
   */
  const speakNode = (node: PlacedNode) => {
    if (!speakOnTap) return;
    const spoken = [node.label, node.detail].filter(Boolean).join('. ');
    if (spoken) tts.speak(spoken, { quiet: true });
  };

  const handleSelectNode = (node: PlacedNode) => {
    setSelectedNode(node);
    speakNode(node);
  };

  const handleToggleCollapse = (nodeId: string) => {
    tts.stop();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleExpandDeeper = async (node: PlacedNode) => {
    setIsExpandingNode(true);
    try {
      const result = await api.expandNode(currentMap.topic, node.label, node.detail);
      if (result.children && result.children.length > 0) {
        // Attach children to tree
        const addChildrenRecursive = (curr: MindMapNode): MindMapNode => {
          if (curr.id === node.id) {
            return {
              ...curr,
              children: [...(curr.children || []), ...result.children],
            };
          }
          return {
            ...curr,
            children: curr.children ? curr.children.map(addChildrenRecursive) : [],
          };
        };

        const updatedRoot = addChildrenRecursive(currentMap.root);
        const updatedDoc = {
          ...currentMap,
          root: updatedRoot,
          totalTopics: (currentMap.totalTopics || 8) + result.children.length,
        };
        setCurrentMap(updatedDoc);
        award('branchExpanded');
        await saveMindMap(updatedDoc);
      }
    } catch (error: any) {
      // A placeholder branch labelled "<topic> Deep Dive" is not an expansion,
      // it is a lie shaped like one — and it would be saved into the map and
      // exported alongside real research. Say the request failed instead.
      setResearchError(
        error?.message ||
          'Could not go deeper on that branch right now. Nothing was changed on the map.'
      );
    } finally {
      setIsExpandingNode(false);
      setSelectedNode(null);
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsSendingChat(true);

    const replyId = `a_${Date.now()}`;
    let received = false;

    try {
      await streamChat(
        {
          topic: currentMap.topic,
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
        {
          // The status frames name the stage the engine is at. Showing them is
          // the difference between "it is working" and "it has hung".
          onStatus: (data) => setStreamStatus(data?.message || null),

          onReply: (data) => {
            const chunk = String(data?.text || '');
            if (!chunk) return;
            received = true;
            setStreamStatus(null);

            setMessages((prev) => {
              const existing = prev.find((m) => m.id === replyId);
              if (!existing) {
                return [
                  ...prev,
                  {
                    id: replyId,
                    role: 'assistant',
                    content: chunk,
                    timestamp: new Date().toISOString(),
                    sources: data?.sources,
                  },
                ];
              }
              // A frame marked `final` carries the whole reply rather than a
              // delta, so appending it would duplicate everything before it.
              return prev.map((m) =>
                m.id === replyId
                  ? {
                      ...m,
                      content: data?.final ? chunk : `${m.content}${chunk}`,
                      sources: data?.sources || m.sources,
                    }
                  : m
              );
            });
          },

          // A turn can also answer with a whole new map when the question turns
          // out to be a research request rather than a follow-up.
          onMap: (mapData) => {
            if (!mapData?.root) return;
            const nextDoc: MindMapDocument = {
              id: `map_${Date.now()}`,
              topic: mapData.topic || mapData.title || currentMap.topic,
              summary: mapData.summary || '',
              root: mapData.root,
              totalTopics: mapData.totalTopics,
              sourceType: 'query',
              createdAt: new Date().toISOString(),
            };
            setCurrentMap(nextDoc);
            setCollapsedIds(new Set());
            award('mapCreated');
            saveMindMap(nextDoc).catch(() => {});
          },

          onError: (data) => {
            setStreamStatus(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content:
                  (data as any)?.message ||
                  'The engine could not answer that one. Your question is still in the box above.',
                timestamp: new Date().toISOString(),
              },
            ]);
          },
        }
      );

      if (!received) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: 'The engine did not send anything back. Try asking again in a moment.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content:
            error?.message ||
            'Could not reach the engine. The map on screen is still yours to explore.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreamStatus(null);
      setIsSendingChat(false);
    }
  };

  /**
   * Get the map out of the app.
   *
   * Three formats because they go to different places: Markdown into notes
   * apps, a plain outline into anything that chokes on asterisks (including a
   * screen reader), and JSON for anyone who wants the structure back.
   */
  const handleExportMap = () => {
    Alert.alert('Take this map with you', `"${currentMap.topic}"`, [
      {
        text: 'Copy as text',
        onPress: () => copyToClipboard(mapToOutline(currentMap)),
      },
      {
        text: 'Share as Markdown',
        onPress: () => shareText(mapToMarkdown(currentMap), currentMap.topic, 'md'),
      },
      {
        text: 'Share as JSON',
        onPress: () =>
          shareText(JSON.stringify(currentMap, null, 2), currentMap.topic, 'json'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleReadMapAloud = () => {
    const spoken = [
      currentMap.topic,
      currentMap.summary,
      ...(currentMap.root?.children || []).map((child) =>
        [child.label, child.detail].filter(Boolean).join('. ')
      ),
    ]
      .filter(Boolean)
      .join('. ');
    tts.speak(spoken);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Research Input Bar */}
        <View style={styles.searchBarContainer}>
          <Input
            placeholder="Research any topic into a mind map…"
            value={topicInput}
            onChangeText={setTopicInput}
            returnKeyType="search"
            onSubmitEditing={() => handlePerformResearch()}
            trailingIcon={
              <VoiceInputButton
                onTranscript={(text) => {
                  setTopicInput(text);
                  handlePerformResearch(text);
                }}
                size={34}
              />
            }
            containerStyle={{ marginBottom: 0, flex: 1 }}
          />
          <Button
            title="Draw"
            variant="primary"
            size="md"
            loading={isLoading}
            onPress={() => handlePerformResearch()}
            style={styles.drawBtn}
          />
        </View>

        {researchError ? (
          <Text variant="bodySm" color={COLORS.magenta} style={{ marginBottom: SPACING.sm }}>
            {researchError}
          </Text>
        ) : null}

        {/* Tab Switcher (Canvas / Conversation) */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'canvas' ? styles.tabBtnActive : {}]}
            onPress={() => setActiveTab('canvas')}
          >
            <Network size={15} color={activeTab === 'canvas' ? COLORS.cyanDark : COLORS.textMuted} />
            <Text
              variant="bodySm"
              weight="semibold"
              color={activeTab === 'canvas' ? COLORS.cyanDark : COLORS.textMuted}
              style={{ marginLeft: 6 }}
            >
              Interactive Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'chat' ? styles.tabBtnActive : {}]}
            onPress={() => setActiveTab('chat')}
          >
            <MessageSquare size={15} color={activeTab === 'chat' ? COLORS.cyanDark : COLORS.textMuted} />
            <Text
              variant="bodySm"
              weight="semibold"
              color={activeTab === 'chat' ? COLORS.cyanDark : COLORS.textMuted}
              style={{ marginLeft: 6 }}
            >
              Ask AI ({messages.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Progress State */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <StagedLoader />
          </View>
        ) : activeTab === 'canvas' ? (
          /* CANVAS TAB */
          <View style={styles.canvasTabContent}>
            {/* Map Summary Ribbon */}
            <View style={styles.mapInfoCard}>
              <View style={styles.mapInfoHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSm" weight="bold" numberOfLines={1}>
                    {currentMap.topic}
                  </Text>
                  <Text variant="caption" color={COLORS.textMuted} numberOfLines={1}>
                    {currentMap.summary}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Read this map aloud"
                  style={styles.iconBtn}
                  onPress={handleReadMapAloud}
                >
                  <Volume2 size={16} color={COLORS.cyan} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Copy, share or export this map"
                  style={styles.iconBtn}
                  onPress={handleExportMap}
                >
                  <Share2 size={16} color={COLORS.cyan} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Interactive Canvas */}
            <MindMapCanvas
              rootNode={currentMap.root}
              selectedNodeId={selectedNode?.id}
              collapsedIds={collapsedIds}
              onSelectNode={handleSelectNode}
              onToggleCollapse={handleToggleCollapse}
              onExpandDeeper={handleExpandDeeper}
            />

            <View style={styles.bottomHintBar}>
              <Text variant="caption" color={COLORS.textSubtle}>
                {speakOnTap
                  ? 'Tap a branch to open and hear it · tap the count circle to fold it away'
                  : 'Tap a branch to open it · tap the count circle to fold it away'}
              </Text>
            </View>
          </View>
        ) : (
          /* CHAT TAB */
          <View style={styles.chatTabContent}>
            <ScrollView
              style={styles.chatMessagesScroll}
              contentContainerStyle={{ padding: SPACING.md }}
            >
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.msgBubble,
                    msg.role === 'user' ? styles.userMsg : styles.assistantMsg,
                  ]}
                >
                  <Text
                    variant="body"
                    color={msg.role === 'user' ? COLORS.textInverse : COLORS.text}
                  >
                    {msg.content}
                  </Text>
                </View>
              ))}

              {streamStatus ? (
                <View style={[styles.msgBubble, styles.assistantMsg]}>
                  <Text variant="bodySm" color={COLORS.textMuted}>
                    {streamStatus}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <Input
                placeholder="Ask about this mind map…"
                value={chatInput}
                onChangeText={setChatInput}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
              <Button
                variant="primary"
                size="md"
                loading={isSendingChat}
                icon={<Send size={16} color={COLORS.textInverse} />}
                onPress={handleSendMessage}
                style={styles.sendBtn}
              />
            </View>
          </View>
        )}

        {/* Selected Node Details Bottom Sheet */}
        <NodeDetailSheet
          node={selectedNode}
          isExpanding={isExpandingNode}
          onClose={() => setSelectedNode(null)}
          onExpandDeeper={handleExpandDeeper}
          onAskAboutNode={(node) => {
            setSelectedNode(null);
            setActiveTab('chat');
            setChatInput(`Explain "${node.label}" in simpler terms`);
          }}
        />
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
    padding: SPACING.md,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  drawBtn: {
    minWidth: 70,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: RADIUS.sm,
    padding: 3,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  tabBtnActive: {
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.divider,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  canvasTabContent: {
    flex: 1,
  },
  mapInfoCard: {
    backgroundColor: t.surface,
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
    marginBottom: SPACING.sm,
  },
  mapInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: t.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  bottomHintBar: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  chatTabContent: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  chatMessagesScroll: {
    flex: 1,
  },
  msgBubble: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    maxWidth: '88%',
  },
  userMsg: {
    backgroundColor: t.cyan,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  assistantMsg: {
    backgroundColor: t.bg,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: t.dividerSubtle,
    borderBottomLeftRadius: 2,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.dividerSubtle,
    gap: SPACING.sm,
  },
  sendBtn: {
    width: 48,
  },
});
