"""Manage Protocol users from the server (no HTTP endpoint exists for this).

Usage:
    uv run python -m scripts.manage_users list
    uv run python -m scripts.manage_users create "Name" [password]
    uv run python -m scripts.manage_users delete <user-id>

Docker (prod image has no uv; the venv's python is on PATH):
    docker exec protocol-backend-1 python -m scripts.manage_users list

Creating without a password generates a random one and prints it once —
passwords identify users at login, so they must be unique across users.
Explicit passwords must be non-empty and at most 72 bytes (bcrypt's limit).
Deleting a user removes all their data via FK cascades.
"""

import argparse
import asyncio
import sys

from app.core.database import async_session
from app.services import user_service


async def cmd_list() -> None:
    async with async_session() as db:
        users = await user_service.list_users(db)
    for user in users:
        print(f"{user.id}  {user.created_at:%Y-%m-%d}  {user.name}")


async def cmd_create(name: str, password: str | None) -> None:
    async with async_session() as db:
        try:
            user, plaintext = await user_service.create_user(db, name, password)
        except user_service.InvalidUserError as exc:
            sys.exit(f"Error: {exc}")
    print(f"Created user: {user.name} ({user.id})")
    print(f"Password:     {plaintext}")


async def cmd_delete(user_id: str) -> None:
    async with async_session() as db:
        try:
            user = await user_service.delete_user(db, user_id)
        except LookupError as exc:
            sys.exit(f"Error: {exc}")
    print(f"Deleted user: {user.name} ({user.id}) and all their data")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage Protocol users")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List all users")

    p_create = sub.add_parser("create", help="Create a user")
    p_create.add_argument("name")
    p_create.add_argument("password", nargs="?", default=None)

    p_delete = sub.add_parser("delete", help="Delete a user and all their data")
    p_delete.add_argument("user_id")

    args = parser.parse_args()
    if args.command == "list":
        asyncio.run(cmd_list())
    elif args.command == "create":
        asyncio.run(cmd_create(args.name, args.password))
    elif args.command == "delete":
        asyncio.run(cmd_delete(args.user_id))
