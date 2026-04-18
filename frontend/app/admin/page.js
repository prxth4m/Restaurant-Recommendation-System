'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, isLoggedIn } from '@/lib/api';
import { isAdmin, getCurrentUser } from '@/lib/auth';

function StatCard({ label, value, icon, color = 'var(--primary)' }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, padding: '20px 24px',
      boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: 16
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 22,
        background: `${color}15`
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Model controls
  const [alpha, setAlpha] = useState(0.4);
  const [abHybrid, setAbHybrid] = useState(100);
  const [abCbf, setAbCbf] = useState(0);

  useEffect(() => {
    if (!isLoggedIn() || !isAdmin()) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes] = await Promise.all([
        api.admin.getAnalytics(),
        api.admin.getUsers(),
      ]);
      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
        setAlpha(analyticsRes.data.global_alpha ?? 0.4);
        const ab = analyticsRes.data.ab_test_split || {};
        setAbHybrid(ab.hybrid ?? 100);
        setAbCbf(ab.cbf_only ?? 0);
      }
      if (usersRes.success) setUsers(usersRes.data?.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleSetAlpha = async () => {
    try {
      await api.admin.setAlpha(alpha);
      flash(`Alpha set to ${alpha}`);
    } catch (e) { flash(e.message, 'error'); }
  };

  const handleRetrain = async () => {
    try {
      const res = await api.admin.retrain();
      flash(res.message || 'Retrain triggered');
    } catch (e) { flash(e.message, 'error'); }
  };

  const handleAbTest = async () => {
    try {
      await api.admin.setAbTest(abHybrid, abCbf);
      flash(`A/B split: ${abHybrid}% Hybrid / ${abCbf}% CBF`);
    } catch (e) { flash(e.message, 'error'); }
  };

  const handleRebuild = async () => {
    try {
      const res = await api.admin.rebuildPipeline();
      flash(res.message || 'Pipeline rebuild started');
    } catch (e) { flash(e.message, 'error'); }
  };

  const handleSuspendUser = async (userId, currently) => {
    try {
      await api.admin.suspendUser(userId, !currently);
      flash(`User ${!currently ? 'suspended' : 'unsuspended'}`);
      loadData();
    } catch (e) { flash(e.message, 'error'); }
  };

  const handlePromoteUser = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.admin.setUserRole(userId, newRole);
      flash(`Role changed to ${newRole}`);
      loadData();
    } catch (e) { flash(e.message, 'error'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user permanently?')) return;
    try {
      await api.admin.deleteUser(userId);
      flash('User deleted');
      loadData();
    } catch (e) { flash(e.message, 'error'); }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'model', label: '⚙️ Model Controls' },
    { id: 'users', label: '👥 Users' },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 24px' }}>
        <div className="skeleton" style={{ height: 40, width: '30%', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      </div>
    );
  }

  const a = analytics || {};

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <p className="text-eyebrow" style={{ marginBottom: 4 }}>ADMIN DASHBOARD</p>
          <h1 className="text-h2">Control Centre</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>↻ Refresh</button>
        </div>
      </div>

      {/* Toast */}
      {msg.text && (
        <div className={`toast ${msg.type}`} style={{ position: 'fixed', bottom: 24, right: 24 }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-toggle" style={{ maxWidth: 420, marginBottom: 28 }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard label="Total Users" value={a.total_users || 0} icon="👥" />
            <StatCard label="Total Interactions" value={a.total_interactions || 0} icon="📝" color="#4285F4" />
            <StatCard label="Restaurants" value={a.total_restaurants || 9249} icon="🍽️" color="var(--rating-high)" />
            <StatCard label="Global Alpha" value={(a.global_alpha ?? 0.4).toFixed(2)} icon="α" color="var(--admin-accent)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 12, padding: 24,
              boxShadow: 'var(--shadow-card)'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>A/B Test Split</h3>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--bg)', marginBottom: 8 }}>
                <div style={{ width: `${a.ab_test_split?.hybrid ?? 100}%`, background: 'var(--primary)', transition: 'width 400ms' }} />
                <div style={{ width: `${a.ab_test_split?.cbf_only ?? 0}%`, background: '#4285F4', transition: 'width 400ms' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>🟠 Hybrid: {a.ab_test_split?.hybrid ?? 100}%</span>
                <span>🔵 CBF Only: {a.ab_test_split?.cbf_only ?? 0}%</span>
              </div>
            </div>
            <div style={{
              background: 'var(--surface)', borderRadius: 12, padding: 24,
              boxShadow: 'var(--shadow-card)'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Pipeline Status</h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>Last SVD retrain: <strong>{a.last_svd_retrain || 'Never'}</strong></p>
                <p>Interactions since retrain: <strong>{a.interactions_since_retrain || 0}</strong></p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODEL CONTROLS TAB ────────────────────────────── */}
      {activeTab === 'model' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Alpha control */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Global Alpha</h3>
            <p className="text-body" style={{ marginBottom: 16 }}>
              Controls the CF vs CBF blend. 0 = pure CBF, 1 = pure CF.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <input type="range" min="0" max="1" step="0.05" value={alpha}
                onChange={e => setAlpha(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)' }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', minWidth: 40 }}>
                {alpha.toFixed(2)}
              </span>
            </div>
            <button className="btn btn-primary btn-sm btn-full" onClick={handleSetAlpha}>
              Apply Alpha
            </button>
          </div>

          {/* A/B test */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>A/B Test Split</h3>
            <p className="text-body" style={{ marginBottom: 16 }}>
              Percentage of users who get Hybrid vs CBF-only recommendations.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Hybrid %</label>
                <input type="number" className="input-field" value={abHybrid}
                  onChange={e => { setAbHybrid(Number(e.target.value)); setAbCbf(100 - Number(e.target.value)); }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">CBF-Only %</label>
                <input type="number" className="input-field" value={abCbf}
                  onChange={e => { setAbCbf(Number(e.target.value)); setAbHybrid(100 - Number(e.target.value)); }} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm btn-full" onClick={handleAbTest}>
              Update Split
            </button>
          </div>

          {/* Retrain */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Retrain SVD Model</h3>
            <p className="text-body" style={{ marginBottom: 16 }}>
              Trigger an immediate SVD retrain with current interaction data.
            </p>
            <button className="btn btn-primary btn-sm btn-full" onClick={handleRetrain}>
              🔄 Retrain Now
            </button>
          </div>

          {/* Pipeline rebuild */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Rebuild Pipeline</h3>
            <p className="text-body" style={{ marginBottom: 16 }}>
              Reload restaurant dataset, recompute TF-IDF and cosine matrix.
            </p>
            <button className="btn btn-ghost btn-sm btn-full" onClick={handleRebuild} style={{ color: 'var(--rating-low)', borderColor: 'var(--rating-low)' }}>
              ⚠️ Rebuild Pipeline
            </button>
          </div>
        </div>
      )}

      {/* ── USERS TAB ─────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u._id || i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: u.role === 'admin' ? 'var(--admin-accent)' : 'var(--primary-light)',
                        color: u.role === 'admin' ? '#fff' : 'var(--primary)', fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6,
                        background: u.suspended ? 'var(--rating-low)' : 'var(--rating-high)'
                      }} />
                      {u.suspended ? 'Suspended' : 'Active'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleSuspendUser(u._id, u.suspended)}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button onClick={() => handlePromoteUser(u._id, u.role)}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button onClick={() => handleDeleteUser(u._id)}
                          style={{ background: 'none', border: '1px solid var(--rating-low)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--rating-low)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
