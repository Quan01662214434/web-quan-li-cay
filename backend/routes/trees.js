const router = require("express").Router();
const mongoose = require("mongoose");
const Tree = require("../models/Tree");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

/**
 * ✅ Theo cách của bạn:
 * - Khu C => địa chỉ A, VietGAP C
 * - Các khu khác => địa chỉ B, VietGAP AB
 * Bạn chỉ cần chỉnh 4 biến ENV bên dưới cho đúng farm.
 */
const ADDRESS_A_FOR_KHU_C = process.env.ADDRESS_A_FOR_KHU_C || "ĐỊA CHỈ A (Khu C)";
const ADDRESS_B_FOR_OTHERS = process.env.ADDRESS_B_FOR_OTHERS || "ĐỊA CHỈ B (Các khu còn lại)";
const VIETGAP_FOR_KHU_C = process.env.VIETGAP_FOR_KHU_C || "VIETGAP_C";
const VIETGAP_FOR_OTHERS = process.env.VIETGAP_FOR_OTHERS || "VIETGAP_AB";

function isKhuC(area) {
  if (!area) return false;
  return /khu\s*c\b/i.test(String(area).trim()); // match "Khu C"
}

/* =====================
   PUBLIC
===================== */

/**
 * ⚠️ Danh sách cây public (nếu không cần public thì bạn nên xoá route này).
 * Tối ưu: loại qrCode base64 cho nhẹ.
 */
router.get("/", async (_, res) => {
  const trees = await Tree.find().select("-qrCode");
  res.json(trees);
});

/* =====================
   PUBLIC – QUÉT QR (DUY NHẤT)
   HỖ TRỢ: _id | numericId | vietGapCode
===================== */
router.get("/public/:id", async (req, res) => {
  try {
    const raw = (req.params.id || "").trim();
    const or = [];

    // 1) _id (ObjectId)
    if (mongoose.Types.ObjectId.isValid(raw)) {
      or.push({ _id: raw });
    }

    // 2) numericId (Number)
    if (/^\d+$/.test(raw)) {
      or.push({ numericId: Number(raw) });
    }

    // 3) vietGapCode (String)
    or.push({ vietGapCode: raw });

    const tree = await Tree.findOne({ $or: or });
    if (!tree) {
      return res.status(404).json({
        message: "Không xác định được cây – vui lòng quét lại"
      });
    }

    // tăng lượt quét QR (atomic)
    await Tree.updateOne({ _id: tree._id }, { $inc: { qrScans: 1 } });

    // Trả về object + gắn gardenAddress/vietGap theo rule của bạn
    const obj = tree.toObject();

    const khuC = isKhuC(obj.area);
    obj.gardenAddress = khuC ? ADDRESS_A_FOR_KHU_C : ADDRESS_B_FOR_OTHERS;
    obj.vietGapCode = khuC ? VIETGAP_FOR_KHU_C : VIETGAP_FOR_OTHERS;

    // ✅ Tối ưu: nếu trang public không cần show lại QR thì bỏ qrCode cho nhẹ
    // delete obj.qrCode;

    return res.json(obj);
  } catch (err) {
    console.error("QR public error:", err);
    return res.status(500).json({ message: "Lỗi server khi tải thông tin cây" });
  }
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
