const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* =====================
   KẾT NỐI MONGODB
===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* =====================
   SCHEMA
===================== */
const TreeSchema = new mongoose.Schema(
  {
    name: String,
    species: String,
    area: String,
    location: String,
    plantDate: Date,
    imageURL: String,
    qrCode: String,
    currentHealth: String,
    diseases: [String],
    notes: String,
    yieldHistory: Array,
    extraFields: Array,

    // multi farm (cây cũ có thể chưa có)
    farmId: String,
  },
  { timestamps: true }
);

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String, // owner | staff
  farmId: String,
});

const Tree = mongoose.model("Tree", TreeSchema);
const User = mongoose.model("User", UserSchema);

/* =====================
   AUTH MIDDLEWARE
===================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

/* =====================
   LOGIN
===================== */
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ message: "Sai tài khoản" });

  const token = jwt.sign(
    { id: user._id, role: user.role, farmId: user.farmId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    role: user.role,
    farmId: user.farmId,
  });
});

/* =====================
   🔧 FIX HIỂN THỊ CÂY CŨ
===================== */
app.get("/api/trees", auth, async (req, res) => {
  try {
    const trees = await Tree.find({
      $or: [
        { farmId: req.user.farmId },   // cây mới
        { farmId: { $exists: false } } // 👈 CÂY CŨ KHÔNG BỊ MẤT
      ],
    }).sort({ createdAt: -1 });

    res.json(trees);
  } catch (e) {
    res.status(500).json({ message: "Lỗi lấy cây" });
  }
});

/* =====================
   THÊM CÂY
===================== */
app.post("/api/trees", auth, async (req, res) => {
  const tree = new Tree({
    ...req.body,
    farmId: req.user.farmId, // cây mới gán farmId
  });

  await tree.save();
  res.json(tree);
});

/* =====================
   QR PUBLIC
===================== */
app.get("/public/tree/:id", async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) return res.status(404).json({ message: "Không tìm thấy cây" });

  res.json({ tree });
});

/* =====================
   NHÂN VIÊN
===================== */
app.post("/api/staff", auth, async (req, res) => {
  if (req.user.role !== "owner")
    return res.status(403).json({ message: "Không có quyền" });

  const staff = new User({
    ...req.body,
    role: "staff",
    farmId: req.user.farmId,
  });

  await staff.save();
  res.json(staff);
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
