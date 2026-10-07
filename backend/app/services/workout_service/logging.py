"""Workout logging — save one session's snapshot."""

from datetime import UTC, datetime
from datetime import date as date_type

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.mesocycle_structure import apply_session_snapshot, is_mesocycle_complete
from app.models.mesocycle import Mesocycle
from app.schemas.workout import SaveSessionRequest
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


def sync_completed_at(mesocycle: Mesocycle) -> None:
    """Stamp ``completed_at`` when the last open session gets done; clear it
    if a change reopens the mesocycle."""
    if is_mesocycle_complete(mesocycle.structure):
        if mesocycle.completed_at is None:
            mesocycle.completed_at = datetime.now(UTC)
    else:
        mesocycle.completed_at = None


async def save_session(db: AsyncSession, user_id: str, data: SaveSessionRequest) -> dict:
    mesocycle = await get_user_mesocycle(db, data.mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    _, session = get_session_from_structure(structure, data.week_index, data.session_index)

    apply_session_snapshot(
        structure,
        data.week_index,
        data.session_index,
        exercises=[e.model_dump() for e in data.exercises],
        logged_on=data.logged_on or date_type.today(),
        apply_to_future=data.apply_to_future,
    )
    sync_completed_at(mesocycle)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "session": session}
