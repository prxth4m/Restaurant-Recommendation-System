# backend/admin.py — Admin-only endpoints (complete set)
from fastapi import APIRouter, Depends
from backend.auth import require_admin
from backend import database, recommender

router = APIRouter(prefix="/admin", tags=["admin"])


# ═══════════════════════════════════════════════════════
# USER MANAGEMENT
# ═══════════════════════════════════════════════════════
@router.get("/users")
async def list_users(skip: int = 0, limit: int = 20, _=Depends(require_admin)):
    """Paginated list of all users."""
    col = database.get_collection("users")
    if col is None:
        return {"success": True, "data": {"users": [], "total": 0}, "message": "DB offline"}
    cursor = col.find({}, {"password_hash": 0}).skip(skip).limit(limit)
    users = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        users.append(doc)
    total = await col.count_documents({})
    return {"success": True, "data": {"users": users, "total": total}}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, _=Depends(require_admin)):
    """Delete user and wipe their interactions."""
    from bson import ObjectId
    users_col = database.get_collection("users")
    inter_col = database.get_collection("interactions")
    if users_col is None:
        return {"success": False, "error": "DB offline"}
    await users_col.delete_one({"_id": ObjectId(user_id)})
    if inter_col:
        await inter_col.delete_many({"user_id": user_id})
    return {"success": True, "message": f"User {user_id} deleted with all interactions"}


@router.patch("/users/{user_id}/suspend")
async def suspend_user(user_id: str, body: dict, _=Depends(require_admin)):
    """Suspend or unsuspend a user."""
    from bson import ObjectId
    col = database.get_collection("users")
    if col is None:
        return {"success": False, "error": "DB offline"}
    suspended = body.get("suspended", True)
    await col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"suspended": suspended}}
    )
    action = "suspended" if suspended else "unsuspended"
    return {"success": True, "message": f"User {user_id} {action}"}


@router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, body: dict, _=Depends(require_admin)):
    """Promote or demote a user (admin ↔ user)."""
    from bson import ObjectId
    col = database.get_collection("users")
    if col is None:
        return {"success": False, "error": "DB offline"}
    new_role = body.get("role", "user")
    if new_role not in ("user", "admin"):
        return {"success": False, "error": "Role must be 'user' or 'admin'"}
    await col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": new_role}}
    )
    return {"success": True, "message": f"User {user_id} role changed to {new_role}"}


@router.delete("/users/{user_id}/interactions")
async def wipe_user_interactions(user_id: str, _=Depends(require_admin)):
    """Wipe a user's interaction history without deleting the account."""
    col = database.get_collection("interactions")
    if col is None:
        return {"success": False, "error": "DB offline"}
    result = await col.delete_many({"user_id": user_id})
    return {"success": True, "message": f"Deleted {result.deleted_count} interactions for user {user_id}"}


# ═══════════════════════════════════════════════════════
# MODEL CONTROLS
# ═══════════════════════════════════════════════════════
@router.put("/model/alpha")
async def update_alpha(body: dict, _=Depends(require_admin)):
    """Update global alpha in config."""
    alpha = body.get("global_alpha", 0.4)
    if not (0.0 <= alpha <= 1.0):
        return {"success": False, "error": "Alpha must be between 0.0 and 1.0"}
    await database.update_config({"global_alpha": alpha})
    return {"success": True, "data": {"global_alpha": alpha}}


@router.post("/model/retrain")
async def trigger_retrain(_=Depends(require_admin)):
    """Trigger SVD retrain. Returns 202 (queued)."""
    # In production: launch background task to retrain SVD
    return {"success": True, "message": "SVD retrain queued. This may take a few minutes."}


@router.put("/model/ab-test")
async def update_ab_test(body: dict, _=Depends(require_admin)):
    """Update A/B test split configuration."""
    hybrid_pct = body.get("hybrid", 100)
    cbf_only_pct = body.get("cbf_only", 0)
    if hybrid_pct + cbf_only_pct != 100:
        return {"success": False, "error": "Split must sum to 100"}
    config = {"ab_test_split": {"hybrid": hybrid_pct, "cbf_only": cbf_only_pct}}
    await database.update_config(config)
    return {"success": True, "data": config}


# ═══════════════════════════════════════════════════════
# RESTAURANT MANAGEMENT
# ═══════════════════════════════════════════════════════
@router.patch("/restaurants/{restaurant_id}")
async def edit_restaurant(restaurant_id: int, body: dict, _=Depends(require_admin)):
    """Edit restaurant metadata (name, cuisines, location, etc.)."""
    allowed_fields = {"name", "cuisines", "location", "rest_type", "rate", "votes", "approx_cost"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        return {"success": False, "error": f"No valid fields to update. Allowed: {allowed_fields}"}
    success = recommender.update_restaurant(restaurant_id, updates)
    if not success:
        return {"success": False, "error": "Restaurant not found"}
    return {"success": True, "message": f"Restaurant {restaurant_id} updated", "data": updates}


@router.patch("/restaurants/{restaurant_id}/flag")
async def flag_restaurant(restaurant_id: int, body: dict, _=Depends(require_admin)):
    """Flag or unflag a restaurant for review."""
    flagged = body.get("flagged", True)
    recommender.flag_restaurant(restaurant_id, flagged)
    action = "flagged" if flagged else "unflagged"
    return {"success": True, "message": f"Restaurant {restaurant_id} {action}"}


@router.patch("/restaurants/{restaurant_id}/exclude")
async def exclude_restaurant(restaurant_id: int, body: dict, _=Depends(require_admin)):
    """Exclude or re-include a restaurant from recommendations."""
    excluded = body.get("excluded", True)
    recommender.exclude_restaurant(restaurant_id, excluded)
    action = "excluded from" if excluded else "re-included in"
    return {"success": True, "message": f"Restaurant {restaurant_id} {action} recommendations"}


# ═══════════════════════════════════════════════════════
# PIPELINE
# ═══════════════════════════════════════════════════════
@router.post("/pipeline/rebuild")
async def rebuild_pipeline(_=Depends(require_admin)):
    """Trigger regeneration of the cosine similarity matrix. Returns 202 (queued)."""
    # In production: launch background task to rebuild TF-IDF + cosine_sim
    return {"success": True, "message": "Pipeline rebuild queued. Cosine matrix will be regenerated."}


# ═══════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════
@router.get("/analytics")
async def get_analytics(_=Depends(require_admin)):
    """Dashboard analytics data."""
    users_col = database.get_collection("users")
    inter_col = database.get_collection("interactions")

    total_users = await users_col.count_documents({}) if users_col else 0
    total_interactions = await inter_col.count_documents({}) if inter_col else 0

    # Cold-start rate: % of users with < 3 interactions
    cold_start_count = 0
    if users_col and inter_col:
        all_user_ids = []
        async for u in users_col.find({}, {"_id": 1}):
            all_user_ids.append(str(u["_id"]))
        for uid in all_user_ids:
            count = await inter_col.count_documents({"user_id": uid})
            if count < 3:
                cold_start_count += 1
        cold_start_rate = (cold_start_count / total_users * 100) if total_users > 0 else 0
    else:
        cold_start_rate = 0.0

    config = await database.get_config()

    return {
        "success": True,
        "data": {
            "total_users": total_users,
            "total_interactions": total_interactions,
            "global_alpha": config.get("global_alpha", 0.4),
            "cold_start_rate": round(cold_start_rate, 1),
            "trending_cuisines": ["North Indian", "Chinese", "South Indian", "Italian", "Biryani"],
            "ab_test_split": config.get("ab_test_split", {"hybrid": 100, "cbf_only": 0}),
            "last_svd_retrain": config.get("last_svd_retrain", ""),
            "interactions_since_retrain": config.get("interactions_since_retrain", 0)
        }
    }
