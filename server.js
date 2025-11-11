// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ===== KẾT NỐI MONGODB =====
mongoose
  .connect(
    process.env.MONGO_URI ||
      "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanhhuyenfarm?retryWrites=true&w=majority"
  )
  .then(() => console.log("✅ MongoDB đã kết nối"))
  .catch((err) => console.error("❌ Lỗi Mongo:", err));

// ===== SCHEMA =====
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ["owner", "staff"], default: "owner" },
  farmName: { type: String, default: "Thanh Huyền Farm" },
  createdBy: String,
});

const treeSchema = new mongoose.Schema({
  name: String,
  species: String,
  location: String,
  plantDate: Date,
  vietGapCode: String,
  currentHealth: String,
  notes: String,
  productivityByYear: Object, // {2023: 15000, 2024: 18000}
  qrCode: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
});

const activitySchema = new mongoose.Schema({
  userId: String,
  username: String,
  action: String,
  treeId: String,
  treeName: String,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Tree = mongoose.model("Tree", treeSchema);
const Activity = mongoose.model("Activity", activitySchema);

// ===== MIDDLEWARE AUTH =====
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Thiếu token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token không hợp lệ" });
  }
};

// ===== AUTH API =====
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role = "owner" } = req.body;
    const exist = await User.findOne({ username });
    if (exist) return res.status(400).json({ error: "User đã tồn tại" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashed, role });
    res.status(201).json({ message: "Tạo user thành công", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Sai tài khoản" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Sai mật khẩu" });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ===== CRUD CÂY =====

// Lấy danh sách cây
app.get("/api/trees", auth, async (req, res) => {
  try {
    const trees = await Tree.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(trees);
  } catch (err) {
    res.status(500).json({ error: "Không thể tải cây" });
  }
});

// Thêm cây
app.post("/api/trees", auth, async (req, res) => {
  try {
    const tree = new Tree({ ...req.body, createdBy: req.user.id });
    const qrUrl = `${
      process.env.PUBLIC_QR_URL || "https://thefram.site/public.html"
    }?treeId=${tree._id}`;
    tree.qrCode = await QRCode.toDataURL(qrUrl);
    await tree.save();

    await Activity.create({
      userId: req.user.id,
      username: req.user.username,
      treeId: tree._id,
      treeName: tree.name,
      action: "Thêm cây mới",
    });

    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi thêm cây" });
  }
});

// Sửa cây
app.put("/api/trees/:id", auth, async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      req.body,
      { new: true }
    );
    if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });

    await Activity.create({
      userId: req.user.id,
      username: req.user.username,
      treeId: tree._id,
      treeName: tree.name,
      action: "Cập nhật thông tin cây",
    });

    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật" });
  }
});

// Xóa cây
app.delete("/api/trees/:id", auth, async (req, res) => {
  try {
    const tree = await Tree.findOne({ _id: req.params.id });
    if (!tree) return res.status(404).json({ error: "Không có cây" });
    await Tree.deleteOne({ _id: req.params.id });

    await Activity.create({
      userId: req.user.id,
      username: req.user.username,
      treeId: tree._id,
      treeName: tree.name,
      action: "Xoá cây",
    });

    res.json({ message: "Đã xoá cây" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xoá cây" });
  }
});

// Lấy lịch sử hoạt động
app.get("/api/activity", auth, async (req, res) => {
  try {
    const logs = await Activity.find({ userId: req.user.id }).sort({
      timestamp: -1,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Không thể tải lịch sử" });
  }
});

// API Public cho QR khách xem
app.get("/public/tree/:id", async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) return res.status(404).json({ error: "Không có dữ liệu" });
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn public" });
  }
});

// ===== KHỞI ĐỘNG SERVER =====
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`)
);
