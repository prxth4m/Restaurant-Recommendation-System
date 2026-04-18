# mongodbPing.py — MongoDB Atlas connectivity check
# Run: python mongodbPing.py
# Install: pip install "pymongo[srv]" python-dotenv

import os
import sys

# python-dotenv lets us read a .env file so we don't have to set env vars manually.
# If it's not installed, we still try to read from os.environ directly.
try:
    from dotenv import load_dotenv
    load_dotenv()  # Loads variables from .env in the current directory into os.environ
except ImportError:
    pass  # No .env file support — MONGODB_URI must already be set in the environment

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ConfigurationError

# ── Step 1: Read the connection string ──────────────────────────────────────
# We never hardcode the URI here — it must come from the environment or .env file.
# This keeps credentials out of source code and version control.
uri = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")

if not uri:
    print("❌ No MongoDB URI found.")
    print("   Set MONGO_URL or MONGODB_URI in your environment or .env file.")
    sys.exit(1)

print("🔌 Connecting to MongoDB Atlas...")
print(f"   URI starts with: {uri[:30]}...")  # Print only the start — never the full URI

# ── Step 2: Create the client ────────────────────────────────────────────────
# serverSelectionTimeoutMS=5000 means: if Atlas isn't reachable in 5 seconds, give up.
# Without this, the default timeout is 30 seconds which feels like a hang to a beginner.
try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
except ConfigurationError as e:
    # This usually means the URI format is wrong (e.g. wrong scheme, missing username)
    print(f"❌ Invalid URI format: {e}")
    sys.exit(1)

# ── Step 3: Ping the server ──────────────────────────────────────────────────
# The 'ping' command is the lightest possible command Atlas accepts.
# It doesn't read or write any data — it just checks the connection is alive.
try:
    print("📡 Sending ping to Atlas...")
    client.admin.command("ping")  # Runs: db.runCommand({ ping: 1 })
    print("✅ Successfully connected to MongoDB Atlas!")
    print("   Your URI is valid and Atlas is reachable.")
except ConnectionFailure as e:
    # ConnectionFailure covers: wrong password, IP not whitelisted, network issues
    print(f"❌ Ping failed — could not reach Atlas: {e}")
    print("   Check: IP whitelist, username/password, and network connection.")
finally:
    # ── Step 4: Always close the connection ─────────────────────────────────
    # Even on failure, the client may have opened a socket. Close it cleanly.
    client.close()
    print("🔒 Connection closed.")
