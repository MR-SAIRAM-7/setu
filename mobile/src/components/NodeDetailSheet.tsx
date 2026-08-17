/**
 * SETU Mobile — Node Detail Modal Sheet
 * --------------------------------------
 * Provides deep reading, TTS playback, AI node expansion,
 * and conversational follow-up for a selected mind map branch.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { X, Volume2, GitBranch, MessageSquare, Sparkles } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { Text, Heading, Kicker } from './Typography';
import { Button } from './Button';
import { BionicText } from './BionicText';
import { PlacedNode } from '../types';
import { tts } from '../services/tts';

export interface NodeDetailSheetProps {
  node: PlacedNode | null;
  onClose: () => void;
  onExpandDeeper: (node: PlacedNode) => void;
  onAskAboutNode: (node: PlacedNode) => void;
  isExpanding?: boolean;
}

export const NodeDetailSheet: React.FC<NodeDetailSheetProps> = ({
  node,
  onClose,
  onExpandDeeper,
  onAskAboutNode,
  isExpanding = false,
}) => {
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  if (!node) return null;

  const handleSpeak = () => {
    if (isPlayingTts) {
      tts.stop();
      setIsPlayingTts(false);
    } else {
      setIsPlayingTts(true);
      const textToSpeak = `${node.label}. ${node.detail || ''}`;
      tts.speak(textToSpeak, {
        onDone: () => setIsPlayingTts(false),
        onError: () => setIsPlayingTts(false),
      });
    }
  };

  return (
    <Modal visible={Boolean(node)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetCard}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Kicker color={COLORS.cyan}>Selected Branch · Depth {node.depth}</Kicker>
              <Heading variant="title" style={{ marginTop: 2 }}>
                {node.label}
              </Heading>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close topic details"
              style={styles.closeBtn}
              onPress={onClose}
            >
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Detail */}
          <View style={styles.detailContainer}>
            <BionicText
              text={node.detail || 'Core conceptual topic branch.'}
              variant="body"
              color={COLORS.text}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsGrid}>
            <Button
              title={isPlayingTts ? 'Stop audio' : 'Listen'}
              variant="secondary"
              size="md"
              icon={<Volume2 size={16} color={COLORS.cyan} />}
              onPress={handleSpeak}
              style={{ flex: 1 }}
            />
            <Button
              title="Expand deeper"
              variant="primary"
              size="md"
              loading={isExpanding}
              icon={<GitBranch size={16} color={COLORS.textInverse} />}
              onPress={() => onExpandDeeper(node)}
              style={{ flex: 1.2 }}
            />
          </View>

          <Button
            title="Ask about this topic"
            variant="ghost"
            size="sm"
            fullWidth
            icon={<MessageSquare size={14} color={COLORS.cyan} />}
            onPress={() => onAskAboutNode(node)}
            style={{ marginTop: SPACING.xs }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 30, 29, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    ...SHADOWS.lg,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  detailContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.cyan,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
