/**
 * SETU Mobile — Library.
 *
 * Everything SETU has made or been given, in three shelves: mind maps, saved
 * mode results, and documents.
 *
 * Documents are the shelf that matters most in practice. The thing a person
 * cannot read is usually a PDF somebody sent them — a tenancy agreement, a
 * hospital letter, a school circular — and the whole point is to get it in here
 * and back out in plain language. So the picker takes anything the phone will
 * hand over, and every document offers the same four exits: simplify it, map it,
 * study it, or hear it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Search,
  BookOpen,
  Trash2,
  RotateCcw,
  ArrowRight,
  Plus,
  Waves,
  FileText,
  Layers,
  Share2,
  Upload,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, RADIUS, SPACING, PLATE_COLORS } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { getSavedMindMaps, deleteMindMap, restoreReferenceLibrary } from '../services/storage';
import { getSavedSummaries, deleteSummary, SavedSummary } from '../services/summaryStorage';
import { api } from '../services/api';
import { tts } from '../services/tts';
import { mapToMarkdown, modeResultToMarkdown, shareText } from '../services/exportUtils';
import { MindMapDocument } from '../types';
import { formatRelativeDate, truncateText } from '../utils/formatters';
import * as Haptics from 'expo-haptics';

export interface LibraryScreenProps {
  navigation: any;
}

type LibraryTab = 'maps' | 'summaries' | 'documents';

interface LibraryDocument {
  id?: string;
  _id?: string;
  originalName?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  extractedText?: string;
  summary?: string;
  createdAt?: string;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [activeTab, setActiveTab] = useState<LibraryTab>('maps');
  const [maps, setMaps] = useState<MindMapDocument[]>([]);
  const [summaries, setSummaries] = useState<SavedSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'seed'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [storedMaps, storedSummaries] = await Promise.all([
        getSavedMindMaps(),
        getSavedSummaries(),
      ]);
      setMaps(storedMaps);
      setSummaries(storedSummaries);
    } catch (_) {}

    // Documents live on the engine, because parsing a PDF is not something a
    // phone should be doing. A null here means the engine is unreachable, which
    // is a different thing from having no documents — say so rather than showing
    // an empty shelf.
    const files = await api.listFiles();
    if (files === null) {
      setDocumentsError('Cannot reach the engine, so your documents are not listed right now.');
    } else {
      setDocumentsError(null);
      setDocuments(Array.isArray(files) ? files : files.files || files.documents || []);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteMap = (id: string, topic: string) => {
    Alert.alert('Delete Mind Map', `Are you sure you want to remove "${topic}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (_) {}
          const updated = await deleteMindMap(id);
          setMaps(updated);
        },
      },
    ]);
  };

  const handleDeleteSummary = (id: string, modeName: string) => {
    Alert.alert('Delete Saved Result', `Are you sure you want to remove this ${modeName} output?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (_) {}
          const updated = await deleteSummary(id);
          setSummaries(updated);
        },
      },
    ]);
  };

  const handleAddDocument = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Everything, rather than a whitelist: the engine already rejects what
        // it cannot parse, and a picker that hides the user's file is a dead end
        // with no explanation.
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      setIsUploading(true);
      setDocumentsError(null);

      const uploaded = await api.uploadFile(
        asset.uri,
        asset.mimeType || 'application/octet-stream',
        asset.name || 'document'
      );

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      await loadData();
      if (uploaded) handleDocumentActions(uploaded as LibraryDocument);
    } catch (error: any) {
      setDocumentsError(error?.message || 'That document could not be read.');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * What to do with a document once it is in.
   *
   * The four options are the four reasons somebody uploads something they
   * cannot read: to understand it, to see its shape, to be tested on it, or to
   * hear it instead.
   */
  const handleDocumentActions = (doc: LibraryDocument) => {
    const id = doc.id || doc._id || '';
    const name = doc.originalName || doc.name || 'this document';
    const text = doc.extractedText || doc.summary || '';

    Alert.alert(name, doc.summary ? truncateText(doc.summary, 160) : 'What would you like to do with it?', [
      {
        text: 'Put it in plain language',
        onPress: () =>
          navigation.navigate('ModesTab', {
            screen: 'ModesScreen',
            params: { initialMode: 'simplify', initialInput: text },
          }),
      },
      {
        text: 'Draw it as a map',
        onPress: async () => {
          const result = await api.mindMapFromFile(id).catch(() => null);
          navigation.navigate('MindMapTab', {
            screen: 'MindMapScreen',
            params: result?.root ? { selectedMap: result } : { initialTopic: name },
          });
        },
      },
      {
        text: 'Study and quiz me',
        onPress: () =>
          navigation.navigate('ModesTab', {
            screen: 'ModesScreen',
            params: { initialMode: 'learn', initialInput: text },
          }),
      },
      { text: 'Read it aloud', onPress: () => tts.speak(text) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteFile(id);
          await loadData();
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  const handleRestoreLibrary = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    const updated = await restoreReferenceLibrary();
    setMaps(updated);
    Alert.alert('Library Restored', 'The reference research library has been refreshed.');
  };

  const filteredMaps = maps.filter((m) => {
    const matchesSearch =
      m.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.summary || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'user') return m.sourceType !== 'seed';
    if (filterType === 'seed') return m.sourceType === 'seed';
    return true;
  });

  const filteredDocuments = documents.filter((doc) => {
    const haystack = `${doc.originalName || doc.name || ''} ${doc.summary || ''}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  const filteredSummaries = summaries.filter((s) => {
    const matchesSearch =
      s.modeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(s.result).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Kicker color={COLORS.cyan}>Stored Knowledge Vault</Kicker>
            <Heading variant="titleLg" style={{ marginTop: 2 }}>
              Library
            </Heading>
            <Text variant="caption" color={COLORS.textMuted}>
              Every mind map and cognitive result saved on this device.
            </Text>
          </View>

          <Button
            title="Restore seeds"
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={14} color={COLORS.cyan} />}
            onPress={handleRestoreLibrary}
          />
        </View>

        {/* Dynamic Segmented Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'maps' && styles.tabButtonActive]}
            onPress={() => setActiveTab('maps')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'maps' }}
          >
            <Layers size={14} color={activeTab === 'maps' ? COLORS.cyan : COLORS.textMuted} />
            <Text
              variant="caption"
              weight={activeTab === 'maps' ? 'bold' : 'medium'}
              color={activeTab === 'maps' ? COLORS.cyan : COLORS.textMuted}
              style={{ marginLeft: 6 }}
            >
              Maps ({maps.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'summaries' && styles.tabButtonActive]}
            onPress={() => setActiveTab('summaries')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'summaries' }}
          >
            <Waves size={14} color={activeTab === 'summaries' ? COLORS.cyan : COLORS.textMuted} />
            <Text
              variant="caption"
              weight={activeTab === 'summaries' ? 'bold' : 'medium'}
              color={activeTab === 'summaries' ? COLORS.cyan : COLORS.textMuted}
              style={{ marginLeft: 6 }}
            >
              Results ({summaries.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'documents' && styles.tabButtonActive]}
            onPress={() => setActiveTab('documents')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'documents' }}
          >
            <FileText size={14} color={activeTab === 'documents' ? COLORS.cyan : COLORS.textMuted} />
            <Text
              variant="caption"
              weight={activeTab === 'documents' ? 'bold' : 'medium'}
              color={activeTab === 'documents' ? COLORS.cyan : COLORS.textMuted}
              style={{ marginLeft: 6 }}
            >
              Documents ({documents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Search Input */}
        <Input
          placeholder={
            activeTab === 'maps'
              ? 'Search saved mind maps…'
              : activeTab === 'summaries'
                ? 'Search saved mode results…'
                : 'Search your documents…'
          }
          value={searchQuery}
          onChangeText={setSearchQuery}
          leadingIcon={<Search size={16} color={COLORS.textMuted} />}
          containerStyle={{ marginBottom: SPACING.sm }}
        />

        {/* Map Source Filter Chips (Only shown in Maps tab) */}
        {activeTab === 'maps' && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' ? styles.filterChipActive : {}]}
              onPress={() => setFilterType('all')}
            >
              <Text
                variant="caption"
                weight={filterType === 'all' ? 'bold' : 'normal'}
                color={filterType === 'all' ? COLORS.cyanDark : COLORS.textMuted}
              >
                All ({maps.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterType === 'user' ? styles.filterChipActive : {}]}
              onPress={() => setFilterType('user')}
            >
              <Text
                variant="caption"
                weight={filterType === 'user' ? 'bold' : 'normal'}
                color={filterType === 'user' ? COLORS.cyanDark : COLORS.textMuted}
              >
                Researched ({maps.filter((m) => m.sourceType !== 'seed').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterType === 'seed' ? styles.filterChipActive : {}]}
              onPress={() => setFilterType('seed')}
            >
              <Text
                variant="caption"
                weight={filterType === 'seed' ? 'bold' : 'normal'}
                color={filterType === 'seed' ? COLORS.cyanDark : COLORS.textMuted}
              >
                Reference ({maps.filter((m) => m.sourceType === 'seed').length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scrollable Content Area */}
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
          {/* TAB 1: MIND MAPS */}
          {activeTab === 'maps' && (
            <>
              {filteredMaps.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <BookOpen size={36} color={COLORS.textSubtle} />
                  <Text variant="body" weight="semibold" style={{ marginTop: SPACING.sm }}>
                    No mind maps found
                  </Text>
                  <Text variant="caption" color={COLORS.textMuted} style={{ textAlign: 'center', marginTop: 4 }}>
                    {searchQuery
                      ? 'Try searching with a different keyword.'
                      : 'Start a research query to create your first map.'}
                  </Text>
                  <Button
                    title="Create new map"
                    variant="primary"
                    size="md"
                    icon={<Plus size={16} color={COLORS.textInverse} />}
                    onPress={() => navigation.navigate('MindMapTab')}
                    style={{ marginTop: SPACING.md }}
                  />
                </View>
              ) : (
                filteredMaps.map((item, index) => {
                  const isSeed = item.sourceType === 'seed';
                  const plateColor = PLATE_COLORS[index % PLATE_COLORS.length];
                  return (
                    <Card
                      key={item.id || item._id || `map_${index}`}
                      elevated
                      plateColor={isSeed ? COLORS.ink : plateColor}
                      style={styles.mapCard}
                      onPress={() =>
                        navigation.navigate('MindMapTab', {
                          screen: 'MindMapScreen',
                          params: { selectedMap: item },
                        })
                      }
                    >
                      <View style={styles.cardTopRow}>
                        <Tag
                          label={isSeed ? 'Reference Seed' : 'Researched'}
                          variant={isSeed ? 'neutral' : 'cyan'}
                        />
                        <View style={styles.cardHeaderRight}>
                          {item.createdAt && (
                            <Text variant="caption" color={COLORS.textSubtle} style={{ marginRight: 8 }}>
                              {formatRelativeDate(item.createdAt)}
                            </Text>
                          )}
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Share ${item.topic}`}
                            style={styles.deleteBtn}
                            onPress={() => shareText(mapToMarkdown(item), item.topic, 'md')}
                          >
                            <Share2 size={15} color={COLORS.cyan} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${item.topic}`}
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteMap(item.id || item._id || '', item.topic)}
                          >
                            <Trash2 size={15} color={COLORS.magenta} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text variant="bodyLg" weight="bold" color={COLORS.text} style={styles.mapTitle}>
                        {item.topic}
                      </Text>

                      <Text variant="bodySm" color={COLORS.textMuted} numberOfLines={2} style={styles.mapSummary}>
                        {item.summary || 'Researched mind map outline.'}
                      </Text>

                      <View style={styles.cardFooter}>
                        <Text variant="caption" color={COLORS.textSubtle}>
                          {item.totalTopics || 10} topics · saved locally
                        </Text>
                        <View style={styles.openLink}>
                          <Text variant="caption" weight="bold" color={COLORS.cyan}>
                            Open map
                          </Text>
                          <ArrowRight size={13} color={COLORS.cyan} style={{ marginLeft: 3 }} />
                        </View>
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}

          {/* TAB 2: MODE SUMMARIES */}
          {activeTab === 'summaries' && (
            <>
              {filteredSummaries.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Waves size={36} color={COLORS.textSubtle} />
                  <Text variant="body" weight="semibold" style={{ marginTop: SPACING.sm }}>
                    No mode results saved yet
                  </Text>
                  <Text variant="caption" color={COLORS.textMuted} style={{ textAlign: 'center', marginTop: 4 }}>
                    Results from Start, Simplify, Learn, Meet, and other modes appear here automatically.
                  </Text>
                  <Button
                    title="Open Cognitive Modes"
                    variant="primary"
                    size="md"
                    icon={<Plus size={16} color={COLORS.textInverse} />}
                    onPress={() => navigation.navigate('ModesTab')}
                    style={{ marginTop: SPACING.md }}
                  />
                </View>
              ) : (
                filteredSummaries.map((item, index) => {
                  return (
                    <Card
                      key={item.id || `sum_${index}`}
                      elevated
                      plateColor={COLORS.cyan}
                      style={styles.mapCard}
                      onPress={() =>
                        navigation.navigate('ModesTab', {
                          screen: 'ModesScreen',
                          params: { initialMode: item.modeKey, initialInput: item.input },
                        })
                      }
                    >
                      <View style={styles.cardTopRow}>
                        <Tag label={item.modeName} variant="cyan" />
                        <View style={styles.cardHeaderRight}>
                          <Text variant="caption" color={COLORS.textSubtle} style={{ marginRight: 8 }}>
                            {formatRelativeDate(item.createdAt)}
                          </Text>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Share this ${item.modeName} result`}
                            style={styles.deleteBtn}
                            onPress={() =>
                              shareText(
                                modeResultToMarkdown(item.modeKey, item.result, item.input),
                                `SETU ${item.modeName}`,
                                'md'
                              )
                            }
                          >
                            <Share2 size={15} color={COLORS.cyan} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${item.modeName} result`}
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteSummary(item.id, item.modeName)}
                          >
                            <Trash2 size={15} color={COLORS.magenta} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text variant="body" weight="bold" color={COLORS.text} numberOfLines={2} style={styles.mapTitle}>
                        {truncateText(item.input, 90)}
                      </Text>

                      <Text variant="caption" color={COLORS.textMuted} numberOfLines={3} style={styles.mapSummary}>
                        {item.result?.plainLanguageRewrite ||
                          item.result?.supportiveMessage ||
                          item.result?.summary ||
                          item.result?.workflowName ||
                          'Generated cognitive tool result.'}
                      </Text>

                      <View style={styles.cardFooter}>
                        <Text variant="caption" color={COLORS.textSubtle}>
                          Mode: {item.modeName}
                        </Text>
                        <View style={styles.openLink}>
                          <Text variant="caption" weight="bold" color={COLORS.cyan}>
                            Reopen mode
                          </Text>
                          <ArrowRight size={13} color={COLORS.cyan} style={{ marginLeft: 3 }} />
                        </View>
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 'documents' && (
            <>
              <Button
                title={isUploading ? 'Reading it…' : 'Add a document'}
                variant="primary"
                size="md"
                loading={isUploading}
                icon={<Upload size={16} color={COLORS.textInverse} />}
                onPress={handleAddDocument}
                style={{ marginBottom: SPACING.md }}
              />

              {documentsError ? (
                <Text variant="bodySm" color={COLORS.magenta} style={{ marginBottom: SPACING.md }}>
                  {documentsError}
                </Text>
              ) : null}

              {filteredDocuments.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <FileText size={36} color={COLORS.textSubtle} />
                  <Text variant="body" weight="semibold" style={{ marginTop: SPACING.sm }}>
                    Nothing here yet
                  </Text>
                  <Text
                    variant="caption"
                    color={COLORS.textMuted}
                    style={{ textAlign: 'center', marginTop: 4 }}
                  >
                    Add a PDF, a Word file, or a photo of a page. SETU pulls the text out, and then
                    you can have it simplified, mapped, quizzed, or read aloud.
                  </Text>
                  <Button
                    title="Scan a page with the camera"
                    variant="secondary"
                    size="md"
                    onPress={() => navigation.navigate('CameraOCR')}
                    style={{ marginTop: SPACING.md }}
                  />
                </View>
              ) : (
                filteredDocuments.map((doc, index) => (
                  <Card
                    key={doc.id || doc._id || `doc_${index}`}
                    elevated
                    plateColor={COLORS.cyan}
                    style={styles.mapCard}
                    onPress={() => handleDocumentActions(doc)}
                    accessibilityRole="button"
                    accessibilityLabel={`${doc.originalName || doc.name}. Tap for what to do with it.`}
                  >
                    <View style={styles.cardTopRow}>
                      <Tag label={(doc.mimeType || 'file').split('/').pop() || 'file'} variant="cyan" />
                      {doc.createdAt ? (
                        <Text variant="caption" color={COLORS.textSubtle}>
                          {formatRelativeDate(doc.createdAt)}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      variant="body"
                      weight="bold"
                      numberOfLines={2}
                      style={styles.mapTitle}
                    >
                      {doc.originalName || doc.name || 'Untitled document'}
                    </Text>

                    <Text
                      variant="bodySm"
                      color={COLORS.textMuted}
                      numberOfLines={3}
                      style={styles.mapSummary}
                    >
                      {doc.summary ||
                        truncateText(doc.extractedText || '', 140) ||
                        'Text pulled out and ready to work with.'}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text variant="caption" color={COLORS.textSubtle}>
                        {doc.size ? `${Math.max(1, Math.round(doc.size / 1024))} KB` : 'Stored on the engine'}
                      </Text>
                      <View style={styles.openLink}>
                        <Text variant="caption" weight="bold" color={COLORS.cyan}>
                          What can I do with this?
                        </Text>
                        <ArrowRight size={13} color={COLORS.cyan} style={{ marginLeft: 3 }} />
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </>
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
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.dividerSubtle,
  },
  filterChipActive: {
    backgroundColor: t.cyanLight,
    borderColor: t.cyanBorder,
  },
  scrollContent: {
    paddingBottom: SPACING.huge,
    gap: SPACING.sm,
  },
  emptyStateBox: {
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCard: {
    padding: SPACING.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  mapTitle: {
    marginTop: 2,
    marginBottom: 4,
  },
  mapSummary: {
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: t.dividerSubtle,
    paddingTop: SPACING.xs,
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
