const mongoose = require("mongoose");

module.exports = mongoose.model("trees",
  new mongoose.Schema({
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
    assignedStaff: mongoose.Schema.Types.ObjectId,
    diseases: Array,
    yieldHistory: Array,
    qrCode: String
  }, { timestamps: true, strict: false })
);
