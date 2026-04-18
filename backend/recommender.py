# backend/recommender.py — All ML recommendation logic
import pandas as pd
import numpy as np
import joblib
import json
import difflib
import os
from surprise import SVD

# ─── Globals (populated by load_models) ───
df = None
cosine_sim = None
svd_model = None
interactions_df = None
name_to_idx = None
all_names_lower = None
max_log_votes = 1.0


def load_models(models_dir: str):
    """Load all ML artefacts into memory. Called once at FastAPI startup."""
    global df, cosine_sim, svd_model, interactions_df
    global name_to_idx, all_names_lower, max_log_votes

    df = pd.read_parquet(os.path.join(models_dir, 'zomato_clean.parquet'))
    df['restaurant_id'] = df.index

    cosine_sim = np.load(os.path.join(models_dir, 'cosine_sim.npy'))
    svd_model = joblib.load(os.path.join(models_dir, 'svd_model.pkl'))
    interactions_df = pd.read_parquet(os.path.join(models_dir, 'user_interactions.parquet'))

    with open(os.path.join(models_dir, 'restaurant_names.json')) as f:
        data = json.load(f)
        name_to_idx = data['name_to_idx']
        all_names_lower = data['all_names_lower']

    max_log_votes = np.log1p(df['votes'].max())
    print(f"[OK] Models loaded: {len(df)} restaurants, cosine {cosine_sim.shape}")


# ─── Alpha Ramping ───
def get_alpha(interaction_count: int) -> float:
    if interaction_count == 0:
        return 0.0
    elif interaction_count <= 2:
        return 0.1
    elif interaction_count <= 9:
        return 0.4
    else:
        return 0.7


# ─── Popularity Score ───
def popularity_score(row) -> float:
    """Weighted score: rating * log(votes), normalised."""
    rating = float(row.get('rate', 0) or 0)
    votes = float(row.get('votes', 0) or 0)
    log_v = np.log1p(votes) / max_log_votes if max_log_votes > 0 else 0
    return round(0.6 * (rating / 5.0) + 0.4 * log_v, 4)


# ─── Content-Based Filtering (CBF) ───
def get_cbf_recommendations(
    restaurant_name: str = None,
    top_n: int = 10,
    cuisines: list = None,
    area: str = None,
    price_min: float = None,
    price_max: float = None,
    online_order: bool = None,
    book_table: bool = None,
) -> list:
    """Return top_n CBF recommendations using cosine similarity + optional filters."""
    if df is None:
        return []

    filtered = df.copy()

    # Apply filters
    if cuisines:
        pattern = '|'.join([c.lower() for c in cuisines])
        filtered = filtered[filtered['cuisines'].str.lower().str.contains(pattern, na=False)]
    if area:
        filtered = filtered[filtered['location'].str.lower().str.contains(area.lower(), na=False)]
    if price_min is not None:
        filtered = filtered[filtered['cost_for_two'] >= price_min]
    if price_max is not None:
        filtered = filtered[filtered['cost_for_two'] <= price_max]
    if online_order is not None:
        filtered = filtered[filtered['online_order'] == (1 if online_order else 0)]
    if book_table is not None:
        filtered = filtered[filtered['book_table'] == (1 if book_table else 0)]

    if filtered.empty:
        return []

    if restaurant_name and restaurant_name.lower() in [n.lower() for n in name_to_idx.keys()]:
        # Find the closest match
        matches = difflib.get_close_matches(restaurant_name.lower(), all_names_lower, n=1, cutoff=0.4)
        if matches:
            idx = name_to_idx.get(matches[0])
            if idx is not None and cosine_sim is not None:
                sim_scores = list(enumerate(cosine_sim[idx]))
                sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
                # Filter to only indices in our filtered df
                filtered_indices = set(filtered.index.tolist())
                sim_scores = [(i, s) for i, s in sim_scores if i in filtered_indices and i != idx]
                sim_scores = sim_scores[:top_n]
                result_indices = [i for i, _ in sim_scores]
                result_df = df.iloc[result_indices].copy()
                result_df['cbf_score'] = [s for _, s in sim_scores]
                result_df['pop_score'] = result_df.apply(popularity_score, axis=1)
                result_df['score'] = result_df['cbf_score'] * 0.7 + result_df['pop_score'] * 0.3
                return _to_list(result_df.head(top_n))

    # Popularity-based fallback within filtered set
    scored = filtered.copy()
    scored['score'] = scored.apply(popularity_score, axis=1)
    scored = scored.sort_values('score', ascending=False)
    return _to_list(scored.head(top_n))


# ─── Collaborative Filtering (CF) ───
def get_cf_recommendations(user_id: str, top_n: int = 10) -> list:
    """SVD-based CF recommendations. Falls back to popularity if user is cold-start."""
    if df is None or svd_model is None or interactions_df is None:
        return []

    all_restaurant_ids = df['restaurant_id'].tolist()

    # Check if user has any interactions in training data
    if user_id not in interactions_df['user_id'].values:
        # Cold-start: return popular restaurants
        scored = df.copy()
        scored['score'] = scored.apply(popularity_score, axis=1)
        return _to_list(scored.sort_values('score', ascending=False).head(top_n))

    # Get restaurants already interacted with
    seen = set(interactions_df[interactions_df['user_id'] == user_id]['restaurant_id'].tolist())
    unseen = [rid for rid in all_restaurant_ids if rid not in seen]

    # Predict ratings
    predictions = []
    for rid in unseen:
        try:
            pred = svd_model.predict(user_id, rid)
            predictions.append((rid, pred.est))
        except Exception:
            predictions.append((rid, 3.5))

    predictions.sort(key=lambda x: x[1], reverse=True)
    top_ids = [rid for rid, _ in predictions[:top_n]]
    result_df = df[df['restaurant_id'].isin(top_ids)].copy()
    score_map = {rid: score for rid, score in predictions[:top_n]}
    result_df['score'] = result_df['restaurant_id'].map(score_map)
    return _to_list(result_df.sort_values('score', ascending=False))


# ─── Hybrid ───
def get_hybrid_recommendations(
    user_id: str = None,
    restaurant_name: str = None,
    top_n: int = 10,
    alpha: float = None,
    live_count: int = 0,
    cuisines: list = None,
    area: str = None,
    price_min: float = None,
    price_max: float = None,
    online_order: bool = None,
    book_table: bool = None,
) -> list:
    """Blend CBF + CF with dynamic alpha. Alpha=0 → pure CBF, Alpha=1 → pure CF."""
    if alpha is None:
        alpha = get_alpha(live_count)

    cbf = get_cbf_recommendations(
        restaurant_name=restaurant_name,
        top_n=top_n * 2,
        cuisines=cuisines,
        area=area,
        price_min=price_min,
        price_max=price_max,
        online_order=online_order,
        book_table=book_table,
    )
    cf = get_cf_recommendations(user_id, top_n=top_n * 2) if user_id else []

    # Build score maps
    cbf_map = {r['restaurant_id']: r.get('score', 0) for r in cbf}
    cf_map = {r['restaurant_id']: r.get('score', 0) for r in cf}

    all_ids = list(set(cbf_map.keys()) | set(cf_map.keys()))

    # Normalise CF scores (SVD outputs ~0-5, CBF outputs ~0-1)
    max_cf = max(cf_map.values(), default=1) or 1

    scored = []
    for rid in all_ids:
        cbf_s = cbf_map.get(rid, 0)
        cf_s = cf_map.get(rid, 0) / max_cf
        hybrid_s = (1 - alpha) * cbf_s + alpha * cf_s
        scored.append((rid, hybrid_s))

    scored.sort(key=lambda x: x[1], reverse=True)
    top_ids = [rid for rid, _ in scored[:top_n]]
    score_map = {rid: s for rid, s in scored[:top_n]}

    result_df = df[df['restaurant_id'].isin(top_ids)].copy()
    result_df['score'] = result_df['restaurant_id'].map(score_map)
    return _to_list(result_df.sort_values('score', ascending=False))


# ─── Restaurant Scores (for detail page) ───
def get_restaurant_scores(restaurant_id: int, user_id: str = None, user_preferences: dict = None, live_count: int = 0):
    """Return (scores_dict, error_string | None) for a single restaurant."""
    if df is None:
        return {}, "Models not loaded"

    row = df[df['restaurant_id'] == restaurant_id]
    if row.empty:
        return {}, "Restaurant not found"
    row = row.iloc[0].to_dict()

    # ── CBF Score: preference match ───
    user_prefs = user_preferences  # unified local alias
    has_preferences = bool(user_prefs and (user_prefs.get('cuisines') or user_prefs.get('area') or user_prefs.get('price_range')))
    cbf_score = 0.0

    if has_preferences:
        score_parts = []
        # Cuisine match (0-1)
        pref_cuisines = [c.lower() for c in (user_prefs.get('cuisines') or [])]
        rest_cuisines = str(row.get('cuisines', '') or '').lower()
        if pref_cuisines:
            cuisine_match = any(c in rest_cuisines for c in pref_cuisines)
            score_parts.append(1.0 if cuisine_match else 0.0)
        # Area match (0-1)
        pref_area = (user_prefs.get('area') or '').lower()
        rest_loc = str(row.get('location', '') or '').lower()
        if pref_area:
            score_parts.append(1.0 if pref_area in rest_loc else 0.0)
        # Price match (0-1)
        pref_price = user_prefs.get('price_range', '')
        cost = float(row.get('cost_for_two', 0) or 0)
        if pref_price == '₹' and cost <= 500:
            score_parts.append(1.0)
        elif pref_price == '₹₹' and 500 < cost <= 1500:
            score_parts.append(1.0)
        elif pref_price == '₹₹₹' and cost > 1500:
            score_parts.append(1.0)
        elif pref_price:
            score_parts.append(0.2)
        cbf_score = sum(score_parts) / len(score_parts) if score_parts else popularity_score(row)
    else:
        cbf_score = popularity_score(row)

    # ── CF Score ───
    cf_score = 0.0
    cf_is_personalised = False
    if user_id and svd_model and interactions_df is not None:
        try:
            if user_id in interactions_df['user_id'].values:
                pred = svd_model.predict(user_id, restaurant_id)
                cf_score = min(pred.est / 5.0, 1.0)
                cf_is_personalised = True
            else:
                cf_score = popularity_score(row)
        except Exception:
            cf_score = popularity_score(row)
    else:
        cf_score = popularity_score(row)

    alpha = get_alpha(live_count or 0)
    hybrid_score = (1 - alpha) * cbf_score + alpha * cf_score

    scores = {
        'cbf_score': round(cbf_score, 4),
        'cf_score': round(cf_score, 4),
        'hybrid_score': round(hybrid_score, 4),
        'alpha_used': alpha,
        'has_preferences': has_preferences,
        'cf_is_personalised': cf_is_personalised,
    }
    return scores, None


# ─── Search / Autocomplete ───
def search_restaurants(query: str, top_n: int = 8) -> list:
    """Fuzzy name search for autocomplete."""
    if df is None or not query:
        return []
    q = query.lower().strip()
    # Direct substring match first
    mask = df['name'].str.lower().str.contains(q, na=False, regex=False)
    direct = df[mask].head(top_n)
    if len(direct) >= top_n:
        return _to_list(direct)
    # Fuzzy fallback
    matches = difflib.get_close_matches(q, all_names_lower, n=top_n, cutoff=0.3)
    idxs = [name_to_idx[m] for m in matches if m in name_to_idx]
    fuzzy = df.iloc[idxs] if idxs else pd.DataFrame()
    combined = pd.concat([direct, fuzzy]).drop_duplicates(subset='restaurant_id').head(top_n)
    return _to_list(combined)


# Alias used by main.py
fuzzy_search = search_restaurants


# ─── Unified Recommendation Dispatch ───
def get_recommendations(
    user_id: str = None,
    restaurant_name: str = None,
    location: str = None,
    technique: str = "hybrid",
    alpha: float = None,
    top_n: int = 10,
    cuisines: str = None,
    price_min: int = 0,
    price_max: int = 3000,
    min_rating: float = 0.0,
    live_count: int = None,
):
    """
    Dispatch to CBF / CF / Hybrid based on 'technique'.
    Returns (DataFrame, error_string | None).
    """
    if df is None:
        return pd.DataFrame(), "Models not loaded"

    cuisine_list = [c.strip() for c in cuisines.split(",")] if cuisines else None
    area = location

    try:
        if technique == "cbf":
            recs_list = get_cbf_recommendations(
                restaurant_name=restaurant_name,
                top_n=top_n,
                cuisines=cuisine_list,
                area=area,
                price_min=price_min,
                price_max=price_max,
            )
        elif technique == "cf":
            recs_list = get_cf_recommendations(user_id, top_n=top_n)
        else:
            # "hybrid" (default)
            recs_list = get_hybrid_recommendations(
                user_id=user_id,
                restaurant_name=restaurant_name,
                top_n=top_n,
                alpha=alpha,
                live_count=live_count or 0,
                cuisines=cuisine_list,
                area=area,
                price_min=price_min,
                price_max=price_max,
            )
    except Exception as e:
        return pd.DataFrame(), str(e)

    if not recs_list:
        return pd.DataFrame(), None

    result_df = pd.DataFrame(recs_list)

    # Apply min_rating filter
    if min_rating and 'rate' in result_df.columns:
        result_df = result_df[result_df['rate'] >= min_rating]

    # Add metadata columns expected by main.py
    result_df['recommendation_score'] = result_df['score'] if 'score' in result_df.columns else 0
    result_df['technique_used'] = technique
    result_df['alpha_used'] = alpha if alpha is not None else get_alpha(live_count or 0)

    return result_df, None


# ─── Group Recommendations ───
def get_group_recommendations(members: list, top_n: int = 10):
    """
    Generate recommendations for a group by blending each member's CBF results.
    members: list of dicts with optional keys: cuisines, price_range, area
    Returns (DataFrame, error_string | None).
    """
    if df is None:
        return pd.DataFrame(), "Models not loaded"

    if not members or len(members) < 2:
        return pd.DataFrame(), "At least 2 group members required"

    all_scores = {}
    for member in members:
        cuisine_list = None
        if member.get("cuisines"):
            raw = member["cuisines"]
            cuisine_list = [c.strip() for c in raw.split(",")] if isinstance(raw, str) else raw

        area = member.get("area", "")

        member_recs = get_cbf_recommendations(
            top_n=top_n * 3,
            cuisines=cuisine_list,
            area=area,
        )

        for rec in member_recs:
            rid = rec.get("restaurant_id")
            if rid not in all_scores:
                all_scores[rid] = []
            all_scores[rid].append(rec.get("score", 0))

    # Aggregate: average score across members, weighted by how many members matched
    scored = []
    for rid, scores in all_scores.items():
        avg_score = sum(scores) / len(members)
        coverage = len(scores) / len(members)
        group_score = avg_score * 0.6 + coverage * 0.4
        scored.append((rid, group_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    top_ids = [rid for rid, _ in scored[:top_n]]
    score_map = {rid: s for rid, s in scored[:top_n]}

    result_df = df[df['restaurant_id'].isin(top_ids)].copy()
    result_df['group_score'] = result_df['restaurant_id'].map(score_map).fillna(0)
    result_df['num_members'] = len(members)
    result_df = result_df.sort_values('group_score', ascending=False)

    return result_df, None

# ─── Admin Controls ───
_flagged_ids: set = set()
_excluded_ids: set = set()


def flag_restaurant(restaurant_id: int, flagged: bool):
    if flagged:
        _flagged_ids.add(restaurant_id)
    else:
        _flagged_ids.discard(restaurant_id)


def exclude_restaurant(restaurant_id: int, excluded: bool):
    if excluded:
        _excluded_ids.add(restaurant_id)
    else:
        _excluded_ids.discard(restaurant_id)


def update_restaurant(restaurant_id: int, updates: dict) -> bool:
    global df
    if df is None:
        return False
    mask = df['restaurant_id'] == restaurant_id
    if not mask.any():
        return False
    for key, val in updates.items():
        if key in df.columns:
            df.loc[mask, key] = val
    return True


# ─── Helper ───
def _to_list(frame: pd.DataFrame) -> list:
    """Convert a DataFrame slice to a JSON-serialisable list of dicts."""
    if frame is None or frame.empty:
        return []
    records = []
    for _, row in frame.iterrows():
        r = {}
        for col in ['restaurant_id', 'name', 'cuisines', 'location', 'rate',
                    'votes', 'cost_for_two', 'online_order', 'book_table',
                    'rest_type', 'score', 'cbf_score', 'pop_score']:
            if col in row.index:
                val = row[col]
                if isinstance(val, float) and np.isnan(val):
                    r[col] = None
                elif hasattr(val, 'item'):
                    r[col] = val.item()
                else:
                    r[col] = val
        records.append(r)
    return records


# ─── SVD Retrain (live) ───
async def retrain_svd(db) -> str:
    """
    Retrain the SVD model using existing training data + live MongoDB interactions.
    Returns a status message.
    """
    global svd_model, interactions_df

    from surprise import Dataset, Reader

    models_dir = os.path.join(os.path.dirname(__file__), 'models')

    # 1. Load existing training data
    existing_df = pd.read_parquet(os.path.join(models_dir, 'user_interactions.parquet'))

    # 2. Fetch live rated interactions from MongoDB
    interactions_col = db['interactions']
    live_ratings = []
    cursor = interactions_col.find(
        {"rating": {"$ne": None, "$exists": True}},
        {"user_id": 1, "restaurant_id": 1, "rating": 1, "_id": 0}
    )
    async for doc in cursor:
        if doc.get('rating') is not None:
            live_ratings.append({
                'user_id': str(doc['user_id']),
                'restaurant_id': str(doc['restaurant_id']),
                'rating': float(doc['rating']),
            })

    live_count = len(live_ratings)
    if live_count == 0:
        return f"No live ratings found in MongoDB. SVD unchanged ({len(existing_df)} existing rows)."

    # 3. Merge: existing + live (deduplicate, prefer live)
    live_df = pd.DataFrame(live_ratings)
    combined = pd.concat([existing_df, live_df], ignore_index=True)
    # Keep the last occurrence (live overrides existing for same user+restaurant)
    combined = combined.drop_duplicates(subset=['user_id', 'restaurant_id'], keep='last')

    # Clamp ratings to [1.0, 5.0] for surprise
    combined['rating'] = combined['rating'].clip(1.0, 5.0)

    # 4. Train new SVD
    reader = Reader(rating_scale=(1.0, 5.0))
    surprise_data = Dataset.load_from_df(combined[['user_id', 'restaurant_id', 'rating']], reader)
    trainset = surprise_data.build_full_trainset()

    new_svd = SVD(n_factors=50, n_epochs=20, lr_all=0.005, reg_all=0.02, random_state=42)
    new_svd.fit(trainset)

    # 5. Save to disk
    joblib.dump(new_svd, os.path.join(models_dir, 'svd_model.pkl'))
    combined.to_parquet(os.path.join(models_dir, 'user_interactions.parquet'), index=False)

    # 6. Hot-reload into memory
    svd_model = new_svd
    interactions_df = combined

    msg = (
        f"SVD retrained successfully. "
        f"{len(existing_df)} existing + {live_count} live = {len(combined)} total ratings. "
        f"Unique users: {combined['user_id'].nunique()}, "
        f"Unique restaurants: {combined['restaurant_id'].nunique()}."
    )
    print(f"[OK] {msg}")
    return msg


# ─── Cosine Similarity Rebuild ───
def rebuild_cosine_sim() -> str:
    """
    Rebuild TF-IDF + cosine similarity matrix from the current DataFrame.
    Returns a status message.
    """
    global cosine_sim

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    if df is None:
        return "Cannot rebuild: DataFrame not loaded."

    models_dir = os.path.join(os.path.dirname(__file__), 'models')

    # Build TF-IDF from combined_features column
    tfidf = TfidfVectorizer(stop_words='english', max_features=5000)
    tfidf_matrix = tfidf.fit_transform(df['combined_features'].fillna(''))

    # Compute cosine similarity
    new_cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix).astype(np.float32)

    # Save to disk
    np.save(os.path.join(models_dir, 'cosine_sim.npy'), new_cosine_sim)

    # Hot-reload into memory
    cosine_sim = new_cosine_sim

    msg = f"Cosine similarity matrix rebuilt: {new_cosine_sim.shape}. Saved to disk."
    print(f"[OK] {msg}")
    return msg

