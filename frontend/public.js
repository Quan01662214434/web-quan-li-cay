const API = "https://api.thefram.site";
const id = new URLSearchParams(location.search).get("id");

// ===== GHI LOG LƯỢT QUÉT =====
fetch(`${API}/api/trees/${id}/scan`, { method: "POST" });

// ===== LOAD DATA =====
Promise.all([
  fetch(`${API}/api/trees/${id}`).then(r => r.json()),
  fetch(`${API}/api/qr-settings`).then(r => r.json())
]).then(([tree, cfg]) => {

  // Updated time
  updated.innerText =
    "Cập nhật: " + new Date(tree.updatedAt).toLocaleString("vi-VN");

  // Image
  if (tree.imageURL) {
    imageBox.innerHTML = `<img src="${API}${tree.imageURL}">`;
  }

  // VietGAP
  if (tree.vietGapCode) {
    vietgapCode.innerText = "Mã số: " + tree.vietGapCode;
  } else {
    vietgap.style.display = "none";
  }

  // Người phụ trách
  manager.innerText =
    "👨‍🌾 Người phụ trách: " + (tree.managerName || "Đang cập nhật");

  // Lượt quét
  scanCount.innerText =
    "🔍 Lượt quét QR: " + (tree.qrScans || 0);

  // Label map
  const labels = {
    name: "Tên cây",
    species: "Giống",
    area: "Khu vực",
    location: "Vị trí",
    gardenAddress: "Địa chỉ vườn",
    plantDate: "Ngày trồng"
  };

  // Render theo cấu hình QR
  cfg.fields.forEach(f => {
    if (!tree[f]) return;

    info.innerHTML += `
      <div class="card">
        <div class="label">${labels[f] || f}</div>
        <div class="value">${
          f === "plantDate"
            ? new Date(tree[f]).toLocaleDateString("vi-VN")
            : tree[f]
        }</div>
      </div>
    `;
  });

  // Status
  status.innerText =
    "Tình trạng: " + (tree.currentHealth || "—");
});
