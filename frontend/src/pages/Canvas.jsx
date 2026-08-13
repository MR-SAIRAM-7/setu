import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, Download, ZoomIn, ZoomOut, Maximize, MousePointer2, Type, Plus, RefreshCw } from 'lucide-react';
import { dbService } from '../services/supabaseClient';
import { callModeApi } from '../services/apiService';
import { useTheme } from '../contexts/ThemeContext';

const initialNodes = [
  { id: 'root', text: 'Central Idea', x: 400, y: 300, color: 'var(--color-primary)' }
];
const initialEdges = [];

const Canvas = () => {
  const { theme } = useTheme();
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  const [dragNodeId, setDragNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  
  const svgRef = useRef(null);

  useEffect(() => {
    loadMindmap();
  }, []);

  const loadMindmap = async () => {
    try {
      const maps = await dbService.getMindmaps();
      if (maps && maps.length > 0) {
        const latest = maps[0];
        if (latest.nodes_json) setNodes(latest.nodes_json);
        if (latest.edges_json) setEdges(latest.edges_json);
      }
    } catch (err) {
      console.error('Failed to load mindmap', err);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomAdjust = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(Math.max(0.5, z + zoomAdjust), 3));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handlePointerDown = (e) => {
    if (e.target.tagName === 'svg') {
      setIsPanning(true);
    }
  };

  const handlePointerMove = (e) => {
    if (isPanning) {
      setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
    } else if (dragNodeId) {
      setNodes(nds => nds.map(n => 
        n.id === dragNodeId 
          ? { ...n, x: n.x + e.movementX / zoom, y: n.y + e.movementY / zoom }
          : n
      ));
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setDragNodeId(null);
  };

  const addNode = (parentId) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      text: 'New Node',
      x: parent.x + 150 + Math.random() * 50,
      y: parent.y + (Math.random() - 0.5) * 100,
      color: 'var(--color-secondary)'
    };
    
    setNodes([...nodes, newNode]);
    setEdges([...edges, { from: parentId, to: newNodeId }]);
  };

  const saveMindmap = async () => {
    try {
      await dbService.saveMindmap({
        title: 'Mindmap ' + new Date().toLocaleDateString(),
        nodes_json: nodes,
        edges_json: edges
      });
      alert('Saved successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const exportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mindmap.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 glass-card px-4 py-2 flex items-center gap-4 rounded-full shadow-elevated">
        <button className="p-2 hover:bg-slate-100 rounded-full" onClick={() => setZoom(z => Math.min(z + 0.1, 3))} aria-label="Zoom In">
          <ZoomIn size={20} className="text-slate-700" />
        </button>
        <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button className="p-2 hover:bg-slate-100 rounded-full" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} aria-label="Zoom Out">
          <ZoomOut size={20} className="text-slate-700" />
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <button className="p-2 hover:bg-slate-100 rounded-full flex items-center gap-2" onClick={saveMindmap}>
          <Save size={18} className="text-slate-700" />
          <span className="text-sm font-medium hidden sm:inline">Save</span>
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-full flex items-center gap-2" onClick={exportJson}>
          <Download size={18} className="text-slate-700" />
          <span className="text-sm font-medium hidden sm:inline">Export</span>
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const path = `M ${fromNode.x} ${fromNode.y} C ${fromNode.x + dx/2} ${fromNode.y}, ${fromNode.x + dx/2} ${toNode.y}, ${toNode.x} ${toNode.y}`;
            
            return (
              <path key={`edge-${i}`} d={path} fill="none" stroke="#cbd5e1" strokeWidth="2" />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g 
              key={node.id} 
              transform={`translate(${node.x}, ${node.y})`}
              onPointerDown={(e) => { e.stopPropagation(); setDragNodeId(node.id); }}
            >
              <rect
                x="-60" y="-25" width="120" height="50" rx="12"
                fill="white" stroke={node.color || '#4a7c59'} strokeWidth="2"
                className="cursor-move shadow-soft"
                onClick={() => setEditingNodeId(node.id)}
              />
              {editingNodeId === node.id ? (
                <foreignObject x="-55" y="-15" width="110" height="30">
                  <input
                    type="text"
                    autoFocus
                    defaultValue={node.text}
                    className="w-full h-full bg-transparent text-center text-sm font-medium outline-none"
                    onBlur={(e) => {
                      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, text: e.target.value } : n));
                      setEditingNodeId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                    }}
                  />
                </foreignObject>
              ) : (
                <text x="0" y="5" textAnchor="middle" className="text-sm font-medium pointer-events-none fill-slate-800">
                  {node.text}
                </text>
              )}
              {/* Add child button */}
              <circle
                cx="60" cy="0" r="10"
                fill="#f1f5f9" stroke="#cbd5e1"
                className="cursor-pointer hover:fill-slate-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); addNode(node.id); }}
              />
              <path d="M 57 0 L 63 0 M 60 -3 L 60 3" stroke="#64748b" strokeWidth="1.5" className="pointer-events-none" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default Canvas;
