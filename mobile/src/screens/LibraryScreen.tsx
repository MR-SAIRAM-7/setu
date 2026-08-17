/**
 * SETU Mobile — Library & Knowledge Vault Screen
 * ----------------------------------------------
 * Dynamic multi-tier vault storing:
 * 1. Researched & Seed Mind Maps
 * 2. Cognitive Mode Summaries (Start, Simplify, Learn, Meet, Practice, Write, Guide)
 * 3. Ingested OCR Documents
 *
 * Real-time keyword filtering, mode segmentation, relative date formatting,
 * deletion with haptics, and instant restoration of reference materials.
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
  Sparkles,
  ArrowRight,
  Plus,
  Waves,
  FileText,
  Clock,
  Layers,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, PLATE_COLORS } from '../constants/theme';
import { Text, Heading, Subheading, Kicker } from '../components/Typography';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card, Tag } from '../components/Card';
import { getSavedMindMaps, deleteMindMap, restoreReferenceLibrary } from '../services/storage';
import { getSavedSummaries, deleteSummary, SavedSummary } from '../services/summaryStorage';
import { MindMapDocument } from '../types';
import { formatRelativeDate, truncateText } from '../utils/formatters';
import * as Haptics from 'expo-haptics';

export interface LibraryScreenProps {
  navigation: any;
}

type LibraryTab = 'maps' | 'summaries';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('maps');
  const [maps, setMaps] = useState<MindMapDocument[]>([]);
  const [summaries, setSummaries] = useState<SavedSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'seed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storedMaps, storedSummaries] = await Promise.all([
        getSavedMindMaps(),
        getSavedSummaries(),
      ]);
      setMaps(storedMaps);
      setSummaries(storedSummaries);
    } catch (_) {}
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
              Mind Maps ({maps.length})
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
              Mode Results ({summaries.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Search Input */}
        <Input
          placeholder={
            activeTab === 'maps'
              ? 'Search saved mind maps…'
              : 'Search saved mode summaries…'
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
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
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  filterChipActive: {
    backgroundColor: COLORS.cyanLight,
    borderColor: COLORS.cyanBorder,
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
    borderTopColor: COLORS.dividerSubtle,
    paddingTop: SPACING.xs,
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
