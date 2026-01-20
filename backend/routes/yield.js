const router = require("express").Router();
const Tree = require("../models/Tree");

router.get("/", async (_, res) => {
  const trees = await Tree.find();
  res.json(trees.map(t => ({
    name: t.name,
    total: (t.yieldHistory || []).reduce((s, y) => s + (y.quantity || 0), 0)
  })));
});

module.exports = router;
