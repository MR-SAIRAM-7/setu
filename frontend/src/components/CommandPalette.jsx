import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { savePrefs } from '../lib/storage';

export default function CommandPalette({ isOpen, onClose, currentMap, onStartFocus, onExportMap }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const COMMANDS = [
    // Go Group
    {
      id: 'go-mindmap',
      group: 'Go',
      icon: 'ph-graph',
      label: 'Mind Map',
      hint: 'Ask anything, get an interactive map',
      run: () => navigate('/mindmap')
    },
    {
      id: 'go-library',
      group: 'Go',
      icon: 'ph-books',
      label: 'Library',
      hint: 'Explore all your saved maps',
      run: () => navigate('/library')
    },
    {
      id: 'go-modes',
      group: 'Go',
      icon: 'ph-squares-four',
      label: 'Cognitive Modes',
      hint: 'Seven cognitive disability tools',
      run: () => navigate('/modes')
    },
    {
      id: 'go-settings',
      group: 'Go',
      icon: 'ph-gear',
      label: 'Settings',
      hint: 'Adjust reading typography and preferences',
      run: () => navigate('/settings')
    },

    // Do Group
    {
      id: 'do-focus',
      group: 'Do',
      icon: 'ph-timer',
      label: 'Start a focus session',
      hint: '25-minute calm timer with gentle break',
      run: () => onStartFocus?.()
    },
    {
      id: 'do-simplify',
      group: 'Do',
      icon: 'ph-waves',
      label: 'Simplify some text',
      hint: 'Rewrite dense language to Grade 6 plain words',
      run: () => navigate('/modes?mode=simplify')
    },
    {
      id: 'do-start',
      group: 'Do',
      icon: 'ph-play-circle',
      label: 'Break task freeze',
      hint: 'Get one 10-minute micro action to begin',
      run: () => navigate('/modes?mode=start')
    },
    {
      id: 'do-meet',
      group: 'Do',
      icon: 'ph-users-three',
      label: 'Rescue meeting notes',
      hint: 'Pull decisions, actions, and decode jargon',
      run: () => navigate('/modes?mode=meet')
    },
    {
      id: 'do-export',
      group: 'Do',
      icon: 'ph-export',
      label: 'Export this map to Markdown',
      hint: 'Download full outline and sources',
      run: () => onExportMap?.()
    },

    // Reading Group
    {
      id: 'read-hyper',
      group: 'Reading',
      icon: 'ph-text-aa',
      label: 'Switch to Atkinson Hyperlegible',
      hint: 'High-distinction letterforms for dyslexic readers',
      run: () => savePrefs({ font: 'hyper' })
    },
    {
      id: 'read-serif',
      group: 'Reading',
      icon: 'ph-article',
      label: 'Switch to Source Serif 4',
      hint: 'The default Broadsheet reading serif',
      run: () => savePrefs({ font: 'serif' })
    },
    {
      id: 'read-system',
      group: 'Reading',
      icon: 'ph-browsers',
      label: 'Switch to System sans',
      hint: 'Clean standard system typography',
      run: () => savePrefs({ font: 'system' })
    },
    {
      id: 'read-size',
      group: 'Reading',
      icon: 'ph-magnifying-glass-plus',
      label: 'Set text size to Comfortable (1.1×)',
      hint: 'Larger, more relaxed line height',
      run: () => savePrefs({ textSize: 'comfortable' })
    },
    {
      id: 'read-still',
      group: 'Reading',
      icon: 'ph-pause-circle',
      label: 'Keep it still (Reduce motion)',
      hint: 'Disable all transitions and movement',
      run: () => savePrefs({ motion: 'still' })
    }
  ];

  const filtered = COMMANDS.filter((cmd) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.hint.toLowerCase().includes(q) ||
      cmd.group.toLowerCase().includes(q)
    );
  }).slice(0, 6);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="dialog-backdrop items-start pt-[14vh] px-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="dialog w-full max-w-[560px] p-0 shadow-lg border border-[var(--color-divider)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-[var(--color-divider)] px-4 py-3.5 bg-[var(--color-bg)]">
          <i className="ph-duotone ph-magnifying-glass text-xl text-[var(--color-accent)]"></i>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Do anything, navigate, or change reading mode…"
            className="flex-1 bg-transparent border-0 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] font-[var(--font-body)]"
            aria-label="Command palette input"
          />
          <kbd className="rounded border border-[var(--color-divider)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-[340px] overflow-y-auto p-1.5 bg-[var(--color-bg)]" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13.5px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)]">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    cmd.run();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-left transition-colors cursor-pointer border-0 ${
                    isSelected
                      ? 'bg-[var(--color-accent-100)] text-[var(--color-accent-900)]'
                      : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-accent-100)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <i
                      className={`ph-duotone ${cmd.icon} text-lg ${
                        isSelected ? 'text-[var(--color-accent-700)]' : 'text-[var(--color-accent)]'
                      }`}
                    ></i>
                    <div className="min-w-0">
                      <span className="block text-[14.5px] font-semibold leading-tight truncate">
                        {cmd.label}
                      </span>
                      <span
                        className={`block text-[12px] truncate ${
                          isSelected
                            ? 'text-[var(--color-accent-800)]'
                            : 'text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]'
                        }`}
                      >
                        {cmd.hint}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider ${
                      isSelected
                        ? 'text-[var(--color-accent-700)]'
                        : 'text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]'
                    }`}
                  >
                    {cmd.group}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
