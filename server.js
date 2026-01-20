// ===============================
// SERVER – FARM QR MANAGER
// Safe upgrade – NO DATA LOSS
// ===============================
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

/* ===============================
   MONGODB
   =============================== */
mongoose.connect(process.env.MONGO_URI, {
  autoIndex: true,
}).then(() => console.log("✅ MongoDB connected"));

/* ===============================
   SCHEMAS (KHÔNG ĐỔI FIELD)
   =============================== */
const TreeSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({}, { strict: false });
const DisplayConfigSchema = new mongoose.Schema({}, { strict: false });
const ActivitySchema = new mongoose.Schema({}, { strict: false });

const Tree = mongoose.model("Tree", TreeSchema);
const User = mongoose.model("User", UserSchema);
const DisplayConfig = mongoose.model("DisplayConfig", DisplayConfigSchema);
const Activity = mongoose.model("Activity", ActivitySchema);

/* ===============================
   AUTH MIDDLEWARE
   =============================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===============================
   LOGIN
   =============================== */
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });

  const token = jwt.sign(
    { id: user._id, role: user.role, farmId: user.farmId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: {
      username: user.username,
      role: user.role,
      farmName: user.farmName,
    },
  });
});

/* ===============================
   TREE CRUD (SAFE)
   =============================== */
app.get("/api/trees", auth, async (req, res) => {
  const trees = await Tree.find({ farmId: req.user.farmId }).sort({ numericId: 1 });
  res.json(trees);
});

app.post("/api/trees", auth, async (req, res) => {
  const count = await Tree.countDocuments({ farmId: req.user.farmId });
  const tree = await Tree.create({
    ...req.body,
    farmId: req.user.farmId,
    numericId: count + 1,
    createdAt: new Date(),
  });

  res.json(tree);
});

app.patch("/api/trees/:id", auth, async (req, res) => {
  const tree = await Tree.findOneAndUpdate(
    { _id: req.params.id, farmId: req.user.farmId },
    req.body,
    { new: true }
  );
  res.json(tree);
});

app.delete("/api/trees/:id", auth, async (req, res) => {
  await Tree.deleteOne({ _id: req.params.id, farmId: req.user.farmId });
  res.json({ ok: true });
});

/* ===============================
   HEALTH / DISEASE / YIELD
   =============================== */
app.patch("/api/trees/:id/health", auth, async (req, res) => {
  const tree = await Tree.findOneAndUpdate(
    { _id: req.params.id, farmId: req.user.farmId },
    {
      currentHealth: req.body.currentHealth,
      notes: req.body.notes,
      updatedAt: new Date(),
    },
    { new: true }
  );
  res.json(tree);
});

app.patch("/api/trees/:id/diseases", auth, async (req, res) => {
  const tree = await Tree.findOneAndUpdate(
    { _id: req.params.id, farmId: req.user.farmId },
    { diseases: req.body.diseases, updatedAt: new Date() },
    { new: true }
  );
  res.json(tree);
});

app.post("/api/trees/:id/yield", auth, async (req, res) => {
  const tree = await Tree.findOne({ _id: req.params.id, farmId: req.user.farmId });
  tree.yieldHistory = tree.yieldHistory || [];
  tree.yieldHistory.push({
    year: req.body.year,
    quantity: req.body.quantity,
  });
  tree.updatedAt = new Date();
  await tree.save();
  res.json(tree);
});

/* ===============================
   DISPLAY CONFIG (PER FARM)
   =============================== */
app.get("/api/display-config", auth, async (req, res) => {
  const cfg = await DisplayConfig.findOne({ farmId: req.user.farmId }) || {};
  res.json(cfg);
});

app.patch("/api/display-config", auth, async (req, res) => {
  const cfg = await DisplayConfig.findOneAndUpdate(
    { farmId: req.user.farmId },
    req.body,
    { upsert: true, new: true }
  );
  res.json(cfg);
});

/* ===============================
   PUBLIC QR – CỰC KỲ QUAN TRỌNG
   =============================== */
app.get("/public/tree/:treeId", async (req, res) => {
  const tree = await Tree.findById(req.params.treeId);
  if (!tree) return res.status(404).json({ error: "Tree not found" });

  const cfg = await DisplayConfig.findOne({ farmId: tree.farmId }) || {};
  const farmOwner = await User.findOne({ farmId: tree.farmId, role: "owner" });

  res.json({
    tree,
    displayConfig: cfg,
    farmName: farmOwner?.farmName || "Farm",
    farmVietGapCode: tree.vietGapCode || "",
    farmAddress: farmOwner?.farmAddress || "",
  });
});

/* ===============================
   SERVER START
   =============================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
