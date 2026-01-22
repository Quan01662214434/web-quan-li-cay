const router = require("express").Router();
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Không có quyền" });
  }

  const logs = await AuditLog
    .find()
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(logs);
});

module.exports = router;
/* =====================
   THỐNG KÊ THEO NHÂN VIÊN
===================== */
router.get("/stats/users", auth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Không có quyền" });
  }

  const stats = await AuditLog.aggregate([
    {
      $group: {
        _id: "$userName",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json(
    stats.map(s => ({
      label: s._id || "Không rõ",
      value: s.count
    }))
  );
});
