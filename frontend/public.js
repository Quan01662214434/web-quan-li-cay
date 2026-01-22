const API = "https://api.thefram.site";
const id = new URLSearchParams(location.search).get("id");

if (!id) {
  document.body.innerHTML = "<h3>❌ Thiếu ID cây</h3>";
  throw new Error("Missing tree id");
}

// Liên hệ
const ZALO_PHONE = "84901234567";
const FB_PAGE = "https://www.facebook.com/thanhhuyenfarm";

zaloLink.href = `https://zalo.me/${ZALO_PHONE}`;
fbLink.href = FB_PAGE;

// Load cây
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
    vietgap.innerText = t.vietGapCode || "Đạt chuẩn VietGAP";

    plantDate.innerText = t.plantDate
      ? new Date(t.plantDate).toLocaleDateString("vi-VN")
      : "-";

    treeImage.src =
      t.imageURL && t.imageURL.trim() !== ""
        ? t.imageURL
        : "https://via.placeholder.com/400x220?text=Thanh+Huyen+Farm";
  })
  .catch(err => {
    document.body.innerHTML = "<h3>❌ Không tải được thông tin cây</h3>";
    console.error(err);
  });
