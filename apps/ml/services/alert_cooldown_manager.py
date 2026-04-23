"""
AlertCooldownManager — Cooldown per member per alert type.
Requirements: 9.7
"""

import os
import redis as redis_lib

COOLDOWN_TTL = {
    "CRITICAL": 60,   # 60 seconds
    "WARNING": 120,   # 120 seconds
}


def _get_redis() -> redis_lib.Redis:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return redis_lib.from_url(url, decode_responses=True)


def is_in_cooldown(user_id: str, alert_type: str) -> bool:
    """
    Returns True if the alert is still in cooldown period.
    """
    r = _get_redis()
    key = f"alert_cooldown:{user_id}:{alert_type}"
    return r.exists(key) == 1


def set_cooldown(user_id: str, alert_type: str) -> None:
    """
    Sets cooldown flag for the given user and alert type.
    TTL: CRITICAL=60s, WARNING=120s.
    """
    r = _get_redis()
    ttl = COOLDOWN_TTL.get(alert_type, 60)
    key = f"alert_cooldown:{user_id}:{alert_type}"
    r.setex(key, ttl, "1")
