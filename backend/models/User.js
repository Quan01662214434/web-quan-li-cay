const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["owner", "staff"],
      default: "staff"
    },

    farmName: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
const mongoose = require("mongoose");

module.exports = mongoose.model(
  "users",
  new mongoose.Schema(
    {
      username: { type: String, unique: true },
      passwordHash: String,
      role: {
        type: String,
        enum: ["owner", "staff"],
        default: "staff"
      },
      fullName: String
    },
    { timestamps: true }
  )
);

