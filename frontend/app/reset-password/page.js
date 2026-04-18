'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') || '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [status,    setStatus]    = useState('idle'); // idle | loading | success | error | invalid
  const [message,   setMessage]   = useState('');

  useEffect(() => {
    if (!token) setStatus('invalid');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setStatus('error'); setMessage("Passwords don't match."); return;
    }
    if (password.length < 6) {
      setStatus('error'); setMessage('Password must be at least 6 characters.'); return;
    }
    setStatus('loading'); setMessage('');
    try {
      const res = await api.resetPassword(token, password);
      if (res?.success) {
        setStatus('success');
        setTimeout(() => router.push('/login?message=Password+reset+successfully%21+Please+sign+in.'), 2500);
      } else {
        setStatus('error');
        setMessage(res?.error || 'Reset failed. The link may have expired.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Network error.');
    }
  };

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6)  s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
  const strengthColor = ['', '#ef5350', '#ffa726', '#66bb6a', '#26a69a', '#42a5f5'][strength];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fff8f2 0%, #fff3e8 100%)', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(252,128,25,0.12)', width: '100%', maxWidth: '420px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🍽️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>GoodSpot</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Set a new password</p>
        </div>

        {/* Invalid token */}
        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#c62828' }}>
              Invalid Reset Link
            </h2>
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
              This reset link is missing or malformed. Please request a new one.
            </p>
            <Link href="/forgot-password" style={{
              display: 'block', padding: '14px', background: '#FC8019', color: '#fff',
              borderRadius: '10px', textDecoration: 'none', fontWeight: 600, textAlign: 'center',
            }}>
              Request New Link
            </Link>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #FC8019, #E8720C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '28px',
            }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Password Updated!</h2>
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
              Your password has been changed successfully. Redirecting you to sign in…
            </p>
            <div style={{
              height: '4px', borderRadius: '2px', background: '#f0f0f0', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: '#FC8019', borderRadius: '2px',
                animation: 'progress 2.5s linear forwards',
              }} />
            </div>
            <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        )}

        {/* Form */}
        {(status === 'idle' || status === 'loading' || status === 'error') && token && (
          <form onSubmit={handleSubmit}>
            {status === 'error' && (
              <div style={{
                background: '#fff2f2', border: '1px solid #ffcdd2', borderRadius: '10px',
                padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px',
              }}>
                {message}
              </div>
            )}

            {/* New password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: '#333' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '14px 48px 14px 16px', borderRadius: '10px', fontSize: '15px',
                    border: '1.5px solid #e8e8e8', boxSizing: 'border-box', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#FC8019'}
                  onBlur={(e)  => e.target.style.borderColor = '#e8e8e8'}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0,
                }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Strength bar */}
              {password && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: i <= strength ? strengthColor : '#eee',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: strengthColor, fontWeight: 600 }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: '#333' }}>
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '15px',
                  border: `1.5px solid ${confirm && confirm !== password ? '#ef5350' : '#e8e8e8'}`,
                  boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#FC8019'}
                onBlur={(e)  => e.target.style.borderColor = confirm && confirm !== password ? '#ef5350' : '#e8e8e8'}
              />
              {confirm && confirm !== password && (
                <p style={{ color: '#ef5350', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                  Passwords don't match
                </p>
              )}
            </div>

            <button
              type="submit"
              id="reset-submit-btn"
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: status === 'loading' ? '#f5a862' : 'linear-gradient(135deg, #FC8019, #E8720C)',
                color: '#fff', fontWeight: 600, fontSize: '15px',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'loading' ? 'Updating…' : 'Set New Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link href="/login" style={{ color: '#FC8019', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
