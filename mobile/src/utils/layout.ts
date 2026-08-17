/**
 * SETU Mobile — Mind Map Tree Layout Engine
 * -----------------------------------------
 * Implements a Reingold-Tilford tree layout for mobile screens.
 * Places nodes cleanly without overlaps and calculates cubic bezier curves.
 */

import { MindMapNode, PlacedNode, PlacedEdge } from '../types';
import { PLATE_COLORS } from '../constants/theme';

const COLUMN_WIDTH = [160, 180, 160];
const H_GAP = 54;
const V_GAP = 16;

export function widthFor(depth: number): number {
  return COLUMN_WIDTH[Math.min(depth, COLUMN_WIDTH.length - 1)];
}

export function heightFor(node: MindMapNode, depth: number): number {
  const width = widthFor(depth);
  const charsPerLine = Math.max(12, Math.floor(width / 7.2));

  const labelLines = Math.max(1, Math.ceil((node.label || '').length / (charsPerLine * 0.85)));
  const detailLines = node.detail ? Math.ceil(node.detail.length / charsPerLine) : 0;

  const padding = depth === 0 ? 20 : 16;
  const labelHeight = labelLines * (depth === 0 ? 18 : 16);
  const detailHeight = detailLines * 14;

  const minHeights = [60, 52, 44];
  const minH = minHeights[Math.min(depth, minHeights.length - 1)];

  return Math.max(minH, padding + labelHeight + (detailHeight ? detailHeight + 4 : 0));
}

export function layoutTree(
  root: MindMapNode,
  collapsed: Set<string> = new Set()
): {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
} {
  if (!root) return { nodes: [], edges: [], width: 0, height: 0 };

  const nodes: PlacedNode[] = [];
  const edges: PlacedEdge[] = [];
  const metrics = new Map<MindMapNode, { own: number; span: number }>();

  const visibleChildren = (node: MindMapNode) =>
    collapsed.has(node.id) ? [] : node.children || [];

  const spanOf = (node: MindMapNode) => metrics.get(node)?.span ?? 0;

  // Pass 1 — measure subtree heights bottom-up
  function measure(node: MindMapNode, depth: number): number {
    const own = heightFor(node, depth);
    const children = visibleChildren(node);

    if (!children.length) {
      metrics.set(node, { own, span: own });
      return own;
    }

    const childSpan = children.reduce(
      (sum, child, index) => sum + measure(child, depth + 1) + (index ? V_GAP : 0),
      0
    );

    const span = Math.max(own, childSpan);
    metrics.set(node, { own, span });
    return span;
  }

  // Pass 2 — place nodes at vertical centers
  function place(
    node: MindMapNode,
    depth: number,
    x: number,
    spanTop: number,
    branch: number
  ): PlacedNode {
    const { own: height, span } = metrics.get(node)!;
    const width = widthFor(depth);
    const y = spanTop + (span - height) / 2;

    const children = visibleChildren(node);
    const hasHiddenChildren = collapsed.has(node.id) && (node.children || []).length > 0;

    const placed: PlacedNode = {
      id: node.id,
      label: node.label,
      detail: node.detail,
      depth,
      x,
      y,
      width,
      height,
      branch,
      childCount: (node.children || []).length,
      collapsed: hasHiddenChildren,
      raw: node,
    };
    nodes.push(placed);

    if (!children.length) return placed;

    const childX = x + width + H_GAP;
    const childrenSpan = children.reduce((s, c, i) => s + spanOf(c) + (i ? V_GAP : 0), 0);
    let cursor = spanTop + (span - childrenSpan) / 2;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const branchIndex = depth === 0 ? i % PLATE_COLORS.length : branch;
      const childPlaced = place(child, depth + 1, childX, cursor, branchIndex);

      edges.push({
        id: `${placed.id}-${childPlaced.id}`,
        from: { x: x + width, y: y + height / 2 },
        to: { x: childX, y: childPlaced.y + childPlaced.height / 2 },
        depth: depth + 1,
        branch: branchIndex,
      });

      cursor += spanOf(child) + V_GAP;
    }

    return placed;
  }

  measure(root, 0);
  const totalHeight = metrics.get(root)?.span || 300;
  const paddingX = 24;
  const paddingY = 24;

  place(root, 0, paddingX, paddingY, 3); // Root gets ink plate

  let maxX = 0;
  for (const n of nodes) {
    if (n.x + n.width > maxX) maxX = n.x + n.width;
  }

  return {
    nodes,
    edges,
    width: maxX + paddingX * 2,
    height: totalHeight + paddingY * 2,
  };
}
