const router = require("express").Router();
const mongoose = require("mongoose");

const Tree = require("../models/Tree");
const AuditLog = require("../models/AuditLog");
const QrSetting = require("../models/QrSetting");
const auth = require("../middleware/auth");

/**
 * Theo cách của bạn:
 * - Khu C => địa chỉ A, VietGAP C
 * - Các khu khác => địa chỉ B, VietGAP AB
 */
const ADDRESS_A_FOR_KHU_C = process.env.ADDRESS_A_FOR_KHU_C || "Địa chỉ A (Khu C)";
const ADDRESS_B_FOR_OTHERS = process.env.ADDRESS_B_FOR_OTHERS || "Địa chỉ B (các khu khác)";
const VIETGAP_FOR_KHU_C = process.env.VIETGAP_FOR_KHU_C || "VIETGAP_C";
const VIETGAP_FOR_OTHERS = process.env.VIETGAP_FOR_OTHERS || "VIETGAP_AB";

function isKhuC(area) {
  if (!area) return false;
  return /khu\s*c\b/i.test(String(area).trim());
}

async function getOrCreateQrSetting() {
  let cfg = await QrSetting.findOne();
  if (!cfg) cfg = await QrSetting.create({});
  return cfg;
}

/**
 * Năng suất:
 * - Nếu tree có yieldHistory -> tính tổng + gần nhất
 * - Nếu không có -> trả null (frontend sẽ hiện "-")
 */
function computeYieldSummaryFromTree(treeDoc) {
  const arr = Array.isArray(treeDoc.yieldHistory) ? treeDoc.yieldHistory : [];
  if (arr.length === 0) return null;

  const norm = (x) => {
    if (typeof x === "number") return { amount: x, date: null };
    if (typeof x === "string" && !isNaN(Number(x))) return { amount: Number(x), date: null };
    if (x && typeof x === "object") {
      const amount =
        Number(x.amount ?? x.yield ?? x.value ?? x.weight ?? x.quantity ?? 0) || 0;
      const date = x.date ?? x.at ?? x.time ?? x.createdAt ?? null;
      return { amount, date };
    }
    return { amount: 0, date: null };
  };

  const items = arr.map(norm);
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  let latest = items[items.length - 1];
  const withDate = items.filter(i => i.date);
  if (withDate.length) {
    withDate.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    latest = withDate[withDate.length - 1];
  }

  if (latest?.date) {
    return `Tổng: ${total} | Gần nhất: ${latest.amount} (${new Date(latest.date).toLocaleDateString("vi-VN")})`;
  }
  return `Tổng: ${total} | Gần nhất: ${latest?.amount ?? 0}`;
}

/* =====================
   PUBLIC
===================== */
router.get("/", async (_, res) => {
  // tối ưu: không trả qrCode base64 khi list
  const trees = await Tree.find().select("-qrCode");
  res.json(trees);
});

/* =====================
   PUBLIC – QUÉT QR
   HỖ TRỢ: _id | numericId | vietGapCode
   + ÁP DỤNG CONFIG QR (tick field)
===================== */
router.get("/public/:id", async (req, res) => {
  try {
    const raw = (req.params.id || "").trim();
    const or = [];

    // _id
    if (mongoose.Types.ObjectId.isValid(raw)) or.push({ _id: raw });

    // numericId (hỗ trợ Number hoặc String)
    if (/^\d+$/.test(raw)) {
      or.push({ numericId: Number(raw) });
      or.push({ numericId: raw });
    }

    // vietGapCode
    or.push({ vietGapCode: raw });

    const tree = await Tree.findOne({ $or: or });
    if (!tree) {
      return res.status(404).json({ message: "Không xác định được cây – vui lòng quét lại" });
    }

    // tăng lượt quét
    await Tree.updateOne({ _id: tree._id }, { $inc: { qrScans: 1 } });

    // load QR config
    const cfg = await getOrCreateQrSetting();
    const allowed = Array.isArray(cfg.fields) ? cfg.fields : [];

    // rule khu C / others
    const khuC = isKhuC(tree.area);
    const gardenAddress = khuC ? ADDRESS_A_FOR_KHU_C : ADDRESS_B_FOR_OTHERS;
    const vietGapCode = khuC ? VIETGAP_FOR_KHU_C : VIETGAP_FOR_OTHERS;

    // năng suất
    const yieldSummary = computeYieldSummaryFromTree(tree) || null;

    // map dữ liệu có thể hiển thị
    const map = {
      name: tree.name,
      species: tree.species,
      area: tree.area,
      location: tree.location,
      gardenAddress,
      plantDate: tree.plantDate,
      vietGapCode,
      currentHealth: tree.currentHealth,
      yieldSummary,
      qrScans: tree.qrScans
    };

    // trả theo config
    const out = {
      _id: tree._id,
      numericId: tree.numericId,
      qrFields: allowed,
      qrContacts: cfg.contacts || {},
      showQrImage: !!cfg.showQrImage
    };

    for (const k of allowed) {
      if (k in map) out[k] = map[k];
    }

    // nếu bật show ảnh QR
    if (cfg.showQrImage && tree.qrCode) out.qrCode = tree.qrCode;

    res.json(out);
  } catch (err) {
    console.error("QR public error:", err);
    res.status(500).json({ message: "Lỗi server khi tải thông tin cây" });
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
  if (!tree) return res.status(404).json({ message: "Không tìm thấy cây" });
  res.json(tree);
});

/* CẬP NHẬT TÌNH TRẠNG */
router.put("/:id/health", auth, async (req, res) => {
  const updated = await Tree.findByIdAndUpdate(
    req.params.id,
    { currentHealth: req.body.currentHealth, notes: req.body.notes },
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
