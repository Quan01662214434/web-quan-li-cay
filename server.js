// =======================================================
// 🌿 THANH HUYỀN FARM - SERVER HOÀN CHỈNH
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
const JWT_SECRET = "THANH_HUYEN_FARM_SECRET_KEY";

// =======================================================
// SERVE FRONTEND
// =======================================================
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// Trang public cho QR
app.get("/public/:numericId", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "public.html"));
});

// =======================================================
// DATABASE
// =======================================================
mongoose
  .connect(
    "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanhhuyen_farm_final"
  )
  .then(() => console.log("✅ MongoDB đã kết nối"))
  .catch((err) => console.error("❌ Lỗi MongoDB:", err));

// =======================================================
// MODELS
// =======================================================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ["owner", "staff"], default: "owner" },
  farmName: String,
});
const User = mongoose.model("User", userSchema);

const treeSchema = new mongoose.Schema(
  {
    numericId: Number, // ID số cố định
    name: String,
    species: String,
    area: String, // khu vực
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Bình thường" },
    notes: String,
    imageURL: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    qrCode: String,
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

// Cấu hình hiển thị QR
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

async function getOrCreateDisplayConfig(ownerId) {
  let cfg = await DisplayConfig.findOne({ owner: ownerId });
  if (!cfg) {
    cfg = await DisplayConfig.create({ owner: ownerId }); // dùng default
  }
  return cfg;
}

// =======================================================
// AUTH
// =======================================================

// Tạo user (có thể dùng sau này nếu muốn thêm nhân viên)
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

// Tạo hoặc reset tài khoản mặc định cho chủ vườn
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
      return res.json({
        message: "✅ Đã TẠO tài khoản chủ vườn mặc định",
        username: "thanhhuyen",
        password: "12345",
      });
    } else {
      user.password = hashed;
      user.role = "owner";
      user.farmName = user.farmName || "Vườn sầu riêng Thanh Huyền";
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
// CẤU HÌNH HIỂN THỊ QR
// =======================================================

// Lấy cấu hình
app.get("/api/display-config", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const cfg = await getOrCreateDisplayConfig(user._id);
    res.json(cfg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không lấy được cấu hình hiển thị" });
  }
});

// Cập nhật cấu hình
app.patch("/api/display-config", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const cfg = await getOrCreateDisplayConfig(user._id);

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
      if (typeof req.body[f] === "boolean") {
        cfg[f] = req.body[f];
      }
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

// Lấy danh sách cây của chủ vườn
app.get("/api/trees", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  const trees = await Tree.find({ owner: user._id }).sort({ createdAt: -1 });
  res.json(trees);
});

// Tạo cây mới + QR
app.post("/api/trees", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const lastTree = await Tree.findOne({ owner: user._id }).sort({
      numericId: -1,
    });
    const numericId = lastTree ? lastTree.numericId + 1 : 1;

    const { name, species, area, location, plantDate, imageURL } = req.body;

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const qrUrl = `${baseUrl}/public/${numericId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    const tree = await Tree.create({
      numericId,
      name,
      species,
      area,
      location,
      plantDate,
      imageURL,
      owner: user._id,
      qrCode: qrCodeDataUrl,
      currentHealth: "Bình thường",
      notes: "",
      diseases: [],
      yieldHistory: [],
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
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  if (tree.owner.toString() !== req.user.id)
    return res.status(403).json({ error: "Không có quyền" });

  tree.currentHealth = currentHealth || tree.currentHealth;
  tree.notes = notes || tree.notes;
  await tree.save();
  res.json(tree);
});

// Cập nhật bệnh
app.patch("/api/trees/:id/diseases", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { diseases } = req.body;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  if (tree.owner.toString() !== req.user.id)
    return res.status(403).json({ error: "Không có quyền" });

  tree.diseases = diseases || [];
  await tree.save();
  res.json(tree);
});

// Cập nhật năng suất
app.post("/api/trees/:id/yield", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { year, quantity } = req.body;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  if (tree.owner.toString() !== req.user.id)
    return res.status(403).json({ error: "Không có quyền" });

  const y = parseInt(year);
  const q = parseFloat(quantity);
  if (!y || !q) return res.status(400).json({ error: "Thiếu dữ liệu" });

  const idx = tree.yieldHistory.findIndex((i) => i.year === y);
  if (idx >= 0) tree.yieldHistory[idx].quantity = q;
  else tree.yieldHistory.push({ year: y, quantity: q });

  tree.yieldHistory.sort((a, b) => a.year - b.year);
  await tree.save();
  res.json(tree);
});

// =======================================================
// PUBLIC API CHO QR (JSON)
// =======================================================
app.get("/public/tree/:numericId", async (req, res) => {
  const numericId = parseInt(req.params.numericId);
  const tree = await Tree.findOne({ numericId }).populate(
    "owner",
    "farmName username"
  );
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

  let displayConfig = null;
  if (tree.owner?._id) {
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
