const router = require("express").Router();
const QrSetting = require("../models/QrSetting");
const auth = require("../middleware/auth");

// Helper: lấy config, nếu chưa có thì tạo default
async function getOrCreate() {
  let cfg = await QrSetting.findOne();
  if (!cfg) cfg = await QrSetting.create({});
  return cfg;
}

// GET (OWNER) – lấy cấu hình (có auth)
router.get("/", auth, async (req, res) => {
  try {
    // Nếu middleware auth có role thì chặn luôn (không có thì vẫn cho qua để khỏi gãy)
    if (req.user?.role && req.user.role !== "owner") {
      return res.status(403).json({ message: "Không có quyền" });
    }

    const cfg = await getOrCreate();
    res.json({
      fields: cfg.fields || [],
      contacts: cfg.contacts || {},
      showQrImage: !!cfg.showQrImage
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST (OWNER) – lưu cấu hình
router.post("/", auth, async (req, res) => {
  try {
    if (req.user?.role && req.user.role !== "owner") {
      return res.status(403).json({ message: "Không có quyền" });
    }

    const { fields, contacts, showQrImage } = req.body || {};
    const cfg = await getOrCreate();

    if (Array.isArray(fields)) cfg.fields = fields;
    if (contacts && typeof contacts === "object") {
      cfg.contacts = {
        zalo: contacts.zalo || "",
        phone: contacts.phone || "",
        facebook: contacts.facebook || ""
      };
    }
    if (typeof showQrImage === "boolean") cfg.showQrImage = showQrImage;

    await cfg.save();

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET (PUBLIC) – trang QR được phép lấy config (không auth)
router.get("/public", async (req, res) => {
  try {
    const cfg = await getOrCreate();
    res.json({
      fields: cfg.fields || [],
      contacts: cfg.contacts || {},
      showQrImage: !!cfg.showQrImage
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
