// ====== IMPORT THƯ VIỆN ======
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
require("dotenv").config(); // đọc biến môi trường từ .env

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

// ====== MÔ HÌNH DỮ LIỆU ======
const treeSchema = new mongoose.Schema(
  {
    numericId: { type: Number, unique: true }, // ID số tự tăng
    name: { type: String, required: true },
    species: String,
    location: String,
    plantDate: String,
    currentHealth: { type: String, default: "Tốt" },
    notes: String,
    qrCode: String, // ảnh QR (base64)
  },
  { timestamps: true }
);

const Tree = mongoose.model("Tree", treeSchema);

// ====== HÀM TẠO LINK PUBLIC ĐỂ GẮN VÀO QR ======
function getPublicTreeUrl(numericId) {
  // Dùng domain thật của bạn
  return `https://api.thefram.site/tree/${numericId}`;
}

// ====== API CHECK SERVER ======
app.get("/", (req, res) => {
  res.send("🌿 API quản lý cây đang hoạt động!");
});

// ====== 1. TẠO CÂY MỚI ======
app.post("/api/trees", async (req, res) => {
  try {
    const { name, species, location, plantDate, currentHealth, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tên cây là bắt buộc" });
    }

    // Tìm numericId lớn nhất, +1
    const lastTree = await Tree.findOne().sort({ numericId: -1 });
    const nextId = lastTree ? lastTree.numericId + 1 : 1;

    // Tạo QR code chứa link public
    const publicUrl = getPublicTreeUrl(nextId);
    const qrCode = await QRCode.toDataURL(publicUrl);

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
    res.status(500).json({ error: "Không thể tạo cây mới" });
  }
});

// ====== 2. LẤY DANH SÁCH CÂY ======
app.get("/api/trees", async (req, res) => {
  try {
    const trees = await Tree.find().sort({ numericId: 1 });
    res.json(trees);
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách cây:", err);
    res.status(500).json({ error: "Không thể lấy danh sách cây" });
  }
});

// ====== 3. CẬP NHẬT TÌNH TRẠNG SỨC KHỎE ======
// Frontend sẽ gọi theo _id của cây: /api/trees/:id/health
app.patch("/api/trees/:id/health", async (req, res) => {
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

// ====== 4. XOÁ CÂY ======
// Frontend cũng truyền _id vào URL /api/trees/:id
app.delete("/api/trees/:id", async (req, res) => {
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

// ====== 5. TRANG CÔNG KHAI KHI QUÉT QR ======
// Dùng numericId để tra cây cho đẹp & dễ nhớ
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
      background: #f0f4f8;
      margin: 0;
      padding: 20px;
      color: #111827;
    }
    .card {
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.1);
      padding: 20px;
      max-width: 480px;
      margin: auto;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 6px;
    }
    .status {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 12px;
      color: #fff;
      font-size: 13px;
      background: ${badgeColor};
      margin-bottom: 10px;
    }
    .row { margin: 8px 0; font-size: 15px; }
    .label { color: #555; font-weight: 600; }
    .footer {
      font-size: 12px;
      text-align: center;
      color: #9ca3af;
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
    <div class="footer">🌿 Quét từ hệ thống Quản lý cây | ID nội bộ: ${tree._id}</div>
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
