import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MindMap from '../components/MindMap';
import { listMaps, deleteMap, saveMap } from '../lib/storage';

export default function Library() {
  const [maps, setMaps] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setMaps(listMaps());
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return maps;
    return maps.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) || (m.summary || '').toLowerCase().includes(needle)
    );
  }, [maps, query]);

  const openMap = maps.find((m) => m.id === openId);

  const removeMap = (e, id) => {
    e.stopPropagation();
    deleteMap(id);
    setMaps(listMaps());
    if (openId === id) setOpenId(null);
  };

  if (openMap) {
    return (
      <div className="flex h-full flex-col gap-3 p-4 sm:p-6 bg-[var(--color-bg)]">
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
          <button
            onClick={() => navigate('/mindmap')}
            className="btn btn-primary !min-h-[32px] text-[12.5px]"
          >
            <i className="ph-duotone ph-plus"></i>
            Ask a new topic
          </button>
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
        <header className="space-y-1.5">
          <h1 className="text-3xl sm:text-[34px] font-bold text-[var(--color-text)]">
            Your library
          </h1>
          <p className="text-[15px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] max-w-2xl">
            Every map you've made, saved on this device. Nothing is uploaded — clearing your browser
            data is the only thing that removes them.
          </p>
        </header>

        {maps.length > 0 && (
          <div className="max-w-[380px]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your maps…"
              className="input text-[14px]"
              aria-label="Search maps"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-divider)]">
            <div className="max-w-md mx-auto space-y-3">
              <i className="ph-duotone ph-books text-4xl text-[var(--color-accent)]"></i>
              <h2 className="text-xl font-bold text-[var(--color-text)]">
                {maps.length ? 'Nothing matches that search' : 'No maps yet'}
              </h2>
              <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                {maps.length
                  ? 'Try a different word or topic title.'
                  : 'Ask about any topic on the Mind Map page and it will be saved here automatically.'}
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
            {filtered.map((m) => (
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
                  <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}
