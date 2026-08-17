/**
 * SETU Mobile — Interactive Mind Map Canvas
 * -----------------------------------------
 * Renders the Broadsheet four-plate mind map with SVG bezier connector curves,
 * interactive collapsible nodes, and touch gestures.
 */

import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { MindMapNode, PlacedNode } from '../types';
import { layoutTree } from '../utils/layout';
import { COLORS, PLATE_COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { Text } from './Typography';
import { BionicText } from './BionicText';

export interface MindMapCanvasProps {
  rootNode: MindMapNode;
  selectedNodeId?: string | null;
  collapsedIds: Set<string>;
  onSelectNode: (node: PlacedNode) => void;
  onToggleCollapse: (nodeId: string) => void;
  onExpandDeeper?: (node: PlacedNode) => void;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  rootNode,
  selectedNodeId,
  collapsedIds,
  onSelectNode,
  onToggleCollapse,
}) => {
  const { nodes, edges, width, height } = useMemo(() => {
    return layoutTree(rootNode, collapsedIds);
  }, [rootNode, collapsedIds]);

  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = Math.max(screenWidth - 32, width + 40);
  const canvasHeight = Math.max(340, height + 40);

  const handleNodePress = (node: PlacedNode) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onSelectNode(node);
  };

  const handleToggle = (e: any, nodeId: string) => {
    e.stopPropagation();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onToggleCollapse(nodeId);
  };

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ minWidth: canvasWidth }}
      >
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ minHeight: canvasHeight, padding: SPACING.md }}
        >
          <View style={[styles.canvasSurface, { width: canvasWidth, height: canvasHeight }]}>
            {/* SVG Connecting Curves */}
            <Svg style={StyleSheet.absoluteFill} width={canvasWidth} height={canvasHeight}>
              {edges.map((edge) => {
                const strokeColor = PLATE_COLORS[edge.branch % PLATE_COLORS.length];
                const strokeWidth = edge.depth === 1 ? 2.2 : 1.5;
                const opacity = edge.depth === 1 ? 0.75 : 0.45;
                const pathD = `M ${edge.from.x} ${edge.from.y} C ${edge.from.x + 32} ${
                  edge.from.y
                }, ${edge.to.x - 32} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`;

                return (
                  <Path
                    key={edge.id}
                    d={pathD}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    fill="none"
                  />
                );
              })}
            </Svg>

            {/* Absolutely Placed Button Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const branchColor =
                node.depth === 0
                  ? COLORS.ink
                  : PLATE_COLORS[node.branch % PLATE_COLORS.length];

              return (
                <TouchableOpacity
                  key={node.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${node.label}, ${node.detail || ''}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.nodeBox,
                    {
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      minHeight: node.height,
                      borderLeftColor: branchColor,
                    },
                    isSelected ? styles.nodeSelected : styles.nodeUnselected,
                  ]}
                  onPress={() => handleNodePress(node)}
                >
                  <BionicText
                    text={node.label}
                    variant={node.depth === 0 ? 'body' : 'bodySm'}
                    color={COLORS.text}
                    style={styles.nodeLabel}
                  />

                  {node.detail ? (
                    <Text
                      variant="caption"
                      color={COLORS.textMuted}
                      numberOfLines={3}
                      style={styles.nodeDetail}
                    >
                      {node.detail}
                    </Text>
                  ) : null}

                  {/* Circular Collapse / Expand Indicator */}
                  {node.childCount > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        node.collapsed
                          ? `Expand ${node.childCount} branches`
                          : 'Collapse branch'
                      }
                      style={[
                        styles.toggleBadge,
                        { borderColor: branchColor },
                        node.collapsed ? styles.toggleBadgeCollapsed : styles.toggleBadgeOpen,
                      ]}
                      onPress={(e) => handleToggle(e, node.id)}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        color={node.collapsed ? COLORS.textInverse : branchColor}
                        style={styles.toggleBadgeText}
                      >
                        {node.collapsed ? node.childCount : '−'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
    overflow: 'hidden',
    minHeight: 360,
  },
  canvasSurface: {
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  nodeBox: {
    position: 'absolute',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderLeftWidth: 3.5,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 4,
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  nodeUnselected: {
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
  nodeSelected: {
    borderWidth: 2,
    borderColor: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  nodeLabel: {
    fontWeight: '700',
    marginBottom: 2,
  },
  nodeDetail: {
    fontSize: 11,
    lineHeight: 14,
  },
  toggleBadge: {
    position: 'absolute',
    right: -10,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  toggleBadgeCollapsed: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
  },
  toggleBadgeOpen: {
    backgroundColor: COLORS.bg,
  },
  toggleBadgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
