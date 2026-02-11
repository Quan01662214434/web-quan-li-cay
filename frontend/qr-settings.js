const API = "https://api.thefram.site";

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) location.href = "login.html";
if (role !== "owner") {
  alert("❌ Bạn không có quyền truy cập trang này");
  location.href = "index.html";
}

const ALL_FIELDS = [
  { key: "name", label: "Tên cây" },
  { key: "species", label: "Giống" },
  { key: "area", label: "Khu" },
  { key: "location", label: "Vị trí" },
  { key: "gardenAddress", label: "Địa chỉ vườn" },
  { key: "plantDate", label: "Ngày trồng" },
  { key: "vietGapCode", label: "Mã VietGAP" },
  { key: "currentHealth", label: "Tình trạng" },
  { key: "yieldSummary", label: "Năng suất (tổng + gần nhất)" }
];

async function loadConfig() {
  const box = document.getElementById("fields");
  box.innerHTML = "Đang tải...";

  const res = await fetch(`${API}/api/qr-settings`, {
    headers: { Authorization: "Bearer " + token }
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    alert(`❌ Load cấu hình thất bại (${res.status}) ${txt}`);
    box.innerHTML = "";
    return;
  }

  const cfg = await res.json();
  const selected = Array.isArray(cfg.fields) ? cfg.fields : [];

  box.innerHTML = "";
  ALL_FIELDS.forEach((f) => {
    const checked = selected.includes(f.key) ? "checked" : "";
    box.innerHTML += `
      <div class="field">
        <label style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" value="${f.key}" ${checked}>
          <span>${f.label}</span>
        </label>
      </div>
    `;
  });

  document.getElementById("zalo").value = cfg.contacts?.zalo || "";
  document.getElementById("phone").value = cfg.contacts?.phone || "";
  document.getElementById("facebook").value = cfg.contacts?.facebook || "";
  document.getElementById("showQrImage").checked = !!cfg.showQrImage;
}

async function save() {
  const fields = [...document.querySelectorAll("#fields input[type='checkbox']:checked")]
    .map(i => i.value);

  const contacts = {
    zalo: (document.getElementById("zalo").value || "").trim(),
    phone: (document.getElementById("phone").value || "").trim(),
    facebook: (document.getElementById("facebook").value || "").trim()
  };

  const showQrImage = !!document.getElementById("showQrImage").checked;

  const res = await fetch(`${API}/api/qr-settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ fields, contacts, showQrImage })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    alert(`❌ Lưu thất bại (${res.status}) ${txt}`);
    return;
  }

  alert("✅ Đã lưu cấu hình QR");
}

window.save = save;
loadConfig();
