const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
  location.href = "login.html";
}

if (role !== "owner") {
  alert("❌ Bạn không có quyền truy cập trang này");
  location.href = "index.html";
}


/* Danh sách field PHÙ HỢP MONGODB */
const ALL_FIELDS = [
  { key: "name", label: "Tên cây" },
  { key: "species", label: "Giống" },
  { key: "area", label: "Khu" },
  { key: "location", label: "Vị trí" },
  { key: "gardenAddress", label: "Địa chỉ vườn" },
  { key: "plantDate", label: "Ngày trồng" },
  { key: "vietGapCode", label: "Mã VietGAP" },
  { key: "currentHealth", label: "Tình trạng" }
];

/* Load cấu hình */
fetch(`${API}/api/qr-settings`)
  .then(r => r.json())
  .then(cfg => {
    const box = document.getElementById("fields");
    ALL_FIELDS.forEach(f => {
      box.innerHTML += `
        <div class="field">
          <input type="checkbox" value="${f.key}"
            ${cfg.fields?.includes(f.key) ? "checked" : ""}>
          ${f.label}
        </div>
      `;
    });
  });

/* Save */
async function save() {
  const fields = [...document.querySelectorAll("input:checked")]
    .map(i => i.value);

  await fetch(`${API}/api/qr-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ fields })
  });

  alert("✅ Đã lưu cấu hình QR");
}

