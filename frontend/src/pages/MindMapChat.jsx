import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MindMap from '../components/MindMap';
import { streamChat, api } from '../lib/api';
import { saveMap, listMaps, DEFAULT_WORKED_MAP } from '../lib/storage';

const SUGGESTIONS = [
  'How does a transformer neural network work?',
  'Why did attention beat recurrence in LSTMs?',
  'How do vaccines actually train the immune system?',
  'The causes of the French Revolution',
  'How does compound interest build wealth?'
];

export default function MindMapChat() {
  const [messages, setMessages] = useState([]);
  const [map, setMap] = useState(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showChat, setShowChat] = useState(true);
  const [handoffBanner, setHandoffBanner] = useState(null);

  const abortRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const [params, setParams] = useSearchParams();

  // Load default initial map if none is open
  useEffect(() => {
    if (!map) {
      const stored = listMaps();
      const current = stored[0] || DEFAULT_WORKED_MAP;
      setMap(current);
    }
  }, []);

  // Check URL parameters for search query or extension import
  useEffect(() => {
    const topicParam = params.get('topic');
    if (topicParam && !busy && messages.length === 0) {
      params.delete('topic');
      setParams(params, { replace: true });
      send(topicParam);
    }
  }, [params, setParams]);

  /* Handle Extension Import Handoff */
  useEffect(() => {
    const imported = params.get('import');
    if (!imported) return;

    try {
      const payload = JSON.parse(decodeURIComponent(imported));
      params.delete('import');
      setParams(params, { replace: true });

      setHandoffBanner({
        title: payload.title || 'Page sent from Lens',
        url: payload.url || ''
      });

      setMessages([
        { role: 'user', content: `Map this page for me: ${payload.title}` },
        {
          role: 'assistant',
          content: `Reading “${payload.title}” and laying out an accessible mind map…`
        }
      ]);
      setBusy(true);
      setStatus('Reading around the topic…');

      api
        .mindMap(payload.title, payload.text?.slice(0, 12000) || '')
        .then((fresh) => {
          const withHandoff = { ...fresh, isLensHandoff: true };
          setMap(withHandoff);
          saveMap(withHandoff);
          setMessages((current) => [
            ...current,
            { role: 'assistant', content: `Here's your map of **${fresh.title}**.` }
          ]);
        })
        .catch((err) => setError(err.message))
        .finally(() => {
          setBusy(false);
          setStatus(null);
        });
    } catch (_) {
      // Ignore malformed import
    }
  }, [params, setParams]);

  /* Auto-scroll transcript */
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  /* Cancel stream on unmount */
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (raw) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;

      setInput('');
      setError(null);
      setBusy(true);
      setStatus('Reading around the topic…');

      const history = [...messages, { role: 'user', content: text }];
      setMessages(history);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          {
            messages: history.map(({ role, content }) => ({ role, content })),
            map: map ? { title: map.title, summary: map.summary, root: map.root } : null
          },
          {
            onStatus: (update) => setStatus(update.message || update.stage),
            onReply: (reply) =>
              setMessages((current) => [...current, { role: 'assistant', content: reply.text }]),
            onMap: (fresh) => {
              setMap(fresh);
              setDetail(null);
              saveMap(fresh);
              setMessages((current) => [
                ...current,
                { role: 'assistant', content: `Here's your map of **${fresh.title}**.` }
              ]);
            },
            onError: (payload) => setError(payload.message)
          },
          controller.signal
        );
      } catch (streamError) {
        if (streamError.name !== 'AbortError') {
          setError(
            streamError.message ||
              'Could not reach the SETU engine. Make sure the backend is running (npm start in /backend).'
          );
        }
      } finally {
        setBusy(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [input, busy, messages, map]
  );

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setStatus(null);
  };

  const startNewMap = () => {
    stop();
    setMessages([]);
    setMap(null);
    setDetail(null);
    setError(null);
    setHandoffBanner(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-[var(--color-bg)]">
      {/* --------------------------- Conversation Pane (392px fixed) --------------------------- */}
      <section
        className={`flex flex-col border-r border-[var(--color-divider)] bg-[var(--color-bg)] transition-all duration-200 ${
          showChat ? 'lg:w-[392px] lg:shrink-0 w-full' : 'lg:w-12 lg:shrink-0 hidden lg:flex'
        }`}
        aria-label="Conversation"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-divider)]">
          {showChat ? (
            <>
              <div>
                <h1 className="text-[20px] font-bold text-[var(--color-text)]">Ask anything</h1>
                <p className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
                  I'll research it and lay it out as a map
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={startNewMap}
                  className="btn btn-ghost !min-h-[30px] !px-2.5 text-[12px]"
                  title="Start a new map"
                >
                  New map
                </button>
                <button
                  onClick={() => setShowChat(false)}
                  className="btn btn-quiet !min-h-[30px] !px-2 hidden lg:inline-flex"
                  aria-label="Collapse conversation panel"
                >
                  <i className="ph-duotone ph-caret-left text-base"></i>
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowChat(true)}
              className="btn btn-quiet !min-h-[36px] !px-2 w-full justify-center"
              aria-label="Expand conversation panel"
            >
              <i className="ph-duotone ph-caret-right text-base"></i>
            </button>
          )}
        </header>

        {showChat && (
          <>
            {/* Extension Handoff Moment Banner */}
            {handoffBanner && (
              <div className="mx-4 mt-3 p-3.5 bg-[var(--color-accent-100)] border border-[var(--color-accent-300)] rounded-[var(--radius-md)] flex items-start justify-between gap-3 text-left animate-setu-rise">
                <div className="flex items-start gap-2.5">
                  <i className="ph-duotone ph-arrow-square-in text-xl text-[var(--color-accent-700)] shrink-0 mt-0.5"></i>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--color-accent-900)] leading-tight">
                      Sent over from Lens
                    </p>
                    <p className="text-[12px] text-[var(--color-accent-800)] mt-0.5 leading-snug">
                      The page you were reading — <em>{handoffBanner.title}</em> — came across and
                      became the map on the right.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHandoffBanner(null)}
                  className="text-[var(--color-accent-700)] hover:text-[var(--color-accent-900)] p-1 bg-transparent border-0 cursor-pointer"
                  aria-label="Dismiss banner"
                >
                  <i className="ph-duotone ph-x text-sm"></i>
                </button>
              </div>
            )}

            {/* Transcript Area */}
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-left"
              role="log"
              aria-live="polite"
            >
              {messages.length === 0 && !busy && (
                <div className="space-y-4 py-2">
                  <p className="text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
                    Name any complex topic. SETU researches it and organizes it into an interactive
                    visual hierarchy.
                  </p>
                  <div className="space-y-2 pt-2">
                    <span className="kicker block">Try an example</span>
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => send(suggestion)}
                        className="block w-full p-2.5 rounded-[var(--radius-md)] border border-[var(--color-divider)] text-left text-[13px] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-100)] hover:text-[var(--color-accent-900)] transition-colors cursor-pointer bg-transparent"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <MessageItem key={index} role={message.role} content={message.content} />
              ))}

              {/* 3-Stage Progress Lines (Never a dead panel) */}
              {busy && <StagedProgress status={status} />}

              {error && (
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-accent-2-100)] border border-[var(--color-accent-2)] text-[13px] text-[var(--color-accent-2-900)] leading-snug">
                  {error}
                </div>
              )}
            </div>

            {/* Follow-up suggestions */}
            {map?.followUps?.length > 0 && !busy && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-t border-[var(--color-divider)] bg-[var(--color-surface)]">
                {map.followUps.slice(0, 3).map((question) => (
                  <button
                    key={question}
                    onClick={() => send(question)}
                    className="tag tag-outline hover:border-[var(--color-accent)] hover:text-[var(--color-accent-700)] text-left cursor-pointer"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 p-3 border-t border-[var(--color-divider)] bg-[var(--color-bg)]"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={map ? 'Ask a follow-up, or name a new topic…' : 'Name any topic…'}
                className="input min-h-[44px] text-[14px]"
                aria-label="Message prompt"
                disabled={busy}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  className="btn btn-ghost min-h-[44px] px-3.5"
                  aria-label="Stop research"
                >
                  <i className="ph-duotone ph-stop text-lg text-[var(--color-accent-2)]"></i>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="btn btn-primary min-h-[44px] px-4"
                  aria-label="Send message"
                >
                  <i className="ph-duotone ph-arrow-up text-lg"></i>
                </button>
              )}
            </form>
          </>
        )}
      </section>

      {/* --------------------------- Flexible Map Pane --------------------------- */}
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-5 gap-3"
        aria-label="Mind map canvas"
      >
        {map ? (
          <>
            {/* Map Header with flex-wrap and 1 1 260px basis */}
            <header className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)] shadow-[var(--shadow-sm)]">
              <div className="flex-1 basis-[260px] min-w-0 text-left">
                <h2 className="text-[19px] sm:text-[22px] font-bold text-[var(--color-text)] truncate leading-tight">
                  {map.title}
                </h2>
                <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] truncate mt-0.5">
                  {map.summary}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="tag tag-neutral">{countNodes(map.root)} topics</span>
                {map.grounded ? (
                  <span className="tag tag-accent">
                    <i className="ph-duotone ph-globe"></i>
                    {map.sources?.length || 0} web sources
                  </span>
                ) : (
                  <span className="tag tag-neutral" title="Built from verified model knowledge">
                    model knowledge
                  </span>
                )}
                <button
                  onClick={() => downloadMarkdown(map)}
                  className="btn btn-secondary !min-h-[32px] !px-3 text-[12.5px]"
                >
                  <i className="ph-duotone ph-export"></i>
                  Export
                </button>
              </div>
            </header>

            {/* Mind Map Canvas floor flex: 1 1 300px */}
            <div className="flex-1 basis-[300px] min-h-[300px] relative">
              <MindMap
                map={map}
                onMapChange={(next) => {
                  setMap(next);
                  saveMap(next);
                }}
                onNodeFocus={setDetail}
              />
            </div>

            {/* Detail Panel below canvas when a node is clicked */}
            {detail && (
              <aside className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)] shadow-[var(--shadow-sm)] animate-setu-rise max-h-[32vh] overflow-y-auto text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 max-w-[76ch]">
                    <span className="kicker block mb-1">Selected topic</span>
                    <h3 className="text-[19px] font-bold text-[var(--color-text)] leading-tight">
                      {detail.label}
                    </h3>
                    {detail.detail && (
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
                        {detail.detail}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                    className="btn btn-quiet !min-h-[28px] !px-2"
                    aria-label="Close topic detail"
                  >
                    <i className="ph-duotone ph-x text-base"></i>
                  </button>
                </div>

                <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-[var(--color-divider)]">
                  <button
                    onClick={() => send(`Tell me more about "${detail.label}"`)}
                    className="btn btn-secondary !min-h-[32px] text-[12px]"
                  >
                    <i className="ph-duotone ph-chats-circle"></i>
                    Ask about this
                  </button>
                  <button
                    onClick={() => send(`Go one level deeper into "${detail.label}" in the map`)}
                    className="btn btn-ghost !min-h-[32px] text-[12px]"
                  >
                    <i className="ph-duotone ph-tree-structure"></i>
                    Go one level deeper
                  </button>
                </div>
              </aside>
            )}
          </>
        ) : (
          <EmptyCanvas busy={busy} status={status} onStart={() => inputRef.current?.focus()} />
        )}
      </section>
    </div>
  );
}

/* ------------------------------ Transcript Items ------------------------------ */

function MessageItem({ role, content }) {
  const isUser = role === 'user';

  // Render markdown bold highlights
  const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-[var(--color-text)]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );

  if (isUser) {
    return (
      <div className="flex justify-end animate-setu-rise">
        <div
          className="max-w-[85%] px-4 py-2.5 text-[14px] leading-relaxed shadow-[var(--shadow-sm)]"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 2px var(--radius-lg)'
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  // Assistant messages are plain text at 84% ink — NOT bubbles!
  return (
    <div className="flex justify-start animate-setu-rise">
      <div className="text-[15px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_84%,transparent)] max-w-[95%]">
        {parts}
      </div>
    </div>
  );
}

/* ------------------------------ 3-Stage Progress ------------------------------ */

function StagedProgress({ status }) {
  const isFinding = status?.includes('branch') || status?.includes('tree') || status?.includes('deeper');
  const isDrawing = status?.includes('Draw') || status?.includes('map') || status?.includes('final');

  return (
    <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2 text-left animate-setu-rise">
      <div
        className={`flex items-center gap-2.5 text-[13px] ${
          !isFinding && !isDrawing
            ? 'text-[var(--color-accent-700)] font-semibold'
            : 'text-[color-mix(in_srgb,var(--color-text)_40%,transparent)]'
        }`}
      >
        <i className="ph-duotone ph-book-open text-base"></i>
        <span>Reading around the topic</span>
      </div>
      <div
        className={`flex items-center gap-2.5 text-[13px] ${
          isFinding && !isDrawing
            ? 'text-[var(--color-accent-700)] font-semibold'
            : 'text-[color-mix(in_srgb,var(--color-text)_40%,transparent)]'
        }`}
      >
        <i className="ph-duotone ph-tree-structure text-base"></i>
        <span>Finding the branches</span>
      </div>
      <div
        className={`flex items-center gap-2.5 text-[13px] ${
          isDrawing
            ? 'text-[var(--color-accent-700)] font-semibold'
            : 'text-[color-mix(in_srgb,var(--color-text)_40%,transparent)]'
        }`}
      >
        <i className="ph-duotone ph-pen-nib text-base"></i>
        <span>Drawing your map</span>
      </div>
    </div>
  );
}

/* ------------------------------ Empty Canvas ------------------------------ */

function EmptyCanvas({ busy, status, onStart }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-center bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)]">
      <div className="max-w-md space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent)] text-2xl">
          <i className="ph-duotone ph-graph"></i>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {busy ? status || 'Researching topic…' : 'Your map appears here'}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            {busy
              ? 'Exploring verified references and mapping out clear cognitive branches.'
              : 'Type any question on the left or try an example suggestion to generate an interactive map.'}
          </p>
        </div>
        {!busy && (
          <button onClick={onStart} className="btn btn-primary text-sm font-semibold mt-2">
            Ask a question
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Helpers ------------------------------ */

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function downloadMarkdown(map) {
  const lines = [`# ${map.title}`, '', map.summary || '', ''];

  if (map.keyFacts?.length) {
    lines.push('## Key facts', ...map.keyFacts.map((fact) => `- ${fact}`), '');
  }

  const walk = (node, depth) => {
    lines.push(`${'  '.repeat(Math.max(0, depth - 1))}- **${node.label}** — ${node.detail || ''}`);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  };
  lines.push('## Mind Map Outline');
  (map.root?.children || []).forEach((branch) => walk(branch, 1));

  if (map.sources?.length) {
    lines.push(
      '',
      '## Sources',
      ...map.sources.map((source) => `- [${source.title}](${source.url})`)
    );
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(map.title || 'setu-mindmap').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}
