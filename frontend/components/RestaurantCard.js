'use client';
import Link from 'next/link';

// ── Rating badge color ────────────────────────────────────────
function ratingClass(rating) {
  if (rating >= 4.0) return 'rating-high';
  if (rating >= 3.0) return 'rating-mid';
  return 'rating-low';
}

// ── Food emoji by cuisine ─────────────────────────────────────
const CUISINE_EMOJI = {
  'North Indian': '🍛', 'Chinese': '🥡', 'South Indian': '🥘',
  'Biryani': '🍚', 'Continental': '🍝', 'Café': '☕',
  'Pizza': '🍕', 'Italian': '🍝', 'Japanese': '🍣',
  'Mexican': '🌮', 'Thai': '🍜', 'Seafood': '🦐',
  'Bakery': '🧁', 'Desserts': '🍰', 'Ice Cream': '🍦',
  'Fast Food': '🍔', 'Street Food': '🌯',
};

function getFoodEmoji(cuisines) {
  if (!cuisines) return '🍽️';
  const first = cuisines.split(',')[0]?.trim();
  return CUISINE_EMOJI[first] || '🍽️';
}

export default function RestaurantCard({ restaurant, showMoreLike = true, onMoreLike = null }) {
  const r = restaurant;
  const rating = parseFloat(r.rate || r.rating || 0);
  const name = r.name || 'Restaurant';
  const cuisines = r.cuisines || r.cuisine || '';
  const location = r.location || r.area || '';
  const price = r.approx_cost || r.cost || '';
  const restType = r.rest_type || '';
  const onlineOrder = r.online_order === 1;
  const id = r.id || r.restaurant_id || 0;

  return (
    <Link href={`/restaurant/${id}`} style={{ textDecoration: 'none' }}>
      <div className="restaurant-card">
        {/* Image area */}
        <div className="restaurant-card-img">
          <div className="restaurant-card-img-placeholder">
            {getFoodEmoji(cuisines)}
          </div>
          {/* Cuisine label - top left */}
          {cuisines && (
            <span className="card-badge-tl">
              {cuisines.split(',')[0]?.trim()}
            </span>
          )}
          {/* Rating badge - top right */}
          {rating > 0 && (
            <span className={`rating-badge card-badge-tr ${ratingClass(rating)}`}>
              ★ {rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="restaurant-card-body">
          <div className="restaurant-card-name">{name}</div>
          <div className="restaurant-card-meta">
            {cuisines}{restType ? ` · ${restType}` : ''}
          </div>
          {location && (
            <div className="restaurant-card-loc">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {location}
            </div>
          )}
          {price && <div className="restaurant-card-price">₹{price} for two</div>}
          <div className="restaurant-card-footer">
            {showMoreLike && (
              <span className="more-like-btn" onClick={e => {
                if (onMoreLike) { e.preventDefault(); e.stopPropagation(); onMoreLike(name); }
              }}>More Like This →</span>
            )}
            <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: onlineOrder ? 'var(--rating-high)' : 'var(--text-muted)',
                display: 'inline-block'
              }} />
              {onlineOrder ? 'Online Order' : 'Dine-Out Only'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton variant ──────────────────────────────────────────
export function RestaurantCardSkeleton() {
  return (
    <div className="restaurant-card" style={{ cursor: 'default' }}>
      <div className="skeleton" style={{ height: 160, borderRadius: '16px 16px 0 0' }} />
      <div style={{ padding: '14px 16px' }}>
        <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '40%' }} />
      </div>
    </div>
  );
}
