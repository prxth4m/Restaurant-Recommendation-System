'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import RestaurantCard, { RestaurantCardSkeleton } from '@/components/RestaurantCard';

const CUISINE_OPTIONS = ['North Indian', 'Chinese', 'South Indian', 'Biryani', 'Continental', 'Café', 'Pizza', 'Italian'];
const PRICE_OPTIONS = ['₹', '₹₹', '₹₹₹'];

function MemberForm({ member, index, onChange, onRemove, canRemove }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, padding: 20,
      boxShadow: 'var(--shadow-card)', position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>
          <span style={{
            display: 'inline-flex', width: 24, height: 24, borderRadius: '50%',
            background: 'var(--primary)', color: '#fff', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, marginRight: 8
          }}>
            {index + 1}
          </span>
          Member {index + 1}
        </h4>
        {canRemove && (
          <button onClick={onRemove} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--rating-low)', fontSize: 18, lineHeight: 1
          }}>✕</button>
        )}
      </div>

      <label className="input-label">Cuisine Preferences</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {CUISINE_OPTIONS.map(c => {
          const selected = (member.cuisines || '').split(',').map(s => s.trim()).filter(Boolean).includes(c);
          return (
            <button key={c} className={`chip${selected ? ' selected' : ''}`}
              onClick={() => {
                const current = (member.cuisines || '').split(',').map(s => s.trim()).filter(Boolean);
                const next = selected ? current.filter(x => x !== c) : [...current, c];
                onChange({ ...member, cuisines: next.join(', ') });
              }}
              style={{ fontSize: 11, padding: '4px 10px' }}>
              {c}
            </button>
          );
        })}
      </div>

      <label className="input-label">Price Range</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {PRICE_OPTIONS.map(p => (
          <button key={p} className={`chip${member.price_range === p ? ' selected' : ''}`}
            onClick={() => onChange({ ...member, price_range: p })}
            style={{ fontSize: 12, padding: '6px 14px' }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GroupPage() {
  const [members, setMembers] = useState([
    { user_id: 'member_1', cuisines: '', price_range: '₹₹' },
    { user_id: 'member_2', cuisines: '', price_range: '₹₹' },
  ]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const updateMember = (i, data) => {
    const next = [...members];
    next[i] = data;
    setMembers(next);
  };

  const addMember = () => {
    if (members.length >= 4) return;
    setMembers([...members, { user_id: `member_${members.length + 1}`, cuisines: '', price_range: '₹₹' }]);
  };

  const removeMember = (i) => {
    if (members.length <= 2) return;
    setMembers(members.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    // Validate at least one cuisine per member
    for (let i = 0; i < members.length; i++) {
      if (!members[i].cuisines?.trim()) {
        setMessage(`Member ${i + 1} needs at least one cuisine preference.`);
        return;
      }
    }
    setLoading(true); setResults([]); setMessage('');
    try {
      const res = await api.recommendGroup(members);
      if (res.success) {
        setResults(res.data || []);
        setMessage(`Found ${(res.data || []).length} restaurants everyone will enjoy!`);
      }
    } catch (e) {
      setMessage('Failed to get group recommendations. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p className="text-eyebrow" style={{ marginBottom: 8 }}>GROUP DINING</p>
        <h1 className="text-h2" style={{ marginBottom: 8 }}>Find a Spot Everyone Loves</h1>
        <p className="text-body" style={{ maxWidth: 560, margin: '0 auto' }}>
          Add your group members' preferences and we'll find restaurants that satisfy everyone.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Members panel */}
        <div style={{ flex: '1 1 400px', maxWidth: 480 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            {members.map((m, i) => (
              <MemberForm key={i} member={m} index={i}
                onChange={(data) => updateMember(i, data)}
                onRemove={() => removeMember(i)}
                canRemove={members.length > 2}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {members.length < 4 && (
              <button className="btn btn-ghost" onClick={addMember} style={{ flex: 1 }}>
                + Add Member
              </button>
            )}
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={loading}
              style={{ flex: 2 }}>
              {loading ? 'Finding…' : `Find for ${members.length} People →`}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: '1 1 400px' }}>
          {message && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{message}</p>}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => <RestaurantCardSkeleton key={i} />)}
            </div>
          ) : results.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.map((r, i) => (
                <RestaurantCard key={r.id || i} restaurant={r} showMoreLike={false} />
              ))}
            </div>
          ) : !loading && (
            <div style={{
              background: 'var(--surface)', borderRadius: 16, padding: 48,
              textAlign: 'center', boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Set Preferences</h3>
              <p className="text-body">Add cuisines for each member and hit "Find" to see recommendations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
