/**
 * Tidy horizontal tree layout for the Broadsheet mind map.
 *
 * Nodes render as real HTML button elements (focusable, wrapping, screen-reader
 * friendly) positioned absolutely; only the connecting edges are SVG. That
 * keeps the map keyboard-navigable.
 *
 * The algorithm is a simplified Reingold–Tilford pass: measure each subtree's
 * height bottom-up, then centre each parent against its children. Sibling
 * subtrees never overlap because a parent's slot is exactly the sum of its
 * children's slots.
 */

export const PLATE_COLORS = ['#0088b0', '#d6006c', '#edbb00', '#201e1d']; // cyan, magenta, yellow, ink

/** Column width per depth, in px. Root is 186; depth 1 is 200; leaves are 168. */
const WIDTH = [186, 200, 168];
/** Horizontal gap between columns. */
const H_GAP = 66;
/** Minimum vertical gap between sibling nodes. */
const V_GAP = 14;

export const widthFor = (depth) => WIDTH[Math.min(depth, WIDTH.length - 1)];

/**
 * Estimate rendered height from text length.
 * Deterministic, so layout is stable across renders without layout shifts.
 */
export function heightFor(node, depth) {
  const width = widthFor(depth);
  const charsPerLine = Math.max(12, Math.floor(width / 7.2));

  const labelLines = Math.max(1, Math.ceil((node.label || '').length / (charsPerLine * 0.85)));
  const detailLines = node.detail ? Math.ceil(node.detail.length / charsPerLine) : 0;

  const padding = depth === 0 ? 22 : 18;
  const labelHeight = labelLines * (depth === 0 ? 20 : 17);
  const detailHeight = detailLines * 15;

  const minHeights = [64, 56, 46];
  const minH = minHeights[Math.min(depth, minHeights.length - 1)];

  return Math.max(minH, padding + labelHeight + (detailHeight ? detailHeight + 4 : 0));
}

/**
 * Compute absolute positions for every visible node.
 *
 * @param {object} root      tree with { id, label, detail, children }
 * @param {Set}    collapsed ids whose children are hidden
 * @returns {{nodes: Array, edges: Array, width: number, height: number, byId: Map}}
 */
export function layoutTree(root, collapsed = new Set()) {
  if (!root) return { nodes: [], edges: [], width: 0, height: 0, byId: new Map() };

  const nodes = [];
  const edges = [];

  const visibleChildren = (node) =>
    collapsed.has(node.id) ? [] : node.children || [];

  /** Pass 1 — total vertical space each subtree needs. */
  function measure(node, depth) {
    const own = heightFor(node, depth);
    const children = visibleChildren(node);

    if (!children.length) {
      node._own = own;
      node._span = own;
      return own;
    }

    const childSpan = children.reduce(
      (sum, child, index) => sum + measure(child, depth + 1) + (index ? V_GAP : 0),
      0
    );

    node._own = own;
    // A parent taller than all its children still needs its own room.
    node._span = Math.max(own, childSpan);
    return node._span;
  }

  /** Pass 2 — place each node at the vertical centre of its allotted span. */
  function place(node, depth, x, spanTop) {
    const width = widthFor(depth);
    const height = node._own;
    const y = spanTop + (node._span - height) / 2;

    const children = visibleChildren(node);
    const hasHiddenChildren = collapsed.has(node.id) && (node.children || []).length > 0;

    const placed = {
      id: node.id,
      label: node.label,
      detail: node.detail,
      depth,
      x,
      y,
      width,
      height,
      childCount: (node.children || []).length,
      collapsed: hasHiddenChildren,
      raw: node
    };
    nodes.push(placed);

    if (!children.length) return placed;

    const childX = x + width + H_GAP;
    let cursor = spanTop + (node._span - children.reduce((s, c, i) => s + c._span + (i ? V_GAP : 0), 0)) / 2;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const branchIndex = depth === 0 ? i % PLATE_COLORS.length : (placed.branch ?? 0);
      const childPlaced = place(child, depth + 1, childX, cursor);
      childPlaced.branch = branchIndex;

      edges.push({
        id: `${placed.id}-${childPlaced.id}`,
        from: { x: x + width, y: y + height / 2 },
        to: { x: childX, y: childPlaced.y + childPlaced.height / 2 },
        depth: depth + 1,
        branch: branchIndex
      });

      cursor += child._span + V_GAP;
    }

    return placed;
  }

  const totalHeight = measure(root, 0);
  const rootNode = place(root, 0, 16, 16);
  rootNode.branch = 3; // Ink plate for root

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width), 0) + 32;

  return {
    nodes,
    edges,
    width: Math.max(620, maxX),
    height: Math.max(400, totalHeight + 32),
    byId
  };
}

/** Cubic bezier connecting two points horizontally. */
export function edgePath({ from, to }) {
  const dx = Math.max(36, (to.x - from.x) * 0.45);
  return `M ${from.x},${from.y} C ${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
}

/** Flatten a tree into depth-first order — used for keyboard navigation. */
export function flatten(root, collapsed = new Set(), out = []) {
  if (!root) return out;
  out.push(root);
  if (!collapsed.has(root.id)) {
    for (const child of root.children || []) flatten(child, collapsed, out);
  }
  return out;
}

/** Path of labels from the root down to `id`, for expansion context. */
export function pathTo(root, id, trail = []) {
  if (!root) return null;
  const next = [...trail, root.label];
  if (root.id === id) return next;

  for (const child of root.children || []) {
    const found = pathTo(child, id, next);
    if (found) return found;
  }
  return null;
}

/** Immutably replace one node's children. */
export function withChildren(root, id, children) {
  if (!root) return root;
  if (root.id === id) return { ...root, children };
  return { ...root, children: (root.children || []).map((c) => withChildren(c, id, children)) };
}
