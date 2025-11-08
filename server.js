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
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Đã kết nối MongoDB"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// ====== MÔ HÌNH DỮ LIỆU ======
const treeSchema = new mongoose.Schema({
  id: { type: Number, unique: true }, // ID tự tăng
  name: { type: String, required: true },
  species: String,
  location: String,
  plantDate: String,
  currentHealth: { type: String, default: "Tốt" },
  notes: String,
  qrCode: String,
});

// ====== TỰ TĂNG ID ======
treeSchema.pre("save", async function (next) {
  if (this.isNew) {
    const lastTree = await Tree.findOne().sort({ id: -1 });
    this.id = lastTree ? lastTree.id + 1 : 1;
  }
  next();
});

const Tree = mongoose.model("Tree", treeSchema);

// ====== API GỐC ======
app.get("/", (req, res) => {
  res.send("<h2>🌿 API quản lý cây đang hoạt động!</h2>");
});

// ====== LẤY DANH SÁCH CÂY ======
app.get("/api/trees", async (req, res) => {
  try {
    const trees = await Tree.find().sort({ id: 1 });
    res.json(trees);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải danh sách cây", error });
  }
});

// ====== THÊM CÂY MỚI ======
app.post("/api/trees", async (req, res) => {
  try {
    const { name, species, location, plantDate, currentHealth, notes } = req.body;

    const newTree = new Tree({
      name,
      species,
      location,
      plantDate,
      currentHealth,
      notes,
    });

    // Tạo QR code chứa đường dẫn xem cây
    const qrData = `https://api.thefram.site/tree/${newTree._id}`;
    newTree.qrCode = await QRCode.toDataURL(qrData);

    await newTree.save();
    res.json({ message: "✅ Đã thêm cây mới!", tree: newTree });
  } catch (error) {
    res.status(500).json({ message: "❌ Lỗi khi thêm cây", error });
  }
});

// ====== CẬP NHẬT SỨC KHỎE ======
app.put("/api/trees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { currentHealth, notes } = req.body;

    const updated = await Tree.findOneAndUpdate(
      { id },
      { currentHealth, notes },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Không tìm thấy cây" });
    res.json({ message: "✅ Đã cập nhật cây", tree: updated });
  } catch (error) {
    res.status(500).json({ message: "❌ Lỗi khi cập nhật cây", error });
  }
});

// ====== XOÁ CÂY ======
app.delete("/api/trees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Tree.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy cây" });
    res.json({ message: "🗑️ Đã xoá cây thành công!" });
  } catch (error) {
    res.status(500).json({ message: "❌ Lỗi khi xoá cây", error });
  }
});

// ====== XEM THÔNG TIN CÂY (theo QR) ======
app.get("/tree/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tree = await Tree.findById(id);
    if (!tree) return res.status(404).send("<h3>Không tìm thấy cây này.</h3>");

    res.send(`
      <html>
        <head><title>Thông tin cây</title></head>
        <body style="font-family: sans-serif; background:#f6fff6; padding: 20px;">
          <h2>🌳 ${tree.name}</h2>
          <p><b>Giống:</b> ${tree.species || "Chưa có"}</p>
          <p><b>Vị trí:</b> ${tree.location || "Chưa rõ"}</p>
          <p><b>Ngày trồng:</b> ${tree.plantDate || "Không rõ"}</p>
          <p><b>Tình trạng:</b> ${tree.currentHealth}</p>
          <p><b>Ghi chú:</b> ${tree.notes || "Không có"}</p>
          <img src="${tree.qrCode}" width="150"/>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send("<h3>Lỗi khi tải thông tin cây.</h3>");
  }
});

// ====== KHỞI ĐỘNG SERVER ======
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy ở http://localhost:${PORT}`);
});
