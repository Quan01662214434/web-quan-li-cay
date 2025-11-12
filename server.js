// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");

const app = express();

// CORS – cho phép frontend truy cập
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// KẾT NỐI MONGODB
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanh-huyen-farm";

mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log("✅ Đã kết nối MongoDB"))
  .catch((err) => {
    console.error("Lỗi MongoDB:", err);
    process.exit(1);
  });

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_for_thanh_huyen";

// ===================
//  SCHEMAS & MODELS
// ===================

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["owner", "staff"], default: "owner" },
    farmName: { type: String, default: "Thanh Huyền Farm" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // với staff: tham chiếu owner
  },
  { timestamps: true }
);

const treeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    numericId: { type: Number, required: true },
    name: { type: String, required: true },
    species: String,
    area: String,
    location: String,
    acreage: String,            // ✅ Diện tích (m²/ha) dạng text cho linh hoạt
    plantDate: Date,
    imageURL: String,
    vietGapCode: String,
    currentHealth: String,
    notes: String,
    diseases: [String],
    yieldHistory: [{ year: Number, quantity: Number }],
    qrCode: String,             // dataURL QR
  },
  { timestamps: true }
);

const displayConfigSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    showName: { type: Boolean, default: true },
    showSpecies: { type: Boolean, default: true },
    showArea: { type: Boolean, default: true },
    showLocation: { type: Boolean, default: true },
    showAcreage: { type: Boolean, default: true },  // ✅ hiển thị Diện tích
    showPlantDate: { type: Boolean, default: true },
    showVietGap: { type: Boolean, default: true },
    showImage: { type: Boolean, default: true },
    showCurrentHealth: { type: Boolean, default: true },
    showNotes: { type: Boolean, default: true },
    showDiseases: { type: Boolean, default: true },
    showYield: { type: Boolean, default: true },
    showOwnerName: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    user: String,
    role: String,
    action: String,
    tree: String,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Tree = mongoose.model("Tree", treeSchema);
const DisplayConfig = mongoose.model("DisplayConfig", displayConfigSchema);
const Activity = mongoose.model("Activity", activitySchema);

// ===================
//  MIDDLEWARE AUTH
// ===================

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Thiếu token" });
  const parts = header.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "Token không hợp lệ" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username, role, farmName }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token hết hạn hoặc không hợp lệ" });
  }
}

// Ghi lịch sử
async function logActivity({ ownerId, user, role, action, tree }) {
  try {
    await Activity.create({ owner: ownerId, user, role, action, tree });
  } catch (err) {
    console.error("Lỗi ghi activity:", err);
  }
}

// ===================
//  AUTH
// ===================

app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role, farmName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu username hoặc password" });
    }
    const exist = await User.findOne({ username });
    if (exist) return res.status(400).json({ error: "Tài khoản đã tồn tại" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash: hash,
      role: role === "staff" ? "staff" : "owner",
      farmName: farmName || "Thanh Huyền Farm",
    });

    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        farmName: user.farmName,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Đã tạo user",
      user: { id: user._id, username: user.username, role: user.role, farmName: user.farmName },
      token,
    });
  } catch (err) {
    console.error("Lỗi register:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });

    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        farmName: user.farmName,
        ownerId: user.role === "staff" && user.owner ? user.owner : user._id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role, farmName: user.farmName },
    });
  } catch (err) {
    console.error("Lỗi login:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
//  TREES API
// ===================

async function getOwnerIdFromUser(userPayload) {
  if (userPayload.role === "staff") {
    const staff = await User.findById(userPayload.id);
    return staff.owner;
  }
  return userPayload.id;
}

app.get("/api/trees", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const trees = await Tree.find({ owner: ownerId }).sort({ numericId: 1 }).lean();
    res.json(trees);
  } catch (err) {
    console.error("Lỗi get /api/trees:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/api/trees", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const {
      name, species, area, location, acreage, plantDate, imageURL, vietGapCode
    } = req.body;

    if (!name) return res.status(400).json({ error: "Tên cây là bắt buộc" });

    const lastTree = await Tree.findOne({ owner: ownerId }).sort({ numericId: -1 }).lean();
    const nextNumericId = lastTree ? (lastTree.numericId || 0) + 1 : 1;

    const tree = await Tree.create({
      owner: ownerId,
      numericId: nextNumericId,
      name,
      species,
      area,
      location,
      acreage: acreage || "",         // ✅
      plantDate: plantDate || null,
      imageURL,
      vietGapCode,
      currentHealth: "Bình thường",
      notes: "",
      diseases: [],
      yieldHistory: [],
    });

    const publicUrl =
      process.env.PUBLIC_QR_URL || "https://thefram.site/public.html";
    const qrTarget = `${publicUrl}?treeId=${tree._id.toString()}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrTarget, { margin: 1, scale: 6 });

    tree.qrCode = qrCodeDataUrl;
    await tree.save();

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Tạo cây mới #${tree.numericId} – ${tree.name}`,
      tree: tree.name,
    });

    res.status(201).json(tree);
  } catch (err) {
    console.error("Lỗi POST /api/trees:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.patch("/api/trees/:id", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const { id } = req.params;
    const { location, acreage, plantDate, vietGapCode } = req.body;

    const tree = await Tree.findOne({ _id: id, owner: ownerId });
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    if (location !== undefined) tree.location = location;
    if (acreage !== undefined) tree.acreage = acreage; // ✅
    if (plantDate !== undefined) tree.plantDate = plantDate || null;
    if (vietGapCode !== undefined) tree.vietGapCode = vietGapCode;

    await tree.save();

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Chỉnh thông tin cây #${tree.numericId}`,
      tree: tree.name,
    });

    res.json(tree);
  } catch (err) {
    console.error("Lỗi PATCH /api/trees/:id", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.delete("/api/trees/:id", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const { id } = req.params;

    const tree = await Tree.findOneAndDelete({ _id: id, owner: ownerId });
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Xoá cây #${tree.numericId} – ${tree.name}`,
      tree: tree.name,
    });

    res.json({ message: "Đã xoá cây" });
  } catch (err) {
    console.error("Lỗi DELETE /api/trees/:id", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.patch("/api/trees/:id/health", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const { id } = req.params;
    const { currentHealth, notes } = req.body;

    const tree = await Tree.findOne({ _id: id, owner: ownerId });
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    tree.currentHealth = currentHealth;
    tree.notes = notes;
    await tree.save();

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Cập nhật tình trạng: ${currentHealth}`,
      tree: tree.name,
    });

    res.json(tree);
  } catch (err) {
    console.error("Lỗi PATCH /api/trees/:id/health", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.patch("/api/trees/:id/diseases", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const { id } = req.params;
    const { diseases } = req.body;

    const tree = await Tree.findOne({ _id: id, owner: ownerId });
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    tree.diseases = Array.isArray(diseases) ? diseases : [];
    await tree.save();

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Cập nhật bệnh: ${(tree.diseases || []).join(", ")}`,
      tree: tree.name,
    });

    res.json(tree);
  } catch (err) {
    console.error("Lỗi PATCH /api/trees/:id/diseases", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/api/trees/:id/yield", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const { id } = req.params;
    const { year, quantity } = req.body;

    const tree = await Tree.findOne({ _id: id, owner: ownerId });
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    const existing = tree.yieldHistory.find((y) => y.year === Number(year));
    if (existing) existing.quantity = Number(quantity);
    else tree.yieldHistory.push({ year: Number(year), quantity: Number(quantity) });

    await tree.save();

    await logActivity({
      ownerId,
      user: req.user.username,
      role: req.user.role,
      action: `Cập nhật năng suất năm ${year}: ${quantity}kg`,
      tree: tree.name,
    });

    res.json(tree);
  } catch (err) {
    console.error("Lỗi POST /api/trees/:id/yield", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
// DISPLAY CONFIG
// ===================

app.get("/api/display-config", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    let cfg = await DisplayConfig.findOne({ owner: ownerId }).lean();
    if (!cfg) cfg = await DisplayConfig.create({ owner: ownerId });
    res.json(cfg);
  } catch (err) {
    console.error("Lỗi GET /api/display-config", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.patch("/api/display-config", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const update = {};
    const allowed = [
      "showName",
      "showSpecies",
      "showArea",
      "showLocation",
      "showAcreage",     // ✅
      "showPlantDate",
      "showVietGap",
      "showImage",
      "showCurrentHealth",
      "showNotes",
      "showDiseases",
      "showYield",
      "showOwnerName",
    ];
    allowed.forEach((key) => {
      if (typeof req.body[key] === "boolean") update[key] = req.body[key];
    });
    const cfg = await DisplayConfig.findOneAndUpdate(
      { owner: ownerId },
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    res.json(cfg);
  } catch (err) {
    console.error("Lỗi PATCH /api/display-config", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
// STAFF
// ===================

app.get("/api/staff", auth, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Chỉ chủ vườn mới xem được" });
    }
    const staff = await User.find({ owner: req.user.id, role: "staff" })
      .select("_id username role")
      .lean();
    res.json(staff);
  } catch (err) {
    console.error("Lỗi GET /api/staff", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/api/staff", auth, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Chỉ chủ vườn mới tạo nhân viên" });
    }
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Thiếu username hoặc password" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Tài khoản đã tồn tại" });

    const hash = await bcrypt.hash(password, 10);
    const staff = await User.create({
      username,
      passwordHash: hash,
      role: "staff",
      farmName: req.user.farmName,
      owner: req.user.id,
    });

    res.status(201).json({ id: staff._id, username: staff.username, role: staff.role });
  } catch (err) {
    console.error("Lỗi POST /api/staff", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.delete("/api/staff/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Chỉ chủ vườn mới xoá nhân viên" });
    }
    const { id } = req.params;
    const staff = await User.findOneAndDelete({
      _id: id,
      owner: req.user.id,
      role: "staff",
    });
    if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    res.json({ message: "Đã xoá nhân viên" });
  } catch (err) {
    console.error("Lỗi DELETE /api/staff/:id", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
// ACTIVITY
// ===================

app.get("/api/activity", auth, async (req, res) => {
  try {
    const ownerId = await getOwnerIdFromUser(req.user);
    const logs = await Activity.find({ owner: ownerId }).sort({ at: -1 }).limit(200).lean();
    res.json(logs);
  } catch (err) {
    console.error("Lỗi GET /api/activity", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
// PUBLIC QR VIEW API
// ===================

app.get("/public/tree/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tree = await Tree.findById(id).lean();
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    const display = await DisplayConfig.findOne({ owner: tree.owner }).lean();

    // Lấy mã VietGAP đại diện farm (dùng bất kỳ cây có vietGapCode)
    let farmVietGap = null;
    if (tree.vietGapCode) farmVietGap = tree.vietGapCode;
    else {
      const vgTree = await Tree.findOne({
        owner: tree.owner,
        vietGapCode: { $exists: true, $ne: "" },
      })
        .sort({ createdAt: 1 })
        .lean();
      farmVietGap = vgTree ? vgTree.vietGapCode : null;
    }

    res.json({
      tree,
      displayConfig: display || {},
      farmName: "Thanh Huyền Farm",
      farmVietGapCode: farmVietGap,
    });
  } catch (err) {
    console.error("Lỗi GET /public/tree/:id", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===================
// START
// ===================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("🚀 Server đang chạy ở cổng", PORT);
});
