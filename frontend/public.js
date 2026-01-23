const API = "https://api.thefram.site";
let id = new URLSearchParams(location.search).get("id");

// 🔥 FIX: fallback khi QR cũ không có ?id=
if (!id) {
  const parts = window.location.pathname.split("/");
  id = parts[parts.length - 1];
}

// 🔥 FIX lần cuối: nếu vẫn không có id → show lỗi nhẹ
if (!id || id === "public.html") {
  document.body.innerHTML = `
    <h3 style="text-align:center">
      ❌ Không xác định được cây<br>
      Vui lòng quét lại mã QR
    </h3>`;
  throw new Error("Missing tree id");
}

// ===== LIÊN HỆ =====
const ZALO_PHONE = "84901234567";
const FB_PAGE = "https://www.facebook.com/thanhhuyenfarm";

zaloLink.href = `https://zalo.me/${ZALO_PHONE}`;
fbLink.href = FB_PAGE;

// ===== LOAD CÂY =====
fetch(`${API}/api/trees/${id}`)
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
