'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, setToken } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

// ── Google G SVG Logo ─────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Onboarding Quiz (Step 2) ──────────────────────────────────
const CUISINES = ['North Indian', 'Chinese', 'South Indian', 'Biryani', 'Continental', 'Café', 'Pizza', 'Others'];
const AREAS_FALLBACK = ['Koramangala', 'Indiranagar', 'HSR Layout', 'Jayanagar', 'Whitefield', 'MG Road', 'Marathahalli', 'Electronic City', 'Yelahanka', 'Rajajinagar'];
const PRICES = [
  { id: '₹', symbol: '₹', label: 'Under ₹500' },
  { id: '₹₹', symbol: '₹₹', label: '₹500–₹1,500' },
  { id: '₹₹₹', symbol: '₹₹₹', label: '₹1,500+' },
];

function OnboardingQuiz({ onComplete }) {
  const [cuisines, setCuisines] = useState([]);
  const [price, setPrice] = useState('₹₹');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Searchable area combobox state
  const [allLocations, setAllLocations] = useState(AREAS_FALLBACK);
  const [areaSearch, setAreaSearch] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const areaRef = useRef(null);

  useEffect(() => {
    api.getFilters().then(res => {
      if (res.success && res.data?.locations?.length) setAllLocations(res.data.locations);
    }).catch(() => {});
  }, []);

  // Close area dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (areaRef.current && !areaRef.current.contains(e.target)) setAreaOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCuisine = (c) =>
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const handleSubmit = async () => {
    if (cuisines.length === 0) { setError('Please select at least one cuisine.'); return; }
    setLoading(true); setError('');
    try {
      await api.completeOnboarding(cuisines, price, area);
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8 }}>
        <div className="step-dot done" />
        <div className="step-line done" />
        <div className="step-dot active" />
      </div>
      <div className="step-label" style={{ marginBottom: 24 }}>Step 2 of 2</div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
        Almost there! Help us personalise.
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24 }}>
        This helps us personalise your recommendations from day one.
      </p>

      {/* Cuisines */}
      <label className="input-label" style={{ marginBottom: 10 }}>What cuisines do you love?</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {CUISINES.map(c => (
          <button key={c} className={`chip${cuisines.includes(c) ? ' selected' : ''}`} onClick={() => toggleCuisine(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* Price */}
      <label className="input-label" style={{ marginBottom: 10 }}>What's your price comfort?</label>
      <div className="price-cards" style={{ marginBottom: 24 }}>
        {PRICES.map(p => (
          <div key={p.id} className={`price-card${price === p.id ? ' selected' : ''}`} onClick={() => setPrice(p.id)}>
            <div className="price-symbol">{p.symbol}</div>
            <div className="price-label">{p.label}</div>
          </div>
        ))}
      </div>

      {/* Area — searchable combobox */}
      <label className="input-label" style={{ marginBottom: 6 }}>Which area of Bangalore do you mostly eat in?</label>
      <div ref={areaRef} style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search areas..."
            value={areaOpen ? areaSearch : (area || '')}
            onChange={e => { setAreaSearch(e.target.value); setArea(''); setAreaOpen(true); }}
            onFocus={() => { setAreaOpen(true); setAreaSearch(''); }}
            style={{ fontSize: 14, paddingRight: area ? 30 : 12 }}
          />
          {area && !areaOpen && (
            <button
              onClick={() => { setArea(''); setAreaSearch(''); }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                color: 'var(--text-muted)', padding: 0, lineHeight: 1
              }}
            >✕</button>
          )}
        </div>
        {areaOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0 0 8px 8px', maxHeight: 180, overflowY: 'auto',
            boxShadow: 'var(--shadow-card)'
          }}>
            {allLocations
              .filter(a => !areaSearch || a.toLowerCase().includes(areaSearch.toLowerCase()))
              .map(a => (
                <div key={a}
                  style={{
                    padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                    background: area === a ? 'var(--primary-light)' : 'transparent',
                    fontWeight: area === a ? 600 : 400,
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--primary-light)'}
                  onMouseLeave={e => e.target.style.background = area === a ? 'var(--primary-light)' : 'transparent'}
                  onClick={() => { setArea(a); setAreaSearch(''); setAreaOpen(false); }}
                >
                  {a}
                </div>
              ))
            }
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--rating-low)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Saving…' : 'Create Account →'}
      </button>
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'signin');
  const [step, setStep] = useState(parseInt(searchParams.get('step') || '1', 10)); // 1 = form, 2 = onboarding quiz

  // Sign in form
  const [signEmail, setSignEmail] = useState('');
  const [signPass, setSignPass] = useState('');
  const [showSignPass, setShowSignPass] = useState(false);

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get('error') || '');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (getCurrentUser()) router.replace('/discover');
  }, []);

  // ── Sign In ─────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.login(signEmail, signPass);
      if (!res.success) throw new Error(res.error || 'Login failed');
      setToken(res.data.access_token);
      router.push('/discover');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Register Step 1 ─────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (regPass !== regConfirm) { setError('Passwords do not match.'); return; }
    if (regPass.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.register(regEmail, regPass, {});
      if (!res.success) throw new Error(res.error || 'Registration failed');
      setToken(res.data.access_token);
      setStep(2); // Go to onboarding quiz
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ─────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err) {
      setForgotMsg('Request sent — check your inbox.');
    } finally {
      setLoading(false);
    }
  };

  // ── Onboarding complete ─────────────────────────────────────
  const handleOnboardingComplete = () => router.push('/discover');

  return (
    <div className="auth-page">
      {/* Decorative blobs */}
      <div className="auth-blob" style={{ width: 300, height: 300, top: -80, left: -80 }} />
      <div className="auth-blob" style={{ width: 200, height: 200, bottom: -60, right: -60 }} />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-icon">🍽️</div>
          <span className="auth-logo-text">GoodSpot</span>
        </div>

        {/* Show onboarding quiz after email register */}
        {tab === 'register' && step === 2 ? (
          <OnboardingQuiz onComplete={handleOnboardingComplete} />
        ) : forgotMode ? (
          /* Forgot password */
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Reset Password</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Enter your email — we'll send a reset link.
            </p>
            {forgotMsg ? (
              <div style={{ padding: 16, background: 'var(--primary-light)', borderRadius: 8, fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>
                {forgotMsg}
              </div>
            ) : (
              <form onSubmit={handleForgot}>
                <label className="input-label">Email address</label>
                <input required type="email" className="input-field" placeholder="you@example.com"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  style={{ marginBottom: 20 }} />
                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            )}
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
              <button onClick={() => setForgotMode(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                ← Back to Sign In
              </button>
            </p>
          </div>
        ) : (
          /* Main form */
          <>
            {/* Tab toggle */}
            <div className="tab-toggle" style={{ marginBottom: 28 }}>
              <button className={`tab-btn${tab === 'signin' ? ' active' : ''}`} onClick={() => { setTab('signin'); setError(''); setStep(1); }}>
                Sign In
              </button>
              <button className={`tab-btn${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setError(''); setStep(1); }}>
                Create Account
              </button>
            </div>

            {/* Step indicator for register */}
            {tab === 'register' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                  <div className="step-dot active" />
                  <div className="step-line" />
                  <div className="step-dot" />
                </div>
                <div className="step-label">Step 1 of 2</div>
              </div>
            )}

            {/* Google button */}
            <button className="btn-google" onClick={() => api.googleLogin()}>
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="divider"><span>or</span></div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 8, fontSize: 13, color: 'var(--rating-low)', marginBottom: 16 }}>
                {error}
              </div>
            )}

            {tab === 'signin' ? (
              /* Sign In form */
              <form onSubmit={handleSignIn}>
                <label className="input-label">Email address</label>
                <input required type="email" className="input-field"
                  placeholder="you@example.com" value={signEmail}
                  onChange={e => setSignEmail(e.target.value)}
                  style={{ marginBottom: 16 }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Password</label>
                  <button type="button" onClick={() => setForgotMode(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    Forgot password?
                  </button>
                </div>
                <div className="input-wrap" style={{ marginBottom: 24 }}>
                  <input required type={showSignPass ? 'text' : 'password'}
                    className="input-field" placeholder="••••••••"
                    value={signPass} onChange={e => setSignPass(e.target.value)} />
                  <button type="button" className="eye-btn" onClick={() => setShowSignPass(!showSignPass)}>
                    {showSignPass ? '🙈' : '👁️'}
                  </button>
                </div>

                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In →'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => { setTab('register'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                    Create Account
                  </button>
                </p>
              </form>
            ) : (
              /* Register Step 1 form */
              <form onSubmit={handleRegister}>
                <label className="input-label">Email address</label>
                <input required type="email" className="input-field"
                  placeholder="you@example.com" value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  style={{ marginBottom: 16 }} />

                <label className="input-label">Password</label>
                <div className="input-wrap" style={{ marginBottom: 4 }}>
                  <input required type={showRegPass ? 'text' : 'password'}
                    className="input-field" placeholder="Create a password"
                    value={regPass} onChange={e => setRegPass(e.target.value)} />
                  <button type="button" className="eye-btn" onClick={() => setShowRegPass(!showRegPass)}>
                    {showRegPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="input-hint" style={{ marginBottom: 16 }}>At least 8 characters</p>

                <label className="input-label">Confirm Password</label>
                <input required type="password" className="input-field"
                  placeholder="Repeat your password" value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  style={{ marginBottom: 24 }} />

                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Continue →'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setTab('signin'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                    Sign In
                  </button>
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
