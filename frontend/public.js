const API = "https://api.thefram.site";
let id = new URLSearchParams(location.search).get("id");

// ===== FIX CHO QR CŨ =====
if (!id) {
  // 1️⃣ thử lấy numericId từ hash (#3, #5…)
  if (location.hash) {
    id = location.hash.replace("#", "");
  }
}

// ===== NẾU VẪN KHÔNG CÓ → DÙNG MẶC ĐỊNH =====
if (!id) {
  document.body.innerHTML = `
    <h3 style="text-align:center">
      ❌ Mã QR cũ không chứa thông tin cây<br>
      Vui lòng liên hệ Thanh Huyền Farm
    </h3>`;
  throw new Error("Missing tree identifier");
}
// ===== LIÊN HỆ =====
const ZALO_PHONE = "84901234567";
const FB_PAGE = "https://www.facebook.com/thanhhuyenfarm";

zaloLink.href = `https://zalo.me/${ZALO_PHONE}`;
fbLink.href = FB_PAGE;

// ===== LOAD CÂY =====
fetch(`${API}/api/trees/public/${id}`)
  .then(res => {
    if (!res.ok) throw new Error("Không tìm thấy cây");
    return res.json();
  })
  .then(t => {
    name.innerText = t.name || "-";
    species.innerText = t.species || "-";
    area.innerText = t.area || "-";
    location.innerText = t.location || "-";
    gardenAddress.innerText = t.gardenAddress || "-";
    health.innerText = t.currentHealth || "-";
    vietgap.innerText = t.vietGapCode
      ? `✔ VietGAP: ${t.vietGapCode}`
      : "✔ Đạt chuẩn VietGAP";

    plantDate.innerText = t.plantDate
      ? new Date(t.plantDate).toLocaleDateString("vi-VN")
      : "-";

    treeImage.src =
      t.imageURL && t.imageURL.trim() !== ""
        ? t.imageURL
        : "https://via.placeholder.com/400x220?text=Thanh+Huyen+Farm";

    // ===== LOG QR SCAN =====
    fetch(`${API}/api/trees/${id}/scan`, { method: "POST" });
  })
  .catch(err => {
    document.body.innerHTML = "<h3>❌ Không tải được thông tin cây</h3>";
    console.error(err);
  });
