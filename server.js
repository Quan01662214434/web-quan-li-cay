// server.js - API cho hệ thống quản lý vườn Thanh Huyền Smart Farm

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-change-me";

// URL frontend công khai, dùng để nhúng vào QR
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://thefram.site";

// ====== KẾT NỐI MONGODB ======
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/web-quan-li-cay?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB đã kết nối thành công"))
  .catch((err) => {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
  });

// ====== MIDDLEWARE ======
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json({ limit: "10mb" }));

// Serve frontend
app.use(express.static(path.join(__dirname, "frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ====== SCHEMA & MODEL ======

// Counter dùng để tạo numericId tăng dần cho cây
const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

async function getNextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

// User: admin / owner / staff
const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "owner", "staff"],
      default: "owner",
    },

    // Thông tin vườn (cho chủ vườn + theme)
    farmName: { type: String },
    farmLogo: { type: String },
    farmPrimaryColor: { type: String },

    // Với staff: thuộc chủ vườn nào
    farmOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Cây trong vườn
const treeSchema = new mongoose.Schema(
  {
    numericId: { type: Number, unique: true },
    name: { type: String, required: true },
    species: { type: String },
    location: { type: String },
    plantDate: { type: String },

    currentHealth: {
      type: String,
      enum: ["Tốt", "Bình thường", "Yếu", "Nguy hiểm"],
      default: "Bình thường",
    },
    notes: { type: String },

    qrCode: { type: String }, // dataURL base64 của QR (chứa URL)

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Tree = mongoose.model("Tree", treeSchema);

// ====== AUTH MIDDLEWARE ======
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Thiếu token. Vui lòng đăng nhập." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, farmName,... }
    next();
  } catch (err) {
    console.error("❌ Lỗi verify token:", err.message);
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới được phép thao tác" });
  }
  next();
}

// ====== AUTH ROUTES ======

// Đăng ký (dùng tạo admin lần đầu, sau đó nên tắt)
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role = "admin" } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đầy đủ username & password" });
    }

    if (!["admin", "owner", "staff"].includes(role)) {
      return res.status(400).json({ error: "Role không hợp lệ" });
    }

    if (role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount > 0) {
        return res.status(403).json({
          error: "Đã có admin trong hệ thống, không thể tạo thêm bằng API này",
        });
      }
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Tài khoản đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      role,
    });

    res.status(201).json({
      message: "Đã tạo user",
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi /auth/register:", err);
    res.status(500).json({ error: "Lỗi server khi đăng ký" });
  }
});

// Đăng nhập
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đầy đủ username & password" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const payload = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      farmName: user.farmName || null,
      farmLogo: user.farmLogo || null,
      farmPrimaryColor: user.farmPrimaryColor || null,
      farmOwner: user.farmOwner ? user.farmOwner.toString() : null,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: payload });
  } catch (err) {
    console.error("❌ Lỗi /auth/login:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// ====== ADMIN ROUTES ======

// Admin tạo user (owner/staff)
app.post("/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const {
      username,
      password,
      role = "owner",
      farmName,
      farmLogo,
      farmPrimaryColor,
      farmOwnerId,
    } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đầy đủ username & password" });
    }
    if (!["owner", "staff"].includes(role)) {
      return res.status(400).json({ error: "Vai trò chỉ được owner hoặc staff" });
    }
    if (role === "owner" && !farmName) {
      return res.status(400).json({ error: "Chủ vườn bắt buộc phải có tên vườn" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Tài khoản đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let farmOwnerRef = null;
    if (role === "staff" && farmOwnerId) {
      const ownerDoc = await User.findOne({ _id: farmOwnerId, role: "owner" });
      if (!ownerDoc) {
        return res
          .status(400)
          .json({ error: "Không tìm thấy chủ vườn tương ứng farmOwnerId" });
      }
      farmOwnerRef = ownerDoc._id;
    }

    const user = await User.create({
      username,
      passwordHash,
      role,
      farmName: farmName || undefined,
      farmLogo: farmLogo || undefined,
      farmPrimaryColor: farmPrimaryColor || "#16a34a",
      farmOwner: farmOwnerRef,
    });

    res.status(201).json({
      message: "Đã tạo user",
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        farmName: user.farmName,
        farmLogo: user.farmLogo,
        farmPrimaryColor: user.farmPrimaryColor,
        farmOwner: user.farmOwner,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi POST /admin/users:", err);
    res.status(500).json({ error: "Lỗi server khi tạo user" });
  }
});

// Admin xem danh sách user
app.get("/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role && ["owner", "staff", "admin"].includes(role)) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .select("-passwordHash")
      .populate("farmOwner", "username farmName");

    res.json(users);
  } catch (err) {
    console.error("❌ Lỗi GET /admin/users:", err);
    res.status(500).json({ error: "Không thể tải danh sách user" });
  }
});

// Admin cập nhật thông tin user
app.patch("/admin/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      role,
      farmName,
      farmLogo,
      farmPrimaryColor,
      farmOwnerId,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản." });
    }

    // Đổi username
    if (username && username !== user.username) {
      const existing = await User.findOne({ username });
      if (existing && existing._id.toString() !== id) {
        return res.status(409).json({ error: "Tài khoản này đã tồn tại." });
      }
      user.username = username;
    }

    // Đổi role
    if (role) {
      if (!["owner", "staff", "admin"].includes(role)) {
        return res.status(400).json({ error: "Role không hợp lệ." });
      }
      user.role = role;
    }

    // Chủ vườn: cập nhật info vườn
    if ((user.role === "owner" || role === "owner") && farmName) {
      user.farmName = farmName;
    }
    if (typeof farmPrimaryColor === "string" && farmPrimaryColor.trim() !== "") {
      user.farmPrimaryColor = farmPrimaryColor;
    }
    if (typeof farmLogo === "string" && farmLogo.trim() !== "") {
      user.farmLogo = farmLogo;
    }

    // Staff: gán chủ vườn
    if (user.role === "staff" && farmOwnerId) {
      const ownerDoc = await User.findOne({ _id: farmOwnerId, role: "owner" });
      if (!ownerDoc) {
        return res
          .status(400)
          .json({ error: "Không tìm thấy chủ vườn tương ứng farmOwnerId." });
      }
      user.farmOwner = ownerDoc._id;
      user.farmName = ownerDoc.farmName;
      user.farmLogo = ownerDoc.farmLogo;
      user.farmPrimaryColor = ownerDoc.farmPrimaryColor;
    }

    await user.save();

    res.json({
      message: "Đã cập nhật thông tin tài khoản",
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        farmName: user.farmName,
        farmLogo: user.farmLogo,
        farmPrimaryColor: user.farmPrimaryColor,
        farmOwner: user.farmOwner,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi PATCH /admin/users/:id:", err);
    res.status(500).json({ error: "Không thể cập nhật tài khoản" });
  }
});

// Admin đổi mật khẩu user
app.patch(
  "/admin/users/:id/password",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 4) {
        return res
          .status(400)
          .json({ error: "Mật khẩu mới phải có ít nhất 4 ký tự." });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy tài khoản." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user.passwordHash = passwordHash;
      await user.save();

      res.json({
        message: "Đã đổi mật khẩu cho tài khoản " + user.username,
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("❌ Lỗi PATCH /admin/users/:id/password:", err);
      res.status(500).json({ error: "Không thể đổi mật khẩu" });
    }
  }
);

// Admin xem tất cả cây
app.get("/admin/trees", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { health, ownerId } = req.query;
    const filter = {};
    if (health && ["Tốt", "Bình thường", "Yếu", "Nguy hiểm"].includes(health)) {
      filter.currentHealth = health;
    }
    if (ownerId) {
      filter.owner = ownerId;
    }

    const trees = await Tree.find(filter)
      .sort({ createdAt: -1 })
      .populate("owner", "username farmName");

    res.json(trees);
  } catch (err) {
    console.error("❌ Lỗi GET /admin/trees:", err);
    res.status(500).json({ error: "Không thể tải danh sách cây cho admin" });
  }
});

// Admin tạo cây cho một vườn cụ thể (tuỳ bạn có dùng hay không)
app.post("/admin/trees", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { ownerId, name, species, location, plantDate } = req.body;

    if (!ownerId || !name) {
      return res
        .status(400)
        .json({ error: "Thiếu ownerId hoặc tên cây (name) là bắt buộc." });
    }

    const owner = await User.findOne({ _id: ownerId, role: "owner" });
    if (!owner) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy chủ vườn tương ứng ownerId." });
    }

    const numericId = await getNextSequence("tree");

    // QR chứa URL, ví dụ: https://thefram.site/?tree=123
    const qrUrl = `${PUBLIC_BASE_URL}/?tree=${numericId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    const tree = await Tree.create({
      numericId,
      name,
      species: species || "",
      location: location || "",
      plantDate: plantDate || "",
      currentHealth: "Bình thường",
      notes: "",
      qrCode: qrCodeDataUrl,
      owner: owner._id,
    });

    res.status(201).json(tree);
  } catch (err) {
    console.error("❌ Lỗi POST /admin/trees:", err);
    res.status(500).json({ error: "Không thể tạo cây cho vườn này" });
  }
});

// ====== CHỦ VƯỜN TẠO / XEM NHÂN VIÊN ======

app.post("/owner/staff", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res
        .status(403)
        .json({ error: "Chỉ chủ vườn mới có quyền tạo nhân viên." });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đủ tài khoản và mật khẩu." });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Tài khoản đã tồn tại." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const staff = await User.create({
      username,
      passwordHash,
      role: "staff",
      farmName: req.user.farmName || null,
      farmLogo: req.user.farmLogo || null,
      farmPrimaryColor: req.user.farmPrimaryColor || "#16a34a",
      farmOwner: req.user.id,
    });

    res.status(201).json({
      message: "Đã tạo nhân viên cho vườn",
      staff: {
        id: staff._id.toString(),
        username: staff.username,
        role: staff.role,
        farmName: staff.farmName,
        farmOwner: staff.farmOwner,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi POST /owner/staff:", err);
    res.status(500).json({ error: "Không thể tạo nhân viên" });
  }
});

app.get("/owner/staff", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res
        .status(403)
        .json({ error: "Chỉ chủ vườn mới xem được nhân viên của mình." });
    }

    const staffList = await User.find({
      role: "staff",
      farmOwner: req.user.id,
    }).select("-passwordHash");

    res.json(staffList);
  } catch (err) {
    console.error("❌ Lỗi GET /owner/staff:", err);
    res.status(500).json({ error: "Không thể tải danh sách nhân viên" });
  }
});

// ====== PUBLIC: DANH SÁCH VƯỜN ======
app.get("/public/farms", async (req, res) => {
  try {
    const farms = await User.find({ role: "owner" })
      .select("username farmName farmLogo farmPrimaryColor createdAt")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(farms);
  } catch (err) {
    console.error("❌ Lỗi GET /public/farms:", err);
    res.status(500).json({ error: "Không thể tải danh sách vườn" });
  }
});

// ====== PUBLIC: THÔNG TIN CÂY TỪ QR ======
app.get("/public/tree/:numericId", async (req, res) => {
  try {
    const numericId = parseInt(req.params.numericId, 10);
    if (Number.isNaN(numericId)) {
      return res.status(400).json({ error: "Mã cây không hợp lệ." });
    }

    const tree = await Tree.findOne({ numericId }).populate(
      "owner",
      "username farmName"
    );
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây." });
    }

    res.json({
      numericId: tree.numericId,
      name: tree.name,
      species: tree.species,
      location: tree.location,
      plantDate: tree.plantDate,
      currentHealth: tree.currentHealth,
      notes: tree.notes,
      owner: tree.owner
        ? {
            username: tree.owner.username,
            farmName: tree.owner.farmName,
          }
        : null,
      updatedAt: tree.updatedAt,
    });
  } catch (err) {
    console.error("❌ Lỗi GET /public/tree/:numericId:", err);
    res.status(500).json({ error: "Không thể tải thông tin cây." });
  }
});

// ====== TREES API (OWNER / STAFF / ADMIN) ======

app.get("/api/trees", authMiddleware, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "admin") {
      filter = {};
    } else if (req.user.role === "owner") {
      filter = { owner: req.user.id };
    } else if (req.user.role === "staff") {
      if (!req.user.farmOwner) {
        return res.status(403).json({
          error:
            "Nhân viên chưa được gán chủ vườn (farmOwner). Hãy liên hệ chủ vườn hoặc admin.",
        });
      }
      filter = { owner: req.user.farmOwner };
    } else {
      return res.status(403).json({ error: "Vai trò không được phép xem cây" });
    }

    const trees = await Tree.find(filter)
      .sort({ createdAt: -1 })
      .populate("owner", "username farmName");

    res.json(trees);
  } catch (err) {
    console.error("❌ Lỗi GET /api/trees:", err);
    res.status(500).json({ error: "Không thể tải danh sách cây" });
  }
});

// Chủ vườn tạo cây
app.post("/api/trees", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res
        .status(403)
        .json({ error: "Chỉ chủ vườn mới được tạo cây mới." });
    }

    const { name, species, location, plantDate } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tên cây là bắt buộc" });
    }

    const numericId = await getNextSequence("tree");

    // QR chứa URL, vd: https://thefram.site/?tree=123
    const qrUrl = `${PUBLIC_BASE_URL}/?tree=${numericId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);

    const tree = await Tree.create({
      numericId,
      name,
      species: species || "",
      location: location || "",
      plantDate: plantDate || "",
      currentHealth: "Bình thường",
      notes: "",
      qrCode: qrCodeDataUrl,
      owner: req.user.id,
    });

    res.status(201).json(tree);
  } catch (err) {
    console.error("❌ Lỗi POST /api/trees:", err);
    res.status(500).json({ error: "Không thể tạo cây mới" });
  }
});

// Cập nhật tình trạng / ghi chú
app.patch("/api/trees/:id/health", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentHealth, notes } = req.body;

    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = tree.owner.toString() === req.user.id;
    const isStaffOfOwner =
      req.user.role === "staff" &&
      req.user.farmOwner &&
      tree.owner.toString() === req.user.farmOwner;

    if (!isAdmin && !isOwner && !isStaffOfOwner) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật cây này." });
    }

    if (currentHealth) tree.currentHealth = currentHealth;
    if (typeof notes === "string") tree.notes = notes;

    await tree.save();
    res.json({ message: "Đã cập nhật cây", tree });
  } catch (err) {
    console.error("❌ Lỗi PATCH /api/trees/:id/health:", err);
    res.status(500).json({ error: "Không thể cập nhật cây" });
  }
});

// Xoá cây
app.delete("/api/trees/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = tree.owner.toString() === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        error: "Chỉ admin hoặc chủ vườn của cây này mới được phép xoá.",
      });
    }

    await tree.deleteOne();
    res.json({ message: "Đã xoá cây" });
  } catch (err) {
    console.error("❌ Lỗi DELETE /api/trees/:id:", err);
    res.status(500).json({ error: "Không thể xoá cây" });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
