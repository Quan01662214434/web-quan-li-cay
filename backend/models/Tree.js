const mongoose = require("mongoose");

module.exports = mongoose.model(
  "trees",
  new mongoose.Schema(
    {
      numericId: Number,
      name: String,
      species: String,
      area: String,
      location: String,
      gardenAddress: String,
      plantDate: Date,

      vietGapCode: String,
      currentHealth: String,
      notes: String,

      imageURL: String,

      // nhân viên phụ trách (nếu cần map user)
      assignedStaff: mongoose.Schema.Types.ObjectId,

      // tên người phụ trách (hiển thị QR public)
      managerName: String,

      diseases: Array,
      yieldHistory: Array,

      qrCode: String,

      // ===== QR AUDIT =====
      qrScans: {
        type: Number,
        default: 0
      }
    },
    {
      timestamps: true,
      strict: false // GIỮ NGUYÊN – RẤT ĐÚNG
    }
  )
);
