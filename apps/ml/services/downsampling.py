"""
Downsampling task — aggregate HR raw data to per-minute averages.
Requirements: 20.3, 20.4
"""

import os
import logging
import time
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


def run_downsampling() -> None:
    """
    Aggregate HR raw data older than 90 days to per-minute averages.
    Saves results to heartrate_aggregated bucket.
    Requirements: 20.3, 20.4
    """
    start_time = time.time()
    logger.info("[downsampling] Starting daily downsampling task at %s", datetime.now(timezone.utc).isoformat())

    try:
        from influxdb_client import InfluxDBClient
        from influxdb_client.client.write_api import SYNCHRONOUS

        influx_url = os.getenv("INFLUX_URL", "http://localhost:8086")
        influx_token = os.getenv("INFLUX_TOKEN", "")
        influx_org = os.getenv("INFLUX_ORG", "fitsense")
        bucket_raw = os.getenv("INFLUX_BUCKET", "heartrate")
        bucket_agg = os.getenv("INFLUX_BUCKET_AGGREGATED", "heartrate_aggregated")

        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        cutoff_str = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")

        flux_query = f"""
            from(bucket: "{bucket_raw}")
              |> range(start: 1970-01-01T00:00:00Z, stop: {cutoff_str})
              |> filter(fn: (r) => r["_measurement"] == "hr_data")
              |> filter(fn: (r) => r["_field"] == "hr")
              |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
              |> yield(name: "downsampled")
        """

        client = InfluxDBClient(url=influx_url, token=influx_token, org=influx_org)
        query_api = client.query_api()
        write_api = client.write_api(write_options=SYNCHRONOUS)

        tables = query_api.query(flux_query)
        points_processed = 0

        from influxdb_client import Point
        for table in tables:
            for record in table.records:
                point = (
                    Point("hr_data_aggregated")
                    .tag("club_id", record.values.get("club_id", ""))
                    .tag("user_id", record.values.get("user_id", ""))
                    .tag("session_id", record.values.get("session_id", ""))
                    .field("hr_mean", record.get_value())
                    .time(record.get_time())
                )
                write_api.write(bucket=bucket_agg, record=point)
                points_processed += 1

        client.close()
        elapsed = time.time() - start_time
        logger.info(
            "[downsampling] Completed: %d data points processed in %.2f seconds",
            points_processed, elapsed
        )

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error("[downsampling] Failed after %.2f seconds: %s", elapsed, str(e))


def start_downsampling_scheduler() -> None:
    """Start APScheduler to run downsampling daily at 02:00 UTC."""
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run_downsampling, "cron", hour=2, minute=0, id="daily_downsampling")
    scheduler.start()
    logger.info("[downsampling] Scheduler started — runs daily at 02:00 UTC")
