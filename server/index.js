require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const storage = require("./services/storage");
const geminiWrapper = require("./services/geminiWrapper");
const analytics = require("./services/analytics");
const generateRoutes = require("./routes/generate");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve React build (production) or old frontend (fallback)
const clientDist = path.join(__dirname, "..", "client", "dist");
const oldFrontend = path.join(__dirname, "..", "frontend");
const fs = require("fs");
app.use(express.static(fs.existsSync(clientDist) ? clientDist : oldFrontend));

// Serve stored images
app.use("/storage", express.static(path.join(__dirname, "..", process.env.STORAGE_DIR || "storage")));

// API routes
app.use("/api", generateRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Server error:", err.message);
  res.status(err.status || 500).json({ error: err.message });
});

// Initialise services and start
storage.init();
geminiWrapper.init();
analytics.init();

app.listen(PORT, () => {
  console.log(`\n🚀 Product Visualization Engine running at http://localhost:${PORT}\n`);
});
