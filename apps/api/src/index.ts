import app from "./app";
import { config } from "./config";
import { startDownsamplingJob } from "./services/downsampling.job";

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[API] FitSense API Server running on port ${PORT}`);
  startDownsamplingJob();
});

export default app;
