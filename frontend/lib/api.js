// frontend/lib/api.js — Centralised API client for all backend calls
// All calls hit http://localhost:8000 (FastAPI)

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Token helpers ─────────────────────────────────────────────
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('goodspot_token');
}

export function setToken(token) {
  localStorage.setItem('goodspot_token', token);
}

export function removeToken() {
  localStorage.removeItem('goodspot_token');
}

export function isLoggedIn() {
  return !!getToken();
}

// ── Base fetch wrapper ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Spread options but remove 'cache' to avoid Turbopack/Next.js 16 conflicts
  const { cache: _cache, ...restOptions } = options;
  const fetchOptions = { ...restOptions, headers };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, fetchOptions);
  } catch (networkError) {
    // Network-level failure (DNS, timeout, backend unreachable)
    console.warn(`[apiFetch] Network error on ${path}:`, networkError.message);
    return { success: false, data: null, detail: 'Network error — is the backend running?' };
  }

  if (!res.ok) {
    // Session invalidated (expired token, suspended user, etc.)
    if ((res.status === 401 || res.status === 403) && token) {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?error=Session+expired.+Please+sign+in+again.';
      }
      throw new Error('Session expired');
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ── Health ────────────────────────────────────────────────────
export const api = {

  health: () => apiFetch('/health'),

  // ── Search ─────────────────────────────────────────────────
  search: (q) => apiFetch(`/search?q=${encodeURIComponent(q)}`),

  // ── Recommendations ────────────────────────────────────────
  recommend: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.restaurant_name) qs.set('restaurant_name', params.restaurant_name);
    if (params.cuisines)        qs.set('cuisines', params.cuisines);
    if (params.area)            qs.set('location', params.area);  // backend uses 'location'
    if (params.price_min != null) qs.set('price_min', params.price_min);
    if (params.price_max != null) qs.set('price_max', params.price_max);
    if (params.technique)       qs.set('technique', params.technique);
    if (params.top_n)           qs.set('top_n', params.top_n);
    return apiFetch(`/recommend?${qs.toString()}`);
  },

  recommendGroup: (members) =>
    apiFetch('/recommend-group', { method: 'POST', body: JSON.stringify({ members }) }),

  // ── Restaurant ─────────────────────────────────────────────
  getRestaurant: (id) => apiFetch(`/restaurant/${id}`),
  getRestaurantScores: (id) => apiFetch(`/restaurant/${id}/scores`),

  // ── Auth — Email/Password ──────────────────────────────────
  register: (email, password, preferences = {}) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, preferences }),
    }),

  login: (email, password) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email) =>
    apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, new_password) =>
    apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    }),

  // ── Auth — Google OAuth ────────────────────────────────────
  // Frontend just redirects — backend handles the rest
  googleLogin: () => {
    window.location.href = `${BASE_URL}/auth/google`;
  },

  // ── User Profile ───────────────────────────────────────────
  getMe: () => apiFetch('/users/me'),

  getMyInteractions: () => apiFetch('/users/me/interactions'),

  logInteraction: (restaurant_id, restaurant_name, action, location = '', rating = null) =>
    apiFetch('/users/me/interactions', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id, restaurant_name, action, location, rating }),
    }),

  updatePreferences: (cuisines, price_range, area) =>
    apiFetch('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ cuisines, price_range, area }),
    }),

  completeOnboarding: (cuisines, price_range, area) =>
    apiFetch('/users/me/onboarding', {
      method: 'POST',
      body: JSON.stringify({ cuisines, price_range, area }),
    }),

  // ── Admin ──────────────────────────────────────────────────
  admin: {
    getUsers: () => apiFetch('/admin/users'),
    deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
    suspendUser: (id, suspended) =>
      apiFetch(`/admin/users/${id}/suspend`, { method: 'PATCH', body: JSON.stringify({ suspended }) }),
    setUserRole: (id, role) =>
      apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    wipeInteractions: (id) =>
      apiFetch(`/admin/users/${id}/interactions`, { method: 'DELETE' }),

    getAnalytics: () => apiFetch('/admin/analytics'),

    setAlpha: (global_alpha) =>
      apiFetch('/admin/model/alpha', { method: 'PUT', body: JSON.stringify({ global_alpha }) }),
    retrain: () => apiFetch('/admin/model/retrain', { method: 'POST' }),
    setAbTest: (hybrid, cbf_only) =>
      apiFetch('/admin/model/ab-test', { method: 'PUT', body: JSON.stringify({ hybrid, cbf_only }) }),

    editRestaurant: (id, data) =>
      apiFetch(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    flagRestaurant: (id, flagged) =>
      apiFetch(`/admin/restaurants/${id}/flag`, { method: 'PATCH', body: JSON.stringify({ flagged }) }),
    excludeRestaurant: (id, excluded) =>
      apiFetch(`/admin/restaurants/${id}/exclude`, { method: 'PATCH', body: JSON.stringify({ excluded }) }),
    rebuildPipeline: () => apiFetch('/admin/pipeline/rebuild', { method: 'POST' }),
  },
};

export default api;
