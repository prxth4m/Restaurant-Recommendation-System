# GoodSpot — Deployment Guide

> **Stack**: FastAPI backend on **Render** · Next.js 16 frontend on **Vercel** · MongoDB on **Atlas**

---

## Prerequisites

- MongoDB Atlas cluster running (connection string available)
- Google Cloud OAuth 2.0 Client credentials
- Gmail account with App Password (for forgot-password emails)
- Accounts on [Render](https://render.com) and [Vercel](https://vercel.com)

---

## Step 1 — Deploy Backend on Render

### 1.1 Create a new Web Service
1. Go to [Render Dashboard](https://dashboard.render.com) → **New → Web Service**
2. Connect your GitHub repo: `prxth4m/Restaurant-Recommendation-System`
3. Configure:
   - **Name**: `goodspot-backend`
   - **Root Directory**: *(leave blank — repo root)*
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`

### 1.2 Set Environment Variables in Render
Go to your service → **Environment** tab and add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Generate a strong random string (32+ chars) |
| `MONGO_URL` | Your MongoDB Atlas connection string |
| `DB_NAME` | `goodspot` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://<your-render-url>/auth/google/callback` ← set AFTER deploy |
| `FRONTEND_URL` | `https://<your-vercel-url>` ← set AFTER Vercel deploy |
| `ALLOWED_ORIGINS` | `https://<your-vercel-url>` ← set AFTER Vercel deploy |
| `SMTP_EMAIL` | Your Gmail address |
| `SMTP_APP_PASSWORD` | Your Gmail App Password |

> ⚠️ **Note**: `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, and `ALLOWED_ORIGINS` depend on knowing your final URLs. Deploy first, then update these three after both services are live.

### 1.3 Deploy
Click **Create Web Service**. First deploy will take ~3-5 minutes (building ML dependencies + loading models).

**Verify**: Visit `https://<your-render-url>/health` — you should see:
```json
{"success": true, "message": "GoodSpot API is running", "data": {"restaurants_loaded": 51717, "models_ready": true}}
```

---

## Step 2 — Deploy Frontend on Vercel

### 2.1 Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New → Project**
2. Import `prxth4m/Restaurant-Recommendation-System`
3. **Root Directory**: set to `frontend`
4. **Framework**: Next.js (auto-detected)

### 2.2 Set Environment Variables in Vercel
Go to **Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://<your-render-url>` |

### 2.3 Deploy
Click **Deploy**. Vercel will build and host the Next.js app (usually ~60 seconds).

**Note your Vercel URL** — e.g. `https://goodspot.vercel.app`

---

## Step 3 — Fix Google OAuth (Critical Post-Deploy Step)

Google OAuth **will not work** until you complete this step.

### 3.1 Update Google Cloud Console
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your **OAuth 2.0 Client ID**
3. Under **Authorized redirect URIs**, add:
   ```
   https://<your-render-url>/auth/google/callback
   ```
4. Click **Save**

### 3.2 Update Render Environment Variables
Back in Render → **Environment**, update:
- `GOOGLE_REDIRECT_URI` → `https://<your-render-url>/auth/google/callback`
- `FRONTEND_URL` → `https://<your-vercel-url>`
- `ALLOWED_ORIGINS` → `https://<your-vercel-url>`

Render will auto-redeploy when you save env vars.

### 3.3 Test Google Login
1. Open `https://<your-vercel-url>/login`
2. Click **Continue with Google**
3. You should be redirected to Google, then back to `/discover` on success

---

## Step 4 — Final Verification Checklist

- [ ] `GET /health` returns `models_ready: true`
- [ ] Email registration and login works
- [ ] Google OAuth login works and redirects correctly
- [ ] Onboarding quiz saves preferences
- [ ] `/discover` page loads restaurant recommendations
- [ ] Restaurant detail page shows scores panel
- [ ] Forgot password email arrives (check spam)
- [ ] Admin panel accessible at `/admin` with admin credentials

---

## Environment Variables Summary

### Backend (Render)
```
JWT_SECRET=<strong-random-secret>
MONGO_URL=mongodb+srv://...
DB_NAME=goodspot
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://<render-url>/auth/google/callback
FRONTEND_URL=https://<vercel-url>
ALLOWED_ORIGINS=https://<vercel-url>
SMTP_EMAIL=your@gmail.com
SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=https://<render-url>
```

---

## Local Development

```bash
# Backend (from project root)
.\venv\Scripts\python -m uvicorn backend.main:app --reload --port 8000

# Frontend (from /frontend)
npm run dev
```

Ensure your `.env` file (in project root) has the local values from `.env.example`.

---

## Git LFS Notes

Large ML model files are tracked via [Git LFS](https://git-lfs.com):
- `backend/models/cosine_sim.npy` — 326 MB (cosine similarity matrix)
- `backend/models/svd_model.pkl` — 2.8 MB (SVD collaborative filter)
- `backend/models/tfidf_vectoriser.pkl` — 8.6 KB (TF-IDF vectoriser)
- `backend/models/zomato_clean.parquet` — 394 KB (cleaned dataset)
- `backend/models/user_interactions.parquet` — 142 KB (synthetic interactions)
- `backend/models/restaurant_names.json` — 385 KB (name index)

When cloning: `git lfs pull` to download LFS files after `git clone`.
