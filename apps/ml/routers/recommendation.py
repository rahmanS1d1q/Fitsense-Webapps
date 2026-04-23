"""
SessionAnalyzer + RecommendationService
Requirements: 12.1–12.8
"""

import os
import logging
import psycopg2
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from models.hr_analyzer import generate_recommendations

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeSessionRequest(BaseModel):
    session_id: str
    user_id: str
    club_id: str


def _get_db_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL", "postgresql://fitsense:password@localhost:5432/fitsense"))


def _get_last_sessions(user_id: str, limit: int = 5) -> List[dict]:
    """Fetch last N sessions for a user from PostgreSQL."""
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, avg_hr, hr_zone, duration_minutes, started_at
               FROM sessions
               WHERE user_id = %s AND ended_at IS NOT NULL
               ORDER BY started_at DESC
               LIMIT %s""",
            (user_id, limit)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {"id": r[0], "avg_hr": r[1], "hr_zone": r[2], "duration_minutes": r[3], "started_at": r[4]}
            for r in rows
        ]
    except Exception as e:
        logger.error("[SessionAnalyzer] DB query failed: %s", str(e))
        return []


def _save_recommendation(user_id: str, session_id: str, rec_type: str, content: dict) -> None:
    """Save recommendation to ml_recommendations table."""
    import json
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO ml_recommendations (user_id, session_id, type, content)
               VALUES (%s, %s, %s, %s)""",
            (user_id, session_id, rec_type, json.dumps(content))
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error("[SessionAnalyzer] Failed to save recommendation: %s", str(e))


@router.post("/ml/analyze-session")
async def analyze_session(req: AnalyzeSessionRequest):
    """
    Analyze a completed session and generate recommendations.
    Requirements: 12.1–12.8
    """
    sessions = _get_last_sessions(req.user_id, limit=5)

    if len(sessions) < 1:
        logger.info("[SessionAnalyzer] Data tidak mencukupi untuk user %s — tidak menyimpan rekomendasi.", req.user_id)
        return {"status": "skipped", "reason": "insufficient_data"}

    recommendations = generate_recommendations(sessions)

    for rec in recommendations:
        _save_recommendation(req.user_id, req.session_id, rec["type"], rec)

    return {"status": "ok", "recommendations_count": len(recommendations)}


@router.get("/ml/recommendations/{user_id}")
async def list_recommendations(user_id: str):
    """List all recommendations for a user. Requirements: 12.6"""
    import json
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, session_id, type, content, generated_at
               FROM ml_recommendations
               WHERE user_id = %s
               ORDER BY generated_at DESC""",
            (user_id,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {"recommendations": [
            {"id": r[0], "session_id": r[1], "type": r[2], "content": r[3], "generated_at": str(r[4])}
            for r in rows
        ]}
    except Exception as e:
        logger.error("[RecommendationService] list failed: %s", str(e))
        return {"recommendations": []}


@router.get("/ml/recommendations/{user_id}/latest")
async def latest_recommendation(user_id: str):
    """Get latest recommendation for a user. Requirements: 12.7"""
    import json
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, session_id, type, content, generated_at
               FROM ml_recommendations
               WHERE user_id = %s
               ORDER BY generated_at DESC
               LIMIT 1""",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return {"recommendation": None}
        return {"recommendation": {
            "id": row[0], "session_id": row[1], "type": row[2],
            "content": row[3], "generated_at": str(row[4])
        }}
    except Exception as e:
        logger.error("[RecommendationService] latest failed: %s", str(e))
        return {"recommendation": None}
