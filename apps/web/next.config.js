/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // diperlukan untuk Docker deployment
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MQTT_URL: process.env.NEXT_PUBLIC_MQTT_URL,
  },
};

module.exports = nextConfig;
