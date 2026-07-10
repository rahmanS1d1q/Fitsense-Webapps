import app from "./app";
import { config } from "./config";
import { startDownsamplingJob } from "./services/downsampling.job";
import { startMqttConsumer } from "./services/mqtt.consumer";

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[API] FitSense API Server running on port ${PORT}`);

  // Start MQTT Consumer — non-blocking, errors handled inside startMqttConsumer.
  // API remains fully functional even if MQTT broker is temporarily unavailable.
  // The consumer will auto-reconnect every 5s (reconnectPeriod in mqtt.consumer.ts).
  console.log("[API] Starting MQTT consumer...");
  startMqttConsumer();

  // Start downsampling cron job (InfluxDB aggregation, runs daily at 02:00 UTC)
  startDownsamplingJob();
});

export default app;
