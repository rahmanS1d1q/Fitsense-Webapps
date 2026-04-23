"""
ZoneStateTracker — Lacak zona aktif dan durasi per member di Redis.
Requirements: 9.8
"""

import os
import redis as redis_lib
from typing import Optional, Dict

ZONE_STATE_TTL = 7200  # 2 hours


def _get_redis() -> redis_lib.Redis:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return redis_lib.from_url(url, decode_responses=True)


def get_zone_state(user_id: str) -> Optional[Dict[str, str]]:
    """
    Returns { current_zone, entered_at } or None if not set.
    """
    r = _get_redis()
    data = r.hgetall(f"zone_state:{user_id}")
    if not data:
        return None
    return data


def set_zone_state(user_id: str, zone: str, entered_at_ms: int) -> None:
    """
    Sets zone_state:{user_id} hash with current_zone and entered_at.
    TTL: 2 hours.
    """
    r = _get_redis()
    key = f"zone_state:{user_id}"
    r.hset(key, mapping={"current_zone": zone, "entered_at": str(entered_at_ms)})
    r.expire(key, ZONE_STATE_TTL)


def get_duration_in_zone_seconds(user_id: str, current_timestamp_ms: int) -> int:
    """
    Returns how many seconds the user has been in their current zone.
    Returns 0 if no zone state found.
    """
    state = get_zone_state(user_id)
    if not state or "entered_at" not in state:
        return 0
    try:
        entered_at_ms = int(state["entered_at"])
        elapsed_ms = current_timestamp_ms - entered_at_ms
        return max(0, elapsed_ms // 1000)
    except (ValueError, TypeError):
        return 0
