import app from "./app";
import { config } from "./config";
import { startDownsamplingJob } from "./services/downsampling.job";
import { startMqttConsumer } from "./services/mqtt.consumer";

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[API] FitSense API Server running on port ${PORT}`);

  // Start MQTT Consumer — non-blocking. startMqttConsumer() creates an async
  // MQTT client and returns immediately. API stays up even if EMQX is slow to
  // start; the consumer auto-reconnects every 5 s (reconnectPeriod).
  console.log("[API] Starting MQTT consumer...");
  startMqttConsumer();

  // Start downsampling cron job (InfluxDB aggregation, runs daily at 02:00 UTC)
  startDownsamplingJob();
});

export default app;
