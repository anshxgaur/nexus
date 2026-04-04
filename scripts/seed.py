"""
Bootstrap script — creates default channels and an admin user.
Run: python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User, Channel
from app.core.security import hash_password
from sqlalchemy import select


DEFAULT_CHANNELS = [
    ("general", "Company-wide announcements and general chat"),
    ("engineering", "Engineering team discussions"),
    ("product", "Product planning and feedback"),
    ("random", "Off-topic conversations"),
]

ADMIN = {
    "name": "Admin",
    "email": "admin@nexus.local",
    "password": "admin1234",
}


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Admin user
        existing = await db.execute(select(User).where(User.email == ADMIN["email"]))
        if not existing.scalar_one_or_none():
            user = User(
                name=ADMIN["name"],
                email=ADMIN["email"],
                password_hash=hash_password(ADMIN["password"]),
            )
            db.add(user)
            print(f"✓ Created admin user: {ADMIN['email']} / {ADMIN['password']}")
        else:
            print(f"  Admin user already exists.")

        # Default channels
        for name, desc in DEFAULT_CHANNELS:
            existing = await db.execute(select(Channel).where(Channel.name == name))
            if not existing.scalar_one_or_none():
                db.add(Channel(name=name, description=desc))
                print(f"✓ Created channel: #{name}")
            else:
                print(f"  Channel #{name} already exists.")

        await db.commit()
    print("\nSeed complete ✓")


if __name__ == "__main__":
    asyncio.run(seed())
