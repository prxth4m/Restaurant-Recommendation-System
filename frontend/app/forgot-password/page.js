'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState('idle'); // idle | loading | sent | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await api.forgotPassword(email.trim());
      if (res?.success) {
        setStatus('sent');
        setMessage(res.message || 'Reset link sent!');
      } else {
        setStatus('error');
        setMessage(res?.error || 'Something went wrong.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Network error.');
    }
  };

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
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Forgot your password?</p>
        </div>

        {status === 'sent' ? (
          /* ── Success State ── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #FC8019, #E8720C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '28px',
            }}>📬</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Check your inbox</h2>
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
              The link expires in <strong>15 minutes</strong>.
            </p>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '24px' }}>
              Didn't get it? Check spam folder or{' '}
              <button
                onClick={() => { setStatus('idle'); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: '#FC8019', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: '13px' }}
              >try again</button>.
            </p>
            <Link href="/login" style={{
              display: 'block', padding: '14px', background: '#FC8019', color: '#fff',
              borderRadius: '10px', textDecoration: 'none', fontWeight: 600, textAlign: 'center',
            }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Form State ── */
          <form onSubmit={handleSubmit}>
            <p style={{ color: '#555', lineHeight: '1.6', marginBottom: '28px', fontSize: '14px' }}>
              Enter your account email and we'll send you a secure link to reset your password.
            </p>

            {status === 'error' && (
              <div style={{
                background: '#fff2f2', border: '1px solid #ffcdd2', borderRadius: '10px',
                padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '14px',
              }}>
                {message}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: '#333' }}>
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '15px',
                  border: '1.5px solid #e8e8e8', boxSizing: 'border-box', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#FC8019'}
                onBlur={(e)  => e.target.style.borderColor = '#e8e8e8'}
              />
            </div>

            <button
              type="submit"
              id="send-reset-btn"
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: status === 'loading'
                  ? '#f5a862'
                  : 'linear-gradient(135deg, #FC8019, #E8720C)',
                color: '#fff', fontWeight: 600, fontSize: '15px',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {status === 'loading' ? 'Sending…' : 'Send Reset Link'}
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
