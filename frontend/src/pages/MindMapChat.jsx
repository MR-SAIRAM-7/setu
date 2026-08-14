import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MindMap from '../components/MindMap';
import { streamChat, api } from '../lib/api';
import { saveMap } from '../lib/storage';

const SUGGESTIONS = [
  'How do vaccines actually work?',
  'The causes of the French Revolution',
  'Explain how a transformer neural network works',
  'What happens during photosynthesis?',
  'How does compound interest build wealth?'
];

/**
 * The mind-map chat.
 *
 * Ask about any topic in plain language; the agent researches it and the map
 * appears beside the conversation. Follow-ups either deepen the current map or
 * are answered against it, so the conversation and the diagram stay in step.
 */
export default function MindMapChat() {
  const [messages, setMessages] = useState([]);
  const [map, setMap] = useState(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showChat, setShowChat] = useState(true);

  const abortRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const [params, setParams] = useSearchParams();

  /* Auto-scroll the transcript as it grows. */
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  /* Cancel any in-flight stream when leaving the page. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (raw) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;

      setInput('');
      setError(null);
      setBusy(true);

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
            onStatus: (update) => setStatus(update.message),
            onReply: (reply) =>
              setMessages((current) => [...current, { role: 'assistant', content: reply.text }]),
            onMap: (fresh) => {
              setMap(fresh);
              setDetail(null);
              saveMap(fresh);
              setMessages((current) => [
                ...current,
                { role: 'assistant', content: `Here's your map of **${fresh.title}**.`, mapRef: fresh.title }
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
              'Could not reach the SETU engine. Make sure the backend is running.'
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

  /* Content handed over from the browser extension arrives in the URL hash. */
  useEffect(() => {
    const imported = params.get('import');
    if (!imported) return;

    try {
      const payload = JSON.parse(decodeURIComponent(imported));
      params.delete('import');
      setParams(params, { replace: true });

      setMessages([
        { role: 'user', content: `Map this page for me: ${payload.title}` },
        { role: 'assistant', content: `Reading “${payload.title}” and building your map…` }
      ]);
      setBusy(true);
      setStatus('Researching the page you sent…');

      api
        .mindMap(payload.title, payload.text?.slice(0, 12000) || '')
        .then((fresh) => {
          setMap(fresh);
          saveMap(fresh);
          setMessages((current) => [
            ...current,
            { role: 'assistant', content: `Here's your map of **${fresh.title}**.` }
          ]);
        })
        .catch((importError) => setError(importError.message))
        .finally(() => {
          setBusy(false);
          setStatus(null);
        });
    } catch (_) {
      /* malformed handoff — ignore rather than crash the page */
    }
  }, [params, setParams]);

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setStatus(null);
  };

  const startOver = () => {
    stop();
    setMessages([]);
    setMap(null);
    setDetail(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col lg:flex-row gap-4 p-4">
      {/* ------------------------------ chat ------------------------------ */}
      <section
        className={`card flex min-h-0 flex-col ${showChat ? 'lg:w-[400px] lg:shrink-0' : 'lg:w-14 lg:shrink-0'} transition-all`}
        aria-label="Conversation"
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          {showChat ? (
            <>
              <div>
                <h1 className="text-sm font-bold">Ask anything</h1>
                <p className="text-[11.5px] text-slate-500">I'll research it and draw you a map</p>
              </div>
              <div className="flex gap-1">
                {messages.length > 0 && (
                  <button onClick={startOver} className="btn-quiet !min-h-[30px] !px-2 text-[11px]">
                    New
                  </button>
                )}
                <button
                  onClick={() => setShowChat(false)}
                  className="btn-quiet !min-h-[30px] !px-2 hidden lg:inline-flex"
                  aria-label="Collapse conversation"
                >
                  ‹
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowChat(true)}
              className="btn-quiet !min-h-[30px] !px-2 w-full"
              aria-label="Show conversation"
            >
              ›
            </button>
          )}
        </header>

        {showChat && (
          <>
            <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
              {messages.length === 0 && !busy && <Welcome onPick={send} />}

              {messages.map((message, index) => (
                <Bubble key={index} role={message.role} content={message.content} />
              ))}

              {status && (
                <div className="flex items-center gap-2 px-1 text-[12.5px] text-iris-300">
                  <Dots />
                  <span>{status}</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-[12.5px] text-rose-200">
                  {error}
                </div>
              )}
            </div>

            {map?.followUps?.length > 0 && !busy && (
              <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-4 py-3">
                {map.followUps.slice(0, 3).map((question) => (
                  <button
                    key={question}
                    onClick={() => send(question)}
                    className="chip hover:border-iris-500/70 hover:text-white text-left"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex gap-2 border-t border-white/10 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={map ? 'Ask a follow-up, or name a new topic…' : 'Name any topic…'}
                className="input !py-2.5"
                aria-label="Your message"
                disabled={busy}
              />
              {busy ? (
                <button type="button" onClick={stop} className="btn-ghost !px-3" aria-label="Stop">
                  ■
                </button>
              ) : (
                <button type="submit" className="btn-primary !px-4" disabled={!input.trim()} aria-label="Send">
                  ↑
                </button>
              )}
            </form>
          </>
        )}
      </section>

      {/* ------------------------------ map ------------------------------- */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3" aria-label="Mind map">
        {map ? (
          <>
            <MapHeader map={map} />
            <div className="min-h-0 flex-1">
              <MindMap
              map={map}
              // Persist growth too, so an expanded branch survives a reload.
              onMapChange={(next) => {
                setMap(next);
                saveMap(next);
              }}
              onNodeFocus={setDetail}
            />
            </div>
            {detail && <NodeDetail node={detail} onClose={() => setDetail(null)} onAsk={send} />}
          </>
        ) : (
          <EmptyCanvas busy={busy} status={status} />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Welcome({ onPick }) {
  return (
    <div className="animate-fade-up space-y-4 py-3">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-white">What would you like to understand?</h2>
        <p className="text-[13px] leading-relaxed text-slate-400">
          Name any topic. I'll research it, then lay it out as a map you can open up one
          piece at a time — instead of a wall of text.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="label">Try one</p>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPick(suggestion)}
            className="block w-full rounded-lg border border-white/10 bg-ink-700/40 px-3 py-2
                       text-left text-[12.5px] text-slate-300 transition-colors
                       hover:border-iris-500/60 hover:bg-ink-700 hover:text-white"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ role, content }) {
  const isUser = role === 'user';

  // Render **bold** without pulling in a markdown dependency for one feature.
  const html = content.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-bold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );

  return (
    <div className={`flex animate-fade-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-iris-500 font-medium text-ink-950'
            : 'rounded-bl-sm border border-white/10 bg-ink-700/70 text-slate-200'
        }`}
      >
        {html}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-breathe rounded-full bg-iris-400"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </span>
  );
}

function MapHeader({ map }) {
  return (
    <header className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold text-white">{map.title}</h2>
        <p className="line-clamp-1 text-[12px] text-slate-400">{map.summary}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className="chip">{countNodes(map.root)} topics</span>
        {map.grounded ? (
          <span className="chip !border-mint-400/40 !text-mint-300">
            {map.sources?.length || 0} sources
          </span>
        ) : (
          <span className="chip" title="Built from the model's own knowledge, not live web sources">
            model knowledge
          </span>
        )}
        <button onClick={() => downloadMarkdown(map)} className="btn-ghost !min-h-[32px] !px-3 text-[12px]">
          Export
        </button>
      </div>
    </header>
  );
}

function NodeDetail({ node, onClose, onAsk }) {
  return (
    <aside className="card animate-fade-up px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label mb-1">Selected topic</p>
          <h3 className="text-[14px] font-bold text-white">{node.label}</h3>
          {node.detail && <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">{node.detail}</p>}
        </div>
        <button onClick={onClose} className="btn-quiet !min-h-[28px] !px-2" aria-label="Close details">
          ×
        </button>
      </div>
      <button
        onClick={() => onAsk(`Tell me more about "${node.label}"`)}
        className="btn-ghost mt-3 !min-h-[32px] text-[12px]"
      >
        Ask about this
      </button>
    </aside>
  );
}

function EmptyCanvas({ busy, status }) {
  return (
    <div className="card grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <div
          className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-iris-500/40
            bg-iris-500/10 text-2xl ${busy ? 'animate-breathe' : ''}`}
          aria-hidden
        >
          ◈
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-white">
            {busy ? status || 'Working on it…' : 'Your map appears here'}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-400">
            {busy
              ? 'Researching the topic, then laying out the branches.'
              : 'Ask about a topic on the left and it will be researched and drawn as an interactive map you can expand.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function downloadMarkdown(map) {
  const lines = [`# ${map.title}`, '', map.summary, ''];

  if (map.keyFacts?.length) {
    lines.push('## Key facts', ...map.keyFacts.map((fact) => `- ${fact}`), '');
  }

  const walk = (node, depth) => {
    lines.push(`${'  '.repeat(Math.max(0, depth - 1))}- **${node.label}** — ${node.detail}`);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  };
  lines.push('## Map');
  (map.root?.children || []).forEach((branch) => walk(branch, 1));

  if (map.sources?.length) {
    lines.push('', '## Sources', ...map.sources.map((source) => `- [${source.title}](${source.url})`));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${map.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}
