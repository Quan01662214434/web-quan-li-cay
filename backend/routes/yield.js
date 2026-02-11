const router = require("express").Router();
const Tree = require("../models/Tree");

function normalizeYieldItem(y) {
  // hỗ trợ: number | string | object
  if (typeof y === "number") return { quantity: y, date: null };
  if (typeof y === "string" && !isNaN(Number(y))) return { quantity: Number(y), date: null };

  if (y && typeof y === "object") {
    const quantity = Number(y.quantity ?? y.amount ?? y.value ?? y.weight ?? 0) || 0;
    const date = y.date ?? y.at ?? y.time ?? y.createdAt ?? null;
    return { quantity, date };
  }

  return { quantity: 0, date: null };
}

router.get("/", async (_, res) => {
  try {
    // ✅ chỉ lấy field cần thiết, tránh kéo qrCode base64
    const trees = await Tree.find()
      .select("name numericId area yieldHistory")
      .lean();

    const result = trees.map(t => {
      const items = (t.yieldHistory || []).map(normalizeYieldItem);

      const total = items.reduce((s, it) => s + (it.quantity || 0), 0);

      // latest: ưu tiên cái có date, nếu không có thì lấy phần tử cuối
      let latest = items[items.length - 1] || null;
      const withDate = items.filter(i => i.date);
      if (withDate.length) {
        withDate.sort((a, b) => new Date(a.date) - new Date(b.date));
        latest = withDate[withDate.length - 1];
      }

      return {
        name: t.name,
        numericId: t.numericId,
        area: t.area,
        total,
        latest: latest ? { quantity: latest.quantity, date: latest.date } : null
      };
    });

    res.json(result);
  } catch (err) {
    console.error("yield route error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
