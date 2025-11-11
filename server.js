// server.js - Thanh Huyền Farm (1 vườn sầu riêng, chủ vườn + nhân viên)

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

// URL frontend công khai, dùng để gắn vào QR
// Khi triển khai thật: sửa thành https://thefram.site
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

// User: owner / staff (admin vẫn giữ cho khỏi vỡ DB cũ, nhưng không dùng trên UI)
const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "owner", "staff"],
      default: "owner",
    },

    // Thông tin vườn
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
    numericId: { type: Number, unique: true, required: true },
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

    // QR (dataURL base64 chứa URL ?tree=xxx) – tạo 1 lần, cố định
    qrCode: { type: String },

    // Danh sách bệnh
    diseases: {
      type: [String],
      default: [],
    },

    // Năng suất theo năm
    yieldHistory: {
      type: [
        {
          year: Number,
          quantity: Number, // kg
        },
      ],
      default: [],
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Tree = mongoose.model("Tree", treeSchema);

// Lịch sử hoạt động trên cây
const activityLogSchema = new mongoose.Schema(
  {
    tree: { type: mongoose.Schema.Types.ObjectId, ref: "Tree", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    action: { type: String, required: true }, // UPDATE_HEALTH, UPDATE_DISEASES, UPDATE_YIELD, UPDATE_INFO...
    details: { type: String },
  },
  { timestamps: true }
);

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

async function logActivity({ tree, user, username, action, details }) {
  try {
    await ActivityLog.create({ tree, user, username, action, details });
  } catch (err) {
    console.error("❌ Lỗi ghi ActivityLog:", err.message);
  }
}

// ====== AUTH MIDDLEWARE ======
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Thiếu token. Vui lòng đăng nhập." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, ... }
    next();
  } catch (err) {
    console.error("❌ Lỗi verify token:", err.message);
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

// ====== AUTH ROUTES ======

// Đăng ký (dùng để tạo tài khoản chủ vườn lần đầu)
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role = "owner", farmName } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đầy đủ username & password" });
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
      farmName: farmName || "Vườn sầu riêng Thanh Huyền",
      farmPrimaryColor: "#16a34a",
    });

    res.status(201).json({
      message: "Đã tạo user",
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        farmName: user.farmName,
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
      farmName: user.farmName || "Vườn sầu riêng Thanh Huyền",
      farmLogo: user.farmLogo || null,
      farmPrimaryColor: user.farmPrimaryColor || "#16a34a",
      farmOwner: user.farmOwner ? user.farmOwner.toString() : null,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: payload });
  } catch (err) {
    console.error("❌ Lỗi /auth/login:", err);
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// ====== CHỦ VƯỜN TẠO / XEM / XOÁ NHÂN VIÊN ======

// Tạo nhân viên
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
      farmName: req.user.farmName || "Vườn sầu riêng Thanh Huyền",
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

// Xem nhân viên
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

// Xóa nhân viên
app.delete("/api/staff/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ error: "Chỉ chủ vườn có quyền" });
    }

    const staff = await User.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    if (!staff.farmOwner || staff.farmOwner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Không thể xóa nhân viên không thuộc vườn bạn" });
    }

    await staff.deleteOne();
    res.json({ message: "Đã xóa nhân viên" });
  } catch (err) {
    console.error("❌ Lỗi DELETE /api/staff/:id:", err);
    res.status(500).json({ error: "Không thể xóa nhân viên" });
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
      diseases: tree.diseases || [],
      yieldHistory: tree.yieldHistory || [],
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

// ====== TREES API (owner / staff / admin) ======

// Lấy danh sách cây
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
            "Nhân viên chưa được gán chủ vườn (farmOwner). Hãy liên hệ chủ vườn.",
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

// Tạo cây mới (QR cố định)
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

    // Tạo QR chứa URL: https://thefram.site/?tree=123
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
      diseases: [],
      yieldHistory: [],
      qrCode: qrCodeDataUrl,
      owner: req.user.id,
    });

    // log tạo cây
    await logActivity({
      tree: tree._id,
      user: req.user.id,
      username: req.user.username,
      action: "CREATE_TREE",
      details: `Tạo cây mới #${numericId} - ${name}.`,
    });

    res.status(201).json(tree);
  } catch (err) {
    console.error("❌ Lỗi POST /api/trees:", err);
    res.status(500).json({ error: "Không thể tạo cây mới" });
  }
});

// Cập nhật tình trạng / ghi chú (owner + staff)
app.patch("/api/trees/:id/health", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentHealth, notes } = req.body;

    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isOwner = tree.owner.toString() === req.user.id;
    const isStaffOfOwner =
      req.user.role === "staff" &&
      req.user.farmOwner &&
      tree.owner.toString() === req.user.farmOwner;

    if (!isOwner && !isStaffOfOwner) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật cây này." });
    }

    const oldHealth = tree.currentHealth;
    const oldNotes = tree.notes;

    if (currentHealth) tree.currentHealth = currentHealth;
    if (typeof notes === "string") tree.notes = notes;

    await tree.save();

    let detailText = "";
    if (currentHealth && currentHealth !== oldHealth) {
      detailText += `Đổi tình trạng từ "${oldHealth}" sang "${currentHealth}". `;
    }
    if (typeof notes === "string" && notes !== oldNotes) {
      detailText += "Cập nhật ghi chú.";
    }

    await logActivity({
      tree: tree._id,
      user: req.user.id,
      username: req.user.username,
      action: "UPDATE_HEALTH",
      details: detailText || "Cập nhật tình trạng / ghi chú.",
    });

    res.json({ message: "Đã cập nhật cây", tree });
  } catch (err) {
    console.error("❌ Lỗi PATCH /api/trees/:id/health:", err);
    res.status(500).json({ error: "Không thể cập nhật cây" });
  }
});

// Cập nhật danh sách bệnh (owner + staff)
app.patch("/api/trees/:id/diseases", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { diseases } = req.body;

    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isOwner = tree.owner.toString() === req.user.id;
    const isStaffOfOwner =
      req.user.role === "staff" &&
      req.user.farmOwner &&
      tree.owner.toString() === req.user.farmOwner;

    if (!isOwner && !isStaffOfOwner) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật bệnh cho cây này" });
    }

    if (!Array.isArray(diseases)) {
      return res.status(400).json({ error: "Danh sách bệnh phải là mảng" });
    }

    const oldDiseases = tree.diseases || [];
    tree.diseases = diseases;
    await tree.save();

    await logActivity({
      tree: tree._id,
      user: req.user.id,
      username: req.user.username,
      action: "UPDATE_DISEASES",
      details: `Bệnh từ [${oldDiseases.join(", ")}] → [${diseases.join(", ")}].`,
    });

    res.json({ message: "Đã cập nhật bệnh cho cây", tree });
  } catch (err) {
    console.error("❌ Lỗi PATCH /api/trees/:id/diseases:", err);
    res.status(500).json({ error: "Không thể cập nhật bệnh" });
  }
});

// Thêm / cập nhật năng suất (owner + staff)
app.post("/api/trees/:id/yield", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { year, quantity } = req.body;

    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isOwner = tree.owner.toString() === req.user.id;
    const isStaffOfOwner =
      req.user.role === "staff" &&
      req.user.farmOwner &&
      tree.owner.toString() === req.user.farmOwner;

    if (!isOwner && !isStaffOfOwner) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền cập nhật năng suất cây này" });
    }

    const y = parseInt(year, 10);
    const q = parseFloat(quantity);
    if (!y || !q || Number.isNaN(y) || Number.isNaN(q)) {
      return res.status(400).json({ error: "Năm hoặc số kg không hợp lệ" });
    }

    let oldQuantity = null;
    const idx = tree.yieldHistory.findIndex((item) => item.year === y);
    if (idx >= 0) {
      oldQuantity = tree.yieldHistory[idx].quantity;
      tree.yieldHistory[idx].quantity = q;
    } else {
      tree.yieldHistory.push({ year: y, quantity: q });
    }

    tree.yieldHistory.sort((a, b) => a.year - b.year);
    await tree.save();

    await logActivity({
      tree: tree._id,
      user: req.user.id,
      username: req.user.username,
      action: "UPDATE_YIELD",
      details:
        oldQuantity === null
          ? `Thêm năng suất năm ${y}: ${q} kg.`
          : `Sửa năng suất năm ${y}: ${oldQuantity} kg → ${q} kg.`,
    });

    res.json({ message: "Đã cập nhật năng suất", tree });
  } catch (err) {
    console.error("❌ Lỗi POST /api/trees/:id/yield:", err);
    res.status(500).json({ error: "Không thể cập nhật năng suất" });
  }
});

// Xoá cây (chỉ chủ vườn hoặc admin)
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
        error: "Chỉ chủ vườn (hoặc admin) của cây này mới được phép xoá.",
      });
    }

    await tree.deleteOne();

    await logActivity({
      tree: tree._id,
      user: req.user.id,
      username: req.user.username,
      action: "DELETE_TREE",
      details: `Xoá cây #${tree.numericId} - ${tree.name}.`,
    });

    res.json({ message: "Đã xoá cây" });
  } catch (err) {
    console.error("❌ Lỗi DELETE /api/trees/:id:", err);
    res.status(500).json({ error: "Không thể xoá cây" });
  }
});

// Lịch sử hoạt động của một cây
app.get("/api/trees/:id/logs", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const tree = await Tree.findById(id);
    if (!tree) {
      return res.status(404).json({ error: "Không tìm thấy cây" });
    }

    const isOwner = tree.owner.toString() === req.user.id;
    const isStaffOfOwner =
      req.user.role === "staff" &&
      req.user.farmOwner &&
      tree.owner.toString() === req.user.farmOwner;

    if (!isOwner && !isStaffOfOwner) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền xem lịch sử cây này" });
    }

    const logs = await ActivityLog.find({ tree: id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(
      logs.map((log) => ({
        id: log._id.toString(),
        username: log.username,
        action: log.action,
        details: log.details,
        time: log.createdAt,
      }))
    );
  } catch (err) {
    console.error("❌ Lỗi GET /api/trees/:id/logs:", err);
    res.status(500).json({ error: "Không thể tải lịch sử hoạt động" });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
