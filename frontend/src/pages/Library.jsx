import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MindMap from '../components/MindMap';
import { listMaps, deleteMap, saveMap } from '../lib/storage';

/** Saved maps, kept in this browser. Open one to keep exploring it. */
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
      (map) =>
        map.title.toLowerCase().includes(needle) || (map.summary || '').toLowerCase().includes(needle)
    );
  }, [maps, query]);

  const open = maps.find((map) => map.id === openId);

  const remove = (id) => {
    deleteMap(id);
    setMaps(listMaps());
    if (openId === id) setOpenId(null);
  };

  if (open) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <header className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <button onClick={() => setOpenId(null)} className="btn-quiet !min-h-[26px] !px-1 text-[11.5px]">
              ‹ All maps
            </button>
            <h1 className="truncate text-[15px] font-bold text-white">{open.title}</h1>
            <p className="line-clamp-1 text-[12px] text-slate-400">{open.summary}</p>
          </div>
          <button
            onClick={() => navigate(`/mindmap`)}
            className="btn-ghost !min-h-[34px] text-[12.5px]"
          >
            Ask a new topic
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <MindMap
            map={open}
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
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold text-white">Your library</h1>
        <p className="mt-1 text-[13px] text-slate-400">
          Every map you've made, saved on this device. Nothing is uploaded.
        </p>
      </header>

      {maps.length > 0 && (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your maps…"
          className="input mb-5 max-w-md"
          aria-label="Search maps"
        />
      )}

      {filtered.length === 0 ? (
        <div className="card grid place-items-center p-12 text-center">
          <div className="max-w-sm space-y-3">
            <p className="text-3xl" aria-hidden>▤</p>
            <h2 className="font-bold text-white">
              {maps.length ? 'Nothing matches that search' : 'No maps yet'}
            </h2>
            <p className="text-[13px] text-slate-400">
              {maps.length
                ? 'Try a different word.'
                : 'Ask about any topic on the Mind Map page and it will be saved here automatically.'}
            </p>
            {!maps.length && (
              <button onClick={() => navigate('/mindmap')} className="btn-primary">
                Make your first map
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((map) => (
            <li key={map.id}>
              <article className="card group flex h-full flex-col p-4 transition-all hover:border-iris-500/50 hover:shadow-lift">
                <button onClick={() => setOpenId(map.id)} className="flex-1 text-left">
                  <h2 className="text-[14.5px] font-bold text-white">{map.title}</h2>
                  <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-slate-400">
                    {map.summary}
                  </p>
                </button>
                <footer className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip">{count(map.root)} topics</span>
                    <span className="chip">{new Date(map.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => remove(map.id)}
                    className="btn-quiet !min-h-[28px] !px-2 text-[11px] hover:!text-rose-400"
                    aria-label={`Delete map: ${map.title}`}
                  >
                    Delete
                  </button>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function count(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + count(child), 0);
}
