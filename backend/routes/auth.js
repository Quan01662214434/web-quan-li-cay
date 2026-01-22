const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("LOGIN REQUEST:", username, password);

    const user = await User.findOne({ username });
    console.log("FOUND USER:", user);

    if (!user) {
      return res.status(401).json({ message: "User không tồn tại" });
    }

    if (!user.passwordHash) {
      console.error("❌ USER KHÔNG CÓ passwordHash");
      return res.status(500).json({
        message: "User lỗi dữ liệu (passwordHash missing)"
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      role: user.role,
      name: user.username
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
