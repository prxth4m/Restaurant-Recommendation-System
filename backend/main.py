# backend/main.py — FastAPI application entry point
import os
from contextlib import asynccontextmanager

# Load .env before anything else
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed yet — env vars must be set manually

from fastapi import FastAPI, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import Optional

from backend import recommender, database
from backend.auth import (
    get_current_user, get_current_user_optional,
    hash_password, verify_password, create_access_token,
    build_google_auth_url, exchange_google_code, FRONTEND_URL
)
from backend.schemas import (
    UserRegister, UserLogin, TokenOut, InteractionCreate,
    PreferencesUpdate, GroupRequest
)
from backend.admin import router as admin_router


# ─── Lifespan: load models at startup, close DB at shutdown ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    recommender.load_models(models_dir)
    await database.connect_db()
    yield
    await database.close_db()


# ─── App ───
app = FastAPI(
    title="GoodSpot API",
    description="Restaurant Recommendation Engine — CBF + CF + Hybrid",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — in production set ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
if _raw_origins == "*":
    _origins = ["*"]
else:
    _origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount admin router
app.include_router(admin_router)


# ═══════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════
@app.get("/health")
async def health():
    return {"success": True, "message": "GoodSpot API is running", "data": {
        "restaurants_loaded": len(recommender.df) if recommender.df is not None else 0,
        "models_ready": recommender.cosine_sim is not None and recommender.svd_model is not None
    }}

# ═══════════════════════════════════════════════════════
# RATE LIMITER (in-memory, per-IP)
# ═══════════════════════════════════════════════════════
from collections import defaultdict, deque
import time as _time
from fastapi import Request
from fastapi.responses import JSONResponse

_rate_limit_store: dict[str, deque] = defaultdict(deque)
RATE_LIMIT_MAX = 30       # max requests
RATE_LIMIT_WINDOW = 60    # per 60 seconds

def _check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    now = _time.time()
    dq = _rate_limit_store[ip]
    # Purge entries older than the window
    while dq and dq[0] < now - RATE_LIMIT_WINDOW:
        dq.popleft()
    if len(dq) >= RATE_LIMIT_MAX:
        return False
    dq.append(now)
    return True


# ═══════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════
@app.get("/search")
async def search(request: Request, q: str = Query(..., min_length=1), top_n: int = 10):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        return JSONResponse(
            status_code=429,
            content={"success": False, "data": [], "message": "Too many requests. Please slow down."}
        )
    results = recommender.fuzzy_search(q, top_n=top_n)
    return {"success": True, "data": results, "message": f"{len(results)} results"}


# ═══════════════════════════════════════════════════════
# RECOMMEND
# ═══════════════════════════════════════════════════════
@app.get("/recommend")
async def recommend(
    restaurant_name: Optional[str] = None,
    cuisines: Optional[str] = None,
    location: Optional[str] = None,
    price_min: int = 0,
    price_max: int = 3000,
    min_rating: float = 0.0,
    technique: str = "hybrid",
    alpha: Optional[float] = None,
    top_n: int = 10,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = None
    if user:
        user_id = user.get("sub") or user.get("user_id")

    # Fetch live interaction count from MongoDB so alpha ramps correctly
    live_count = None
    if user_id:
        live_count = await database.get_user_interaction_count(user_id)

    recs, err = recommender.get_recommendations(
        user_id=user_id,
        restaurant_name=restaurant_name,
        location=location,
        technique=technique,
        alpha=alpha,
        top_n=top_n,
        cuisines=cuisines,
        price_min=price_min,
        price_max=price_max,
        min_rating=min_rating,
        live_count=live_count
    )

    if err:
        return {"success": False, "data": [], "message": err, "error": err}

    data = []
    for _, row in recs.iterrows():
        rd = row.to_dict()
        data.append({
            "restaurant_id": int(rd.get("restaurant_id", 0)),
            "name": rd.get("name", ""),
            "cuisines": rd.get("cuisines", ""),
            "location": rd.get("location", ""),
            "rate": float(rd.get("rate", 0)),
            "votes": int(rd.get("votes", 0)),
            "approx_cost": int(rd.get("cost_for_two", rd.get("approx_cost", 0)) or 0),
            "online_order": int(rd.get("online_order", 0)),
            "book_table": int(rd.get("book_table", 0)),
            "rest_type": rd.get("rest_type", ""),
            "recommendation_score": float(rd.get("recommendation_score", 0)),
            "technique_used": rd.get("technique_used", ""),
            "alpha_used": float(rd.get("alpha_used", 0))
        })

    return {"success": True, "data": data, "message": f"{len(data)} recommendations"}


# ═══════════════════════════════════════════════════════
# RECOMMEND GROUP
# ═══════════════════════════════════════════════════════
@app.post("/recommend-group")
async def recommend_group(body: GroupRequest):
    members = [m.dict() for m in body.members]
    recs, err = recommender.get_group_recommendations(members, top_n=body.top_n)

    if err:
        return {"success": False, "data": [], "message": err, "error": err}

    data = []
    for _, row in recs.iterrows():
        data.append({
            "restaurant_id": int(row.get("restaurant_id", 0)),
            "name": row.get("name", ""),
            "cuisines": row.get("cuisines", ""),
            "location": row.get("location", ""),
            "rate": float(row.get("rate", 0)),
            "votes": int(row.get("votes", 0)),
            "group_score": float(row.get("group_score", 0)),
            "num_members": int(row.get("num_members", 0))
        })

    return {"success": True, "data": data, "message": f"{len(data)} group recommendations"}


# ═══════════════════════════════════════════════════════
# RESTAURANT DETAIL
# ═══════════════════════════════════════════════════════
@app.get("/restaurant/{restaurant_id}")
async def get_restaurant(restaurant_id: int):
    if recommender.df is None or restaurant_id >= len(recommender.df):
        return {"success": False, "error": "Restaurant not found"}

    row = recommender.df.iloc[restaurant_id]
    data = {
        "restaurant_id": restaurant_id,
        "name": row.get("name", ""),
        "cuisines": row.get("cuisines", ""),
        "location": row.get("location", ""),
        "rate": float(row.get("rate", 0)),
        "votes": int(row.get("votes", 0)),
        "approx_cost": int(row.get("cost_for_two", row.get("approx_cost", 0))),
        "online_order": int(row.get("online_order", 0)),
        "book_table": int(row.get("book_table", 0)),
        "rest_type": row.get("rest_type", ""),
    }
    return {"success": True, "data": data}


# ═══════════════════════════════════════════════════════
# RESTAURANT SCORES (for "Why We Recommended This" panel)
# ═══════════════════════════════════════════════════════
@app.get("/restaurant/{restaurant_id}/scores")
async def get_restaurant_scores(
    restaurant_id: int,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    user_id = None
    user_preferences = None
    live_count = None
    if user:
        user_id = user.get("sub") or user.get("user_id")
        if user_id:
            # Fetch live count + preferences so scores are honest and personalised
            live_count = await database.get_user_interaction_count(user_id)
            db_user = await database.find_user_by_id(user_id)
            if db_user:
                user_preferences = db_user.get("preferences", {})

    scores, err = recommender.get_restaurant_scores(
        restaurant_id, user_id,
        user_preferences=user_preferences,
        live_count=live_count
    )
    if err:
        return {"success": False, "error": err}
    return {"success": True, "data": scores}


# ═══════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════
@app.post("/auth/register")
async def register(body: UserRegister):
    existing = await database.find_user_by_email(body.email)
    if existing:
        return {"success": False, "error": "Email already registered"}

    pw_hash = hash_password(body.password)
    user = await database.create_user(body.email, pw_hash, body.preferences)

    if user is None:
        # DB offline — create a demo token anyway
        token = create_access_token({
            "sub": "demo_user", 
            "email": body.email, 
            "role": "user",
            "name": body.email.split('@')[0],
            "onboarding_complete": False,
            "auth_method": "email"
        })
        return {"success": True, "data": {"access_token": token, "token_type": "bearer"},
                "message": "Registered (DB offline — demo mode)"}

    token = create_access_token({
        "sub": str(user["_id"]),
        "email": body.email,
        "role": user["role"],
        "name": body.email.split('@')[0],
        "onboarding_complete": user.get("onboarding_complete", False),
        "auth_method": "email"
    })
    return {"success": True, "data": {"access_token": token, "token_type": "bearer"},
            "message": "Registered successfully"}


@app.post("/auth/login")
async def login(body: UserLogin):
    user = await database.find_user_by_email(body.email)
    if not user:
        # DB offline fallback check
        if database.client is None and body.email == "demo@goodspot.io":
            token = create_access_token({
                "sub": "demo_user", "email": body.email, 
                "role": "user", "name": "Demo User",
                "onboarding_complete": True, "auth_method": "email"
            })
            return {"success": True, "data": {"access_token": token, "token_type": "bearer"}, "message": "Demo DB-Offline Login"}
        return {"success": False, "error": "Invalid credentials or DB offline"}

    if not verify_password(body.password, user["password_hash"]):
        return {"success": False, "error": "Invalid credentials"}

    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "user"),
        "name": user.get("name") or user["email"].split('@')[0],
        "onboarding_complete": user.get("onboarding_complete", True),
        "auth_method": "email"
    })
    return {"success": True, "data": {"access_token": token, "token_type": "bearer"},
            "message": "Login successful"}


@app.post("/auth/forgot-password")
async def forgot_password(body: dict):
    """
    Generates a signed reset token, stores it in MongoDB (15-min TTL),
    and sends a branded reset email via Gmail SMTP (runs in thread to avoid blocking).
    Always returns success to prevent user enumeration.
    """
    import asyncio
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import timedelta

    email = body.get("email", "").strip().lower()
    if not email:
        return {"success": False, "error": "Email is required"}

    user = await database.find_user_by_email(email)

    if user:
        reset_token = create_access_token(
            {"sub": str(user["_id"]), "email": email, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=15)
        )

        # Store one-time token in MongoDB
        col = database.get_collection("password_resets")
        if col is not None:
            try:
                await asyncio.wait_for(col.delete_many({"email": email}), timeout=5)
                await asyncio.wait_for(col.insert_one({
                    "email": email, "token": reset_token, "used": False,
                }), timeout=5)
            except asyncio.TimeoutError:
                pass  # Non-critical — link still works, just can't invalidate old tokens

        reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

        smtp_email = os.getenv("SMTP_EMAIL", "")
        smtp_pass  = os.getenv("SMTP_APP_PASSWORD", "")
        credentials_ready = smtp_email and smtp_pass and "your-16-char" not in smtp_pass

        if credentials_ready:
            # Build email
            html_body = f"""
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;
                        background:#fff;border-radius:12px;border:1px solid #eee">
              <h2 style="color:#FC8019;margin-bottom:8px">🍽️ GoodSpot</h2>
              <h3 style="margin-bottom:16px">Reset Your Password</h3>
              <p style="color:#555;line-height:1.6">
                We received a request to reset the password for <b>{email}</b>.
                Click the button below — this link expires in <b>15 minutes</b>.
              </p>
              <a href="{reset_url}"
                 style="display:inline-block;margin:24px 0;padding:14px 28px;
                        background:#FC8019;color:#fff;text-decoration:none;
                        border-radius:8px;font-weight:600;font-size:15px">
                Reset Password
              </a>
              <p style="color:#999;font-size:13px">
                If you didn't request this, you can safely ignore this email.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
              <p style="color:#bbb;font-size:12px">GoodSpot · Bengaluru Restaurant Recommendations</p>
            </div>
            """

            def _send_email():
                """Synchronous SMTP call — runs in a thread pool."""
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "GoodSpot — Reset Your Password"
                msg["From"]    = f"GoodSpot <{smtp_email}>"
                msg["To"]      = email
                msg.attach(MIMEText(html_body, "html"))
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
                    server.login(smtp_email, smtp_pass)
                    server.sendmail(smtp_email, email, msg.as_string())

            try:
                loop = asyncio.get_event_loop()
                await asyncio.wait_for(
                    loop.run_in_executor(None, _send_email),
                    timeout=15  # Give SMTP max 15s before giving up
                )
            except Exception as e:
                print(f"[forgot-password] SMTP error: {e}")
        else:
            # Dev mode — print the link to the backend terminal
            print(f"\n[DEV] Password reset link for {email}:\n{reset_url}\n")

    return {"success": True, "message": f"If {email} is registered, a reset link has been sent."}



@app.post("/auth/reset-password")
async def reset_password(body: dict):
    """
    Validates the reset token and updates the user's password.
    Token is one-time use — invalidated after successful reset.
    """
    from jose import JWTError, jwt
    JWT_SECRET = os.getenv("JWT_SECRET", "goodspot-dev-secret-key")

    token    = body.get("token", "").strip()
    new_pass = body.get("new_password", "").strip()

    if not token or not new_pass:
        return {"success": False, "error": "Token and new password are required"}
    if len(new_pass) < 6:
        return {"success": False, "error": "Password must be at least 6 characters"}

    # Decode and validate token
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        return {"success": False, "error": "Reset link is invalid or has expired"}

    if payload.get("purpose") != "password_reset":
        return {"success": False, "error": "Invalid reset token"}

    email   = payload.get("email", "")
    user_id = payload.get("sub", "")

    # Check token hasn't been used already
    col = database.get_collection("password_resets")
    if col is not None:
        record = await col.find_one({"email": email, "token": token, "used": False})
        if not record:
            return {"success": False, "error": "Reset link has already been used or expired"}
        # Mark as used immediately (one-time token)
        await col.update_one({"_id": record["_id"]}, {"$set": {"used": True}})

    # Update password in users collection
    from bson import ObjectId
    users_col = database.get_collection("users")
    if users_col is None:
        return {"success": False, "error": "Database offline"}

    new_hash = hash_password(new_pass)
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": new_hash}}
    )

    if result.modified_count == 0:
        return {"success": False, "error": "User not found"}

    return {"success": True, "message": "Password updated successfully. You can now log in."}



# ═══════════════════════════════════════════════════════
# GOOGLE OAUTH
# ═══════════════════════════════════════════════════════
@app.get("/auth/google")
async def google_login():
    """
    Redirect the browser to Google's OAuth2 consent screen.
    Frontend: window.location.href = '/auth/google'
    """
    if not build_google_auth_url or not os.getenv("GOOGLE_CLIENT_ID"):
        return {"success": False, "error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"}
    url = build_google_auth_url()
    return RedirectResponse(url)


@app.get("/auth/google/callback")
async def google_callback(code: str = None, error: str = None):
    """
    Google redirects here after user approves.
    Exchanges code → profile → JWT → redirects frontend.
    """
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_denied")

    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=missing_code")

    # Exchange auth code for Google profile
    profile = await exchange_google_code(code)

    # Find or create user in MongoDB
    user, is_new = await database.find_or_create_google_user(
        google_id=profile["id"],
        email=profile["email"],
        name=profile.get("name", ""),
        picture=profile.get("picture", "")
    )

    # Create JWT (same shape as email login)
    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "user"),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "onboarding_complete": user.get("onboarding_complete", not is_new),
        "auth_method": "google"
    })

    # Redirect frontend with token + new_user flag
    # Frontend reads token once, stores in localStorage, removes from URL
    redirect = f"{FRONTEND_URL}/auth/callback?token={token}&new_user={str(is_new).lower()}"
    return RedirectResponse(redirect)


# ═══════════════════════════════════════════════════════
# USER PROFILE & INTERACTIONS
# ═══════════════════════════════════════════════════════
@app.get("/users/me")
async def get_profile(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    db_user = await database.find_user_by_id(user_id)
    count = await database.get_user_interaction_count(user_id)

    if db_user:
        return {"success": True, "data": {
            "user_id": str(db_user["_id"]),
            "email": db_user["email"],
            "role": db_user.get("role", "user"),
            "preferences": db_user.get("preferences", {}),
            "interaction_count": count,
            "most_common_location": db_user.get("most_common_location", ""),
            "alpha": recommender.get_alpha(count)
        }}
    else:
        return {"success": True, "data": {
            "user_id": user_id,
            "email": user.get("email", ""),
            "role": user.get("role", "user"),
            "interaction_count": count,
            "alpha": recommender.get_alpha(count)
        }}


@app.post("/users/me/interactions")
async def create_interaction(body: InteractionCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    doc = await database.log_interaction(
        user_id=user_id,
        restaurant_id=body.restaurant_id,
        restaurant_name=body.restaurant_name,
        action=body.action,
        rating=body.rating,
        location=body.location
    )
    return {"success": True, "data": doc, "message": "Interaction logged"}


@app.get("/users/me/interactions")
async def list_interactions(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    interactions = await database.get_user_interactions(user_id)
    return {"success": True, "data": interactions}


@app.put("/users/me/preferences")
async def update_preferences(body: PreferencesUpdate, user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    prefs = {}
    if body.cuisines is not None:
        prefs["cuisines"] = body.cuisines
    if body.price_range is not None:
        prefs["price_range"] = body.price_range
    if body.area is not None:
        prefs["area"] = body.area
    await database.update_user_preferences(user_id, prefs)
    return {"success": True, "message": "Preferences updated"}


@app.post("/users/me/onboarding")
async def complete_onboarding(body: PreferencesUpdate, user: dict = Depends(get_current_user)):
    """
    Submit onboarding quiz answers (Step 2).
    Used by BOTH new email registrants AND new Google sign-up users.
    Saves preferences + marks onboarding_complete = True.
    """
    user_id = user.get("sub")
    prefs = {}
    if body.cuisines is not None:
        prefs["cuisines"] = body.cuisines
    if body.price_range is not None:
        prefs["price_range"] = body.price_range
    if body.area is not None:
        prefs["area"] = body.area

    await database.update_user_preferences(user_id, prefs)
    await database.complete_onboarding(user_id)

    return {"success": True, "message": "Onboarding complete! Recommendations are now personalised."}

