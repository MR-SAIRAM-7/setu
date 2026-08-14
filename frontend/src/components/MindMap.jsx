import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutTree, edgePath, flatten, pathTo, withChildren } from '../lib/layout';
import { api } from '../lib/api';

const BRANCH_COLORS = ['#7c8cff', '#4ade80', '#fbbf24', '#f472b6', '#38bdf8', '#c084fc'];

/**
 * Interactive mind map.
 *
 * Nodes are real <button>s so the whole map is keyboard navigable and readable
 * by a screen reader; only the connecting edges are SVG. Pan by dragging the
 * canvas, zoom with the controls or ctrl+wheel, and click any node to grow it
 * a level deeper via the research engine.
 */
export default function MindMap({ map, onMapChange, onNodeFocus }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [expanding, setExpanding] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);

  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const didFitRef = useRef(false);

  const root = map?.root;
  const { nodes, edges, width, height } = useMemo(
    () => layoutTree(root, collapsed),
    [root, collapsed]
  );

  /* ----------------------------------------------------------------- */
  /* Fit to view                                                       */
  /* ----------------------------------------------------------------- */

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !width || !height) return;

    const padding = 56;
    const scale = Math.min(
      1,
      (viewport.clientWidth - padding * 2) / width,
      (viewport.clientHeight - padding * 2) / height
    );
    const safeScale = Math.max(0.25, scale);

    setView({
      scale: safeScale,
      x: (viewport.clientWidth - width * safeScale) / 2,
      y: (viewport.clientHeight - height * safeScale) / 2
    });
  }, [width, height]);

  // Fit once per map, not on every expansion — refitting mid-exploration
  // would yank the view away from what the user is reading.
  useEffect(() => {
    didFitRef.current = false;
    setCollapsed(new Set());
    setSelected(null);
  }, [map?.createdAt]);

  useEffect(() => {
    if (!didFitRef.current && width && height) {
      didFitRef.current = true;
      fit();
    }
  }, [width, height, fit]);

  /* ----------------------------------------------------------------- */
  /* Pan & zoom                                                        */
  /* ----------------------------------------------------------------- */

  const onPointerDown = (event) => {
    // Only pan from empty canvas, never from a node.
    if (event.target.closest('[data-node]')) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setView((current) => ({
      ...current,
      x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (event.clientY - dragRef.current.startY)
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const zoomBy = (factor) =>
    setView((current) => ({ ...current, scale: Math.min(2, Math.max(0.25, current.scale * factor)) }));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event) => {
      // Plain wheel scrolls the page; ctrl/⌘+wheel is the zoom gesture.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 0.89);
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  /* ----------------------------------------------------------------- */
  /* Node interaction                                                  */
  /* ----------------------------------------------------------------- */

  const toggleCollapse = (id) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expand = useCallback(
    async (node) => {
      if (expanding) return;
      setExpanding(node.id);

      try {
        const path = pathTo(root, node.id) || [node.label];
        const { children } = await api.expandNode(map.title, node.label, node.detail, path);

        if (children?.length) {
          onMapChange({
            ...map,
            root: withChildren(root, node.id, [...(node.raw.children || []), ...children])
          });
          // Newly grown children should be visible immediately.
          setCollapsed((current) => {
            const next = new Set(current);
            next.delete(node.id);
            return next;
          });
        }
      } catch (error) {
        console.error('Could not expand node:', error);
      } finally {
        setExpanding(null);
      }
    },
    [expanding, map, root, onMapChange]
  );

  const selectNode = (node) => {
    setSelected(node.id);
    onNodeFocus?.(node);
  };

  /* Keyboard: arrows move through the tree in reading order. */
  const order = useMemo(() => flatten(root, collapsed), [root, collapsed]);

  const onKeyDown = (event, node) => {
    const index = order.findIndex((n) => n.id === node.id);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = order[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) document.querySelector(`[data-node="${next.id}"]`)?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!collapsed.has(node.id) && node.childCount) toggleCollapse(node.id);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (collapsed.has(node.id)) toggleCollapse(node.id);
      else if (!node.childCount) expand(node);
    }
  };

  if (!root) return null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-ink-950/60 border border-white/10">
      {/* dotted grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.14) 1px, transparent 1px)',
          backgroundSize: `${26 * view.scale}px ${26 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`
        }}
      />

      <div
        ref={viewportRef}
        className={`absolute inset-0 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="application"
        aria-label={`Mind map: ${map.title}. Use arrow keys to move between topics.`}
      >
        <div
          className="absolute origin-top-left will-change-transform"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            width,
            height
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={width}
            height={height}
            aria-hidden
          >
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edgePath(edge)}
                fill="none"
                stroke={BRANCH_COLORS[edge.branch ?? 0]}
                strokeOpacity={0.45}
                strokeWidth={edge.depth === 1 ? 2.2 : 1.5}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {nodes.map((node) => (
            <Node
              key={node.id}
              node={node}
              color={BRANCH_COLORS[node.branch ?? 0]}
              selected={selected === node.id}
              expanding={expanding === node.id}
              onSelect={() => selectNode(node)}
              onToggle={() => toggleCollapse(node.id)}
              onExpand={() => expand(node)}
              onKeyDown={(event) => onKeyDown(event, node)}
            />
          ))}
        </div>
      </div>

      <Controls
        scale={view.scale}
        onZoomIn={() => zoomBy(1.18)}
        onZoomOut={() => zoomBy(0.85)}
        onFit={fit}
        onCollapseAll={() =>
          setCollapsed(new Set(nodes.filter((n) => n.depth >= 1 && n.childCount).map((n) => n.id)))
        }
        onExpandAll={() => setCollapsed(new Set())}
      />

      <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-500">
        Drag to pan · Ctrl+scroll to zoom · Click a topic to go deeper
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Node({ node, color, selected, expanding, onSelect, onToggle, onExpand, onKeyDown }) {
  const isRoot = node.depth === 0;

  return (
    <div
      className="absolute"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <button
        data-node={node.id}
        onClick={onSelect}
        onDoubleClick={onExpand}
        onKeyDown={onKeyDown}
        aria-expanded={node.childCount ? !node.collapsed : undefined}
        className={`group h-full w-full rounded-xl border px-3.5 py-2.5 text-left transition-all
          ${
            isRoot
              ? 'bg-gradient-to-br from-iris-500/25 to-iris-500/5 border-iris-500/60 shadow-glow'
              : 'bg-ink-800/90 border-white/10 hover:border-white/25'
          }
          ${selected ? 'ring-2 ring-iris-400 ring-offset-2 ring-offset-ink-950' : ''}
          hover:-translate-y-px hover:shadow-lift`}
        style={!isRoot ? { borderLeft: `3px solid ${color}` } : undefined}
      >
        <span
          className={`block font-bold leading-snug ${
            isRoot ? 'text-[15.5px] text-white' : 'text-[13.5px] text-slate-100'
          }`}
        >
          {node.label}
        </span>
        {node.detail && (
          <span className="mt-1 block text-[11.5px] leading-relaxed text-slate-400">
            {node.detail}
          </span>
        )}
      </button>

      {/* Collapse / grow affordance, on the edge side of the node. */}
      <div className="absolute -right-3 top-1/2 -translate-y-1/2">
        {node.childCount > 0 ? (
          <button
            onClick={onToggle}
            aria-label={node.collapsed ? `Show ${node.childCount} subtopics` : 'Hide subtopics'}
            title={node.collapsed ? `Show ${node.childCount} subtopics` : 'Hide subtopics'}
            className="grid h-6 w-6 place-items-center rounded-full border border-white/20
                       bg-ink-700 text-[11px] font-extrabold text-slate-200 shadow-card
                       hover:border-iris-400 hover:text-white"
          >
            {node.collapsed ? node.childCount : '−'}
          </button>
        ) : (
          <button
            onClick={onExpand}
            disabled={expanding}
            aria-label={`Research deeper into ${node.label}`}
            title="Go deeper"
            className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-white/25
                       bg-ink-800/80 text-[13px] font-bold text-slate-400 opacity-0
                       transition-opacity hover:border-mint-400 hover:text-mint-400
                       focus:opacity-100 group-hover:opacity-100
                       [div:hover>&]:opacity-100 disabled:opacity-100"
          >
            {expanding ? <span className="animate-breathe">·</span> : '+'}
          </button>
        )}
      </div>
    </div>
  );
}

function Controls({ scale, onZoomIn, onZoomOut, onFit, onCollapseAll, onExpandAll }) {
  const Btn = ({ children, ...props }) => (
    <button
      {...props}
      className="grid h-8 w-8 place-items-center rounded-lg text-slate-300
                 hover:bg-white/10 hover:text-white text-sm font-bold"
    >
      {children}
    </button>
  );

  return (
    <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-xl border border-white/10 bg-ink-800/90 p-1 shadow-card backdrop-blur">
      <Btn onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">+</Btn>
      <span className="text-center text-[10px] font-bold text-slate-500">
        {Math.round(scale * 100)}%
      </span>
      <Btn onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">−</Btn>
      <div className="my-0.5 h-px bg-white/10" />
      <Btn onClick={onFit} aria-label="Fit to screen" title="Fit to screen">⤢</Btn>
      <Btn onClick={onCollapseAll} aria-label="Collapse all" title="Collapse all">⊟</Btn>
      <Btn onClick={onExpandAll} aria-label="Expand all" title="Expand all">⊞</Btn>
    </div>
  );
}
