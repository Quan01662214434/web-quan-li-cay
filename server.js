// =======================================================
// 🌿 THANH HUYỀN FARM - SERVER HOÀN CHỈNH + STAFF + LOG
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = "THANH_HUYỀN_FARM_SECRET_KEY";

// Frontend để QR trỏ về (Vercel)
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "https://thefram.site";

// =======================================================
// STATIC (cho chạy local, trên Render cũng không sao)
// =======================================================
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// =======================================================
// DB
// =======================================================
mongoose
  .connect(
    "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanhhuyen_farm_full2"
  )
  .then(() => console.log("✅ MongoDB đã kết nối"))
  .catch((err) => console.error("❌ Lỗi MongoDB:", err));

// =======================================================
// MODELS
// =======================================================

/**
 * User:
 * - owner: chủ vườn (farmRoot = chính nó)
 * - staff: nhân viên, thuộc 1 farmRoot (chủ vườn)
 */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["owner", "staff"], default: "owner" },
  farmName: String,
  farmRoot: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // chủ vườn gốc
});
const User = mongoose.model("User", userSchema);

const treeSchema = new mongoose.Schema(
  {
    numericId: Number, // ID số cố định (1,2,3...)
    name: String,
    species: String,
    area: String,
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Bình thường" },
    notes: String,
    imageURL: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // farmRoot
    qrCode: String,
    diseases: [String],
    yieldHistory: [
      {
        year: Number,
        quantity: Number,
      },
    ],
  },
  { timestamps: true }
);
const Tree = mongoose.model("Tree", treeSchema);

// Cấu hình hiển thị QR theo farmRoot
const displayConfigSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  showName: { type: Boolean, default: true },
  showSpecies: { type: Boolean, default: true },
  showArea: { type: Boolean, default: true },
  showLocation: { type: Boolean, default: true },
  showPlantDate: { type: Boolean, default: true },
  showImage: { type: Boolean, default: true },
  showCurrentHealth: { type: Boolean, default: true },
  showNotes: { type: Boolean, default: true },
  showDiseases: { type: Boolean, default: true },
  showYield: { type: Boolean, default: true },
  showOwnerName: { type: Boolean, default: true },
});
const DisplayConfig = mongoose.model("DisplayConfig", displayConfigSchema);

// Lịch sử hoạt động
const activitySchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // farmRoot
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
    tree: { type: mongoose.Schema.Types.ObjectId, ref: "Tree" },
    meta: Object,
  },
  { timestamps: true }
);
const Activity = mongoose.model("Activity", activitySchema);

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

// Lấy farmRoot từ user (chủ / nhân viên)
async function getFarmRoot(userId) {
  const u = await User.findById(userId);
  if (!u) return null;
  if (u.farmRoot) return u.farmRoot;
  return u._id;
}

async function getOrCreateDisplayConfig(ownerId) {
  let cfg = await DisplayConfig.findOne({ owner: ownerId });
  if (!cfg) {
    cfg = await DisplayConfig.create({ owner: ownerId });
  }
  return cfg;
}

async function logActivity({ farm, user, action, tree, meta }) {
  try {
    await Activity.create({ farm, user, action, tree, meta: meta || {} });
  } catch (err) {
    console.error("Lỗi logActivity:", err);
  }
}

// =======================================================
// AUTH
// =======================================================

// tạo user (dùng cho nội bộ)
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role, farmName } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      role: role || "owner",
      farmName,
    });
    res.status(201).json({ message: "Tạo user thành công", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không thể tạo user" });
  }
});

// login
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Sai tài khoản" });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Sai mật khẩu" });
  const token = generateToken(user);
  res.json({ token, user });
});

// seed/reset chủ vườn mặc định
app.get("/auth/seed-owner", async (req, res) => {
  try {
    const hashed = await bcrypt.hash("12345", 10);
    let user = await User.findOne({ username: "thanhhuyen" });

    if (!user) {
      user = await User.create({
        username: "thanhhuyen",
        password: hashed,
        role: "owner",
        farmName: "Vườn sầu riêng Thanh Huyền",
      });
      // chủ vườn gốc: farmRoot = chính nó
      user.farmRoot = user._id;
      await user.save();
      return res.json({
        message: "✅ Đã TẠO tài khoản chủ vườn mặc định",
        username: "thanhhuyen",
        password: "12345",
      });
    } else {
      user.password = hashed;
      user.role = "owner";
      user.farmName = user.farmName || "Vườn sầu riêng Thanh Huyền";
      user.farmRoot = user._id;
      await user.save();
      return res.json({
        message: "✅ ĐÃ RESET mật khẩu tài khoản 'thanhhuyen' về 12345",
        username: "thanhhuyen",
        password: "12345",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tạo/reset tài khoản mặc định" });
  }
});

// =======================================================
// STAFF MANAGEMENT (chỉ chủ vườn dùng)
// =======================================================

// lấy danh sách nhân viên của farm
app.get("/api/staff", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  // chỉ cho chủ xem danh sách
  if (String(user._id) !== String(farmRoot) || user.role !== "owner") {
    return res.status(403).json({ error: "Chỉ chủ vườn mới xem được nhân viên" });
  }

  const staff = await User.find({
    role: "staff",
    farmRoot,
  }).select("-password");
  res.json(staff);
});

// tạo nhân viên
app.post("/api/staff", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  // chỉ chủ mới tạo nhân viên
  if (String(user._id) !== String(farmRoot) || user.role !== "owner") {
    return res.status(403).json({ error: "Chỉ chủ vườn mới tạo nhân viên" });
  }

  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Thiếu username hoặc password" });

    const existed = await User.findOne({ username });
    if (existed)
      return res.status(400).json({ error: "Username đã tồn tại" });

    const hashed = await bcrypt.hash(password, 10);
    const staff = await User.create({
      username,
      password: hashed,
      role: "staff",
      farmName: user.farmName,
      farmRoot,
    });

    await logActivity({
      farm: farmRoot,
      user: user._id,
      action: `Tạo nhân viên mới: ${username}`,
      meta: {},
    });

    res.status(201).json({
      message: "Đã tạo nhân viên",
      staff: { _id: staff._id, username: staff.username, role: staff.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không thể tạo nhân viên" });
  }
});

// xoá nhân viên
app.delete("/api/staff/:id", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  if (String(user._id) !== String(farmRoot) || user.role !== "owner") {
    return res.status(403).json({ error: "Chỉ chủ vườn mới xoá nhân viên" });
  }

  const staffId = req.params.id;
  const staff = await User.findById(staffId);
  if (!staff) return res.status(404).json({ error: "Không tìm thấy user" });

  if (staff.role !== "staff")
    return res.status(400).json({ error: "Không phải nhân viên" });

  if (String(staff.farmRoot) !== String(farmRoot))
    return res.status(403).json({ error: "Không thuộc vườn này" });

  await User.deleteOne({ _id: staff._id });

  await logActivity({
    farm: farmRoot,
    user: user._id,
    action: `Xoá nhân viên: ${staff.username}`,
    meta: {},
  });

  res.json({ message: "Đã xoá nhân viên" });
});

// =======================================================
// DISPLAY CONFIG
// =======================================================
app.get("/api/display-config", authMiddleware, async (req, res) => {
  try {
    const farmRoot = await getFarmRoot(req.user.id);
    const cfg = await getOrCreateDisplayConfig(farmRoot);
    res.json(cfg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không lấy được cấu hình hiển thị" });
  }
});

app.patch("/api/display-config", authMiddleware, async (req, res) => {
  try {
    const farmRoot = await getFarmRoot(req.user.id);
    const cfg = await getOrCreateDisplayConfig(farmRoot);

    const fields = [
      "showName",
      "showSpecies",
      "showArea",
      "showLocation",
      "showPlantDate",
      "showImage",
      "showCurrentHealth",
      "showNotes",
      "showDiseases",
      "showYield",
      "showOwnerName",
    ];

    fields.forEach((f) => {
      if (typeof req.body[f] === "boolean") cfg[f] = req.body[f];
    });

    await cfg.save();
    res.json(cfg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không cập nhật được cấu hình hiển thị" });
  }
});

// =======================================================
// TREES
// =======================================================

// Danh sách cây theo farmRoot (chủ + nhân viên đều thấy)
app.get("/api/trees", authMiddleware, async (req, res) => {
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  const trees = await Tree.find({ owner: farmRoot }).sort({ createdAt: -1 });
  res.json(trees);
});

// Tạo cây mới
app.post("/api/trees", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const farmRoot = await getFarmRoot(req.user.id);
    if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

    const lastTree = await Tree.findOne({ owner: farmRoot }).sort({
      numericId: -1,
    });
    const numericId = lastTree ? lastTree.numericId + 1 : 1;

    const { name, species, area, location, plantDate, imageURL } = req.body;

    const qrUrl = `${FRONTEND_BASE_URL}/public.html?id=${numericId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    const tree = await Tree.create({
      numericId,
      name,
      species,
      area,
      location,
      plantDate,
      imageURL,
      owner: farmRoot,
      qrCode: qrCodeDataUrl,
      currentHealth: "Bình thường",
      notes: "",
      diseases: [],
      yieldHistory: [],
    });

    await logActivity({
      farm: farmRoot,
      user: user._id,
      action: `Tạo cây mới #${numericId} – ${name}`,
      tree: tree._id,
      meta: {},
    });

    res.json({ message: "Đã tạo cây mới", tree });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không thể tạo cây" });
  }
});

// Cập nhật tình trạng & ghi chú
app.patch("/api/trees/:id/health", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { currentHealth, notes } = req.body;
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  if (String(tree.owner) !== String(farmRoot))
    return res.status(403).json({ error: "Không có quyền" });

  tree.currentHealth = currentHealth || tree.currentHealth;
  tree.notes = notes ?? tree.notes;
  await tree.save();

  await logActivity({
    farm: farmRoot,
    user: req.user.id,
    action: `Cập nhật tình trạng cây #${tree.numericId}`,
    tree: tree._id,
    meta: { currentHealth: tree.currentHealth },
  });

  res.json(tree);
});

// Cập nhật bệnh
app.patch("/api/trees/:id/diseases", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { diseases } = req.body;
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  if (String(tree.owner) !== String(farmRoot))
    return res.status(403).json({ error: "Không có quyền" });

  tree.diseases = diseases || [];
  await tree.save();

  await logActivity({
    farm: farmRoot,
    user: req.user.id,
    action: `Cập nhật bệnh cây #${tree.numericId}`,
    tree: tree._id,
    meta: { diseases: tree.diseases },
  });

  res.json(tree);
});

// Cập nhật năng suất
app.post("/api/trees/:id/yield", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { year, quantity } = req.body;
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  if (String(tree.owner) !== String(farmRoot))
    return res.status(403).json({ error: "Không có quyền" });

  const y = parseInt(year);
  const q = parseFloat(quantity);
  if (!y || !q) return res.status(400).json({ error: "Thiếu dữ liệu" });

  const idx = tree.yieldHistory.findIndex((i) => i.year === y);
  if (idx >= 0) tree.yieldHistory[idx].quantity = q;
  else tree.yieldHistory.push({ year: y, quantity: q });

  tree.yieldHistory.sort((a, b) => a.year - b.year);
  await tree.save();

  await logActivity({
    farm: farmRoot,
    user: req.user.id,
    action: `Cập nhật năng suất cây #${tree.numericId}`,
    tree: tree._id,
    meta: { year: y, quantity: q },
  });

  res.json(tree);
});

// =======================================================
// ACTIVITY LOG (chỉ chủ vườn xem)
// =======================================================
app.get("/api/activity", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  const farmRoot = await getFarmRoot(req.user.id);
  if (!farmRoot) return res.status(400).json({ error: "Không tìm thấy farm" });

  // ❗ chỉ chủ vườn gốc mới xem được
  if (String(user._id) !== String(farmRoot) || user.role !== "owner") {
    return res.status(403).json({ error: "Chỉ chủ vườn mới xem lịch sử" });
  }

  const logs = await Activity.find({ farm: farmRoot })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("user", "username role")
    .populate("tree", "numericId name");

  res.json(
    logs.map((l) => ({
      id: l._id,
      user: l.user ? l.user.username : "N/A",
      role: l.user ? l.user.role : "",
      action: l.action,
      tree:
        l.tree && l.tree.numericId
          ? `#${l.tree.numericId} – ${l.tree.name || ""}`
          : null,
      meta: l.meta || {},
      at: l.createdAt,
    }))
  );
});

// =======================================================
// PUBLIC API CHO QR (JSON cho public.html)
// =======================================================
app.get("/public/tree/:numericId", async (req, res) => {
  const numericId = parseInt(req.params.numericId, 10);
  if (!numericId)
    return res.status(400).json({ error: "ID không hợp lệ" });

  const tree = await Tree.findOne({ numericId }).populate(
    "owner",
    "farmName username _id"
  );
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  let displayConfig = null;
  if (tree.owner && tree.owner._id) {
    displayConfig = await getOrCreateDisplayConfig(tree.owner._id);
  }

  res.json({
    tree,
    displayConfig,
  });
});

// =======================================================
// START SERVER
// =======================================================
app.listen(PORT, () =>
  console.log(`🌿 Server chạy tại http://localhost:${PORT}`)
);
