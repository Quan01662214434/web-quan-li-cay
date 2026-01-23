const router = require("express").Router();
const Tree = require("../models/Tree");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

/* =====================
   PUBLIC
===================== */

/* Danh sách cây (dashboard / public) */
router.get("/", async (_, res) => {
  const trees = await Tree.find();
  res.json(trees);
});

/* =====================
   PUBLIC – QUÉT QR (DUY NHẤT)
   HỖ TRỢ: _id | numericId | vietGapCode
===================== */
router.get("/public/:id", async (req, res) => {
  const { id } = req.params;

  const tree = await Tree.findOne({
    $or: [
      { _id: id },
      { numericId: id },
      { vietGapCode: id }
    ]
  });

  if (!tree) {
    return res.status(404).json({
      message: "Không xác định được cây – vui lòng quét lại"
    });
  }

  // tăng lượt quét QR
  await Tree.findByIdAndUpdate(tree._id, { $inc: { qrScans: 1 } });

  res.json(tree);
});

/* =====================
   OWNER – DASHBOARD
===================== */
router.get("/dashboard/list", auth, async (req, res) => {
  const trees = await Tree.find({}, {
    name: 1,
    numericId: 1,
    area: 1,
    currentHealth: 1,
    qrScans: 1
  });

  res.json(trees);
});

/* =====================
   AUTH REQUIRED
===================== */

/* XEM CHI TIẾT CÂY (PHẢI ĐẶT CUỐI) */
router.get("/:id", auth, async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) {
    return res.status(404).json({ message: "Không tìm thấy cây" });
  }
  res.json(tree);
});

/* CẬP NHẬT TÌNH TRẠNG */
router.put("/:id/health", auth, async (req, res) => {
  const updated = await Tree.findByIdAndUpdate(
    req.params.id,
    {
      currentHealth: req.body.currentHealth,
      notes: req.body.notes
    },
    { new: true }
  );

  await AuditLog.create({
    userId: req.user.id,
    userName: req.user.name,
    action: "update_health",
    treeId: updated._id,
    treeName: updated.name,
    changes: req.body
  });

  res.json(updated);
});

/* CẬP NHẬT ĐỊA CHỈ */
router.put("/:id/address", auth, async (req, res) => {
  const updated = await Tree.findByIdAndUpdate(
    req.params.id,
    { gardenAddress: req.body.gardenAddress },
    { new: true }
  );

  await AuditLog.create({
    userId: req.user.id,
    userName: req.user.name,
    action: "update_address",
    treeId: updated._id,
    treeName: updated.name,
    changes: { gardenAddress: req.body.gardenAddress }
  });

  res.json(updated);
});

/* THÊM BỆNH */
router.post("/:id/diseases", auth, async (req, res) => {
  const updated = await Tree.findByIdAndUpdate(
    req.params.id,
    { $push: { diseases: req.body } },
    { new: true }
  );

  await AuditLog.create({
    userId: req.user.id,
    userName: req.user.name,
    action: "add_disease",
    treeId: updated._id,
    treeName: updated.name,
    changes: req.body
  });

  res.json(updated);
});

module.exports = router;
