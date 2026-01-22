const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    // 🔥 QUAN TRỌNG: passwordHash (KHÔNG PHẢI password)
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret123",
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
