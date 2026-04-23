"""
Pure anomaly detection and recommendation logic — no I/O, fully testable.
Requirements: 9.2, 9.3, 9.4, 12.2, 12.3, 12.4
"""
from typing import List, Optional, Tuple


# ─── Anomaly detection ────────────────────────────────────────────────────────

def is_critical_anomaly(hr: int, max_hr: int) -> bool:
    """HR > 95% of Max_HR → CRITICAL."""
    if max_hr <= 0:
        return False
    return hr / max_hr > 0.95


def is_warning_duration_anomaly(hr: int, max_hr: int, duration_in_zone_seconds: int) -> bool:
    """HR > 85% of Max_HR AND duration > 10 minutes → WARNING."""
    if max_hr <= 0:
        return False
    return (hr / max_hr > 0.85) and (duration_in_zone_seconds > 600)


def is_warning_sensor_anomaly(hr: int) -> bool:
    """HR < 40 bpm → WARNING (sensor check)."""
    return hr < 40


def determine_alert(hr: int, max_hr: int, duration_in_zone_seconds: int) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (alert_type, message) or (None, None) if no alert.
    Priority: CRITICAL > WARNING duration > WARNING sensor.
    """
    if is_critical_anomaly(hr, max_hr):
        return "CRITICAL", f"HR melebihi 95% dari Max HR ({hr}/{max_hr} bpm)"
    if is_warning_duration_anomaly(hr, max_hr, duration_in_zone_seconds):
        return "WARNING", f"HR melebihi 85% dari Max HR selama lebih dari 10 menit ({hr}/{max_hr} bpm)"
    if is_warning_sensor_anomaly(hr):
        return "WARNING", f"HR sangat rendah — periksa sensor ({hr} bpm)"
    return None, None


# ─── Recommendation logic ─────────────────────────────────────────────────────

def generate_recommendations(sessions: List[dict]) -> List[dict]:
    """
    Pure recommendation logic based on session history.
    Requirements: 12.2, 12.3, 12.4
    """
    recommendations = []

    if len(sessions) < 1:
        return recommendations

    # Rule 1: Last 3 sessions always in peak zone → reduce intensity
    if len(sessions) >= 3:
        last_3_zones = [s.get("hr_zone") for s in sessions[:3]]
        if all(z == "peak" for z in last_3_zones):
            recommendations.append({
                "type": "workout_recommendation",
                "rule": "reduce_intensity",
                "message": "HR rata-rata 3 sesi terakhir selalu di zona peak. Disarankan menurunkan intensitas dan menambah waktu pemulihan.",
            })

    # Rule 2: avg HR decreasing vs older session → increase intensity
    if len(sessions) >= 2:
        recent_avg = sessions[0].get("avg_hr") or 0
        older_avg = sessions[-1].get("avg_hr") or 0
        if recent_avg > 0 and older_avg > 0 and recent_avg < older_avg:
            recommendations.append({
                "type": "workout_recommendation",
                "rule": "increase_intensity",
                "message": "Rata-rata HR menurun dibanding sesi sebelumnya. Disarankan meningkatkan intensitas latihan.",
            })

    # Rule 3: fat_burn duration < 20 min → extend fat burn
    recent = sessions[0]
    fat_burn_duration = recent.get("duration_minutes") or 0
    if recent.get("hr_zone") == "fat_burn" and fat_burn_duration < 20:
        recommendations.append({
            "type": "workout_recommendation",
            "rule": "extend_fat_burn",
            "message": "Durasi di zona fat_burn kurang dari 20 menit. Disarankan memperpanjang sesi di zona fat burn.",
        })

    return recommendations
