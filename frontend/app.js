const API = "https://api.thefram.site";
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) location.href = "login.html";

// Ẩn menu owner-only
document.querySelectorAll(".owner-only").forEach(el => {
  if (role !== "owner") el.style.display = "none";
});

function toggleMenu() {
  document.querySelector(".sidebar")?.classList.toggle("show");
}

function logout() {
  localStorage.clear();
  location.href = "login.html";
}

/* =====================
   LOAD CÂY – MOBILE FIRST
===================== */
async function loadTrees() {
  hideAll();

  const content = document.getElementById("content");
  content.innerHTML = "<p>⏳ Đang tải...</p>";

  const res = await fetch(`${API}/api/trees/dashboard/list`, {
    headers: { Authorization: "Bearer " + token }
  });
  const trees = await res.json();

  const isMobile = window.innerWidth < 768;
  content.innerHTML = "";

  // ===== MOBILE: CARD =====
  if (isMobile) {
    trees.forEach(t => {
      content.innerHTML += `
        <div class="card" onclick="openTree('${t._id}')">
          <div style="font-weight:600">${t.name}</div>
          <div style="font-size:14px;color:#666">
            🌱 ${t.area || "-"} | QR: ${t.qrScans || 0}
          </div>
          <div style="margin-top:6px">
            🩺 ${t.currentHealth || "—"}
          </div>
        </div>
      `;
    });
  }

  // ===== DESKTOP: TABLE =====
  else {
    content.innerHTML = `
      <table class="table">
        <tr>
          <th>Mã</th>
          <th>Tên</th>
          <th>Khu</th>
          <th>Tình trạng</th>
        </tr>
        ${trees.map(t => `
          <tr onclick="openTree('${t._id}')">
            <td>${t.numericId || ""}</td>
            <td>${t.name}</td>
            <td>${t.area || "-"}</td>
            <td>${t.currentHealth || "-"}</td>
          </tr>
        `).join("")}
      </table>
    `;
  }
}

/* =====================
   HIDE ALL
===================== */
function hideAll() {
  document.getElementById("content").innerHTML = "";
}

/* =====================
   OPEN TREE
===================== */
function openTree(id) {
  location.href = `tree-edit.html?id=${id}`;
}

/* =====================
   INIT
===================== */
loadTrees();

// Welcome
const name = localStorage.getItem("name") || "";
document.getElementById("welcome").innerText =
  "👋 Xin chào " + name;
