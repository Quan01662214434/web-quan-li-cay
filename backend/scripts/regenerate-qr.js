console.log("🚀 BẮT ĐẦU SCRIPT");

require("dotenv").config();
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const Tree = require("../models/Tree");

(async () => {
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const trees = await Tree.find();
    console.log("🌳 Số cây:", trees.length);

    for (const t of trees) {
      const url = `https://www.thefram.site/public.html?id=${t._id}`;
      t.qrCode = await QRCode.toDataURL(url);
      await t.save();
      console.log("✔ Đã tạo QR cho:", t.name);
    }

    console.log("🎉 XONG TOÀN BỘ");
    process.exit(0);
  } catch (err) {
    console.error("❌ LỖI SCRIPT:", err);
    process.exit(1);
  }
})();



