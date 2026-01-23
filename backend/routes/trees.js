const router = require("express").Router();
const Tree = require("../models/Tree");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

/* =====================
   PUBLIC
===================== */

/* Danh sách cây (public / dashboard) */
router.get("/", async (_, res) => {
  res.json(await Tree.find());
});

/* PUBLIC – QUÉT QR (KHÔNG CẦN LOGIN) */
router.get("/:id/public", async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) return res.status(404).json({ message: "Không tìm thấy cây" });

  await Tree.findByIdAndUpdate(req.params.id, { $inc: { qrScans: 1 } });
  res.json(tree);
});

/* GHI LOG LƯỢT QUÉT QR */
router.post("/:id/scan", async (req, res) => {
  try {
    await Tree.findByIdAndUpdate(req.params.id, {
      $inc: { qrScans: 1 }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Scan log error" });
  }
});

/* =====================
   OWNER – THỐNG KÊ
===================== */

/* THỐNG KÊ QR */
router.get("/stats/qr", auth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Không có quyền" });
  }

  const trees = await Tree.find({}, {
    name: 1,
    numericId: 1,
    qrScans: 1
  });

  res.json(
    trees.map(t => ({
      label: `${t.name} (${t.numericId || "-"})`,
      value: t.qrScans || 0
    }))
  );
});

/* DASHBOARD – LOAD NHẸ */
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

/* XEM CHI TIẾT CÂY (ID PHẢI ĐẶT CUỐI) */
router.get("/:id", async (req, res) => {
  const tree = await Tree.findById(req.params.id);
  if (!tree) return res.status(404).json({ message: "Không tìm thấy cây" });
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
    changes: req.body
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
