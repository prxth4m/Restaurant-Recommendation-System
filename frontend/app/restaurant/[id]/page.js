'use client';
import { useState, useEffect, use } from 'react';
import { api, isLoggedIn } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import RestaurantCard, { RestaurantCardSkeleton } from '@/components/RestaurantCard';

function ScoreBar({ label, value, color = 'var(--primary)' }) {
  const pct = Math.min(Math.max(value * 100, 0), 100);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 600ms ease' }} />
      </div>
    </div>
  );
}

export default function RestaurantDetailPage({ params }) {
  const { id } = use(params);
  const [restaurant, setRestaurant] = useState(null);
  const [scores, setScores] = useState(null);
  const [moreLike, setMoreLike] = useState([]);
  const [loading, setLoading] = useState(true);
  const [interactionMsg, setInteractionMsg] = useState('');
  
  // Safe client-side auth state to prevent Next.js hydration mismatch
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Persistent interaction state — restored from MongoDB on load
  const [hasVisited, setHasVisited] = useState(false);
  const [myRating, setMyRating] = useState(null); // null = unrated, 1-5 = rated
  const [hoverRating, setHoverRating] = useState(null);

  useEffect(() => {
    setIsClientLoggedIn(isLoggedIn());
    setUser(getCurrentUser());
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [detailRes, scoresRes] = await Promise.all([
        api.getRestaurant(id),
        api.getRestaurantScores(id),
      ]);
      if (detailRes.success) setRestaurant(detailRes.data);
      if (scoresRes.success) setScores(scoresRes.data);

      // Get "more like this" recommendations
      if (detailRes.success && detailRes.data?.name) {
        const moreRes = await api.recommend({ restaurant_name: detailRes.data.name, technique: 'cbf', top_n: 8 });
        if (moreRes.success) setMoreLike(moreRes.data || []);
      }

      // Restore previous interaction state from MongoDB
      if (isLoggedIn()) {
        const myInteractions = await api.getMyInteractions().catch(() => ({ success: false }));
        if (myInteractions.success) {
          const rid = parseInt(id);
          const forThisRestaurant = (myInteractions.data || []).filter(
            i => i.restaurant_id === rid
          );
          const visited = forThisRestaurant.some(i => i.action === 'been_here');
          const ratingEntry = forThisRestaurant.find(i => i.action === 'rated' && i.rating);
          if (visited) setHasVisited(true);
          if (ratingEntry) setMyRating(ratingEntry.rating);
        }

        // Log view (fire-and-forget, don't block load)
        if (detailRes.success) {
          api.logInteraction(parseInt(id), detailRes.data.name, 'viewed', detailRes.data.location || '').catch(() => {});
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleRate = async (rating) => {
    if (!isLoggedIn()) return;
    try {
      await api.logInteraction(parseInt(id), restaurant.name, 'rated', restaurant.location || '', rating);
      setMyRating(rating);
      setInteractionMsg(`Rated ${rating} ★`);
      setTimeout(() => setInteractionMsg(''), 2000);
    } catch (e) { console.error(e); }
  };

  const handleBeenHere = async () => {
    if (!isLoggedIn() || hasVisited) return; // prevent double-marking
    try {
      await api.logInteraction(parseInt(id), restaurant.name, 'been_here', restaurant.location || '');
      setHasVisited(true);
      setInteractionMsg('Marked as visited!');
      setTimeout(() => setInteractionMsg(''), 2000);
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 24, width: '40%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '60%' }} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
        <h2 className="text-h2">Restaurant Not Found</h2>
        <p className="text-body" style={{ marginTop: 8 }}>This restaurant doesn't exist or has been removed.</p>
      </div>
    );
  }

  const r = restaurant;
  const rating = parseFloat(r.rate || r.rating || 0);
  const ratingBg = rating >= 4 ? 'var(--rating-high)' : rating >= 3 ? 'var(--rating-mid)' : 'var(--rating-low)';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* ── Header Card ────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 32,
        boxShadow: 'var(--shadow-card)', marginBottom: 32
      }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {/* Image placeholder */}
          <div style={{
            width: 280, height: 200, borderRadius: 12,
            background: 'linear-gradient(135deg, #FFF3E8, #FFE0C0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, flexShrink: 0
          }}>
            🍽️
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800 }}>{r.name}</h1>
              {rating > 0 && (
                <span style={{
                  background: ratingBg, color: '#fff', padding: '4px 10px',
                  borderRadius: 6, fontSize: 14, fontWeight: 700
                }}>
                  ★ {rating.toFixed(1)}
                </span>
              )}
            </div>

            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {r.cuisines || r.cuisine} {r.rest_type ? `· ${r.rest_type}` : ''}
            </p>

            {r.location && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {r.location}
              </p>
            )}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              {r.approx_cost > 0 && <span style={{ fontSize: 15, fontWeight: 600 }}>₹{r.approx_cost} for two</span>}
              {r.online_order === 1 ? (
                <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rating-high)' }} />
                  Online Order Available
                </span>
              ) : (
                <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' }} />
                  Dine-Out Only
                </span>
              )}
              {r.book_table === 1 && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>🪑 Table Booking</span>}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {isClientLoggedIn && (
                <>
                  {/* Been Here button — locks once visited */}
                  <button
                    className="btn btn-sm"
                    onClick={handleBeenHere}
                    disabled={hasVisited}
                    style={{
                      background: hasVisited ? 'var(--rating-high)' : 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      cursor: hasVisited ? 'default' : 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      opacity: hasVisited ? 0.85 : 1,
                    }}
                  >
                    {hasVisited ? '✅ Visited' : '📍 I\'ve Been Here'}
                  </button>

                  {/* Star rating — highlights previously chosen star */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {myRating && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>
                        Your rating:
                      </span>
                    )}
                    {[1, 2, 3, 4, 5].map(star => {
                      const isActive = (hoverRating ?? myRating) >= star;
                      return (
                        <button
                          key={star}
                          onClick={() => handleRate(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          style={{
                            background: isActive ? 'var(--primary)' : 'none',
                            border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 6,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 150ms',
                            fontWeight: isActive ? 700 : 400,
                          }}
                        >
                          ★
                        </button>
                      );
                    })}
                    {myRating && (
                      <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginLeft: 4 }}>
                        {myRating}★
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            {interactionMsg && (
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--rating-high)', fontWeight: 500 }}>✓ {interactionMsg}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── "Why We Recommended This" Panel ─────────────── */}
      {scores && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: 28,
          boxShadow: 'var(--shadow-card)', marginBottom: 32
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Why We Recommended This</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {scores.has_preferences
              ? 'Scores are based on your taste preferences.'
              : 'Set your taste preferences to see personalised scores.'}
          </p>

          <ScoreBar
            label={scores.has_preferences ? 'Preference Match (Cuisine · Area · Price)' : 'Popularity Score'}
            value={scores.cbf_score || 0}
            color="var(--primary)"
          />

          <div style={{ marginBottom: 16 }}>
            <ScoreBar
              label={scores.cf_is_personalised ? 'Collaborative Score (Personalised)' : 'Collaborative Score (Based on global avg)'}
              value={scores.cf_score || 0}
              color="#4285F4"
            />
            {!scores.cf_is_personalised && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10 }}>
                Rate more restaurants to unlock personalised collaborative scores.
              </p>
            )}
          </div>

          <ScoreBar label="Overall Recommendation Score" value={scores.hybrid_score || 0} color="var(--rating-high)" />
          <div style={{
            marginTop: 12, padding: '10px 14px', background: 'var(--primary-light)',
            border: '1px solid var(--primary)', borderRadius: 8,
            fontSize: 12, color: 'var(--primary)', fontWeight: 500
          }}>
            α = {scores.alpha_used?.toFixed(2) || '0.00'} —{' '}
            {scores.alpha_used === 0
              ? 'Pure content-based (no interactions yet)'
              : scores.alpha_used <= 0.1
              ? '90% content + 10% collaborative'
              : scores.alpha_used <= 0.4
              ? '60% content + 40% collaborative'
              : '30% content + 70% collaborative'}
          </div>
        </div>
      )}

      {/* ── "More Like This" ────────────────────────────── */}
      {moreLike.length > 0 && (
        <div>
          <h2 className="text-h3" style={{ marginBottom: 20 }}>More Like This</h2>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
            {moreLike.slice(0, 8).map((r, i) => (
              <div key={r.id || i} style={{ minWidth: 240, flexShrink: 0 }}>
                <RestaurantCard restaurant={r} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
