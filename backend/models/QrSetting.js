const mongoose = require("mongoose");

const QrSettingSchema = new mongoose.Schema(
  {
    // Mảng field được phép hiển thị trên trang QR
    fields: {
      type: [String],
      default: [
        "name",
        "species",
        "area",
        "location",
        "gardenAddress",
        "plantDate",
        "vietGapCode",
        "currentHealth",
        "yieldSummary"
      ]
    },

    // Link liên hệ hiển thị trên trang QR
    contacts: {
      zalo: { type: String, default: "" },
      phone: { type: String, default: "" },
      facebook: { type: String, default: "" }
    },

    // Có hiển thị lại ảnh QR trên trang public không
    showQrImage: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("QrSetting", QrSettingSchema);
