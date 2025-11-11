// =======================================================
// 🌿 THANH HUYỀN FARM - SERVER 4.0
// =======================================================
import express from "express";
import mongoose from "mongoose";
import QRCode from "qrcode";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Để dùng __dirname trong ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = "THANH_HUYÊN_FARM_SECRET_KEY";
// URL dùng để nhúng vào QR => trỏ đến trang public HTML
const PUBLIC_BASE_URL = `http://localhost:${PORT}/public`;

// =======================================================
// SERVE FRONTEND (index.html, public.html, css...)
// =======================================================
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Route HTML cho QR: /public/123 => mở public.html (JS sẽ gọi API để lấy dữ liệu)
app.get("/public/:numericId", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "public.html"));
});

// =======================================================
// DATABASE
// =======================================================
mongoose
  .connect(
    "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanhhuyen_farm4"
  )
  .then(() => console.log("✅ MongoDB đã kết nối"))
  .catch((err) => console.error("❌ Lỗi MongoDB:", err));

// =======================================================
// MONGOOSE MODELS
// =======================================================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ["owner", "staff"], default: "staff" },
  farmName: String, // tên vườn
  farmOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // chủ vườn nếu là staff
});
const User = mongoose.model("User", userSchema);

const treeSchema = new mongoose.Schema(
  {
    numericId: Number, // ID số cố định
    name: String,
    species: String,
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Bình thường" },
    notes: String,
    imageURL: String, // ảnh đại diện cây
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // chủ vườn
    qrCode: String, // ảnh QR base64
    diseases: [String],
    yieldHistory: [
      {
        year: Number,
        quantity: Number, // kg
      },
    ],
  },
  { timestamps: true }
);
const Tree = mongoose.model("Tree", treeSchema);

const activityLogSchema = new mongoose.Schema(
  {
    tree: { type: mongoose.Schema.Types.ObjectId, ref: "Tree" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    action: String,
    details: String,
  },
  { timestamps: true }
);
const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

// =======================================================
// UTILS
// =======================================================
function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "Chưa đăng nhập hoặc thiếu token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token không hợp lệ" });
  }
}

async function logActivity({ tree, user, username, action, details }) {
  try {
    await ActivityLog.create({ tree, user, username, action, details });
  } catch (err) {
    console.error("❌ Lỗi ghi log:", err);
  }
}

// =======================================================
// AUTH
// =======================================================
// Tạo user (dùng để tạo chủ vườn / nhân viên)
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role, farmName, farmOwner } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      role,
      farmName,
      farmOwner,
    });
    res.status(201).json({ message: "Tạo user thành công", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không thể tạo user" });
  }
});

// Đăng nhập
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Sai tài khoản" });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Sai mật khẩu" });
  const token = generateToken(user);
  res.json({ token, user });
});

// =======================================================
// TREES
// =======================================================
// Lấy danh sách cây (tùy theo role)
app.get("/api/trees", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  let trees = [];
  if (user.role === "owner") {
    trees = await Tree.find({ owner: user._id }).sort({ createdAt: -1 });
  } else {
    trees = await Tree.find({ owner: user.farmOwner }).sort({ createdAt: -1 });
  }
  res.json(trees);
});

// Tạo cây mới (ID số + QR cố định)
app.post("/api/trees", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (user.role !== "owner")
    return res.status(403).json({ error: "Chỉ chủ vườn được thêm cây" });

  const lastTree = await Tree.findOne({}).sort({ numericId: -1 });
  const numericId = lastTree ? lastTree.numericId + 1 : 1;

  const { name, species, location, plantDate, imageURL } = req.body;

  // Link QR: http://localhost:4000/public/123
  const qrUrl = `${PUBLIC_BASE_URL}/${numericId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

  const tree = await Tree.create({
    numericId,
    name,
    species,
    location,
    plantDate,
    imageURL,
    owner: user._id,
    qrCode: qrCodeDataUrl,
  });

  res.json({ message: "Đã tạo cây mới", tree });
});

// Cập nhật thông tin cây
app.patch("/api/trees/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  const user = await User.findById(req.user.id);
  const canEdit =
    (user.role === "owner" && tree.owner.toString() === user._id.toString()) ||
    (user.role === "staff" &&
      user.farmOwner?.toString() === tree.owner.toString());
  if (!canEdit)
    return res.status(403).json({ error: "Không có quyền chỉnh sửa cây" });

  Object.assign(tree, req.body);
  await tree.save();

  await logActivity({
    tree: tree._id,
    user: user._id,
    username: user.username,
    action: "UPDATE_INFO",
    details: "Cập nhật thông tin cây",
  });

  res.json(tree);
});

// Cập nhật tình trạng & ghi chú
app.patch("/api/trees/:id/health", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { currentHealth, notes } = req.body;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  const user = await User.findById(req.user.id);
  const canEdit =
    (user.role === "owner" && tree.owner.toString() === user._id.toString()) ||
    (user.role === "staff" &&
      user.farmOwner?.toString() === tree.owner.toString());
  if (!canEdit)
    return res.status(403).json({ error: "Không có quyền chỉnh sửa" });

  tree.currentHealth = currentHealth || tree.currentHealth;
  tree.notes = notes || tree.notes;
  await tree.save();

  await logActivity({
    tree: tree._id,
    user: user._id,
    username: user.username,
    action: "UPDATE_HEALTH",
    details: "Cập nhật tình trạng / ghi chú cây",
  });

  res.json(tree);
});

// Cập nhật bệnh
app.patch("/api/trees/:id/diseases", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { diseases } = req.body;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  const user = await User.findById(req.user.id);
  const canEdit =
    (user.role === "owner" && tree.owner.toString() === user._id.toString()) ||
    (user.role === "staff" &&
      user.farmOwner?.toString() === tree.owner.toString());
  if (!canEdit)
    return res.status(403).json({ error: "Không có quyền chỉnh sửa" });

  tree.diseases = diseases;
  await tree.save();

  await logActivity({
    tree: tree._id,
    user: user._id,
    username: user.username,
    action: "UPDATE_DISEASES",
    details: "Cập nhật danh sách bệnh",
  });

  res.json(tree);
});

// Cập nhật năng suất
app.post("/api/trees/:id/yield", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { year, quantity } = req.body;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  const user = await User.findById(req.user.id);
  const canEdit =
    (user.role === "owner" && tree.owner.toString() === user._id.toString()) ||
    (user.role === "staff" &&
      user.farmOwner?.toString() === tree.owner.toString());
  if (!canEdit)
    return res.status(403).json({ error: "Không có quyền chỉnh sửa" });

  const y = parseInt(year);
  const q = parseFloat(quantity);
  if (!y || !q) return res.status(400).json({ error: "Thiếu dữ liệu" });

  const idx = tree.yieldHistory.findIndex((item) => item.year === y);
  if (idx >= 0) tree.yieldHistory[idx].quantity = q;
  else tree.yieldHistory.push({ year: y, quantity: q });

  tree.yieldHistory.sort((a, b) => a.year - b.year);
  await tree.save();

  await logActivity({
    tree: tree._id,
    user: user._id,
    username: user.username,
    action: "UPDATE_YIELD",
    details: `Cập nhật năng suất năm ${year}: ${quantity}kg`,
  });

  res.json(tree);
});

// Lịch sử hoạt động
app.get("/api/trees/:id/logs", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const logs = await ActivityLog.find({ tree: id })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(logs);
});

// =======================================================
// PUBLIC API CHO QR (JSON)
// =======================================================
app.get("/public/tree/:numericId", async (req, res) => {
  const numericId = parseInt(req.params.numericId);
  const tree = await Tree.findOne({ numericId }).populate(
    "owner",
    "username farmName"
  );
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  res.json(tree);
});

// =======================================================
app.listen(PORT, () =>
  console.log(`🌿 Server Thanh Huyền Farm 4.0 chạy tại http://localhost:${PORT}`)
);
