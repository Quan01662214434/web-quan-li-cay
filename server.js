// ===== IMPORT THƯ VIỆN =====
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
require("dotenv").config(); // Đọc biến môi trường từ file .env

// ===== CẤU HÌNH APP =====
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ===== KẾT NỐI MONGODB =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Đã kết nối MongoDB"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// ===== MÔ HÌNH DỮ LIỆU =====
const treeSchema = new mongoose.Schema(
  {
    numericId: { type: Number, unique: true }, // ID số tự tăng
    name: { type: String, required: true },
    species: String,
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Tốt" },
    notes: String,
    qrCode: String,
  },
  { timestamps: true }
);

const Tree = mongoose.model("Tree", treeSchema);

// ===== API =====

// Kiểm tra server
app.get("/", (req, res) => {
  res.send("🌿 API quản lý cây đang chạy với MongoDB + numericId!");
});

// 1️⃣ TẠO CÂY MỚI (có numericId tự tăng + QR)
app.post("/api/trees", async (req, res) => {
  try {
    const { name, species, location, plantDate, currentHealth, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tên cây là bắt buộc" });
    }

    // Tìm cây có numericId lớn nhất, rồi +1
    const lastTree = await Tree.findOne().sort({ numericId: -1 });
    const nextId = lastTree ? lastTree.numericId + 1 : 1;

    // Tạo QR code (encode theo numericId + tên cây)
    const qrText = `TREE-${nextId}-${name}`;
    const qrCode = await QRCode.toDataURL(qrText);

    const newTree = await Tree.create({
      numericId: nextId,
      name,
      species,
      location,
      plantDate,
      currentHealth,
      notes,
      qrCode,
    });

    res.status(201).json(newTree);
  } catch (err) {
    console.error("❌ Lỗi tạo cây:", err);
    res.status(500).json({ error: "Lỗi tạo cây mới" });
  }
});

// 2️⃣ LẤY DANH SÁCH TẤT CẢ CÂY
app.get("/api/trees", async (req, res) => {
  try {
    const trees = await Tree.find().sort({ numericId: 1 }); // sắp xếp theo ID số
    res.json(trees);
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách cây:", err);
    res.status(500).json({ error: "Không thể lấy danh sách cây" });
  }
});

// 3️⃣ CẬP NHẬT TÌNH TRẠNG SỨC KHỎE (dùng _id)
app.patch("/api/trees/:id/health", async (req, res) => {
  try {
    const { currentHealth, notes } = req.body;

    const updatedTree = await Tree.findByIdAndUpdate(
      req.params.id,          // dùng _id của MongoDB
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

// ===== KHỞI ĐỘNG SERVER =====
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy ở http://localhost:${PORT}`);
});
