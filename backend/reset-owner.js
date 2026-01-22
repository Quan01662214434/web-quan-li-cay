require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function reset() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const password = "123456"; // mật khẩu mới
  const hash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { username: "thanhhuyen" },
    { passwordHash: hash },
    { new: true }
  );

  if (!user) {
    console.log("❌ Không tìm thấy user thanhhuyen");
  } else {
    console.log("✅ Reset password thành công cho:", user.username);
  }

  process.exit();
}

reset();
