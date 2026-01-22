const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI =
  "mongodb+srv://admin:12345@cluster0.p12idid.mongodb.net/thanh-huyen-farm?retryWrites=true&w=majority";

async function createOwner() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected:", mongoose.connection.name);

  // Xóa sạch user (đảm bảo không lệch)
  await User.deleteMany({});

  const passwordHash = await bcrypt.hash("123456", 10);

  const user = await User.create({
    username: "admin",
    passwordHash,
    role: "owner",
    farmName: "Thanh Huyền Farm"
  });

  console.log("✅ OWNER ĐÃ TẠO THÀNH CÔNG:");
  console.log({
    id: user._id.toString(),
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role
  });

  process.exit();
}

createOwner().catch(err => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
