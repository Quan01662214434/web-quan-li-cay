const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
  location.href = "login.html";
}

const id = new URLSearchParams(location.search).get("id");
if (!id) {
  alert("❌ Thiếu ID cây");
  history.back();
}

/* ================== PHÂN QUYỀN ================== */
document.querySelectorAll(".owner-only").forEach(el => {
  if (role !== "owner") el.style.display = "none";
});

/* ================== LOAD CÂY ================== */
fetch(`${API}/api/trees/${id}`, {
  headers: { Authorization: "Bearer " + token }
})
.then(res => res.json())
.then(t => {
  name.value = t.name || "";
  species.value = t.species || "";
  area.value = t.area || "";
  location.value = t.location || "";
  gardenAddress.value = t.gardenAddress || "";
  plantDate.value = t.plantDate ? t.plantDate.substr(0,10) : "";
  currentHealth.value = t.currentHealth || "Bình thường";
  vietGapCode.value = t.vietGapCode || "";
  notes.value = t.notes || "";
  managerName.value = t.managerName || "";

  const qrURL = location.origin + "/public.html?id=" + id;
  qrLink.innerText = qrURL;
  qrLink.href = qrURL;
});

/* ================== UPLOAD ẢNH ================== */
async function uploadImage() {
  if (!image.files[0]) return null;

  const form = new FormData();
  form.append("image", image.files[0]);

  const res = await fetch(`${API}/api/trees/${id}/image`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: form
  });

  const data = await res.json();
  return data.imageURL;
}

/* ================== SAVE ================== */
async function save() {
  const imageURL = await uploadImage();

  await fetch(`${API}/api/trees/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      name: name.value,
      species: species.value,
      area: area.value,
      location: location.value,
      gardenAddress: gardenAddress.value,
      plantDate: plantDate.value,
      currentHealth: currentHealth.value,
      vietGapCode: vietGapCode.value,
      notes: notes.value,
      managerName: managerName.value,
      imageURL
    })
  });

  alert("✅ Đã lưu thông tin cây");
}
