// frontend/lib/auth.js — Auth state helpers (client-side only)
import { getToken, removeToken } from './api';

// Decode JWT payload without verification (client-side only)
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    removeToken();
    return null;
  }
  return payload; // { sub, email, role, name, picture, onboarding_complete, auth_method }
}

export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

export function needsOnboarding() {
  const user = getCurrentUser();
  if (!user) return false;
  return user.onboarding_complete === false;
}

export function logout() {
  removeToken();
  window.location.href = '/login';
}
