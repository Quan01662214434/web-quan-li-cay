require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/trees", require("./routes/trees"));
app.use("/api/users", require("./routes/users"));
app.use("/api/yield", require("./routes/yield"));
app.use("/api/qr-settings", require("./routes/qrSettings"));

app.use(express.static(path.join(__dirname, "../frontend")));
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "../frontend/index.html"))
);

app.listen(process.env.PORT || 5000);
