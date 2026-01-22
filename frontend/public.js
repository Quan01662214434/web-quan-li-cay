const API = "https://api.thefram.site";

// lấy id từ QR
const id = new URLSearchParams(location.search).get("id");

if (!id) {
  alert("Thiếu ID cây");
}

// link liên hệ
const ZALO_PHONE = "84901234567";
const FB_PAGE = "https://www.facebook.com/thanhhuyenfarm";

zaloLink.href = `https://zalo.me/${ZALO_PHONE}`;
fbLink.href = FB_PAGE;

// load cây
fetch(`${API}/api/trees/${id}`)
  .then(res => res.json())
  .then(t => {
    name.innerText = t.name || "-";
    species.innerText = t.species || "-";
    area.innerText = t.area || "-";
    location.innerText = t.location || "-";
    gardenAddress.innerText = t.gardenAddress || "-";
    health.innerText = t.currentHealth || "-";
    vietgap.innerText = t.vietGapCode || "Đạt chuẩn";

    plantDate.innerText = t.plantDate
      ? new Date(t.plantDate).toLocaleDateString("vi-VN")
      : "-";

    treeImage.src = t.imageURL || "https://via.placeholder.com/400x220?text=Thanh+Huyen+Farm";
  });

// log lượt quét
fetch(`${API}/api/audit/scan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ treeId: id })
});
