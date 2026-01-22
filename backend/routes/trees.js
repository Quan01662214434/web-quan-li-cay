const router = require("express").Router();
const Tree = require("../models/Tree");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

/* =====================
   PUBLIC
===================== */

/* Danh sách cây (dashboard) */
router.get("/", async (_, res) => {
  res.json(await Tree.find());
});

/* GHI LOG LƯỢT QUÉT QR */
router.post("/:id/scan", async (req, res) => {
  try {
    await Tree.findByIdAndUpdate(
      req.params.id,
      { $inc: { qrScans: 1 } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Scan log error" });
  }
});

/* =====================
   OWNER – THỐNG KÊ
===================== */

/* THỐNG KÊ QR (PHẢI ĐẶT TRƯỚC /:id) */
router.get("/stats/qr", auth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Không có quyền" });
  }

  const trees = await Tree.find(
    {},
    { name: 1, numericId: 1, qrScans: 1 }
  );

  res.json(
    trees.map(t => ({
      label: `${t.name} (${t.numericId || "-"})`,
      value: t.qrScans || 0
    }))
  );
});

/* =====================
   AUTH REQUIRED
===================== */

/* Xem chi tiết cây */
router.get("/:id", async (req, res) => {
  res.json(await Tree.findById(req.params.id));
});

/* Cập nhật tình trạng */
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
    changes: {
      currentHealth: req.body.currentHealth,
      notes: req.body.notes
    }
  });

  res.json(updated);
});

/* Cập nhật địa chỉ vườn */
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

/* Thêm bệnh */
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
// ===== DASHBOARD – LOAD NHẸ =====
router.get("/dashboard/list", auth, async (req, res) => {
  const trees = await Tree.find(
    {},
    {
      name: 1,
      numericId: 1,
      area: 1,
      currentHealth: 1,
      qrScans: 1
    }
  );

  res.json(trees);
});
