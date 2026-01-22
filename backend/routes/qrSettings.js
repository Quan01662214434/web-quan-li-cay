const router = require("express").Router();
const QR = require("../models/QRSetting");
const auth = require("../middleware/auth");

/**
 * GET: ai cũng được gọi (QR public dùng)
 */
router.get("/", async (_, res) => {
  res.json(await QR.findOne() || { fields: [] });
});

/**
 * PUT: CHỈ OWNER
 */
router.put("/", auth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Không có quyền" });
  }

  const data = await QR.findOneAndUpdate(
    {},
    req.body,
    { upsert: true, new: true }
  );

  res.json(data);
});

module.exports = router;
