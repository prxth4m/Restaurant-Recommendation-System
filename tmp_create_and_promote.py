import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend import database
from backend.auth import hash_password

async def create_and_promote(email, password):
    await database.connect_db()
    col = database.get_collection("users")
    
    # Check if user exists
    existing = await col.find_one({"email": email})
    if existing:
        print("User already exists. Promoting to admin...")
        res = await col.update_one({"email": email}, {"$set": {"role": "admin"}})
        print(f"Modified {res.modified_count} user to admin.")
    else:
        print("Creating user and setting as admin...")
        pw_hash = hash_password(password)
        # Create with admin role directly
        doc = {
            "email": email,
            "password_hash": pw_hash,
            "role": "admin",
            "preferences": {"cuisines": ["Chinese", "North Indian"], "price_range": "₹₹", "area": "Indiranagar"},
            "most_common_location": "",
            "onboarding_complete": True,
            "suspended": False
        }
        await col.insert_one(doc)
        print("Created new admin user successfully.")
        
    await database.close_db()

asyncio.run(create_and_promote("pratham.jha2005@gmail.com", "goodspot"))
