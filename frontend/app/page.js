'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import RestaurantCard, { RestaurantCardSkeleton } from '@/components/RestaurantCard';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    setUser(getCurrentUser());
    api.recommend({ top_n: 6 }).then(r => {
      if (r.success) setFeatured(r.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) {
      window.location.href = `/discover?q=${encodeURIComponent(searchQ)}`;
    }
  };

  return (
    <div>
      {/* ── Hero Section ────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, #FFF8F2 0%, #FFFFFF 50%, #FFF3E8 100%)',
        padding: '80px 24px 60px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60 }}>
          {/* Left content */}
          <div style={{ flex: '1 1 55%' }}>
            <p className="text-eyebrow" style={{ marginBottom: 16 }}>RESTAURANT DISCOVERY ENGINE</p>
            <h1 className="text-hero" style={{ marginBottom: 16 }}>
              Discover restaurants you'll <span style={{ color: 'var(--primary)' }}>actually love</span>
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32, maxWidth: 520 }}>
              GoodSpot uses three ML techniques to recommend restaurants tailored to your taste.
              No food delivery. No ordering. Pure discovery.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <Link href="/discover" className="btn btn-primary btn-lg" style={{ paddingLeft: 32, paddingRight: 32 }}>
                Start Discovering →
              </Link>
              <Link href="/about" className="btn btn-ghost btn-lg">
                How It Works
              </Link>
            </div>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { num: '9,249', label: 'Restaurants' },
                { num: '3', label: 'ML Techniques' },
                { num: '100%', label: 'Personalised' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--surface)', borderRadius: 12, padding: '12px 20px',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{s.num}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — decorative card stack */}
          <div style={{ flex: '1 1 45%', display: 'flex', justifyContent: 'center', position: 'relative', minHeight: 360 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute',
                top: i * 24, right: i * 24,
                width: 260, background: 'var(--surface)', borderRadius: 16,
                boxShadow: `0 ${8 + i * 4}px ${24 + i * 8}px rgba(0,0,0,${0.08 - i * 0.02})`,
                padding: 16, transform: `rotate(${-3 + i * 3}deg)`,
                zIndex: 3 - i
              }}>
                <div style={{
                  height: 120, borderRadius: 12, marginBottom: 12,
                  background: `linear-gradient(135deg, ${['#FFE0C0', '#FFD0A0', '#FFC080'][i]}, ${['#FFF3E8', '#FFE8D0', '#FFD8B0'][i]})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40
                }}>
                  {['🍛', '🍕', '☕'][i]}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {['Spice Garden', 'Truffles', 'Third Wave Coffee'][i]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {['North Indian · Koramangala', 'American · Indiranagar', 'Café · HSR Layout'][i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Algorithm Strip ─────────────────────────────────── */}
      <section style={{ background: 'var(--bg)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 className="text-h3" style={{ textAlign: 'center', marginBottom: 8 }}>Three Engines. One Recommendation.</h2>
          <p className="text-body" style={{ textAlign: 'center', marginBottom: 36, maxWidth: 560, margin: '0 auto 36px' }}>
            We don't just show you popular places. We learn what YOU like.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { icon: '📊', title: 'Content-Based', desc: 'Finds restaurants similar to ones you\'ve liked — same cuisine, type, neighbourhood.' },
              { icon: '👥', title: 'Collaborative Filtering', desc: 'Powered by SVD — discovers what people with similar taste patterns enjoy.' },
              { icon: '⚡', title: 'Hybrid Model', desc: 'Blends both with a dynamic alpha weight that ramps up as you build history.' },
            ].map(a => (
              <div key={a.title} style={{
                background: 'var(--surface)', borderRadius: 16, padding: 28,
                boxShadow: 'var(--shadow-card)', textAlign: 'center'
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{a.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{a.title}</h3>
                <p className="text-body" style={{ fontSize: 13 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guest Banner (if not signed in) ─────────────────── */}
      {!user && (
        <section style={{
          background: 'var(--primary-light)', padding: '24px',
          borderTop: '1px solid rgba(252,128,25,0.2)', borderBottom: '1px solid rgba(252,128,25,0.2)'
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                You're browsing as a guest — sign up to unlock personalised recommendations
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Complete a 30-second quiz and we'll tailor every suggestion to your taste.
              </p>
            </div>
            <Link href="/login?tab=register" className="btn btn-primary" style={{ flexShrink: 0 }}>
              Create Account →
            </Link>
          </div>
        </section>
      )}

      {/* ── Quick Search ────────────────────────────────────── */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="text-h3" style={{ marginBottom: 16 }}>Quick Search</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" className="input-field" placeholder="Search restaurants, cuisines, areas..."
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              style={{ flex: 1, height: 48 }}
            />
            <button type="submit" className="btn btn-primary btn-lg">Search</button>
          </form>
          {/* Suggestion chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {['Biryani', 'North Indian', 'Café', 'Pizza', 'Chinese', 'Koramangala'].map(s => (
              <Link key={s} href={`/discover?q=${encodeURIComponent(s)}`} className="chip">
                {s}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Restaurants ─────────────────────────────── */}
      <section style={{ padding: '0 24px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 className="text-h3">Featured Restaurants</h2>
            <Link href="/discover" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>
              View All →
            </Link>
          </div>
          <div className="cards-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <RestaurantCardSkeleton key={i} />)
              : featured.map((r, i) => <RestaurantCard key={r.restaurant_id || i} restaurant={r} />)
            }
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="footer">
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              🍽️ GoodSpot
            </div>
            <p style={{ maxWidth: 300, lineHeight: 1.6 }}>
              A restaurant recommendation engine powered by machine learning.
              No ordering. No delivery. Pure discovery.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <p style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>Pages</p>
              {[['/', 'Home'], ['/discover', 'Discover'], ['/group', 'Group Recs'], ['/about', 'How It Works']].map(([h, l]) => (
                <Link key={h} href={h} style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>{l}</Link>
              ))}
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>Account</p>
              <Link href="/login" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Sign In</Link>
              <Link href="/login?tab=register" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Register</Link>
              <Link href="/profile" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Profile</Link>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '24px auto 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          © 2026 GoodSpot. Built as an academic project — not a commercial service.
        </div>
      </footer>
    </div>
  );
}
