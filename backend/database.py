# backend/database.py — MongoDB async client via Motor
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# ─── Connection ───
client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Connect to MongoDB. Called at FastAPI startup."""
    global client, db
    # Read env vars HERE (after load_dotenv has run in main.py)
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "goodspot")
    try:
        client = AsyncIOMotorClient(
            mongo_url,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where()     # Atlas needs valid CA bundle
        )
        db = client[db_name]
        # Quick ping to verify connection
        await client.admin.command('ping')
        print(f"[OK] Connected to MongoDB: {db_name}")
    except Exception as e:
        print(f"[WARN] MongoDB not available ({e}). Running in offline mode.")
        db = None


async def close_db():
    """Close MongoDB connection. Called at FastAPI shutdown."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")


# ─── Helper: get collection safely ───
def get_collection(name: str):
    """Return a collection handle, or None if DB is offline."""
    if db is None:
        return None
    return db[name]


def get_db():
    """Return the database instance, or None if DB is offline."""
    return db


# ─── App Config (stored in 'config' collection) ───
async def get_config() -> dict:
    """Return the app config document, or defaults if not found."""
    col = get_collection("config")
    if col is None:
        return {}
    doc = await col.find_one({"key": "app_config"})
    if doc:
        doc.pop("_id", None)
        doc.pop("key", None)
        return doc
    return {}


async def update_config(updates: dict):
    """Upsert fields into the app config document."""
    col = get_collection("config")
    if col is None:
        return
    await col.update_one(
        {"key": "app_config"},
        {"$set": updates},
        upsert=True
    )


# ─── Users ───
async def create_user(email: str, password_hash: str, preferences: dict = None):
    col = get_collection("users")
    if col is None:
        return None
    doc = {
        "email": email,
        "password_hash": password_hash,
        "role": "user",
        "preferences": preferences or {"cuisines": [], "price_range": "₹₹", "area": ""},
        "most_common_location": "",
        "created_at": datetime.utcnow().isoformat()
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def find_user_by_email(email: str):
    col = get_collection("users")
    if col is None:
        return None
    return await col.find_one({"email": email})


async def find_user_by_id(user_id: str):
    from bson import ObjectId
    col = get_collection("users")
    if col is None:
        return None
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None  # Invalid ID (e.g. 'google_xxx' from offline mode)
    return await col.find_one({"_id": oid})


async def update_user_preferences(user_id: str, prefs: dict):
    from bson import ObjectId
    col = get_collection("users")
    if col is None:
        return None
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None  # demo_user or invalid ID — skip DB write
    await col.update_one(
        {"_id": oid},
        {"$set": {"preferences": prefs}}
    )


# ─── Google OAuth Users ───
async def find_user_by_google_id(google_id: str):
    col = get_collection("users")
    if col is None:
        return None
    return await col.find_one({"google_id": google_id})


async def find_or_create_google_user(
    google_id: str, email: str, name: str, picture: str
) -> tuple:
    """
    Find existing user by Google ID, or create a new one.
    Returns: (user_doc, is_new_user: bool)
    """
    col = get_collection("users")
    if col is None:
        # DB offline — return a synthetic user for demo
        return {
            "_id": f"google_{google_id[:8]}",
            "email": email,
            "name": name,
            "picture": picture,
            "google_id": google_id,
            "role": "user",
            "preferences": {},
            "onboarding_complete": False,
        }, True

    # Try to find by Google ID first
    user = await col.find_one({"google_id": google_id})
    if user:
        user["_id"] = str(user["_id"])
        return user, False  # Existing user

    # Try to find by email (user may have registered with email before)
    existing = await col.find_one({"email": email})
    if existing:
        # Link their Google ID to existing account
        await col.update_one(
            {"email": email},
            {"$set": {"google_id": google_id, "picture": picture}}
        )
        existing["_id"] = str(existing["_id"])
        existing["google_id"] = google_id
        return existing, False  # Existing user, now linked to Google

    # New user — create with Google profile, no password
    doc = {
        "email": email,
        "name": name,
        "picture": picture,
        "google_id": google_id,
        "password_hash": None,   # Google users have no password
        "role": "user",
        "preferences": {"cuisines": [], "price_range": "₹₹", "area": ""},
        "most_common_location": "",
        "onboarding_complete": False,  # Must complete quiz
        "suspended": False,
        "created_at": datetime.utcnow().isoformat()
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc, True  # New user


async def complete_onboarding(user_id: str):
    """Mark onboarding quiz as complete."""
    from bson import ObjectId
    col = get_collection("users")
    if col is None:
        return
    try:
        await col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"onboarding_complete": True}}
        )
    except Exception:
        pass  # Graceful offline handling




# ─── Interactions ───
async def log_interaction(user_id: str, restaurant_id: int, restaurant_name: str,
                          action: str, rating: float = None, location: str = ""):
    col = get_collection("interactions")
    if col is None:
        return None
    doc = {
        "user_id": user_id,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "action": action,
        "rating": rating,
        "location": location,
        "timestamp": datetime.utcnow().isoformat()
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_user_interactions(user_id: str, limit: int = 50):
    col = get_collection("interactions")
    if col is None:
        return []
    cursor = col.find({"user_id": user_id}).sort("timestamp", -1).limit(limit)
    results = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results


async def get_user_interaction_count(user_id: str) -> int:
    col = get_collection("interactions")
    if col is None:
        return 0
    return await col.count_documents({"user_id": user_id})


# ─── Config (admin) ───
async def get_config():
    col = get_collection("config")
    if col is None:
        return {
            "global_alpha": 0.4,
            "ab_test_split": {"hybrid": 100, "cbf_only": 0},
            "last_svd_retrain": "",
            "interactions_since_retrain": 0
        }
    config = await col.find_one({})
    if config is None:
        # Create default
        config = {
            "global_alpha": 0.4,
            "ab_test_split": {"hybrid": 100, "cbf_only": 0},
            "last_svd_retrain": "",
            "interactions_since_retrain": 0
        }
        await col.insert_one(config)
    config.pop("_id", None)
    return config


async def update_config(updates: dict):
    col = get_collection("config")
    if col is None:
        return None
    await col.update_one({}, {"$set": updates}, upsert=True)
