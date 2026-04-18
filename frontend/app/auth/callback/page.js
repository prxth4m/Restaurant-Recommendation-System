'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/api';
import { needsOnboarding } from '@/lib/auth';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const isNewUser = searchParams.get('new_user') === 'true';
    const error = searchParams.get('error');

    if (error) {
      router.replace(`/login?error=${error}`);
      return;
    }

    if (!token) {
      router.replace('/login?error=missing_token');
      return;
    }

    // Store token
    setToken(token);

    // New Google user → onboarding quiz
    // The token contains onboarding_complete=false for new users
    if (isNewUser || needsOnboarding()) {
      router.replace('/login?tab=register&step=2');
    } else {
      router.replace('/discover');
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 800ms linear infinite', margin: '0 auto 16px'
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Signing you in…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
