const mongoose = require("mongoose");

const TreeSchema = new mongoose.Schema(
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

    // nhân viên phụ trách (map User nếu cần)
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
    },

    // tên người phụ trách (hiển thị QR public)
    managerName: String,

    diseases: Array,

    yieldHistory: [
      {
        date: Date,
        amount: Number
      }
    ],

    qrCode: String,

    // ===== QR AUDIT =====
    qrScans: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    strict: false // ✅ GIỮ – rất tốt
  }
);

module.exports = mongoose.model("trees", TreeSchema);
