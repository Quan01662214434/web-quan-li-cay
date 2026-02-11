const mongoose = require("mongoose");

const QrSettingSchema = new mongoose.Schema(
  {
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
    contacts: {
      zalo: { type: String, default: "" },
      phone: { type: String, default: "" },
      facebook: { type: String, default: "" }
    },
    showQrImage: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("QrSetting", QrSettingSchema);
