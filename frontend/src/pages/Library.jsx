import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MindMap from '../components/MindMap';
import FileUploadModal from '../components/FileUploadModal';
import { listMaps, deleteMap, saveMap } from '../lib/storage';
import { api } from '../lib/api';
import { exportMindMapToPDF } from '../lib/exportUtils';

export default function Library() {
  const [activeTab, setActiveTab] = useState('maps'); // 'maps' | 'files'
  const [maps, setMaps] = useState([]);
  const [files, setFiles] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [buildingFrom, setBuildingFrom] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setMaps(listMaps());
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await api.listFiles();
      if (res?.files) {
        setFiles(res.files);
      }
    } catch (_) {
      // Fallback
    } finally {
      setLoadingFiles(false);
    }
  };

  const filteredMaps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return maps;
    return maps.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) || (m.summary || '').toLowerCase().includes(needle)
    );
  }, [maps, query]);

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter(
      (f) =>
        (f.originalName || '').toLowerCase().includes(needle) ||
        (f.summary || '').toLowerCase().includes(needle)
    );
  }, [files, query]);

  const openMap = maps.find((m) => m.id === openId);

  const removeMap = (e, id) => {
    e.stopPropagation();
    deleteMap(id);
    setMaps(listMaps());
    if (openId === id) setOpenId(null);
  };

  const removeFile = async (e, id) => {
    e.stopPropagation();
    // Optimistic: the card disappears immediately, and a failed delete simply
    // reappears on the next load rather than blocking the interaction.
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await api.deleteFile(id);
  };

  /**
   * Build a map from an uploaded document and open it.
   *
   * saveMap returns the stored record, whose id may differ from anything the
   * engine sent back (a map generated without a database has no id at all), so
   * the returned record is what we open.
   */
  const handleMindMapFromFile = async (file) => {
    if (buildingFrom) return;
    setBuildingFrom(file.id);
    setError(null);

    try {
      const freshMap = await api.mindMapFromFile(file.id);
      if (!freshMap?.root) throw new Error('The engine returned a map with no branches.');

      const stored = saveMap(freshMap);
      setMaps(listMaps());
      setActiveTab('maps');
      if (stored) setOpenId(stored.id);
    } catch (err) {
      setError(err.message || 'Could not build a mind map from that document.');
    } finally {
      setBuildingFrom(null);
    }
  };

  if (openMap) {
    return (
      <div className="flex h-full flex-col gap-3 p-4 sm:p-6 bg-[var(--color-bg)] text-left">
        <header className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setOpenId(null)}
              className="btn btn-ghost !min-h-[30px] !px-2.5 text-[12px]"
            >
              <i className="ph-duotone ph-arrow-left"></i>
              All maps
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold text-[var(--color-text)] truncate">
                {openMap.title}
              </h1>
              <p className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)] truncate">
                {openMap.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportMindMapToPDF(openMap).catch((err) =>
                  setError(`PDF export failed: ${err.message || 'unknown error'}`)
                )
              }
              className="btn btn-secondary !min-h-[32px] text-[12px]"
            >
              <i className="ph-duotone ph-file-pdf"></i>
              Export PDF
            </button>
            <button
              onClick={() => navigate('/mindmap')}
              className="btn btn-primary !min-h-[32px] text-[12.5px]"
            >
              <i className="ph-duotone ph-plus"></i>
              Ask a new topic
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-[350px]">
          <MindMap
            map={openMap}
            onMapChange={(next) => {
              saveMap(next);
              setMaps(listMaps());
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10 bg-[var(--color-bg)] text-left">
      <div className="max-w-[1180px] mx-auto space-y-6">
        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-[34px] font-bold text-[var(--color-text)]">
              Your Library
            </h1>
            <p className="text-[14.5px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] max-w-2xl">
              All your visual mind maps, research notes, and uploaded source documents saved securely.
            </p>
          </div>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn btn-primary text-xs font-semibold py-2 self-start sm:self-auto"
          >
            <i className="ph-duotone ph-cloud-arrow-up text-base"></i>
            Upload Source File
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-accent-2-100)] border border-[var(--color-accent-2)] text-[13px] text-[var(--color-accent-2-900)]"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="btn btn-quiet !min-h-[22px] !px-1.5 shrink-0"
              aria-label="Dismiss error"
            >
              <i className="ph-duotone ph-x text-xs"></i>
            </button>
          </div>
        )}

        {/* Tabs & Search Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('maps')}
              className={`btn !min-h-[34px] !px-3.5 text-xs font-semibold ${
                activeTab === 'maps' ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              <i className="ph-duotone ph-graph"></i>
              Mind Maps ({maps.length})
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`btn !min-h-[34px] !px-3.5 text-xs font-semibold ${
                activeTab === 'files' ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              <i className="ph-duotone ph-file-text"></i>
              Uploaded Documents ({files.length})
            </button>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeTab === 'maps' ? 'Search mind maps…' : 'Search documents…'}
              className="input text-[13.5px] !min-h-[36px]"
              aria-label="Search library"
            />
          </div>
        </div>

        {/* -------------------- Mind Maps Tab -------------------- */}
        {activeTab === 'maps' && (
          <>
            {filteredMaps.length === 0 ? (
              <div className="p-12 text-center bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)]">
                <div className="max-w-md mx-auto space-y-3">
                  <i className="ph-duotone ph-books text-4xl text-[var(--color-accent)]"></i>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    {maps.length ? 'Nothing matches that search' : 'No mind maps yet'}
                  </h2>
                  <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                    {maps.length
                      ? 'Try a different word or topic title.'
                      : 'Ask about any topic on the Mind Map page or upload a document to build your first map.'}
                  </p>
                  {!maps.length && (
                    <button
                      onClick={() => navigate('/mindmap')}
                      className="btn btn-primary text-sm font-semibold mt-2"
                    >
                      Make your first map
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaps.map((m) => (
                  <article
                    key={m.id}
                    onClick={() => setOpenId(m.id)}
                    className="card elev-sm p-4 flex flex-col justify-between hover:shadow-[var(--shadow-md)] cursor-pointer group transition-all duration-150 border border-[var(--color-divider)] hover:border-[var(--color-accent)]"
                  >
                    <div className="space-y-2">
                      <span className="kicker block text-[10.5px]">
                        {m.isLensHandoff
                          ? 'Sent from Lens'
                          : new Date(m.updatedAt || m.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                      </span>
                      <h2 className="text-[16px] font-bold text-[var(--color-text)] leading-snug group-hover:text-[var(--color-accent-700)] transition-colors">
                        {m.title}
                      </h2>
                      <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] line-clamp-3 leading-relaxed">
                        {m.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-4 border-t border-[var(--color-divider)]">
                      <span className="tag tag-neutral text-[11px]">
                        {countNodes(m.root)} topics
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportMindMapToPDF(m).catch((err) =>
                              setError(`PDF export failed: ${err.message || 'unknown error'}`)
                            );
                          }}
                          className="btn btn-quiet !min-h-[26px] !px-2 text-[11px]"
                          title="Export PDF"
                        >
                          <i className="ph-duotone ph-file-pdf"></i>
                        </button>
                        <button
                          onClick={(e) => removeMap(e, m.id)}
                          className="btn btn-quiet !min-h-[26px] !px-2 text-[11.5px] hover:!text-[var(--color-accent-2-700)]"
                          title="Delete map"
                        >
                          Delete
                        </button>
                        <span className="btn btn-ghost !min-h-[26px] !px-2.5 text-[11.5px]">
                          Open
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* -------------------- Uploaded Documents Tab -------------------- */}
        {activeTab === 'files' && (
          <>
            {filteredFiles.length === 0 ? (
              <div className="p-12 text-center bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)]">
                <div className="max-w-md mx-auto space-y-3">
                  <i className="ph-duotone ph-file-arrow-up text-4xl text-[var(--color-accent)]"></i>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    {files.length ? 'No documents match that search' : 'No uploaded files yet'}
                  </h2>
                  <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                    Upload your PDF, Word documents, research papers, or image notes. The AI agent
                    will extract content, generate mind maps, and answer questions.
                  </p>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="btn btn-primary text-sm font-semibold mt-2"
                  >
                    Upload your first document
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                  <article
                    key={file.id}
                    className="card elev-sm p-4 flex flex-col justify-between hover:shadow-[var(--shadow-md)] transition-all duration-150 border border-[var(--color-divider)] hover:border-[var(--color-accent)]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="tag tag-accent text-[10.5px]">
                          {file.mimeType?.includes('pdf')
                            ? 'PDF'
                            : file.mimeType?.includes('word') || file.originalName?.endsWith('.docx')
                              ? 'DOCX'
                              : file.mimeType?.startsWith('image')
                                ? 'IMAGE'
                                : 'TEXT'}
                        </span>
                        <span className="text-[11px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)]">
                          {new Date(file.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      <h2 className="text-[16px] font-bold text-[var(--color-text)] leading-snug truncate">
                        {file.originalName}
                      </h2>

                      <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] line-clamp-3 leading-relaxed">
                        {file.summary || 'Uploaded document ready for cognitive analysis.'}
                      </p>
                    </div>

                    <div className="space-y-2 pt-3 mt-4 border-t border-[var(--color-divider)]">
                      <div className="flex items-center gap-2 text-[11px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                        <span>{file.pageCount || 1} pgs</span>
                        <span>·</span>
                        <span>{Math.round((file.size || 0) / 1024)} KB</span>
                        <span>·</span>
                        <span>~{file.tokenCount || 0} tokens</span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <button
                          onClick={() => handleMindMapFromFile(file)}
                          disabled={Boolean(buildingFrom)}
                          className="btn btn-secondary !min-h-[26px] !px-2 text-[11px]"
                          title="Generate a mind map from this document"
                        >
                          {buildingFrom === file.id ? (
                            <>
                              <i className="ph-duotone ph-spinner animate-spin"></i>
                              Mapping…
                            </>
                          ) : (
                            <>
                              <i className="ph-duotone ph-graph"></i>
                              Map
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/mindmap?doc=${encodeURIComponent(file.id)}`)}
                          className="btn btn-primary !min-h-[26px] !px-2 text-[11px]"
                          title="Ask questions about this document"
                        >
                          <i className="ph-duotone ph-chats-circle"></i>
                          Query
                        </button>
                        <button
                          onClick={(e) => removeFile(e, file.id)}
                          className="btn btn-quiet !min-h-[26px] !px-1.5 text-[11px] hover:!text-[var(--color-accent-2-700)]"
                          title="Delete document"
                        >
                          <i className="ph-duotone ph-trash"></i>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          loadFiles();
        }}
        onMindMapGenerated={(freshMap) => {
          const stored = saveMap(freshMap);
          setMaps(listMaps());
          setActiveTab('maps');
          if (stored) setOpenId(stored.id);
        }}
        onFileAttached={() => {
          loadFiles();
          setActiveTab('files');
        }}
      />
    </div>
  );
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}
