import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutTree, edgePath, flatten, pathTo, withChildren, PLATE_COLORS } from '../lib/layout';
import { api } from '../lib/api';

/**
 * Broadsheet MindMap Canvas Component
 *
 * Interactive, keyboard-navigable mind map.
 * Nodes render as real <button> elements with 3px branch left-borders.
 * Edges are cubic SVG beziers connecting nodes in reading order.
 */
export default function MindMap({ map, onMapChange, onNodeFocus }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [expanding, setExpanding] = useState(null);
  const [view, setView] = useState({ x: 20, y: 20, scale: 1 });
  const [dragging, setDragging] = useState(false);

  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const didFitRef = useRef(false);

  const root = map?.root;
  const { nodes, edges, width, height } = useMemo(
    () => layoutTree(root, collapsed),
    [root, collapsed]
  );

  /* Fit to view */
  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !width || !height) return;

    const padding = 48;
    const scale = Math.min(
      1.1,
      Math.max(
        0.35,
        Math.min(
          (viewport.clientWidth - padding * 2) / width,
          (viewport.clientHeight - padding * 2) / height
        )
      )
    );

    setView({
      scale,
      x: Math.max(16, (viewport.clientWidth - width * scale) / 2),
      y: Math.max(16, (viewport.clientHeight - height * scale) / 2)
    });
  }, [width, height]);

  // Fit once per map on load
  useEffect(() => {
    didFitRef.current = false;
    setCollapsed(new Set());
    setSelected(null);
  }, [map?.id, map?.createdAt]);

  useEffect(() => {
    if (!didFitRef.current && width && height) {
      didFitRef.current = true;
      fit();
    }
  }, [width, height, fit]);

  /* Pan & Zoom */
  const onPointerDown = (event) => {
    if (event.target.closest('[data-node]')) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    };
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
    setView((current) => ({
      ...current,
      scale: Math.min(2.2, Math.max(0.25, current.scale * factor))
    }));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 0.89);
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  /* Node interactions */
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
      if (expanding || !map) return;
      setExpanding(node.id);

      try {
        const path = pathTo(root, node.id) || [node.label];
        const { children } = await api.expandNode(map.title, node.label, node.detail, path);

        if (children?.length) {
          const updated = {
            ...map,
            root: withChildren(root, node.id, [...(node.raw.children || []), ...children])
          };
          onMapChange?.(updated);
          setCollapsed((current) => {
            const next = new Set(current);
            next.delete(node.id);
            return next;
          });
        }
      } catch (err) {
        console.error('Could not expand node:', err);
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

  /* Keyboard navigation */
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
    <div
      id="mindmap-canvas-container"
      className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] border border-[var(--color-divider)]"
    >
      {/* 24px dot grid ground */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in srgb, var(--color-text) 14%, transparent) 1px, transparent 1px)',
          backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
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
        aria-label={`Mind map: ${map.title}. Use arrow keys to navigate.`}
      >
        <div
          className="absolute origin-top-left will-change-transform"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            width,
            height
          }}
        >
          {/* Connector SVG */}
          <svg
            id="mindmap-canvas-svg"
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
                stroke={PLATE_COLORS[edge.branch ?? 0]}
                strokeOpacity={edge.depth === 1 ? 0.6 : 0.4}
                strokeWidth={edge.depth === 1 ? 2.2 : 1.4}
                strokeLinecap="round"
                className="animate-setu-draw"
              />
            ))}
          </svg>

          {/* Placed Nodes */}
          {nodes.map((node) => (
            <Node
              key={node.id}
              node={node}
              color={PLATE_COLORS[node.branch ?? 0]}
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

      {/* Map Controls */}
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

      {/* Bottom hint */}
      <p className="pointer-events-none absolute bottom-3 left-4 text-[11.5px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] select-none">
        Click a topic to read it · double-click to research deeper · arrow keys work too
      </p>
    </div>
  );
}

/* -------------------------------- Node -------------------------------- */

function Node({ node, color, selected, expanding, onSelect, onToggle, onExpand, onKeyDown }) {
  const isRoot = node.depth === 0;
  const labelSize = isRoot ? '16.5px' : node.depth === 1 ? '14px' : '12.5px';

  return (
    <div
      className="absolute animate-setu-rise"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <button
        data-node={node.id}
        onClick={onSelect}
        onDoubleClick={onExpand}
        onKeyDown={onKeyDown}
        aria-expanded={node.childCount ? !node.collapsed : undefined}
        className={`group relative h-full w-full rounded-[var(--radius-md)] bg-[var(--color-bg)] p-2.5 text-left transition-all duration-150 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] ${
          selected
            ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-surface)]'
            : ''
        }`}
        style={{
          borderLeft: `3.5px solid ${isRoot ? 'var(--color-text)' : color}`
        }}
      >
        <span
          className="block font-semibold leading-tight text-[var(--color-text)]"
          style={{ fontSize: labelSize }}
        >
          {node.label}
        </span>
        {node.detail && (
          <span className="mt-1 block text-[11px] leading-snug text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
            {node.detail}
          </span>
        )}
      </button>

      {/* Circular toggle affordance on the edge */}
      <div className="absolute -right-[11px] top-1/2 -translate-y-1/2 z-10">
        {node.childCount > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={node.collapsed ? `Show ${node.childCount} topics` : 'Hide subtopics'}
            title={node.collapsed ? `Show ${node.childCount} topics` : 'Hide subtopics'}
            className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[var(--color-divider)] bg-[var(--color-bg)] text-[10.5px] font-bold text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer"
          >
            {node.collapsed ? node.childCount : '−'}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            disabled={expanding}
            aria-label={`Research deeper into ${node.label}`}
            title="Go deeper"
            className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed border-[var(--color-divider)] bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-text)] opacity-0 group-hover:opacity-100 hover:opacity-100 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-opacity cursor-pointer disabled:opacity-100"
          >
            {expanding ? (
              <i className="ph-duotone ph-spinner animate-spin text-[12px] text-[var(--color-accent)]"></i>
            ) : (
              '+'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Controls ------------------------------ */

function Controls({ scale, onZoomIn, onZoomOut, onFit, onCollapseAll, onExpandAll }) {
  return (
    <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-[var(--radius-md)] bg-[var(--color-bg)] p-1 shadow-[var(--shadow-md)] border border-[var(--color-divider)]">
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
      >
        <i className="ph-duotone ph-plus text-sm"></i>
      </button>
      <span className="text-center font-mono text-[10px] font-semibold text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] select-none py-0.5">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
      >
        <i className="ph-duotone ph-minus text-sm"></i>
      </button>
      <div className="my-0.5 h-px bg-[var(--color-divider)]" />
      <button
        onClick={onFit}
        aria-label="Fit to screen"
        title="Fit to screen"
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
      >
        <i className="ph-duotone ph-arrows-out text-sm"></i>
      </button>
      <button
        onClick={onCollapseAll}
        aria-label="Collapse branches"
        title="Collapse branches"
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
      >
        <i className="ph-duotone ph-tree-structure text-sm"></i>
      </button>
      <button
        onClick={onExpandAll}
        aria-label="Expand all"
        title="Expand all"
        className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
      >
        <i className="ph-duotone ph-arrows-out-line-vertical text-sm"></i>
      </button>
    </div>
  );
}
