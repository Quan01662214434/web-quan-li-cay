require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

/* ================== CORS – PHẢI ĐẶT TRÊN CÙNG ================== */
app.use(cors({
  origin: [
    "https://www.thefram.site",
    "https://thefram.site",
    "http://localhost:3000",
    "http://localhost:4000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ⚠️ RẤT QUAN TRỌNG cho preflight
app.options("*", cors());

/* ================== BODY PARSER ================== */
app.use(express.json());

/* ================== MONGODB ================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

/* ================== API ROUTES ================== */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/trees", require("./routes/trees"));
app.use("/api/users", require("./routes/users"));
app.use("/api/yield", require("./routes/yield"));
app.use("/api/qr-settings", require("./routes/qrSettings"));
app.use("/api/audit", require("./routes/audit"));

/* ================== FRONTEND ================== */
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

/* ================== START ================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
