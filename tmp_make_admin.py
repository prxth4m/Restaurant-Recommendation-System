import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Setup correct imports for backend
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend import database

async def make_admin(email):
    await database.connect_db()
    col = database.get_collection("users")
    if col is None:
        print("Database offline!")
        return
        
    res = await col.update_one({"email": email}, {"$set": {"role": "admin"}})
    print(f"Matched {res.matched_count} user(s), Modified {res.modified_count} user(s) to 'admin'")
    await database.close_db()

asyncio.run(make_admin("pratham.jha2005@gmail.com"))
