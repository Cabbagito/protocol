"""Session-level operations — skip / unskip a whole workout."""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.progression import get_current_position
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def set_session_skipped(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    skipped: bool,
) -> dict:
    """Mark a whole session as skipped (or undo it).

    A skipped session is passed over by "where we left off" and excluded
    from the mesocycle's workout count. Any sets already logged in it are
    kept, so un-skipping restores the session exactly as it was.
    """
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    _, session = get_session_from_structure(structure, week_index, session_index)

    session["skipped"] = skipped

    # Skipping the last open session can finish the mesocycle; un-skipping
    # can reopen it.
    if get_current_position(structure).get("completed"):
        if mesocycle.completed_at is None:
            mesocycle.completed_at = datetime.now(UTC)
    else:
        mesocycle.completed_at = None

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "session_name": session["session_name"], "skipped": skipped}
