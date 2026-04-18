'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, isLoggedIn } from '@/lib/api';
import { getCurrentUser, logout } from '@/lib/auth';

const CUISINE_OPTIONS = ['North Indian', 'Chinese', 'South Indian', 'Biryani', 'Continental', 'Café', 'Pizza', 'Italian', 'Seafood', 'Street Food'];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Edit form state
  const [editCuisines, setEditCuisines] = useState([]);
  const [editPrice, setEditPrice] = useState('₹₹');
  const [editArea, setEditArea] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    setUser(getCurrentUser());
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileRes, interRes] = await Promise.all([
        api.getMe(),
        api.getMyInteractions()
      ]);
      if (profileRes.success) {
        setProfile(profileRes.data);
        const prefs = profileRes.data.preferences || {};
        setEditCuisines(prefs.cuisines || []);
        setEditPrice(prefs.price_range || '₹₹');
        setEditArea(prefs.area || '');
      }
      if (interRes.success) setInteractions(interRes.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePreferences(editCuisines, editPrice, editArea);
      setMsg('Preferences updated!');
      setEditMode(false);
      await loadProfile(); // Reload fresh data from server
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('Failed to save.'); }
    setSaving(false);
  };

  const toggleCuisine = (c) =>
    setEditCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const data = profile || {};
  const u = user || {};

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      {/* ── Profile Header ─────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 28,
        boxShadow: 'var(--shadow-card)', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'
      }}>
        {/* Avatar */}
        {u.picture ? (
          <img src={u.picture} alt="" style={{ width: 64, height: 64, borderRadius: '50%' }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 24
          }}>
            {(u.name || u.email || '?')[0].toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>
            {u.name || data.email?.split('@')[0] || 'User'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{data.email}</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{data.interaction_count || 0}</span> interactions
            </span>
            <span style={{ fontSize: 13 }}>
              α = <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{(data.alpha || 0.4).toFixed(2)}</span>
            </span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              background: data.role === 'admin' ? 'var(--admin-accent)' : 'var(--primary-light)',
              color: data.role === 'admin' ? '#fff' : 'var(--primary)',
              fontWeight: 600, textTransform: 'uppercase'
            }}>
              {data.role || 'user'}
            </span>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', background: 'var(--primary-light)',
          borderRadius: 8, fontSize: 14, color: 'var(--primary)', fontWeight: 500,
          marginBottom: 16
        }}>
          ✓ {msg}
        </div>
      )}

      {/* ── Preferences Card ───────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 28,
        boxShadow: 'var(--shadow-card)', marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Taste Preferences</h2>
          {!editMode && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}>Edit</button>
          )}
        </div>

        {editMode ? (
          <>
            <label className="input-label" style={{ marginBottom: 8 }}>Cuisines</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CUISINE_OPTIONS.map(c => (
                <button key={c} className={`chip${editCuisines.includes(c) ? ' selected' : ''}`}
                  onClick={() => toggleCuisine(c)}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label" style={{ marginBottom: 6 }}>Price Range</label>
                <select className="input-field" value={editPrice} onChange={e => setEditPrice(e.target.value)}>
                  <option value="₹">₹ Under ₹500</option>
                  <option value="₹₹">₹₹ ₹500–₹1500</option>
                  <option value="₹₹₹">₹₹₹ ₹1500+</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label" style={{ marginBottom: 6 }}>Preferred Area</label>
                <input className="input-field" value={editArea} onChange={e => setEditArea(e.target.value)} placeholder="Koramangala" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </>
        ) : (
          <div>
            {/* Cuisines */}
            <div style={{ marginBottom: 20 }}>
              <span className="input-label">Favourite Cuisines</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {(data.preferences?.cuisines || []).length > 0
                  ? data.preferences.cuisines.map(c => <span key={c} className="chip selected">{c}</span>)
                  : <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set yet — click Edit to add your favourites</span>
                }
              </div>
            </div>

            {/* Price & Area — styled as badge cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                flex: '1 1 200px', padding: '14px 18px', borderRadius: 12,
                background: 'var(--primary-light)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>💰</span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Budget</span>
                  <p style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--text-primary)' }}>
                    {data.preferences?.price_range
                      ? `${data.preferences.price_range} ${data.preferences.price_range === '₹' ? '(Under ₹500)' : data.preferences.price_range === '₹₹' ? '(₹500–₹1,500)' : '(₹1,500+)'}`
                      : '—'}
                  </p>
                </div>
              </div>

              <div style={{
                flex: '1 1 200px', padding: '14px 18px', borderRadius: 12,
                background: 'var(--primary-light)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                <span style={{ fontSize: 22 }}>📍</span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Preferred Area</span>
                  <p style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--text-primary)' }}>
                    {data.preferences?.area || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent Interactions ─────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 28,
        boxShadow: 'var(--shadow-card)'
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Recent Activity</h2>
        {interactions.length === 0 ? (
          <p className="text-body">No interactions yet. Start exploring to build your history!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {interactions.slice(0, 20).map((inter, i) => {
              // Format raw action names into readable labels
              let actionLabel;
              switch (inter.action) {
                case 'been_here': actionLabel = '📍 Visited'; break;
                case 'viewed':    actionLabel = '👁️ Viewed'; break;
                case 'rated':     actionLabel = `⭐ Rated${inter.rating != null ? ' · ' + inter.rating + '★' : ''}`; break;
                case 'bookmarked': actionLabel = '🔖 Bookmarked'; break;
                case 'clicked':   actionLabel = '👆 Clicked'; break;
                default:          actionLabel = inter.action;
              }
              return (
                <div key={inter._id || i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8
                }}>
                  <div>
                    <Link href={`/restaurant/${inter.restaurant_id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                      {inter.restaurant_name}
                    </Link>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {actionLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {inter.timestamp ? new Date(inter.timestamp).toLocaleDateString() : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
