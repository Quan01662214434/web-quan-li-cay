const mongoose = require("mongoose");
module.exports = mongoose.model("qr_settings",
  new mongoose.Schema({}, { strict: false })
);
