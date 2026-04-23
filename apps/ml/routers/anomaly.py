"""
AnomalyChecker — POST /ml/anomaly-check
Requirements: 9.1–9.7
"""

import os
import json
import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
import paho.mqtt.client as mqtt_client

from models.hr_analyzer import determine_alert
from services.alert_cooldown_manager import is_in_cooldown, set_cooldown
from services.zone_state_tracker import get_duration_in_zone_seconds, set_zone_state

logger = logging.getLogger(__name__)
router = APIRouter()


class AnomalyCheckRequest(BaseModel):
    hr: int
    rr: Optional[float] = None
    session_id: str
    user_id: str
    club_id: str
    timestamp: int
    hr_zone: str
    max_hr: int
    duration_in_zone_seconds: int = 0


class AnomalyCheckResponse(BaseModel):
    has_alert: bool
    alert_type: Optional[str] = None
    alert_message: Optional[str] = None
    skipped_cooldown: bool = False


def _publish_alert(club_id: str, user_id: str, alert_type: str, message: str, hr: int, max_hr: int, timestamp: int) -> bool:
    """Publish alert to MQTT broker. Returns True on success."""
    broker_host = os.getenv("MQTT_BROKER_HOST", "emqx")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    username = os.getenv("ML_MQTT_USERNAME", "ml_service")
    password = os.getenv("ML_MQTT_PASSWORD", "")

    topic = f"fitsense/{club_id}/{user_id}/alerts"
    payload = json.dumps({
        "type": alert_type,
        "message": message,
        "hr": hr,
        "max_hr": max_hr,
        "timestamp": timestamp,
    })

    try:
        client = mqtt_client.Client(client_id=f"ml_anomaly_{user_id}", protocol=mqtt_client.MQTTv5)
        client.username_pw_set(username, password)
        client.connect(broker_host, broker_port, keepalive=5)
        result = client.publish(topic, payload, qos=1)
        client.disconnect()
        return result.rc == mqtt_client.MQTT_ERR_SUCCESS
    except Exception as e:
        logger.error(
            "[AnomalyChecker] MQTT Broker tidak dapat dijangkau. Alert gagal dikirim. "
            "topic=%s type=%s hr=%d error=%s",
            topic, alert_type, hr, str(e)
        )
        return False


@router.post("/ml/anomaly-check", response_model=AnomalyCheckResponse)
async def anomaly_check(req: AnomalyCheckRequest) -> AnomalyCheckResponse:
    """
    Evaluate HR data point for anomalies.
    Requirements: 9.1–9.7
    """
    # Update zone state in Redis
    try:
        set_zone_state(req.user_id, req.hr_zone, req.timestamp)
        duration = get_duration_in_zone_seconds(req.user_id, req.timestamp)
    except Exception:
        duration = req.duration_in_zone_seconds

    alert_type, alert_message = determine_alert(req.hr, req.max_hr, duration)

    if alert_type is None:
        return AnomalyCheckResponse(has_alert=False, skipped_cooldown=False)

    # Check cooldown
    try:
        if is_in_cooldown(req.user_id, alert_type):
            return AnomalyCheckResponse(
                has_alert=False,
                alert_type=alert_type,
                alert_message=alert_message,
                skipped_cooldown=True,
            )
    except Exception:
        pass  # If Redis is down, proceed with publishing

    # Publish alert
    published = _publish_alert(
        req.club_id, req.user_id, alert_type, alert_message,
        req.hr, req.max_hr, req.timestamp
    )

    if published:
        try:
            set_cooldown(req.user_id, alert_type)
        except Exception:
            pass

    return AnomalyCheckResponse(
        has_alert=True,
        alert_type=alert_type,
        alert_message=alert_message,
        skipped_cooldown=False,
    )
