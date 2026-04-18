'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCurrentUser, logout } from '@/lib/auth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const links = [
    { href: '/discover', label: 'Discover' },
    { href: '/group', label: 'Group Recs' },
    { href: '/about', label: 'How It Works' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <span className="logo-icon">🍽️</span>
          GoodSpot
        </Link>

        {/* Nav links */}
        <div className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link${pathname?.startsWith(href) ? ' active' : ''}`}
            >
              {label}
            </Link>
          ))}

          {user ? (
            // Signed-in state
            <div style={{ position: 'relative', marginLeft: '8px' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 10px', borderRadius: '8px',
                  transition: 'background 200ms'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {/* Avatar */}
                {user.picture ? (
                  <img src={user.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14
                  }}>
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {user.name || user.email?.split('@')[0]}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '44px',
                  background: 'var(--surface)', borderRadius: '12px', minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
                  overflow: 'hidden', zIndex: 200
                }}>
                  <Link href="/profile" onClick={() => setMenuOpen(false)} style={{
                    display: 'block', padding: '12px 16px', fontSize: 14,
                    color: 'var(--text-primary)', transition: 'background 200ms'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    My Profile
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)} style={{
                      display: 'block', padding: '12px 16px', fontSize: 14,
                      color: 'var(--primary)', transition: 'background 200ms'
                    }}>
                      Admin Dashboard
                    </Link>
                  )}
                  <button onClick={logout} style={{
                    display: 'block', width: '100%', padding: '12px 16px',
                    fontSize: 14, color: 'var(--rating-low)', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderTop: '1px solid var(--border)'
                  }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Guest state
            <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/login?tab=register" className="btn btn-primary btn-sm">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
