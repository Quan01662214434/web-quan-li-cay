// ====== IMPORT THƯ VIỆN ======
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// ====== CẤU HÌNH APP ======
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ====== KẾT NỐI MONGODB ======
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Đã kết nối MongoDB"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// ====== SCHEMA & MODEL ======

// User: admin, chủ vườn (owner), nhân viên (staff)
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "owner", "staff"],
      default: "staff",
    },

    // Thông tin vườn
    farmName: { type: String },
    farmLogo: { type: String }, // base64
    farmPrimaryColor: { type: String }, // vd "#22c55e"
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Cây
const treeSchema = new mongoose.Schema(
  {
    numericId: { type: Number }, // ID số tự tăng
    name: { type: String, required: true },
    species: String,
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Tốt" },
    notes: String,
    qrCode: String,

    farmOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Tree = mongoose.model("Tree", treeSchema);

// Task – công việc nhân viên
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,

    status: {
      type: String,
      enum: ["Mới", "Đang làm", "Hoàn thành"],
      default: "Mới",
    },

    priority: {
      type: String,
      enum: ["Thấp", "Trung bình", "Cao"],
      default: "Trung bình",
    },

    dueDate: String,

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    farmOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    farmName: String,

    treeId: { type: mongoose.Schema.Types.ObjectId, ref: "Tree" },

    resultNotes: String,
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", taskSchema);

// ====== HÀM TẠO LINK PUBLIC QR ======
function getPublicTreeUrl(numericId) {
  return `https://api.thefram.site/tree/${numericId}`;
}

// ====== MIDDLEWARE AUTH ======
function auth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "Thiếu token" });

  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token)
    return res.status(401).json({ error: "Token không hợp lệ" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, farmName }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token hết hạn hoặc không hợp lệ" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới được dùng chức năng này" });
  }
  next();
}

function requireOwnerOrAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.role === "owner") {
    return next();
  }
  return res
    .status(403)
    .json({ error: "Chỉ chủ vườn hoặc admin được dùng chức năng này" });
}

// ====== ROUTE CHECK SERVER ======
app.get("/", (req, res) => {
  res.send("🌿 API quản lý vườn + công việc nhân viên đang hoạt động!");
});

// ====== AUTH ======

/**
 * /auth/register – chỉ dùng để tạo admin ban đầu (sau có thể xoá / khoá lại)
 */
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Cần username và password" });
    }

    const existed = await User.findOne({ username });
    if (existed) {
      return res.status(400).json({ error: "Username đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      passwordHash,
      role: role === "admin" ? "admin" : "owner",
    });

    res.status(201).json({
      message: "Đã tạo user",
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("❌ Lỗi register:", err);
    res.status(500).json({ error: "Không thể tạo user mới" });
  }
});

// Đăng nhập
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        farmName: user.farmName,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        farmName: user.farmName || null,
        farmLogo: user.farmLogo || null,
        farmPrimaryColor: user.farmPrimaryColor || "#22c55e",
      },
    });
  } catch (err) {
    console.error("❌ Lỗi login:", err);
    res.status(500).json({ error: "Không thể đăng nhập" });
  }
});

// Admin tạo user owner / staff
app.post("/admin/users", auth, requireAdmin, async (req, res) => {
  try {
    const {
      username,
      password,
      role,
      farmName,
      farmLogo,
      farmPrimaryColor,
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Cần username và password" });
    }

    if (!["owner", "staff"].includes(role)) {
      return res
        .status(400)
        .json({ error: "role phải là 'owner' (chủ vườn) hoặc 'staff' (nhân viên)" });
    }

    if (role === "owner" && !farmName) {
      return res
        .status(400)
        .json({ error: "Chủ vườn phải có tên vườn (farmName)" });
    }

    const existed = await User.findOne({ username });
    if (existed) {
      return res.status(400).json({ error: "Username đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      passwordHash,
      role,
      farmName: role === "owner" ? farmName : farmName || null,
      farmLogo: role === "owner" ? farmLogo || null : farmLogo || null,
      farmPrimaryColor: farmPrimaryColor || "#22c55e",
    });

    res.status(201).json({
      message: "Đã tạo user mới",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        farmName: user.farmName || null,
        farmLogo: user.farmLogo || null,
        farmPrimaryColor: user.farmPrimaryColor || "#22c55e",
      },
    });
  } catch (err) {
    console.error("❌ Lỗi admin tạo user:", err);
    res.status(500).json({ error: "Không thể tạo user mới" });
  }
});

// ====== CÂY ======

// Tạo cây (owner + admin)
app.post("/api/trees", auth, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { name, species, location, plantDate, currentHealth, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Tên cây là bắt buộc" });
    }

    const lastTree = await Tree.findOne().sort({ numericId: -1 });
    const nextId =
      lastTree && typeof lastTree.numericId === "number"
        ? lastTree.numericId + 1
        : 1;

    const publicUrl = getPublicTreeUrl(nextId);

    let qrCode = "";
    try {
      qrCode = await QRCode.toDataURL(publicUrl);
    } catch (qrErr) {
      console.error("⚠️ Lỗi tạo QR:", qrErr);
    }

    const newTree = await Tree.create({
      numericId: nextId,
      name,
      species,
      location,
      plantDate,
      currentHealth,
      notes,
      qrCode,
      farmOwnerId: req.user.role === "owner" ? req.user.id : undefined,
    });

    res.status(201).json(newTree);
  } catch (err) {
    console.error("❌ Lỗi tạo cây:", err);
    res
      .status(500)
      .json({ error: "Không thể tạo cây mới", detail: String(err) });
  }
});

// Lấy danh sách cây (phải đăng nhập)
app.get("/api/trees", auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "owner") {
      query.farmOwnerId = req.user.id;
    }
    const trees = await Tree.find(query).sort({ numericId: 1 });
    res.json(trees);
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách cây:", err);
    res.status(500).json({
      error: "Không thể lấy danh sách cây",
      detail: String(err),
    });
  }
});

// Cập nhật tình trạng & ghi chú (owner + staff)
app.patch("/api/trees/:id/health", auth, async (req, res) => {
  try {
    const { currentHealth, notes } = req.body;

    const updatedTree = await Tree.findByIdAndUpdate(
      req.params.id,
      { currentHealth, notes },
      { new: true }
    );

    if (!updatedTree) {
      return res.status(404).json({ error: "Không tìm thấy cây để cập nhật" });
    }

    res.json(updatedTree);
  } catch (err) {
    console.error("❌ Lỗi cập nhật cây:", err);
    res.status(500).json({ error: "Không thể cập nhật cây" });
  }
});

// Xoá cây (owner + admin)
app.delete("/api/trees/:id", auth, requireOwnerOrAdmin, async (req, res) => {
  try {
    const deletedTree = await Tree.findByIdAndDelete(req.params.id);
    if (!deletedTree) {
      return res.status(404).json({ error: "Không tìm thấy cây để xoá" });
    }
    res.json({ message: `✅ Đã xoá cây ${deletedTree.name}` });
  } catch (err) {
    console.error("❌ Lỗi xoá cây:", err);
    res.status(500).json({ error: "Không thể xoá cây" });
  }
});

// ====== TASK ======

// Tạo task (owner + admin)
app.post("/api/tasks", auth, requireOwnerOrAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      treeId,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Tiêu đề công việc là bắt buộc" });
    }

    const creator = await User.findById(req.user.id);
    if (!creator) {
      return res.status(400).json({ error: "Không tìm thấy user tạo task" });
    }

    let assignedUser = null;
    if (assignedTo) {
      assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ error: "Không tìm thấy nhân viên được giao" });
      }
    }

    let tree = null;
    if (treeId) {
      tree = await Tree.findById(treeId);
      if (!tree) {
        return res.status(400).json({ error: "Không tìm thấy cây được gắn với task" });
      }
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || "Trung bình",
      dueDate,
      assignedTo: assignedUser ? assignedUser._id : null,
      createdBy: creator._id,
      farmOwnerId: creator.role === "owner" ? creator._id : undefined,
      farmName: creator.farmName || null,
      treeId: tree ? tree._id : null,
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("❌ Lỗi tạo task:", err);
    res.status(500).json({ error: "Không thể tạo công việc mới" });
  }
});

// Nhân viên / chủ vườn xem task của mình
app.get("/api/tasks/me", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .sort({ status: 1, dueDate: 1, createdAt: -1 })
      .populate("treeId", "numericId name species location currentHealth");

    res.json(tasks);
  } catch (err) {
    console.error("❌ Lỗi lấy task của user:", err);
    res.status(500).json({ error: "Không thể lấy danh sách task" });
  }
});

// Chủ vườn xem task theo vườn
app.get("/api/tasks/farm", auth, async (req, res) => {
  try {
    if (req.user.role === "owner") {
      const tasks = await Task.find({ farmOwnerId: req.user.id })
        .sort({ createdAt: -1 })
        .populate("assignedTo", "username role")
        .populate("treeId", "numericId name");
      return res.json(tasks);
    }

    if (req.user.role === "admin") {
      const { ownerId } = req.query;
      const query = ownerId ? { farmOwnerId: ownerId } : {};
      const tasks = await Task.find(query)
        .sort({ createdAt: -1 })
        .populate("assignedTo", "username role")
        .populate("treeId", "numericId name");
      return res.json(tasks);
    }

    return res
      .status(403)
      .json({ error: "Chỉ chủ vườn hoặc admin mới xem task theo vườn" });
  } catch (err) {
    console.error("❌ Lỗi lấy task theo vườn:", err);
    res.status(500).json({ error: "Không thể lấy danh sách task" });
  }
});

// Nhân viên cập nhật trạng thái task
app.patch("/api/tasks/:id/status", auth, async (req, res) => {
  try {
    const { status, resultNotes } = req.body;
    const allowedStatus = ["Mới", "Đang làm", "Hoàn thành"];
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Không tìm thấy task" });

    const isAssigned = task.assignedTo?.toString() === req.user.id;
    if (!isAssigned && req.user.role === "staff") {
      return res
        .status(403)
        .json({ error: "Bạn không được phép cập nhật task này" });
    }

    if (status) task.status = status;
    if (typeof resultNotes === "string") task.resultNotes = resultNotes;

    await task.save();

    res.json(task);
  } catch (err) {
    console.error("❌ Lỗi cập nhật trạng thái task:", err);
    res.status(500).json({ error: "Không thể cập nhật task" });
  }
});

// ====== TRANG PUBLIC QUÉT QR ======
app.get("/tree/:numericId", async (req, res) => {
  try {
    const numericId = parseInt(req.params.numericId, 10);
    if (isNaN(numericId)) return res.status(400).send("ID không hợp lệ");

    const tree = await Tree.findOne({ numericId });
    if (!tree) return res.status(404).send("Không tìm thấy cây");

    const statusText = tree.currentHealth || "Chưa rõ";
    let badgeColor = "#16a34a";
    if (statusText === "Bình thường") badgeColor = "#f59e0b";
    if (statusText === "Yếu" || statusText === "Nguy hiểm") badgeColor = "#dc2626";

    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cây #${tree.numericId} - ${tree.name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #0f172a;
      margin: 0;
      padding: 20px;
      color: #e5e7eb;
      display: flex;
      justify-content: center;
    }
    .card {
      background: #020617;
      border-radius: 16px;
      border: 1px solid #1f2937;
      padding: 18px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 18px 40px rgba(0,0,0,0.6);
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px;
    }
    .status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      color: #f9fafb;
      font-size: 12px;
      background: ${badgeColor};
      margin-bottom: 10px;
    }
    .row { margin: 6px 0; font-size: 14px; }
    .label { color: #9ca3af; font-weight: 500; display:inline-block; min-width: 95px; }
    .qr {
      text-align:center;
      margin-top: 14px;
    }
    .qr img {
      width: 160px;
      height: 160px;
      border-radius: 16px;
      border: 1px solid #1f2937;
      background:#020617;
    }
    .footer {
      font-size: 11px;
      text-align: center;
      color: #6b7280;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${tree.name}</h1>
    <div class="status">${statusText}</div>

    <div class="row"><span class="label">Mã số:</span> #${tree.numericId}</div>
    <div class="row"><span class="label">Giống:</span> ${tree.species || "—"}</div>
    <div class="row"><span class="label">Vị trí:</span> ${tree.location || "—"}</div>
    <div class="row"><span class="label">Ngày trồng:</span> ${tree.plantDate || "—"}</div>
    <div class="row"><span class="label">Ghi chú:</span> ${tree.notes || "Không có"}</div>

    <div class="qr">
      <img src="${tree.qrCode}" alt="QR" />
    </div>

    <div class="footer">
      🌿 Hệ thống quản lý cây · thefram.site
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error("❌ Lỗi render QR:", err);
    res.status(500).send("Có lỗi xảy ra.");
  }
});

// ====== KHỞI ĐỘNG SERVER ======
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy ở http://localhost:${PORT}`);
});
