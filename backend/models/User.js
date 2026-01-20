const mongoose = require("mongoose");

module.exports = mongoose.model("users",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ["owner", "staff"], default: "staff" }
  }, { timestamps: true })
);
