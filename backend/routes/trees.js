const router = require("express").Router();
const Tree = require("../models/Tree");

/* Danh sách cây */
router.get("/", async (_, res) => {
  res.json(await Tree.find());
});

/* Xem cây qua QR */
router.get("/:id", async (req, res) => {
  res.json(await Tree.findById(req.params.id));
});

/* Cập nhật tình trạng */
router.put("/:id/health", async (req, res) => {
  res.json(await Tree.findByIdAndUpdate(
    req.params.id,
    { currentHealth: req.body.currentHealth, notes: req.body.notes },
    { new: true }
  ));
});

/* Cập nhật địa chỉ vườn */
router.put("/:id/address", async (req, res) => {
  res.json(await Tree.findByIdAndUpdate(
    req.params.id,
    { gardenAddress: req.body.gardenAddress },
    { new: true }
  ));
});

/* Thêm bệnh */
router.post("/:id/diseases", async (req, res) => {
  res.json(await Tree.findByIdAndUpdate(
    req.params.id,
    { $push: { diseases: req.body } },
    { new: true }
  ));
});

module.exports = router;
