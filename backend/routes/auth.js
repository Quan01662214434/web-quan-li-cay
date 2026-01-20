const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(401).json({});

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(401).json({});

  const token = jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET
  );

  res.json({ token, role: user.role, name: user.name });
});

module.exports = router;
