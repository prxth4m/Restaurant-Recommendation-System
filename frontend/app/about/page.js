import Link from 'next/link';

export const metadata = {
  title: 'How It Works — GoodSpot',
  description: 'Learn how GoodSpot\'s three ML recommendation techniques work together.',
};

export default function AboutPage() {
  const steps = [
    { num: '01', title: 'Create Your Profile', desc: 'Sign up with Google or email. Complete a quick taste quiz — we ask about your favourite cuisines, price comfort, and neighbourhood.', icon: '👤' },
    { num: '02', title: 'We Build Your Taste Model', desc: 'Our content-based engine matches restaurants with similar attributes to your preferences. Every rating you give makes it smarter.', icon: '📊' },
    { num: '03', title: 'Collaborative Intelligence', desc: 'SVD-based collaborative filtering finds patterns across all users. People with tastes like yours help surface hidden gems.', icon: '👥' },
    { num: '04', title: 'Hybrid Blending', desc: 'A dynamic alpha weight blends both techniques. It ramps from 0.1 (cold start) to 0.7 as you build interaction history.', icon: '⚡' },
  ];

  const features = [
    { title: 'Content-Based Filtering', desc: 'TF-IDF vectors + cosine similarity across 9,249 restaurants. Considers cuisine, type, cost, location, and order mode.', detail: 'Technique' },
    { title: 'Collaborative Filtering', desc: 'Truncated SVD (50 components) on a user-interaction matrix. Discovers latent taste patterns across users.', detail: 'Technique' },
    { title: 'Hybrid Model', desc: 'α·CF + (1−α)·CBF with dynamic alpha. New users get pure CBF; experienced users get more CF influence.', detail: 'Technique' },
    { title: 'Group Recommendations', desc: 'Aggregates individual taste vectors using optimistic scoring — no one gets stuck at a place they hate.', detail: 'Feature' },
    { title: 'Admin Dashboard', desc: 'Model alpha control, A/B testing, user management, pipeline rebuild, and restaurant flagging.', detail: 'Feature' },
    { title: '9,249 Restaurants', desc: 'Sourced from Zomato\'s Bangalore dataset. Cleaned, deduplicated, and feature-engineered for ML.', detail: 'Data' },
  ];

  return (
    <div>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #FFF8F2, #FFFFFF)', padding: '64px 24px 48px',
        textAlign: 'center'
      }}>
        <p className="text-eyebrow" style={{ marginBottom: 12 }}>BEHIND THE SCENES</p>
        <h1 className="text-hero" style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          How <span style={{ color: 'var(--primary)' }}>GoodSpot</span> Works
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
          Three machine-learning engines working together to find restaurants you'll actually love.
        </p>
      </section>

      {/* Steps */}
      <section style={{ padding: '48px 24px', maxWidth: 900, margin: '0 auto' }}>
        {steps.map((s, i) => (
          <div key={s.num} style={{
            display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32,
            padding: 24, background: 'var(--surface)', borderRadius: 16,
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{s.num}</span>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</h3>
              </div>
              <p className="text-body">{s.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Tech Grid */}
      <section style={{ background: 'var(--bg)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 className="text-h2" style={{ textAlign: 'center', marginBottom: 32 }}>Under The Hood</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {features.map(f => (
              <div key={f.title} style={{
                background: 'var(--surface)', borderRadius: 16, padding: 24,
                boxShadow: 'var(--shadow-card)'
              }}>
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600, color: 'var(--primary)',
                  background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 4,
                  marginBottom: 8, textTransform: 'uppercase'
                }}>
                  {f.detail}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p className="text-body" style={{ fontSize: 13 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="text-h2" style={{ marginBottom: 20 }}>Tech Stack</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['Python', 'FastAPI', 'scikit-learn', 'scikit-surprise', 'pandas', 'Motor (MongoDB)',
              'Next.js 16', 'React 19', 'Vanilla CSS', 'JWT Auth', 'Google OAuth2'].map(t => (
              <span key={t} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--primary-light)' }}>
        <h2 className="text-h3" style={{ marginBottom: 12 }}>Ready to discover?</h2>
        <p className="text-body" style={{ marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
          Create an account and start getting personalised restaurant recommendations today.
        </p>
        <Link href="/login?tab=register" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '14px 32px', background: 'var(--primary)', color: '#fff',
          borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none'
        }}>
          Get Started →
        </Link>
      </section>
    </div>
  );
}
