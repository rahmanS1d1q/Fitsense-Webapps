"""
Health check endpoint.
Requirements: 16.1, 16.2
"""

import os
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/ml/health")
async def health_check():
    """
    Returns service health status with component checks.
    Requirements: 16.1, 16.2
    """
    checks = {}

    # PostgreSQL check
    try:
        import psycopg2
        conn = psycopg2.connect(
            os.getenv("DATABASE_URL", "postgresql://fitsense:password@localhost:5432/fitsense"),
            connect_timeout=3
        )
        conn.close()
        checks["postgres"] = "ok"
    except Exception as e:
        logger.warning("[health] PostgreSQL check failed: %s", str(e))
        checks["postgres"] = "error"

    # InfluxDB check
    try:
        from influxdb_client import InfluxDBClient
        client = InfluxDBClient(
            url=os.getenv("INFLUX_URL", "http://localhost:8086"),
            token=os.getenv("INFLUX_TOKEN", ""),
            org=os.getenv("INFLUX_ORG", "fitsense"),
            timeout=3000,
        )
        client.ping()
        client.close()
        checks["influxdb"] = "ok"
    except Exception as e:
        logger.warning("[health] InfluxDB check failed: %s", str(e))
        checks["influxdb"] = "error"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
