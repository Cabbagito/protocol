"""Migration checks against real PostgreSQL databases.

- The models match the schema produced by ``alembic upgrade head``.
- 0016 upgrades a populated 0015 database (shaped like prod: seeded data, a
  user with several mesocycles, naive completed_at, food logs), downgrades
  and re-upgrades cleanly, and enforces its new constraints.
- 0017 cleans workout structures without touching logged sets.
- 0018 turns food logs into meals and default servings into units, and back.
"""

import json
import uuid
from datetime import UTC, date, datetime, time

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app.core.config import settings
from app.core.migrations import alembic_config
from app.models import Base
from tests.conftest import TEST_URL
from tests.db_utils import (
    connect,
    drop_database,
    recreate_database,
    run_async,
    run_outside_event_loop,
)

MIGRATION_URL = TEST_URL.set(database=f"{TEST_URL.database}_migrations")


def _alembic(fn, *args) -> None:
    run_outside_event_loop(fn, alembic_config(), *args)


def _sql(fn):
    """Run ``await fn(conn)`` on a fresh asyncpg connection to the migration DB."""

    async def _main():
        conn = await connect(MIGRATION_URL)
        try:
            return await fn(conn)
        finally:
            await conn.close()

    return run_async(_main)


def test_models_match_migrated_schema(database):
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    async def _diff():
        engine = create_async_engine(database, poolclass=NullPool)
        try:
            async with engine.connect() as conn:
                return await conn.run_sync(
                    lambda sync_conn: compare_metadata(
                        MigrationContext.configure(sync_conn), Base.metadata
                    )
                )
        finally:
            await engine.dispose()

    assert run_async(_diff) == []


@pytest.fixture
def migration_db(monkeypatch):
    """An empty throwaway database that alembic commands target."""
    run_async(lambda: recreate_database(MIGRATION_URL))
    monkeypatch.setattr(
        settings, "database_url", MIGRATION_URL.render_as_string(hide_password=False)
    )
    yield
    run_async(lambda: drop_database(MIGRATION_URL))


def _uid() -> str:
    return str(uuid.uuid4())


def _structure(exercise_ids: list[str], *, logged: bool) -> dict:
    sets = [
        {
            "set_num": n,
            "weight": 50 if logged else None,
            "reps": 8 if logged else None,
            "suggested_weight": None,
            "logged": logged,
        }
        for n in (1, 2)
    ]
    return {
        "weeks": [
            {
                "week_number": w,
                "sessions": [
                    {
                        "session_name": "Day 1",
                        "day_order": 0,
                        "date": "2026-03-01" if logged else None,
                        "notes": None,
                        "exercises": [
                            {
                                "exercise_id": eid,
                                "exercise_name": "X",
                                "muscle_group": "chest",
                                "equipment_type": "cable",
                                "sets": sets,
                            }
                            for eid in exercise_ids
                        ],
                    }
                ],
            }
            for w in (1, 2, 3)
        ]
    }


async def _populate_0015(conn) -> dict:
    """Prod-shaped data at revision 0015, inserted with plain SQL."""
    now = datetime.now(UTC)
    ids = {
        k: _uid()
        for k in (
            "alice",
            "bob",
            "custom_ex",
            "split",
            "day",
            "m_done",
            "m_old_active",
            "m_new_active",
            "m_idle",
            "m_bob",
            "food",
            "barcode_food",
        )
    }
    seeded_ex = await conn.fetchval("SELECT id FROM exercises WHERE seed_key IS NOT NULL LIMIT 1")

    for key, name in (("alice", "Alice"), ("bob", "Bob")):
        await conn.execute(
            "INSERT INTO users (id, name, password_hash, created_at, updated_at) "
            "VALUES ($1, $2, 'x', $3, $3)",
            ids[key],
            name,
            now,
        )
    await conn.execute(
        "INSERT INTO exercises (id, name, muscle_group, equipment_type, user_id, created_at, "
        "updated_at) VALUES ($1, 'Custom Fly', 'chest', 'cable', $2, $3, $3)",
        ids["custom_ex"],
        ids["alice"],
        now,
    )
    await conn.execute(
        "INSERT INTO splits (id, name, user_id, created_at, updated_at) "
        "VALUES ($1, 'Alice Split', $2, $3, $3)",
        ids["split"],
        ids["alice"],
        now,
    )
    await conn.execute(
        "INSERT INTO split_days (id, split_id, name, day_order, created_at, updated_at) "
        "VALUES ($1, $2, 'Day 1', 0, $3, $3)",
        ids["day"],
        ids["split"],
        now,
    )
    for order, ex in enumerate((seeded_ex, ids["custom_ex"])):
        await conn.execute(
            'INSERT INTO split_day_exercises (id, day_id, exercise_id, "order", created_at, '
            "updated_at) VALUES ($1, $2, $3, $4, $5, $5)",
            _uid(),
            ids["day"],
            ex,
            order,
            now,
        )

    mesos = [
        # key, user, started, active, completed_at (naive, UTC), logged
        ("m_done", "alice", date(2026, 1, 5), False, datetime(2026, 3, 1, 10, 30), True),
        ("m_old_active", "alice", date(2026, 4, 1), True, None, False),
        ("m_new_active", "alice", date(2026, 6, 1), True, None, False),
        ("m_idle", "alice", date(2026, 2, 1), False, None, False),
        ("m_bob", "bob", date(2026, 6, 1), True, None, False),
    ]
    for key, owner, started, active, completed, logged in mesos:
        await conn.execute(
            "INSERT INTO mesocycles (id, split_id, user_id, name, started_at, completed_at, "
            "is_active, structure, created_at, updated_at) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)",
            ids[key],
            ids["split"],
            ids[owner],
            key,
            started,
            completed,
            active,
            json.dumps(_structure([seeded_ex, ids["custom_ex"]], logged=logged)),
            now,
        )

    await conn.execute(
        "INSERT INTO food_items (id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, "
        "fat_per_100g, user_id, created_at, updated_at) "
        "VALUES ($1, 'Alice Oats', 380, 13, 60, 7, $2, $3, $3)",
        ids["food"],
        ids["alice"],
        now,
    )
    await conn.execute(
        "INSERT INTO food_items (id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, "
        "fat_per_100g, barcode, created_at, updated_at) "
        "VALUES ($1, 'Nutella', 539, 6.3, 57.5, 30.9, '3017620422003', $2, $2)",
        ids["barcode_food"],
        now,
    )
    for food in ("food", "barcode_food"):
        await conn.execute(
            "INSERT INTO food_logs (id, user_id, logged_on, food_item_id, name, quantity_g, kcal, "
            "protein_g, carbs_g, fat_g, created_at, updated_at) "
            "VALUES ($1, $2, '2026-06-02', $3, 'logged', 100, 380, 13, 60, 7, $4, $4)",
            _uid(),
            ids["alice"],
            ids[food],
            now,
        )
    await conn.execute(
        "INSERT INTO body_weight_logs (id, user_id, logged_on, weight_kg, created_at, updated_at) "
        "VALUES ($1, $2, '2026-06-02', 82.5, $3, $3)",
        _uid(),
        ids["alice"],
        now,
    )
    await conn.execute(
        "INSERT INTO daily_targets (user_id, protein_g, carbs_g, fat_g, created_at, updated_at) "
        "VALUES ($1, 160, 250, 70, $2, $2)",
        ids["alice"],
        now,
    )
    return ids


async def _schema_facts(conn) -> dict:
    completed_type = await conn.fetchval(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_name = 'mesocycles' AND column_name = 'completed_at'"
    )
    split_nullable = await conn.fetchval(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_name = 'mesocycles' AND column_name = 'split_id'"
    )
    fk_actions = {
        (r["tbl"], r["col"]): r["action"]
        for r in await conn.fetch(
            "SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, "
            "c.confdeltype::text AS action FROM pg_constraint c JOIN pg_attribute a "
            "ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) WHERE c.contype = 'f'"
        )
    }
    indexes = {
        r["indexname"]
        for r in await conn.fetch("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
    }
    return {
        "completed_type": completed_type,
        "split_nullable": split_nullable,
        "fk": fk_actions,
        "indexes": indexes,
    }


NEW_INDEXES = {
    "uq_mesocycles_one_active_per_user",
    "ix_split_days_split_id",
    "ix_split_day_exercises_day_id",
    "ix_split_day_exercises_exercise_id",
    "ix_mesocycles_split_id",
    "ix_food_logs_food_item_id",
}


def test_0016_upgrade_downgrade_on_populated_database(migration_db):
    # Foods aren't seeded: today's food seeder expects today's schema.
    from app.core.seed import seed_default_splits, seed_exercises

    _alembic(command.upgrade, "0015")

    async def _seed():
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
        from sqlalchemy.pool import NullPool

        engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, class_=AsyncSession)() as session:
                await seed_exercises(session)
                await seed_default_splits(session)
        finally:
            await engine.dispose()

    run_async(_seed)
    ids = _sql(_populate_0015)
    before = _sql(lambda c: c.fetch("SELECT id, structure::text AS s FROM mesocycles ORDER BY id"))
    before_logs = _sql(lambda c: c.fetchval("SELECT count(*) FROM food_logs"))

    # --- upgrade ---
    _alembic(command.upgrade, "0016")
    facts = _sql(_schema_facts)
    assert facts["completed_type"] == "timestamp with time zone"
    assert facts["split_nullable"] == "YES"
    assert facts["fk"][("mesocycles", "split_id")] == "n"  # SET NULL
    assert facts["fk"][("split_day_exercises", "exercise_id")] == "a"  # NO ACTION
    assert facts["fk"][("food_logs", "food_item_id")] == "n"
    assert facts["fk"][("split_days", "split_id")] == "c"  # still CASCADE
    assert NEW_INDEXES | {"ix_mesocycles_user_id"} <= facts["indexes"]

    completed = _sql(
        lambda c: c.fetchval("SELECT completed_at FROM mesocycles WHERE id = $1", ids["m_done"])
    )
    assert completed == datetime(2026, 3, 1, 10, 30, tzinfo=UTC)

    active = _sql(lambda c: c.fetch("SELECT id FROM mesocycles WHERE is_active ORDER BY id"))
    # Alice's older duplicate active mesocycle was deactivated; Bob's is untouched.
    assert {r["id"] for r in active} == {ids["m_new_active"], ids["m_bob"]}

    # Data is otherwise untouched.
    assert (
        _sql(lambda c: c.fetch("SELECT id, structure::text AS s FROM mesocycles ORDER BY id"))
        == before
    )
    assert _sql(lambda c: c.fetchval("SELECT count(*) FROM food_logs")) == before_logs

    # --- downgrade and re-upgrade ---
    _alembic(command.downgrade, "-1")
    facts = _sql(_schema_facts)
    assert facts["completed_type"] == "timestamp without time zone"
    assert facts["split_nullable"] == "NO"
    assert facts["fk"][("mesocycles", "split_id")] == "c"
    assert facts["fk"][("split_day_exercises", "exercise_id")] == "c"
    assert not (NEW_INDEXES & facts["indexes"])
    assert "ix_mesocycles_user_id" in facts["indexes"]
    completed = _sql(
        lambda c: c.fetchval("SELECT completed_at FROM mesocycles WHERE id = $1", ids["m_done"])
    )
    assert completed == datetime(2026, 3, 1, 10, 30)

    _alembic(command.upgrade, "0016")
    assert _sql(_schema_facts)["completed_type"] == "timestamp with time zone"

    # --- new constraints behave ---
    async def _constraints(conn):
        import asyncpg

        # Second active mesocycle for the same user is rejected.
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute(
                "UPDATE mesocycles SET is_active = true WHERE id = $1", ids["m_idle"]
            )
        # A referenced exercise can't be deleted out from under a split.
        with pytest.raises(asyncpg.ForeignKeyViolationError):
            await conn.execute("DELETE FROM exercises WHERE id = $1", ids["custom_ex"])
        # Deleting a food keeps its logs.
        await conn.execute("DELETE FROM food_items WHERE id = $1", ids["food"])
        assert await conn.fetchval("SELECT count(*) FROM food_logs") == before_logs
        # Deleting the split keeps every mesocycle.
        await conn.execute("DELETE FROM splits WHERE id = $1", ids["split"])
        assert await conn.fetchval("SELECT count(*) FROM mesocycles WHERE split_id IS NULL") == len(
            before
        )

    _sql(_constraints)

    # Downgrading now would have to drop split-less mesocycles: refused.
    with pytest.raises(RuntimeError, match="have no split"):
        _alembic(command.downgrade, "-1")

    # Deleting a user still cascades through exercises referenced by their splits.
    async def _delete_users(conn):
        await conn.execute("DELETE FROM users")
        assert await conn.fetchval("SELECT count(*) FROM mesocycles") == 0
        assert await conn.fetchval("SELECT count(*) FROM exercises WHERE user_id IS NOT NULL") == 0

    _sql(_delete_users)


def _set(n, weight=None, reps=None, logged=False, **extra):
    return {"set_num": n, "weight": weight, "reps": reps, "logged": logged, **extra}


def _session(name, date_str, sets, skipped_exercise=False):
    ex = {
        "exercise_id": "e1",
        "exercise_name": "Bench",
        "muscle_group": "chest",
        "equipment_type": "barbell",
        "sets": sets,
    }
    if skipped_exercise:
        ex["skipped"] = True
    return {
        "session_name": name,
        "day_order": 0,
        "date": date_str,
        "notes": None,
        "exercises": [ex],
    }


def test_0017_cleans_structures_and_stamps_completion(migration_db):
    _alembic(command.upgrade, "0016")
    user_id, done_id, open_id = _uid(), _uid(), _uid()
    now = datetime(2026, 10, 1, tzinfo=UTC)

    done = {
        "weeks": [
            {
                "week_number": 1,
                "sessions": [
                    _session(
                        "Push",
                        "2026-06-29",
                        [
                            _set(1, 100, 8, True, suggested_weight=95),
                            _set(2, 100, 0, False, skipped=True, suggested_weight=95),
                        ],
                    ),
                ],
            }
        ]
    }
    still_open = {
        "weeks": [
            {
                "week_number": 1,
                "sessions": [
                    _session("Push", "2026-09-20", [_set(1, 80, 10, True, skipped=True)]),
                    # opened (re-dated by the old client) but never logged
                    _session("Pull", "2026-10-06", [_set(1, 60, 0, False, suggested_weight=60)]),
                ],
            }
        ]
    }

    async def _populate(conn):
        await conn.execute(
            "INSERT INTO users (id, name, password_hash, created_at, updated_at) "
            "VALUES ($1, 'Peki', 'x', $2, $2)",
            user_id,
            now,
        )
        for meso_id, structure, active in ((done_id, done, False), (open_id, still_open, True)):
            await conn.execute(
                "INSERT INTO mesocycles (id, split_id, user_id, name, started_at, completed_at, "
                "is_active, structure, created_at, updated_at) "
                "VALUES ($1, NULL, $2, 'M', $3, NULL, $4, $5::jsonb, $6, $6)",
                meso_id,
                user_id,
                date(2026, 6, 1),
                active,
                json.dumps(structure),
                now,
            )

    _sql(_populate)
    _alembic(command.upgrade, "0017")

    async def _read(conn):
        rows = await conn.fetch("SELECT id, structure::text AS s, completed_at FROM mesocycles")
        return {r["id"]: (json.loads(r["s"]), r["completed_at"]) for r in rows}

    rows = _sql(_read)
    done_s, done_at = rows[done_id]
    open_s, open_at = rows[open_id]

    push = done_s["weeks"][0]["sessions"][0]
    assert push["exercises"][0]["sets"] == [
        {"set_num": 1, "weight": 100, "reps": 8, "logged": True, "skipped": False},
        {"set_num": 2, "weight": None, "reps": None, "logged": False, "skipped": True},
    ]
    assert push["date"] == "2026-06-29"
    assert done_at == datetime(2026, 6, 29, 12, tzinfo=UTC)

    open_push, open_pull = open_s["weeks"][0]["sessions"]
    # A logged set is never also skipped; its values are untouched.
    assert open_push["exercises"][0]["sets"][0] == {
        "set_num": 1,
        "weight": 80,
        "reps": 10,
        "logged": True,
        "skipped": False,
    }
    assert open_pull["date"] is None
    assert open_pull["exercises"][0]["sets"][0] == {
        "set_num": 1,
        "weight": None,
        "reps": None,
        "logged": False,
    }
    assert open_at is None


def test_0018_food_logs_become_meals_and_servings_become_units(migration_db):
    _alembic(command.upgrade, "0017")
    alice, bob, oats, nutella = _uid(), _uid(), _uid(), _uid()
    now = datetime(2026, 10, 1, tzinfo=UTC)

    async def _populate(conn):
        for user_id, name in ((alice, "Alice"), (bob, "Bob")):
            await conn.execute(
                "INSERT INTO users (id, name, password_hash, created_at, updated_at) "
                "VALUES ($1, $2, 'x', $3, $3)",
                user_id,
                name,
                now,
            )
        await conn.execute(
            "INSERT INTO food_items (id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, "
            "fat_per_100g, default_serving_g, user_id, created_at, updated_at) "
            "VALUES ($1, 'Oats', 380, 13, 60, 7, 40, $2, $3, $3)",
            oats,
            alice,
            now,
        )
        await conn.execute(
            "INSERT INTO food_items (id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, "
            "fat_per_100g, barcode, created_at, updated_at) "
            "VALUES ($1, 'Nutella', 539, 6.3, 57.5, 30.9, '3017620422003', $2, $2)",
            nutella,
            now,
        )
        logs = [
            # user, day, food, name, grams, kcal, created
            (alice, date(2026, 6, 2), oats, "Oats", 40.0, 152.0, 1),
            (alice, date(2026, 6, 2), nutella, "Nutella", 15.0, 81.0, 2),
            (alice, date(2026, 6, 3), None, "Quick entry", None, 300.0, 3),
            (bob, date(2026, 6, 2), nutella, "Nutella", 30.0, 162.0, 4),
        ]
        for user_id, day, food, name, grams, kcal, minute in logs:
            created = now.replace(minute=minute)
            await conn.execute(
                "INSERT INTO food_logs (id, user_id, logged_on, food_item_id, name, quantity_g, "
                "kcal, protein_g, carbs_g, fat_g, created_at, updated_at) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 2, 3, $8, $8)",
                _uid(),
                user_id,
                day,
                food,
                name,
                grams,
                kcal,
                created,
            )

    _sql(_populate)
    _alembic(command.upgrade, "0018")

    async def _read(conn):
        meals = await conn.fetch(
            "SELECT m.user_id, m.eaten_on, m.eaten_at, m.name, m.name_source, "
            "array_agg(i.name ORDER BY i.position) AS items, "
            "array_agg(i.quantity_g ORDER BY i.position) AS grams, "
            "array_agg(i.unit_quantity ORDER BY i.position) AS amounts, "
            "array_agg(i.unit_name ORDER BY i.position) AS units "
            "FROM meals m JOIN meal_items i ON i.meal_id = m.id "
            "GROUP BY m.id ORDER BY m.user_id = $1 DESC, m.eaten_on",
            alice,
        )
        units = await conn.fetch("SELECT food_item_id, user_id, name, grams FROM food_units")
        tables = {
            r["tablename"]
            for r in await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        }
        return [dict(m) for m in meals], [dict(u) for u in units], tables

    meals, units, tables = _sql(_read)
    assert "food_logs" not in tables
    assert [
        (m["user_id"], m["eaten_on"], m["items"], m["grams"], m["amounts"], m["units"])
        for m in meals
    ] == [
        (alice, date(2026, 6, 2), ["Oats", "Nutella"], [40, 15], [40, 15], [None, None]),
        (alice, date(2026, 6, 3), ["Quick entry"], [None], [None], [None]),
        (bob, date(2026, 6, 2), ["Nutella"], [30], [30], [None]),
    ]
    assert all(m["eaten_at"] == time(12, 0) for m in meals)
    assert all(m["name"] is None and m["name_source"] == "auto" for m in meals)
    assert units == [{"food_item_id": oats, "user_id": None, "name": "serving", "grams": 40}]

    # --- downgrade and re-upgrade ---
    _alembic(command.downgrade, "-1")

    async def _read_old(conn):
        logs = await conn.fetch(
            "SELECT user_id, logged_on, name, quantity_g FROM food_logs "
            "ORDER BY user_id = $1 DESC, logged_on, name",
            alice,
        )
        serving = await conn.fetchval(
            "SELECT default_serving_g FROM food_items WHERE id = $1", oats
        )
        return [tuple(r) for r in logs], serving

    logs, serving = _sql(_read_old)
    assert logs == [
        (alice, date(2026, 6, 2), "Nutella", 15),
        (alice, date(2026, 6, 2), "Oats", 40),
        (alice, date(2026, 6, 3), "Quick entry", None),
        (bob, date(2026, 6, 2), "Nutella", 30),
    ]
    assert serving == 40
    _alembic(command.upgrade, "0018")
    assert len(_sql(_read)[0]) == 3
