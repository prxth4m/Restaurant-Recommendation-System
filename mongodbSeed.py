# mongodbSeed.py — Seed MongoDB Atlas with sample GoodSpot data
# Run:     venv/Scripts/python.exe mongodbSeed.py
# Install: venv/Scripts/pip.exe install "pymongo[srv]" python-dotenv

import os
import sys
from datetime import datetime, timedelta

try:
    from dotenv import load_dotenv
    load_dotenv()  # Pulls MONGO_URL from .env so we never hardcode credentials
except ImportError:
    pass

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, BulkWriteError

# ── Step 1: Read the URI ──────────────────────────────────────────────────────
uri = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
if not uri:
    print("❌ No MongoDB URI found. Set MONGO_URL in your .env file.")
    sys.exit(1)

print("🔌 Connecting to MongoDB Atlas...")
print(f"   URI starts with: {uri[:30]}...")

# ── Step 2: Connect ───────────────────────────────────────────────────────────
try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")  # Lightweight check before we try to write anything
    print("✅ Connected to Atlas!\n")
except ConnectionFailure as e:
    print(f"❌ Could not connect to Atlas: {e}")
    sys.exit(1)

# ── Step 3: Target database and collection ────────────────────────────────────
# Atlas creates these automatically on first insert — no setup needed.
db = client["goodspot"]          # Same DB name as the main app
col = db["interactions"]         # Stores what users clicked/rated/bookmarked

# ── Step 4: Build 10 realistic seed documents ─────────────────────────────────
# Timestamps are spread across the last 10 days so they look like real user activity.
# In a live app these would be created automatically on each user action.
now = datetime.utcnow()

seed_docs = [
    {
        "user_id": "seed_user_001",
        "restaurant_id": 101,
        "restaurant_name": "Truffles — Koramangala",
        "action": "click",         # User tapped the restaurant card
        "rating": None,            # No rating yet — just browsing
        "location": "Koramangala",
        "timestamp": (now - timedelta(days=9)).isoformat(),
    },
    {
        "user_id": "seed_user_001",
        "restaurant_id": 101,
        "restaurant_name": "Truffles — Koramangala",
        "action": "rate",
        "rating": 4.5,             # User came back and gave a rating
        "location": "Koramangala",
        "timestamp": (now - timedelta(days=8, hours=3)).isoformat(),
    },
    {
        "user_id": "seed_user_002",
        "restaurant_id": 204,
        "restaurant_name": "CTR — Malleswaram",
        "action": "bookmark",      # User saved it for later
        "rating": None,
        "location": "Malleswaram",
        "timestamp": (now - timedelta(days=7)).isoformat(),
    },
    {
        "user_id": "seed_user_002",
        "restaurant_id": 310,
        "restaurant_name": "Meghana Foods — Indiranagar",
        "action": "click",
        "rating": None,
        "location": "Indiranagar",
        "timestamp": (now - timedelta(days=6, hours=2)).isoformat(),
    },
    {
        "user_id": "seed_user_002",
        "restaurant_id": 310,
        "restaurant_name": "Meghana Foods — Indiranagar",
        "action": "rate",
        "rating": 5.0,
        "location": "Indiranagar",
        "timestamp": (now - timedelta(days=5)).isoformat(),
    },
    {
        "user_id": "seed_user_003",
        "restaurant_id": 415,
        "restaurant_name": "Vidyarthi Bhavan — Gandhi Bazaar",
        "action": "click",
        "rating": None,
        "location": "Gandhi Bazaar",
        "timestamp": (now - timedelta(days=4, hours=5)).isoformat(),
    },
    {
        "user_id": "seed_user_003",
        "restaurant_id": 502,
        "restaurant_name": "Empire Restaurant — MG Road",
        "action": "click",
        "rating": None,
        "location": "MG Road",
        "timestamp": (now - timedelta(days=3)).isoformat(),
    },
    {
        "user_id": "seed_user_003",
        "restaurant_id": 502,
        "restaurant_name": "Empire Restaurant — MG Road",
        "action": "rate",
        "rating": 3.5,
        "location": "MG Road",
        "timestamp": (now - timedelta(days=2, hours=1)).isoformat(),
    },
    {
        "user_id": "seed_user_001",
        "restaurant_id": 614,
        "restaurant_name": "Toit Brewpub — Indiranagar",
        "action": "bookmark",
        "rating": None,
        "location": "Indiranagar",
        "timestamp": (now - timedelta(days=1)).isoformat(),
    },
    {
        "user_id": "seed_user_002",
        "restaurant_id": 720,
        "restaurant_name": "Brahmin's Coffee Bar — Basavanagudi",
        "action": "rate",
        "rating": 4.0,
        "location": "Basavanagudi",
        "timestamp": now.isoformat(),  # Most recent — just now
    },
]

# ── Step 5: Insert the documents ──────────────────────────────────────────────
print(f"📥 Inserting {len(seed_docs)} seed documents into goodspot.interactions...\n")

try:
    result = col.insert_many(seed_docs, ordered=False)
    # ordered=False means: if one insert fails, the rest still proceed
except BulkWriteError as e:
    print(f"⚠️  Some inserts failed: {e.details}")
    result = None

# ── Step 6: Print results ─────────────────────────────────────────────────────
if result:
    print(f"✅ Inserted {len(result.inserted_ids)} documents.\n")
    print("Inserted _id values:")
    for i, _id in enumerate(result.inserted_ids):
        doc = seed_docs[i]
        # Show the generated _id alongside a human-readable label
        print(f"  [{i+1}] {_id}  →  {doc['restaurant_name']} ({doc['action']})")

    print("\nSample document preview:")
    for key, val in seed_docs[0].items():
        print(f"  {key}: {val}")

# ── Step 7: Close the connection ──────────────────────────────────────────────
client.close()
print("\n🔒 Connection closed. Seed complete!")
print("   You can now view these in MongoDB Atlas → goodspot → interactions.")
