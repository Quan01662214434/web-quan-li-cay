const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "owner") {
  alert("Không có quyền");
  location.href = "index.html";
}

fetch(`${API}/api/trees`, {
  headers: { Authorization: "Bearer " + token }
})
  .then(res => res.json())
  .then(trees => {
    const list = document.getElementById("list");

    trees
      .filter(t => t.vietGapCode) // CHỈ CÂY ĐẠT VIETGAP
      .forEach(t => {
        list.innerHTML += `
          <div class="tree">
            <h3>${t.name}</h3>
            <div class="grid">
              <div><b>Giống:</b> ${t.species || "-"}</div>
              <div><b>Khu:</b> ${t.area || "-"}</div>
              <div><b>Vị trí:</b> ${t.location || "-"}</div>
              <div><b>Địa chỉ vườn:</b> ${t.gardenAddress || "-"}</div>
              <div><b>Người phụ trách:</b> ${t.managerName || "-"}</div>
              <div><b>Mã VietGAP:</b> ${t.vietGapCode}</div>
              <div><b>Lượt quét QR:</b> ${t.qrScans || 0}</div>
            </div>

            <div class="qr">
              <img src="${t.qrCode}" alt="QR">
            </div>
          </div>
        `;
      });
  });
