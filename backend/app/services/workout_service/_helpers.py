"""Shared helpers used across workout service modules."""

from fastapi import HTTPException


def get_session_from_structure(
    structure: dict, week_index: int, session_index: int
) -> tuple[dict, dict]:
    """Validate indices and return (week, session) from structure."""
    weeks = structure.get("weeks", [])

    if week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")

    week = weeks[week_index]
    sessions = week.get("sessions", [])

    if session_index >= len(sessions):
        raise HTTPException(status_code=400, detail="Invalid session index")

    return week, sessions[session_index]
