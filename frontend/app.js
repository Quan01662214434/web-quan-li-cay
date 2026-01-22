/* ================== CONFIG ================== */
const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const name = localStorage.getItem("name");

/* ================== AUTH CHECK ================== */
if (!token) {
  location.href = "login.html";
}

/* ================== UI INIT ================== */
document.getElementById("welcome").innerText =
  "👋 Xin chào " + (name || "");

/* Ẩn menu owner nếu là staff */
document.querySelectorAll(".owner-only").forEach(el => {
  if (role !== "owner") el.style.display = "none";
});

/* ================== MENU ================== */
function toggleMenu() {
  document.querySelector(".sidebar").classList.toggle("show");
}

function logout() {
  localStorage.clear();
  location.href = "login.html";
}

/* ================== LOAD TREES ================== */
async function loadTrees() {
  const res = await fetch(`${API}/api/trees`, {
    headers: { Authorization: "Bearer " + token }
  });

  const trees = await res.json();

  document.getElementById("content").innerHTML = `
    <h3>🌳 Danh sách cây trồng</h3>

    <table>
      <tr>
        <th>Mã</th>
        <th>Tên</th>
        <th>Khu</th>
        <th>Vị trí</th>
        <th>QR</th>
      </tr>
      ${trees.map(t => `
        <tr>
          <td>${t.numericId || ""}</td>
          <td>${t.name || ""}</td>
          <td>${t.area || ""}</td>
          <td>${t.location || ""}</td>
          <td>
            <a href="public.html?id=${t._id}" target="_blank">🔍</a>
          </td>
        </tr>
      `).join("")}
    </table>

    ${trees.map(t => `
      <div class="tree-card">
        <h4>${t.name}</h4>
        <div><b>Khu:</b> ${t.area}</div>
        <div><b>Vị trí:</b> ${t.location}</div>
        <a href="public.html?id=${t._id}" target="_blank">🔍 Xem QR</a>
      </div>
    `).join("")}
  `;
}

/* ================== QR CHART ================== */
async function loadChart() {
  document.getElementById("content").innerHTML = `
    <h3>📊 Thống kê lượt quét QR</h3>
    <canvas id="qrChart" height="120"></canvas>
  `;

  drawQRChart();
}

/* ================== USERS ================== */
function loadUsers() {
  if (role !== "owner") return;

  document.getElementById("content").innerHTML = `
    <h3>👷 Quản lý nhân viên</h3>
    <iframe src="employees.html"
      style="width:100%;height:80vh;border:none"></iframe>
  `;
}

/* ================== REPORT ================== */
function loadReport() {
  if (role !== "owner") return;
  location.href = "report.html";
}

/* ================== DEFAULT ================== */
loadTrees();
