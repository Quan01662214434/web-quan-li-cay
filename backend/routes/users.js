const router = require("express").Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");

router.get("/", async (_, res) => {
  res.json(await User.find({ role: "staff" }));
});

router.post("/", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  res.json(await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hash,
    role: "staff"
  }));
});

module.exports = router;
