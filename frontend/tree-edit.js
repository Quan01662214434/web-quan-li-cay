const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
if (!token) location.href = "login.html";

const role = localStorage.getItem("role");
document.querySelectorAll(".owner-only").forEach(el => {
  if (role !== "owner") el.style.display = "none";
});

const id = new URLSearchParams(location.search).get("id");
if (!id) {
  alert("Thiếu ID cây");
  location.href = "index.html";
}

/* Load cây */
fetch(`${API}/api/trees/${id}`)
  .then(res => res.json())
  .then(t => {
    name.value = t.name || "";
    species.value = t.species || "";
    area.value = t.area || "";
    location.value = t.location || "";
    gardenAddress.value = t.gardenAddress || "";
    managerName.value = t.managerName || "";
    plantDate.value = t.plantDate ? t.plantDate.substr(0,10) : "";
    currentHealth.value = t.currentHealth || "Bình thường";
    vietGapCode.value = t.vietGapCode || "";
    notes.value = t.notes || "";
  });

/* Save */
async function save() {
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
      managerName: managerName.value,
      plantDate: plantDate.value,
      currentHealth: currentHealth.value,
      vietGapCode: vietGapCode.value,
      notes: notes.value
    })
  });

  alert("✅ Đã lưu");
}
