'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, isLoggedIn } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import RestaurantCard, { RestaurantCardSkeleton } from '@/components/RestaurantCard';

const CUISINE_OPTIONS = ['North Indian', 'Chinese', 'South Indian', 'Biryani', 'Continental', 'Café', 'Pizza', 'Italian', 'Seafood', 'Street Food'];
const AREA_OPTIONS = ['Koramangala', 'Indiranagar', 'HSR Layout', 'Jayanagar', 'Whitefield', 'MG Road', 'Marathahalli', 'Electronic City', 'Yelahanka', 'Rajajinagar', 'BTM Layout', 'JP Nagar'];
const TECHNIQUES = [
  { id: 'cbf', label: 'Content-Based' },
  { id: 'cf', label: 'Collaborative' },
  { id: 'hybrid', label: 'Hybrid' },
];

function DiscoverContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';

  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1); // keyboard nav
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);
  const requestIdRef = useRef(0);      // race condition guard
  const cacheRef = useRef(new Map());  // result cache

  // Filter mode state
  const [selCuisines, setSelCuisines] = useState([]);
  const [selArea, setSelArea] = useState('');
  const [selPrice, setSelPrice] = useState('');
  const [selTechnique, setSelTechnique] = useState('hybrid');
  const [topN, setTopN] = useState(12);

  useEffect(() => {
    setUser(getCurrentUser());
    if (initialQ) {
      handleSearch(null, initialQ);
    } else {
      loadDefaults();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDefaults = async () => {
    setLoading(true);
    try {
      // If logged in, fetch user preferences and use them as default filters
      let params = { top_n: 12 };
      let personalised = false;

      if (isLoggedIn()) {
        try {
          const profileRes = await api.getMe();
          if (profileRes.success && profileRes.data?.preferences) {
            const prefs = profileRes.data.preferences;

            // Pre-fill cuisines
            if (prefs.cuisines && prefs.cuisines.length > 0) {
              setSelCuisines(prefs.cuisines);
              params.cuisines = prefs.cuisines.join(',');
              personalised = true;
            }

            // Pre-fill area
            if (prefs.area) {
              setSelArea(prefs.area);
              params.area = prefs.area;
              personalised = true;
            }

            // Pre-fill price range
            if (prefs.price_range) {
              setSelPrice(prefs.price_range);
              if (prefs.price_range === '₹') { params.price_min = 0; params.price_max = 500; }
              else if (prefs.price_range === '₹₹') { params.price_min = 500; params.price_max = 1500; }
              else if (prefs.price_range === '₹₹₹') { params.price_min = 1500; params.price_max = 6000; }
              personalised = true;
            }
          }
        } catch (e) {
          // Profile fetch failed — fall through to generic recommendations
          console.warn('Could not load preferences:', e);
        }
      }

      const res = await api.recommend(params);
      if (res.success) {
        setResults(res.data || []);
        setMessage(personalised
          ? 'Personalised picks based on your taste preferences ✨'
          : (res.message || ''));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Live autocomplete (with race guard + cache) ────
  const fetchSuggestions = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Check cache first
    const cacheKey = term.toLowerCase();
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setHighlightIdx(-1);
      return;
    }

    const thisRequestId = ++requestIdRef.current;
    setAcLoading(true);
    try {
      const res = await api.search(term);
      // Race condition guard: discard if a newer request was made
      if (thisRequestId !== requestIdRef.current) return;

      if (res.success && res.data?.length > 0) {
        const results = res.data.slice(0, 8);
        setSuggestions(results);
        setShowDropdown(true);
        cacheRef.current.set(cacheKey, results); // cache it
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (e) {
      if (thisRequestId !== requestIdRef.current) return;
      console.error(e);
      setSuggestions([]);
    }
    if (thisRequestId === requestIdRef.current) setAcLoading(false);
    setHighlightIdx(-1);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  // ── Keyboard navigation ────────────────────────────
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') { setShowDropdown(false); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(i => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(i => (i - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
          e.preventDefault();
          handleSuggestionClick(suggestions[highlightIdx]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightIdx(-1);
        break;
      default:
        break;
    }
  };

  const handleSuggestionClick = (item) => {
    setShowDropdown(false);
    setHighlightIdx(-1);
    setQuery(item.name);
    const id = item.restaurant_id ?? item.id ?? 0;
    router.push(`/restaurant/${id}`);
  };

  const handleSuggestionSearch = (item) => {
    setShowDropdown(false);
    setHighlightIdx(-1);
    setQuery(item.name);
    handleSearch(null, item.name);
  };

  // ── Full search (Enter / button click) ─────────────
  const handleSearch = async (e, q = null) => {
    if (e) e.preventDefault();
    const term = q || query;
    if (!term.trim()) return;
    setShowDropdown(false);
    setLoading(true); setResults([]);
    try {
      const searchRes = await api.search(term);
      if (searchRes.success && searchRes.data?.length > 0) {
        setResults(searchRes.data);
        setMessage(`Found ${searchRes.data.length} results for "${term}"`);
      } else {
        const recRes = await api.recommend({ restaurant_name: term, technique: selTechnique, top_n: topN });
        if (recRes.success) {
          setResults(recRes.data || []);
          setMessage(recRes.message || `Recommendations based on "${term}"`);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleFilter = async () => {
    setLoading(true); setResults([]);
    try {
      const params = { technique: selTechnique, top_n: topN };
      if (selCuisines.length > 0) params.cuisines = selCuisines.join(',');
      if (selArea) params.area = selArea;
      if (selPrice === '₹') { params.price_min = 0; params.price_max = 500; }
      else if (selPrice === '₹₹') { params.price_min = 500; params.price_max = 1500; }
      else if (selPrice === '₹₹₹') { params.price_min = 1500; params.price_max = 6000; }
      const res = await api.recommend(params);
      if (res.success) {
        setResults(res.data || []);
        setMessage(res.message || `${(res.data || []).length} results`);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const toggleCuisine = (c) =>
    setSelCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const getCuisineEmoji = (cuisines) => {
    const c = (cuisines || '').toLowerCase();
    if (c.includes('pizza')) return '🍕';
    if (c.includes('biryani')) return '🍛';
    if (c.includes('chinese')) return '🥡';
    if (c.includes('italian')) return '🍝';
    if (c.includes('cafe') || c.includes('coffee')) return '☕';
    if (c.includes('ice cream') || c.includes('dessert')) return '🍨';
    if (c.includes('burger') || c.includes('american')) return '🍔';
    if (c.includes('seafood')) return '🦐';
    if (c.includes('south indian')) return '🥘';
    if (c.includes('north indian') || c.includes('mughlai')) return '🍲';
    return '🍽️';
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 28 }}>
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside style={{ width: 280, flexShrink: 0 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-card)', position: 'sticky', top: 88 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Filters</h3>

          <label className="input-label" style={{ marginBottom: 8 }}>Recommendation Engine</label>
          <div className="tab-toggle" style={{ marginBottom: 20 }}>
            {TECHNIQUES.map(t => (
              <button key={t.id} className={`tab-btn${selTechnique === t.id ? ' active' : ''}`}
                onClick={() => setSelTechnique(t.id)} style={{ fontSize: 12, padding: '8px 10px' }}>
                {t.label}
              </button>
            ))}
          </div>

          <label className="input-label" style={{ marginBottom: 8 }}>Cuisines</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {CUISINE_OPTIONS.map(c => (
              <button key={c} className={`chip${selCuisines.includes(c) ? ' selected' : ''}`}
                onClick={() => toggleCuisine(c)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {c}
              </button>
            ))}
          </div>

          <label className="input-label" style={{ marginBottom: 6 }}>Area</label>
          <select className="input-field" value={selArea} onChange={e => setSelArea(e.target.value)} style={{ marginBottom: 16, fontSize: 13 }}>
            <option value="">All Areas</option>
            {AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <label className="input-label" style={{ marginBottom: 6 }}>Price Range</label>
          <select className="input-field" value={selPrice} onChange={e => setSelPrice(e.target.value)} style={{ marginBottom: 20, fontSize: 13 }}>
            <option value="">Any</option>
            <option value="₹">₹ Under ₹500</option>
            <option value="₹₹">₹₹ ₹500–₹1500</option>
            <option value="₹₹₹">₹₹₹ ₹1500+</option>
          </select>

          <button className="btn btn-primary btn-full" onClick={handleFilter}>
            Apply Filters
          </button>

          {user && (
            <div style={{
              marginTop: 20, padding: '10px 14px', background: 'var(--primary-light)',
              border: '1px solid var(--primary)', borderRadius: 8,
              fontSize: 12, color: 'var(--primary)', fontWeight: 500, textAlign: 'center'
            }}>
              {selTechnique === 'hybrid' ? 'Hybrid Mode' : selTechnique === 'cbf' ? 'Content-Based' : 'Collaborative'}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 className="text-h2">Discover</h1>
          <div className="tab-toggle" style={{ maxWidth: 360 }}>
            <button className={`tab-btn${mode === 'search' ? ' active' : ''}`} onClick={() => setMode('search')}>
              🔍 Search
            </button>
            <button className={`tab-btn${mode === 'filter' ? ' active' : ''}`} onClick={() => setMode('filter')}>
              🎛️ Filter
            </button>
          </div>
        </div>

        {/* ── Search bar with live autocomplete ──────────── */}
        {mode === 'search' && (
          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 24 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by restaurant name, cuisine, or area..."
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                  style={{ width: '100%', height: 48 }}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showDropdown}
                  aria-autocomplete="list"
                />
                {acLoading && (
                  <div style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 18, height: 18, border: '2px solid var(--border)',
                    borderTopColor: 'var(--primary)', borderRadius: '50%',
                    animation: 'spin .6s linear infinite'
                  }} />
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-lg">Search</button>
            </form>

            {/* ── Autocomplete Dropdown ──────────────────── */}
            {showDropdown && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 56, left: 0, right: 80, zIndex: 50,
                background: 'var(--surface)', borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid var(--border)', overflow: 'hidden',
                maxHeight: 420, overflowY: 'auto'
              }}>
                <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                  {suggestions.length} suggestions — use ↑↓ to navigate
                </div>
                {suggestions.map((item, i) => {
                  const id = item.restaurant_id ?? item.id ?? 0;
                  return (
                    <div
                      key={`${id}-${i}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                        transition: 'background 150ms',
                        background: highlightIdx === i ? 'var(--primary-light)' : 'transparent'
                      }}
                      onMouseEnter={() => setHighlightIdx(i)}
                      onMouseLeave={() => setHighlightIdx(-1)}
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0
                      }}>
                        {getCuisineEmoji(item.cuisines)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.cuisines ? item.cuisines.split(',').slice(0, 3).join(', ') : ''}
                          {item.location ? ` · ${item.location}` : ''}
                        </div>
                      </div>

                      {item.rate > 0 && (
                        <div style={{
                          fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: item.rate >= 4.0 ? 'var(--rating-high)' : item.rate >= 3.5 ? 'var(--rating-mid)' : 'var(--rating-low)',
                          color: '#fff', flexShrink: 0
                        }}>
                          ★ {item.rate}
                        </div>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); handleSuggestionSearch(item); }}
                        title="Find similar restaurants"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                          fontSize: 12, color: 'var(--primary)', flexShrink: 0,
                          transition: 'all 150ms'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--primary)'; }}
                      >
                        Similar →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {message && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</p>}

        <div className="cards-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <RestaurantCardSkeleton key={i} />)
            : results.length > 0
              ? results.map((r, i) => <RestaurantCard key={r.restaurant_id ?? r.id ?? `res-${i}`} restaurant={r} />)
              : !loading && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No results found</h3>
                  <p className="text-body">Try a different search term or adjust your filters.</p>
                </div>
              )
          }
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverContent />
    </Suspense>
  );
}
