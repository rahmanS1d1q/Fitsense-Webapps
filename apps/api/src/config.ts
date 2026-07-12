import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.API_PORT || "3001", 10),

  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://fitsense:password@localhost:5432/fitsense",
  },

  influx: {
    url: process.env.INFLUX_URL || "http://localhost:8086",
    token: process.env.INFLUX_TOKEN || "",
    org: process.env.INFLUX_ORG || "fitsense",
    bucket: process.env.INFLUX_BUCKET || "heartrate",
    bucketAggregated:
      process.env.INFLUX_BUCKET_AGGREGATED || "heartrate_aggregated",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-min-32-chars-change-in-prod",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  mqtt: {
    tokenExpiresIn: process.env.MQTT_TOKEN_EXPIRES_IN || "30m",
    brokerInternal: process.env.MQTT_BROKER_INTERNAL || "mqtt://localhost:1883",
    internalUsername: process.env.MQTT_INTERNAL_USERNAME || "api_consumer",
    internalPassword: process.env.MQTT_INTERNAL_PASSWORD || "",
  },

  // ML Feature Flag
  // Set ML_ENABLED=true in .env only when the ML service is running and model is ready.
  // When disabled, the API still processes MQTT heart rate data and saves to InfluxDB;
  // it simply skips all calls to the ML anomaly-check endpoint.
  ml: {
    enabled: process.env.ML_ENABLED === "true",
    serviceUrl: process.env.ML_SERVICE_URL || "",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "FitSense <noreply@example.com>",
  },

  app: {
    domain: process.env.APP_DOMAIN || "localhost",
    corsOrigin: process.env.CORS_ORIGIN || "",
  },
};
