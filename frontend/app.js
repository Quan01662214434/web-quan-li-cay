const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) location.href = "login.html";

// Ẩn menu owner nếu là staff
document.querySelectorAll(".owner-only").forEach(el => {
  if (role !== "owner") el.style.display = "none";
});

// Welcome
document.getElementById("welcome").innerText =
  "👋 Xin chào " + (localStorage.getItem("name") || "");

// ===== LOAD CÂY =====
async function loadTrees() {
  const content = document.getElementById("content");
  content.innerHTML = "⏳ Đang tải danh sách cây...";

  const res = await fetch(`${API}/api/trees`, {
    headers: { Authorization: "Bearer " + token }
  });
  const trees = await res.json();

  content.innerHTML = `
    <h3>🌳 Danh sách cây</h3>

    <table>
      <tr>
        <th>Mã</th>
        <th>Tên</th>
        <th>Khu</th>
        <th>Vị trí</th>
      </tr>
      ${trees.map(t => `
        <tr onclick="openTree('${t._id}')">
          <td>${t.numericId || ""}</td>
          <td>${t.name}</td>
          <td>${t.area}</td>
          <td>${t.location}</td>
        </tr>
      `).join("")}
    </table>

    ${trees.map(t => `
      <div class="tree-card" onclick="openTree('${t._id}')">
        <h4>${t.name}</h4>
        <div>Khu: ${t.area}</div>
        <div>Vị trí: ${t.location}</div>
      </div>
    `).join("")}
  `;
}

function openTree(id) {
  location.href = `tree-edit.html?id=${id}`;
}

function logout() {
  localStorage.clear();
  location.href = "login.html";
}

// Load mặc định
loadTrees();
