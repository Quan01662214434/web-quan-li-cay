const API = "https://api.thefram.site";

// hỗ trợ cả ?id= và ?code=
const params = new URLSearchParams(location.search);
const id = (params.get("id") || params.get("code") || "").trim();

if (!id) {
  alert("❌ Thiếu ID/mã cây");
} else {
  fetch(`${API}/api/trees/public/${encodeURIComponent(id)}`)
    .then(async (res) => {
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Không thể tải thông tin cây (${res.status}) ${txt}`);
      }
      return res.json();
    })
    .then((t) => {
      document.getElementById("name").innerText = t.name || "-";
      document.getElementById("species").innerText = t.species || "-";
      document.getElementById("area").innerText = t.area || "-";
      document.getElementById("location").innerText = t.location || "-";
      document.getElementById("gardenAddress").innerText = t.gardenAddress || "-";
      document.getElementById("plantDate").innerText = t.plantDate
        ? new Date(t.plantDate).toLocaleDateString("vi-VN")
        : "-";
      document.getElementById("health").innerText = t.currentHealth || "-";

      // Hiển thị QR nếu có (base64 hoặc link)
      const qrImg = document.getElementById("qrImage");
      const qrLink = document.getElementById("qrLink");

      if (t.qrCode) {
        qrImg.src = t.qrCode;
        qrImg.style.display = "block";
        // Đừng in full base64 ra màn hình; chỉ để nút tải
        qrLink.innerHTML = `<a href="${t.qrCode}" download="qr-${t.numericId || t.vietGapCode || "tree"}.png">Tải QR Code</a>`;
      } else {
        qrImg.style.display = "none";
        qrLink.innerText = "(Không có QR để hiển thị)";
      }
    })
    .catch((error) => {
      alert(`❌ ${error.message}`);
    });
}
