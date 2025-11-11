// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ====== KẾT NỐI MONGODB ======
mongoose
  .connect("mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thefram", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Đã kết nối MongoDB"))
  .catch((err) => console.error("❌ Lỗi MongoDB:", err));

// ====== SCHEMA ======
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, enum: ["owner", "staff"], default: "staff" },
  createdAt: { type: Date, default: Date.now },
});

const treeSchema = new mongoose.Schema({
  name: String,
  species: String,
  location: String,
  plantDate: Date,
  vietGapCode: String,
  currentHealth: String,
  notes: String,
  area: String,
  qrCode: String,
  createdBy: String,
  updatedAt: { type: Date, default: Date.now },
});

const logSchema = new mongoose.Schema({
  user: String,
  action: String,
  time: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Tree = mongoose.model("Tree", treeSchema);
const Log = mongoose.model("Log", logSchema);

// ====== MIDDLEWARE ======
const SECRET = "thanhhuyenfarm";
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Thiếu token" });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Token không hợp lệ" });
  }
}

// ====== AUTH ======
app.post("/auth/register", async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hash, role });
  await user.save();
  res.status(201).json({ message: "Đã tạo user" });
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Sai tài khoản" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Sai mật khẩu" });

  const token = jwt.sign(
    { username: user.username, role: user.role },
    SECRET,
    { expiresIn: "12h" }
  );
  res.json({ token, role: user.role });
});

// ====== CRUD CÂY ======
app.get("/api/trees", auth, async (req, res) => {
  const trees = await Tree.find();
  res.json(trees);
});

app.post("/api/trees", auth, async (req, res) => {
  const data = req.body;
  const newTree = new Tree({
    ...data,
    createdBy: req.user.username,
  });
  const saved = await newTree.save();

  // Tạo QR code
  const qrUrl = `https://thefram.site/public.html?treeId=${saved._id}`;
  const qrCode = await QRCode.toDataURL(qrUrl);
  saved.qrCode = qrCode;
  await saved.save();

  await Log.create({
    user: req.user.username,
    action: `Thêm cây: ${data.name}`,
  });

  res.status(201).json(saved);
});

app.put("/api/trees/:id", auth, async (req, res) => {
  const { id } = req.params;
  const updated = await Tree.findByIdAndUpdate(id, req.body, { new: true });
  await Log.create({
    user: req.user.username,
    action: `Cập nhật cây: ${updated.name}`,
  });
  res.json(updated);
});

app.delete("/api/trees/:id", auth, async (req, res) => {
  const { id } = req.params;
  const tree = await Tree.findById(id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  await tree.deleteOne();
  await Log.create({
    user: req.user.username,
    action: `Xóa cây: ${tree.name}`,
  });
  res.json({ message: "Đã xóa" });
});

// ====== QUẢN LÝ NHÂN VIÊN ======
app.get("/api/staff", auth, async (req, res) => {
  if (req.user.role !== "owner")
    return res.status(403).json({ error: "Không có quyền" });
  const staff = await User.find({ role: "staff" });
  res.json(staff);
});

app.post("/api/staff", auth, async (req, res) => {
  if (req.user.role !== "owner")
    return res.status(403).json({ error: "Không có quyền" });
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash, role: "staff" });
  await Log.create({
    user: req.user.username,
    action: `Tạo nhân viên: ${username}`,
  });
  res.status(201).json({ message: "Đã tạo nhân viên" });
});

app.delete("/api/staff/:username", auth, async (req, res) => {
  if (req.user.role !== "owner")
    return res.status(403).json({ error: "Không có quyền" });
  await User.deleteOne({ username: req.params.username, role: "staff" });
  await Log.create({
    user: req.user.username,
    action: `Xóa nhân viên: ${req.params.username}`,
  });
  res.json({ message: "Đã xóa nhân viên" });
});

// ====== LỊCH SỬ HOẠT ĐỘNG ======
app.get("/api/logs", auth, async (req, res) => {
  if (req.user.role !== "owner")
    return res.status(403).json({ error: "Chỉ chủ được xem lịch sử" });
  const logs = await Log.find().sort({ time: -1 });
  res.json(logs);
});

// ====== TRANG CÔNG KHAI QR ======
app.get("/public/tree/:id", async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) return res.status(404).json({ error: "Không tìm thấy cây" });
  res.json({ tree });
});

const PORT = 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`)
);
