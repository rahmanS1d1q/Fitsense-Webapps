import app from "./app";
import { config } from "./config";

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[API] FitSense API Server running on port ${PORT}`);
});

export default app;
