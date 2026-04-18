# GoodSpot 🍽️

> A full-stack restaurant recommendation system for Bengaluru, powered by a **Hybrid ML engine** (Content-Based Filtering + Collaborative Filtering via SVD).

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black?logo=next.js)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)

---

## Features

- 🔍 **Fuzzy restaurant search** across 51,000+ Bengaluru restaurants
- 🤖 **Hybrid recommendations** — blends TF-IDF cosine similarity (CBF) + SVD matrix factorisation (CF)
- 📈 **Dynamic alpha** — cold-start users get popularity-weighted recommendations; alpha ramps up as interaction count grows
- 👤 **JWT auth** — email/password + Google OAuth2
- 🧑‍💼 **Admin dashboard** — user management, A/B test controls, model parameters
- 👨‍👩‍👧 **Group recommendations** — merge preferences of 2-4 people
- 📧 **Forgot password** — signed reset tokens via Gmail SMTP

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + Uvicorn |
| ML | scikit-learn (TF-IDF), scikit-surprise (SVD), NumPy, Pandas |
| Frontend | Next.js 16 (App Router), Tailwind CSS |
| Database | MongoDB Atlas (async via Motor) |
| Auth | JWT (python-jose) + bcrypt + Google OAuth2 |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app, all API routes
│   ├── recommender.py   # CBF + CF + Hybrid ML logic
│   ├── database.py      # MongoDB async client (Motor)
│   ├── auth.py          # JWT + bcrypt + Google OAuth
│   ├── admin.py         # Admin-only router
│   ├── schemas.py       # Pydantic request/response models
│   ├── requirements.txt # Python dependencies
│   ├── Procfile         # Render start command
│   └── models/          # ML artefacts (Git LFS)
│       ├── cosine_sim.npy          # 326 MB — TF-IDF cosine matrix
│       ├── svd_model.pkl           # SVD collaborative filter
│       ├── tfidf_vectoriser.pkl    # TF-IDF vectoriser
│       ├── zomato_clean.parquet    # Cleaned restaurant dataset
│       ├── user_interactions.parquet
│       └── restaurant_names.json  # Name → index lookup
├── frontend/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # Navbar, RestaurantCard
│   ├── lib/
│   │   ├── api.js       # Centralised fetch client
│   │   └── auth.js      # JWT decode + session helpers
│   └── .env.example     # Frontend env vars template
├── render.yaml          # Render deploy config
├── DEPLOYMENT.md        # Full deploy guide (Render + Vercel + Google OAuth)
├── .env.example         # Backend env vars template
└── .gitattributes       # Git LFS tracking rules
```

---

## Quick Start (Local)

### Backend
```bash
# 1. Create virtualenv and install deps
python -m venv venv
.\venv\Scripts\activate          # Windows
pip install -r backend/requirements.txt

# 2. Copy and fill in env vars
cp .env.example .env

# 3. Pull LFS files (ML models)
git lfs pull

# 4. Start backend
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete guide:
- Render backend setup
- Vercel frontend setup
- Google OAuth2 redirect URI configuration
- All required environment variables

---

## ML Architecture

```
User request
     │
     ▼
┌─────────────────────────────────┐
│          Hybrid Engine          │
│  score = (1−α)·CBF + α·CF      │
│                                 │
│  α = 0.0  (0 interactions)     │
│  α = 0.1  (1–2 interactions)   │
│  α = 0.4  (3–9 interactions)   │
│  α = 0.7  (10+ interactions)   │
└─────────────────────────────────┘
     │                  │
     ▼                  ▼
  CBF Score           CF Score
  TF-IDF +            SVD (surprise)
  Cosine Sim          Predicted rating
```

---

## License

MIT
