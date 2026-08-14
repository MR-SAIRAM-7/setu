/**
 * Tidy horizontal tree layout for the mind map.
 *
 * Nodes render as real HTML elements (focusable, wrapping, screen-reader
 * friendly) positioned absolutely; only the connecting edges are SVG. That
 * keeps the map keyboard-navigable, which an all-SVG map would not be.
 *
 * The algorithm is a simplified Reingold–Tilford pass: measure each subtree's
 * height bottom-up, then centre each parent against its children. Sibling
 * subtrees never overlap because a parent's slot is exactly the sum of its
 * children's slots.
 */

/** Column width per depth, in px. Root is widest; leaves are narrowest. */
const WIDTH = [268, 236, 214];
/** Horizontal gap between columns. */
const H_GAP = 78;
/** Minimum vertical gap between sibling nodes. */
const V_GAP = 18;

const widthFor = (depth) => WIDTH[Math.min(depth, WIDTH.length - 1)];

/**
 * Estimate rendered height from text length.
 * Deterministic, so layout is stable across renders and does not require a
 * measure-then-reflow pass that would make the map jump on load.
 */
function heightFor(node, depth) {
  const width = widthFor(depth);
  const charsPerLine = Math.floor(width / 7.1);

  const labelLines = Math.max(1, Math.ceil((node.label || '').length / (charsPerLine * 0.86)));
  const detailLines = node.detail ? Math.ceil(node.detail.length / charsPerLine) : 0;

  const padding = 26;
  const labelHeight = labelLines * 21;
  const detailHeight = detailLines * 17;

  return Math.max(56, padding + labelHeight + (detailHeight ? detailHeight + 6 : 0));
}

/**
 * Compute absolute positions for every visible node.
 *
 * @param {object} root      tree with { id, label, detail, children }
 * @param {Set}    collapsed ids whose children are hidden
 * @returns {{nodes: Array, edges: Array, width: number, height: number}}
 */
export function layoutTree(root, collapsed = new Set()) {
  if (!root) return { nodes: [], edges: [], width: 0, height: 0 };

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

    for (const child of children) {
      const childPlaced = place(child, depth + 1, childX, cursor);
      edges.push({
        id: `${placed.id}-${childPlaced.id}`,
        from: { x: x + width, y: y + height / 2 },
        to: { x: childX, y: childPlaced.y + childPlaced.height / 2 },
        depth: depth + 1,
        // Colour edges by their top-level branch so the eye can follow a thread.
        branch: depth === 0 ? children.indexOf(child) % 6 : placed.branch
      });
      childPlaced.branch = depth === 0 ? children.indexOf(child) % 6 : placed.branch;
      cursor += child._span + V_GAP;
    }

    return placed;
  }

  const totalHeight = measure(root, 0);
  place(root, 0, 0, 0);

  // Propagate branch colour down each thread (parents are placed before children).
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const target = nodes.find((n) => Math.abs(n.y + n.height / 2 - edge.to.y) < 0.5 && n.x === edge.to.x);
    if (target && target.branch === undefined) target.branch = edge.branch;
  }

  const maxX = Math.max(...nodes.map((n) => n.x + n.width), 0);

  return {
    nodes,
    edges,
    width: maxX,
    height: totalHeight,
    byId
  };
}

/** Cubic bezier connecting two points horizontally. */
export function edgePath({ from, to }) {
  const dx = Math.max(28, (to.x - from.x) * 0.55);
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
