import React, { useState, useEffect, useCallback } from 'react';

const TYPE_COLORS = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F0C020',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC',
};

const STAT_LABELS = {
  hp: 'HP', attack: 'ATK', defense: 'DEF',
  'special-attack': 'SP.A', 'special-defense': 'SP.D', speed: 'SPD',
};

function officialArt(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
function smallSprite(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

function AnimatedStatBar({ label, value, max, color }) {
  const [width, setWidth] = useState(0);
  const pct = Math.min(100, Math.round((value / max) * 100));
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 font-bold" style={{ color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#e3e1d8' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color, transition: 'width 900ms cubic-bezier(.22,.9,.3,1)' }}
        />
      </div>
      <span className="w-8 text-right font-bold" style={{ color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] || '#999';
  return (
    <span
      className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide text-white"
      style={{ background: color, boxShadow: `0 2px 6px ${color}66` }}
    >
      {type.toUpperCase()}
    </span>
  );
}

export default function App() {
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [evolution, setEvolution] = useState(null);
  const [imgError, setImgError] = useState({});

  async function fetchJson(url, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      }
    }
    throw lastErr;
  }

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await fetchJson('https://pokeapi.co/api/v2/pokemon?limit=151');
      const base = data.results.map((p) => {
        const parts = p.url.split('/').filter(Boolean);
        return { name: p.name, id: parts[parts.length - 1], url: p.url, power: null };
      });
      setList(base);
      setLoadingList(false);

      const batchSize = 20;
      for (let i = 0; i < base.length; i += batchSize) {
        const batch = base.slice(i, i + batchSize);
        const results = await Promise.all(batch.map((p) => fetchJson(p.url).catch(() => null)));
        setList((prev) => {
          const next = [...prev];
          results.forEach((r, idx) => {
            const globalIdx = i + idx;
            if (next[globalIdx]) next[globalIdx] = { ...next[globalIdx], power: r ? (r.base_experience ?? 0) : 0 };
          });
          return next;
        });
      }
    } catch (e) {
      const reason = e && e.name === 'AbortError' ? 'the request timed out' : (e && e.message) || 'an unknown error';
      setListError(`Could not load the Pokédex list (${reason}). Check your connection and try again.`);
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const [lastName, setLastName] = useState(null);

  const openDetail = useCallback(async (name) => {
    setLastName(name);
    setView('detail');
    setDetailLoading(true);
    setDetailError(null);
    setSelected(null);
    setEvolution(null);
    try {
      const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${name}`);
      setSelected(data);

      try {
        const speciesData = await fetchJson(data.species.url);
        if (speciesData.evolution_chain && speciesData.evolution_chain.url) {
          const evoData = await fetchJson(speciesData.evolution_chain.url);
          const chain = [];
          let node = evoData.chain;
          while (node) {
            const urlParts = node.species.url.split('/').filter(Boolean);
            chain.push({ name: node.species.name, id: urlParts[urlParts.length - 1] });
            node = node.evolves_to[0];
          }
          setEvolution(chain);
        }
      } catch (e) {
        setEvolution(null);
      }
    } catch (e) {
      const reason = e && e.name === 'AbortError' ? 'the request timed out' : (e && e.message) || 'an unknown error';
      setDetailError(`Could not load this Pokémon (${reason}). Try again.`);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filtered = list.filter((p) =>
    p.name.includes(search.toLowerCase().trim()) || p.id.includes(search.trim())
  );

  const primaryType = selected ? selected.types[0].type.name : null;
  const accent = primaryType ? TYPE_COLORS[primaryType] : '#c81d1d';

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: '#dcdfd6' }}>
      <div className="w-full max-w-sm rounded-[2.25rem] shadow-2xl" style={{ background: '#d31f1f', border: '5px solid #9e1414' }}>

        {/* device chrome header */}
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
          <div
            className="w-7 h-7 rounded-full flex-shrink-0"
            style={{ background: '#5cb0e8', border: '3px solid #1d5a8f', boxShadow: '0 0 10px #5cb0e899, inset 0 2px 3px rgba(255,255,255,0.6)' }}
          />
          <div className="w-2 h-2 rounded-full" style={{ background: '#f5a3a3' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#f5e0a3' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#a3d9a5' }} />
          <span className="ml-auto text-white font-black tracking-[0.15em] text-sm" style={{ fontFamily: "'Space Grotesk', 'Arial Black', sans-serif" }}>
            POKÉDEX
          </span>
        </div>

        {/* screen */}
        <div
          className="mx-4 rounded-2xl overflow-hidden flex flex-col"
          style={{ background: '#f6f5ef', border: '4px solid #9e1414', height: '600px', transition: 'box-shadow 400ms' }}
        >
          {view === 'list' ? (
            <>
              <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid #e5e3d8' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or #..."
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#ecebe1', color: '#333', fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {loadingList && (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-sm" style={{ color: '#888' }}>
                    <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #ddd', borderTopColor: '#d31f1f' }} />
                    Loading Pokédex data...
                  </div>
                )}

                {listError && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
                    <span className="text-sm" style={{ color: '#a33' }}>{listError}</span>
                    <button
                      onClick={fetchList}
                      className="px-4 py-1.5 rounded-full text-white text-xs font-bold"
                      style={{ background: '#d31f1f' }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loadingList && !listError && filtered.length === 0 && (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: '#999' }}>
                    No Pokémon match "{search}"
                  </div>
                )}

                {!loadingList && !listError && filtered.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openDetail(p.name)}
                        className="rounded-xl p-2.5 flex flex-col items-center gap-1 text-left transition-transform active:scale-95"
                        style={{ background: '#ecebe1' }}
                      >
                        <img
                          src={imgError[p.id] ? smallSprite(p.id) : officialArt(p.id)}
                          onError={() => setImgError((prev) => ({ ...prev, [p.id]: true }))}
                          alt={p.name}
                          className="w-16 h-16 object-contain"
                        />
                        <span className="text-[10px] font-bold" style={{ color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                          #{p.id.padStart(3, '0')}
                        </span>
                        <span className="text-xs font-bold capitalize" style={{ color: '#333' }}>{p.name}</span>
                        <span className="text-[10px] font-bold" style={{ color: '#c81d1d', fontFamily: "'JetBrains Mono', monospace" }}>
                          PWR {p.power === null ? '…' : p.power}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {detailLoading && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm" style={{ color: '#888', minHeight: '596px' }}>
                  <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #ddd', borderTopColor: '#d31f1f' }} />
                  Loading data...
                </div>
              )}

              {detailError && (
                <div className="flex flex-col items-center justify-center gap-3 text-center px-4" style={{ minHeight: '596px' }}>
                  <span className="text-sm" style={{ color: '#a33' }}>{detailError}</span>
                  <button
                    onClick={() => lastName && openDetail(lastName)}
                    className="px-4 py-1.5 rounded-full text-white text-xs font-bold"
                    style={{ background: '#d31f1f' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {selected && !detailLoading && !detailError && (
                <div>
                  <div className="px-5 pt-5 pb-6" style={{ background: `linear-gradient(180deg, ${accent}22, transparent)` }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold" style={{ color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                          #{String(selected.id).padStart(3, '0')}
                        </span>
                        <h2 className="text-xl font-black capitalize" style={{ color: '#2a2a2a' }}>{selected.name}</h2>
                        <div className="text-xs font-bold" style={{ color: '#c81d1d', fontFamily: "'JetBrains Mono', monospace" }}>
                          PWR {selected.base_experience ?? '—'}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end max-w-[120px]">
                        {selected.types.map((t) => <TypeBadge key={t.type.name} type={t.type.name} />)}
                      </div>
                    </div>
                    <img
                      src={imgError[`detail-${selected.id}`] ? smallSprite(selected.id) : officialArt(selected.id)}
                      onError={() => setImgError((prev) => ({ ...prev, [`detail-${selected.id}`]: true }))}
                      alt={selected.name}
                      className="w-40 h-40 object-contain mx-auto mt-1"
                      style={{ filter: `drop-shadow(0 8px 16px ${accent}55)` }}
                    />
                  </div>

                  <div className="px-5 pb-3">
                    <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                      <div className="rounded-xl py-2" style={{ background: '#ecebe1' }}>
                        <div className="text-[10px] font-bold" style={{ color: '#999' }}>HEIGHT</div>
                        <div className="text-sm font-bold" style={{ color: '#333' }}>{(selected.height / 10).toFixed(1)} m</div>
                      </div>
                      <div className="rounded-xl py-2" style={{ background: '#ecebe1' }}>
                        <div className="text-[10px] font-bold" style={{ color: '#999' }}>WEIGHT</div>
                        <div className="text-sm font-bold" style={{ color: '#333' }}>{(selected.weight / 10).toFixed(1)} kg</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-xs font-black tracking-wide mb-2" style={{ color: '#999' }}>ABILITIES</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.abilities.map((a) => (
                          <span
                            key={a.ability.name}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                            style={{ background: '#ecebe1', color: '#555' }}
                          >
                            {a.ability.name.replace(/-/g, ' ')}{a.is_hidden ? ' (hidden)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-xs font-black tracking-wide mb-2" style={{ color: '#999' }}>BASE STATS</h3>
                      <div className="flex flex-col gap-1.5">
                        {selected.stats.map((s) => (
                          <AnimatedStatBar
                            key={s.stat.name}
                            label={STAT_LABELS[s.stat.name] || s.stat.name}
                            value={s.base_stat}
                            max={180}
                            color={accent}
                          />
                        ))}
                      </div>
                    </div>

                    {evolution && evolution.length > 1 && (
                      <div className="mb-4">
                        <h3 className="text-xs font-black tracking-wide mb-2" style={{ color: '#999' }}>EVOLUTION CHAIN</h3>
                        <div className="flex items-center gap-1 flex-wrap rounded-xl p-3" style={{ background: '#ecebe1' }}>
                          {evolution.map((e, i) => (
                            <React.Fragment key={e.id}>
                              <button
                                onClick={() => openDetail(e.name)}
                                className="flex flex-col items-center gap-0.5"
                              >
                                <img src={smallSprite(e.id)} alt={e.name} className="w-12 h-12 object-contain" />
                                <span className="text-[10px] font-bold capitalize" style={{ color: '#555' }}>{e.name}</span>
                              </button>
                              {i < evolution.length - 1 && (
                                <span className="text-sm px-1" style={{ color: '#bbb' }}>→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer controls */}
        <div className="px-5 py-4 flex justify-center">
          {view === 'detail' ? (
            <button
              onClick={() => setView('list')}
              className="px-6 py-2 rounded-full text-white font-bold text-sm tracking-wide active:scale-95 transition-transform"
              style={{ background: '#9e1414' }}
            >
              ← Back to list
            </button>
          ) : (
            <span className="text-white/70 text-[11px] font-semibold tracking-wide">
              {loadingList ? 'Syncing...' : `${list.length} Pokémon loaded`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
                                   }
                
