"""
FitSense ML Service — Python + FastAPI
Requirements: 9.1, 12.1, 16.1
"""

import os
from fastapi import FastAPI
from routers import anomaly, recommendation, health
from services.downsampling import start_downsampling_scheduler

app = FastAPI(title="FitSense ML Service", version="1.0.0")

app.include_router(anomaly.router)
app.include_router(recommendation.router)
app.include_router(health.router)


@app.on_event("startup")
async def startup_event():
    start_downsampling_scheduler()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ML_SERVICE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
