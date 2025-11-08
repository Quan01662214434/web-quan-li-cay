// ====== IMPORT THƯ VIỆN ======
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
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
const treeSchema = new mongoose.Schema(
  {
    numericId: { type: Number }, // ID số tự tăng để show cho người dùng
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

// ====== HÀM TẠO LINK PUBLIC CHO QR ======
function getPublicTreeUrl(numericId) {
  // Dùng domain API thật
  return `https://api.thefram.site/tree/${numericId}`;
}

// ====== CHECK SERVER ======
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

    // Lấy numericId lớn nhất rồi +1
    const lastTree = await Tree.findOne().sort({ numericId: -1 });
    const nextId = lastTree ? lastTree.numericId + 1 : 1;

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

// ====== 3. CẬP NHẬT SỨC KHỎE & GHI CHÚ ======
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

// ====== 5. TRANG PUBLIC KHI QUÉT QR (THEO numericId) ======
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
