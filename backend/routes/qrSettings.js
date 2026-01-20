const router = require("express").Router();
const QR = require("../models/QRSetting");

router.get("/", async (_, res) => {
  res.json(await QR.findOne());
});

router.put("/", async (req, res) => {
  res.json(await QR.findOneAndUpdate({}, req.body, { upsert: true, new: true }));
});

module.exports = router;
