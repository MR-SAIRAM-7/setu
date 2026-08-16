import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MindMap from '../components/MindMap';
import FileUploadModal from '../components/FileUploadModal';
import DocumentViewerModal from '../components/DocumentViewerModal';
import { BionicText } from '../lib/bionic';
import { tts } from '../lib/tts';
import { streamChat, api } from '../lib/api';
import { saveMap, listMaps, DEFAULT_WORKED_MAP } from '../lib/storage';
import {
  exportMindMapToPDF,
  exportMindMapToPNG,
  exportMindMapToSVG,
  exportMindMapToMarkdown,
  exportMindMapToJSON
} from '../lib/exportUtils';

const SUGGESTIONS = [
  'How does a transformer neural network work?',
  'Why did attention beat recurrence in LSTMs?',
  'How do vaccines actually train the immune system?',
  'The causes of the French Revolution',
  'How does compound interest build wealth?'
];

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.message === 'string') return content.message;
  }
  return '';
}

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
  const [attachedDoc, setAttachedDoc] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [viewingDocId, setViewingDocId] = useState(null);
  const [bionicEnabled, setBionicEnabled] = useState(true);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}`);

  const abortRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const pendingRef = useRef(null);
  const [params, setParams] = useSearchParams();

  // Open the most recent map on first mount so the canvas is never blank.
  useEffect(() => {
    const stored = listMaps();
    setMap(stored[0] || DEFAULT_WORKED_MAP);
  }, []);

  useEffect(() => {
    const unsubscribe = tts.subscribe((state) => {
      setTtsPlaying(state.isPlaying && !state.isPaused);
    });
    return () => {
      unsubscribe();
      tts.stop();
    };
  }, []);

  /**
   * Handle the three deep links the app supports, exactly once each.
   */
  useEffect(() => {
    const topicParam = params.get('topic');
    const docParam = params.get('doc');
    const importParam = params.get('import');

    if (!topicParam && !docParam && !importParam) return;

    const next = new URLSearchParams(params);
    next.delete('topic');
    next.delete('doc');
    next.delete('import');
    setParams(next, { replace: true });

    if (topicParam) {
      pendingRef.current = { kind: 'topic', topic: topicParam };
      return;
    }
    if (docParam) {
      pendingRef.current = { kind: 'doc', documentId: docParam };
      return;
    }

    try {
      pendingRef.current = { kind: 'import', payload: JSON.parse(decodeURIComponent(importParam)) };
    } catch (_) {
      // A malformed handoff should not break the page.
    }
  }, [params, setParams]);

  /* Auto-scroll transcript */
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  /* Cancel stream on unmount */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* Close the export menu on outside click or Escape */
  useEffect(() => {
    if (!exportMenuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenuOpen]);

  const send = useCallback(
    async (raw) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;

      setInput('');
      setError(null);
      setBusy(true);
      setStatus(attachedDoc ? `Analyzing "${attachedDoc.originalName}"…` : 'Researching around topic…');

      const history = [...messages, { role: 'user', content: text }];
      setMessages(history);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          {
            messages: history.map(({ role, content }) => ({ role, content })),
            conversationId,
            documentId: attachedDoc?.id || null,
            map: map ? { title: map.title, summary: map.summary, root: map.root } : null
          },
          {
            onStatus: (update) => setStatus(update.message || update.stage),
            onReply: (reply) =>
              setMessages((current) => {
                const replyText = normalizeMessageContent(
                  reply?.text ?? reply?.message ?? reply?.content
                ).trim();
                if (!replyText) return current;

                if (reply.final) {
                  const last = current[current.length - 1];
                  if (last?.role === 'assistant') {
                    const next = [...current];
                    next[next.length - 1] = { ...last, content: replyText };
                    return next;
                  }
                }
                return [...current, { role: 'assistant', content: replyText }];
              }),
            onMap: (fresh) => {
              const stored = saveMap(fresh);
              setMap(stored || fresh);
              setDetail(null);
              setMessages((current) => [
                ...current,
                { role: 'assistant', content: `Here's your structured map of **${fresh.title}**.` }
              ]);
            },
            onError: (payload) => setError(payload.message),
            onDone: (data) => {
              if (data.conversationId) setConversationId(data.conversationId);
            }
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
    [input, busy, messages, map, attachedDoc, conversationId]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || busy) return;
    pendingRef.current = null;

    if (pending.kind === 'topic') {
      send(pending.topic);
      return;
    }

    if (pending.kind === 'doc') {
      api
        .getFile(pending.documentId)
        .then((result) => {
          if (result?.document) {
            setAttachedDoc(result.document);
            inputRef.current?.focus();
          } else {
            setError('That document is no longer available on the engine.');
          }
        })
        .catch((err) => setError(err.message));
      return;
    }

    if (pending.kind === 'import') {
      const payload = pending.payload || {};
      const title = payload.title || 'Page sent from Lens';

      setHandoffBanner({ title, url: payload.url || '' });
      setMessages([
        { role: 'user', content: `Map this page for me: ${title}` },
        { role: 'assistant', content: `Reading “${title}” and laying out an accessible mind map…` }
      ]);
      setBusy(true);
      setStatus('Reading around the topic…');

      api
        .mindMap(title, payload.text?.slice(0, 12000) || '')
        .then((fresh) => {
          const stored = saveMap({ ...fresh, isLensHandoff: true });
          setMap(stored || { ...fresh, isLensHandoff: true });
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
    }
  }, [params, busy, send]);

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setStatus(null);
  };

  const startNewMap = () => {
    stop();
    tts.stop();
    setMessages([]);
    setMap(null);
    setDetail(null);
    setError(null);
    setHandoffBanner(null);
    setAttachedDoc(null);
    setConversationId(`conv_${Date.now()}`);
    inputRef.current?.focus();
  };

  const handleMindMapFromFile = (freshMap) => {
    const stored = saveMap(freshMap);
    setMap(stored || freshMap);
    setDetail(null);
    setMessages([
      {
        role: 'user',
        content: `Created mind map from file: ${freshMap.title}`
      },
      {
        role: 'assistant',
        content: `I analyzed your uploaded source and generated the interactive visual mind map on the right. You can ask follow-up questions or explore any branch.`
      }
    ]);
  };

  const runExport = useCallback(
    async (label, exporter) => {
      if (!map) return;
      setExportMenuOpen(false);
      setError(null);
      try {
        await exporter(map);
      } catch (err) {
        setError(`${label} export failed: ${err.message || 'unknown error'}`);
      }
    },
    [map]
  );

  const handleReadDetail = () => {
    if (!detail) return;
    if (ttsPlaying) {
      tts.stop();
    } else {
      tts.speak(`${detail.label}. ${detail.detail || ''}`);
    }
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
                  Research topics or query uploaded documents
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBionicEnabled((prev) => !prev)}
                  className={`btn !min-h-[30px] !px-2 text-xs font-semibold ${
                    bionicEnabled
                      ? 'bg-[var(--color-accent-100)] text-[var(--color-accent-900)] border border-[var(--color-accent-300)]'
                      : 'btn-ghost'
                  }`}
                  title="Toggle Bionic Reading Fixations"
                >
                  <i className="ph-duotone ph-eye text-sm"></i>
                  Bionic
                </button>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="btn btn-secondary !min-h-[30px] !px-2.5 text-[12px]"
                  title="Upload PDF, DOCX, or Notes"
                >
                  <i className="ph-duotone ph-file-arrow-up"></i>
                  Upload
                </button>
                <button
                  onClick={startNewMap}
                  className="btn btn-ghost !min-h-[30px] !px-2 text-[12px]"
                  title="Start a new map"
                >
                  New
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

            {/* Attached Document Banner */}
            {attachedDoc && (
              <div className="mx-4 mt-3 p-2.5 bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-[var(--radius-md)] flex items-center justify-between gap-2.5 text-left animate-setu-rise">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="ph-duotone ph-paperclip text-lg text-[var(--color-accent)] shrink-0"></i>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">
                      {attachedDoc.originalName}
                    </p>
                    <span className="text-[10.5px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                      Grounded document query active
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setViewingDocId(attachedDoc.id)}
                    className="btn btn-ghost !min-h-[24px] !px-2 text-[11px]"
                    title="View full document"
                  >
                    View
                  </button>
                  <button
                    onClick={() => setAttachedDoc(null)}
                    className="btn btn-quiet !min-h-[24px] !px-1.5 text-[11px]"
                    title="Detach file"
                  >
                    <i className="ph-duotone ph-x"></i>
                  </button>
                </div>
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
                    Name any complex topic or upload a file (PDF, Word, TXT, Notes). SETU researches it and organizes it into an interactive visual hierarchy.
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

                  <div className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2">
                    <span className="kicker block">Upload your own source</span>
                    <button
                      onClick={() => setUploadModalOpen(true)}
                      className="w-full btn btn-secondary text-xs flex items-center justify-center gap-2 py-2"
                    >
                      <i className="ph-duotone ph-cloud-arrow-up text-base"></i>
                      Upload PDF or Document
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <MessageItem
                  key={index}
                  role={message?.role || 'assistant'}
                  content={normalizeMessageContent(message?.content)}
                  bionicEnabled={bionicEnabled}
                />
              ))}

              {/* 3-Stage Progress Lines */}
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
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="btn btn-ghost min-h-[44px] px-2.5 text-[var(--color-accent)]"
                title="Upload or attach document"
                aria-label="Upload document"
              >
                <i className="ph-duotone ph-paperclip text-lg"></i>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  attachedDoc
                    ? `Ask anything about ${attachedDoc.originalName}…`
                    : map
                      ? 'Ask a follow-up or name a new topic…'
                      : 'Name any topic or ask a question…'
                }
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
            {/* Map Header with flex-wrap and export dropdown */}
            <header className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)] shadow-[var(--shadow-sm)] relative">
              <div className="flex-1 basis-[260px] min-w-0 text-left">
                <h2 className="text-[19px] sm:text-[22px] font-bold text-[var(--color-text)] truncate leading-tight">
                  {map.title}
                </h2>
                <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] truncate mt-0.5">
                  <BionicText text={map.summary} enabled={bionicEnabled} />
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="tag tag-neutral">{countNodes(map.root)} topics</span>
                {map.grounded ? (
                  <span className="tag tag-accent">
                    <i className="ph-duotone ph-globe"></i>
                    {map.sources?.length || 0} sources
                  </span>
                ) : (
                  <span className="tag tag-neutral" title="Verified knowledge synthesis">
                    verified synthesis
                  </span>
                )}

                {/* Visual Export Menu */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className="btn btn-secondary !min-h-[32px] !px-3 text-[12.5px] flex items-center gap-1.5"
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    aria-label="Export mind map options"
                  >
                    <i className="ph-duotone ph-export"></i>
                    Export Visual
                    <i className="ph-duotone ph-caret-down text-xs"></i>
                  </button>

                  {exportMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1.5 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-divider)] shadow-xl py-1.5 z-50 text-left animate-setu-rise"
                    >
                      <button
                        onClick={() => runExport('PDF', exportMindMapToPDF)}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-accent)] flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <i className="ph-duotone ph-file-pdf text-base text-[var(--color-accent-2)]"></i>
                        Visual PDF Document
                      </button>
                      <button
                        onClick={() => runExport('PNG', exportMindMapToPNG)}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-accent)] flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <i className="ph-duotone ph-image text-base text-[var(--color-accent)]"></i>
                        High-Res Image (PNG)
                      </button>
                      <button
                        onClick={() => runExport('SVG', exportMindMapToSVG)}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-accent)] flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <i className="ph-duotone ph-bezier-curve text-base text-[#0088b0]"></i>
                        Vector Graphic (SVG)
                      </button>
                      <div className="my-1 h-px bg-[var(--color-divider)]" />
                      <button
                        onClick={() => runExport('Markdown', exportMindMapToMarkdown)}
                        className="w-full px-3.5 py-2 text-xs text-[color-mix(in_srgb,var(--color-text)_80%,transparent)] hover:bg-[var(--color-surface)] flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <i className="ph-duotone ph-file-text text-base"></i>
                        Markdown Outline
                      </button>
                      <button
                        onClick={() => runExport('JSON', exportMindMapToJSON)}
                        className="w-full px-3.5 py-2 text-xs text-[color-mix(in_srgb,var(--color-text)_80%,transparent)] hover:bg-[var(--color-surface)] flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <i className="ph-duotone ph-code text-base"></i>
                        JSON Data Schema
                      </button>
                    </div>
                  )}
                </div>
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
                      <BionicText text={detail.label} enabled={bionicEnabled} />
                    </h3>
                    {detail.detail && (
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_78%,transparent)]">
                        <BionicText text={detail.detail} enabled={bionicEnabled} />
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
                    onClick={handleReadDetail}
                    className={`btn !min-h-[32px] text-[12px] ${ttsPlaying ? 'btn-primary' : 'btn-ghost'}`}
                    title="Listen aloud"
                  >
                    <i className={`ph-duotone ${ttsPlaying ? 'ph-pause-circle' : 'ph-speaker-high'}`}></i>
                    {ttsPlaying ? 'Pause Audio' : 'Listen'}
                  </button>
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
          <EmptyCanvas
            busy={busy}
            status={status}
            onStart={() => inputRef.current?.focus()}
            onUpload={() => setUploadModalOpen(true)}
          />
        )}
      </section>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        conversationId={conversationId}
        onMindMapGenerated={handleMindMapFromFile}
        onFileAttached={(doc) => {
          setAttachedDoc(doc);
          inputRef.current?.focus();
        }}
      />

      {/* Document Reader & Cognitive Viewer Modal */}
      <DocumentViewerModal
        isOpen={Boolean(viewingDocId)}
        documentId={viewingDocId}
        onClose={() => setViewingDocId(null)}
        onMindMapGenerated={handleMindMapFromFile}
      />
    </div>
  );
}

/* ------------------------------ Transcript Items ------------------------------ */

function MessageItem({ role, content, bionicEnabled }) {
  const isUser = role === 'user';
  const safeContent = normalizeMessageContent(content);

  if (!safeContent) return null;

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
          <BionicText text={safeContent} enabled={bionicEnabled} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-setu-rise">
      <div className="text-[15px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_84%,transparent)] max-w-[95%]">
        <BionicText text={safeContent} enabled={bionicEnabled} />
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
        <span>{status || 'Reading around the topic'}</span>
      </div>
      <div
        className={`flex items-center gap-2.5 text-[13px] ${
          isFinding && !isDrawing
            ? 'text-[var(--color-accent-700)] font-semibold'
            : 'text-[color-mix(in_srgb,var(--color-text)_40%,transparent)]'
        }`}
      >
        <i className="ph-duotone ph-tree-structure text-base"></i>
        <span>Structuring branches</span>
      </div>
      <div
        className={`flex items-center gap-2.5 text-[13px] ${
          isDrawing
            ? 'text-[var(--color-accent-700)] font-semibold'
            : 'text-[color-mix(in_srgb,var(--color-text)_40%,transparent)]'
        }`}
      >
        <i className="ph-duotone ph-pen-nib text-base"></i>
        <span>Laying out visual map</span>
      </div>
    </div>
  );
}

/* ------------------------------ Empty Canvas ------------------------------ */

function EmptyCanvas({ busy, status, onStart, onUpload }) {
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
              : 'Type any question on the left, try an example, or upload a source document.'}
          </p>
        </div>
        {!busy && (
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button onClick={onStart} className="btn btn-primary text-sm font-semibold">
              Ask a question
            </button>
            <button onClick={onUpload} className="btn btn-secondary text-sm font-semibold">
              <i className="ph-duotone ph-file-arrow-up"></i>
              Upload file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}
