const mongoose = require("mongoose");

module.exports = mongoose.model(
  "audit_logs",
  new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    action: String,
    treeId: mongoose.Schema.Types.ObjectId,
    treeName: String,
    changes: Object
  }, { timestamps: true })
);
