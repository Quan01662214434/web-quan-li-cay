const API = "https://api.thefram.site";
const $ = (id) => document.getElementById(id);

function token(){ return localStorage.getItem("token") || ""; }
function role(){ return (localStorage.getItem("role") || "").toLowerCase(); }
function name(){ return localStorage.getItem("name") || ""; }

function logout(){
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  location.href = "login.html";
}

function showError(msg){
  $("error").textContent = msg;
  $("error").classList.remove("d-none");
}
function hideError(){
  $("error").textContent = "";
  $("error").classList.add("d-none");
}

let users = [];
let modal;

function badgeRole(r){
  const v = (r || "").toLowerCase();
  if (v === "owner") return `<span class="badge text-bg-primary">OWNER</span>`;
  if (v === "staff") return `<span class="badge text-bg-success">STAFF</span>`;
  return `<span class="badge text-bg-secondary">${(r||"-").toUpperCase()}</span>`;
}

async function api(path, options = {}){
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token()}`,
      "Content-Type": options.body ? "application/json" : (options.headers?.["Content-Type"] || undefined)
    }
  });

  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.message || `Lỗi (${res.status})`);
  return data;
}

async function loadUsers(){
  hideError();

  if(!token()) return location.href = "login.html";
  if(role() !== "owner"){
    alert("❌ Bạn không có quyền truy cập");
    return location.href = "index.html";
  }

  $("badgeRole").textContent = "OWNER";
  $("hint").textContent = "Đang tải...";

  try{
    // ✅ 1) LIST USERS
    const data = await api("/api/users", { method:"GET" });
    users = Array.isArray(data) ? data : (data.users || []);
    $("hint").textContent = `${users.length} tài khoản`;
    render();
  }catch(e){
    showError(e.message);
    $("tbody").innerHTML = `<tr><td colspan="4" class="text-muted">Lỗi tải dữ liệu</td></tr>`;
  }
}

function applyFilterLocal(){
  const q = ($("search").value || "").toLowerCase().trim();
  const fRole = ($("filterRole").value || "").toLowerCase();

  return users.filter(u=>{
    const r = (u.role || "").toLowerCase();
    if(fRole && r !== fRole) return false;
    if(!q) return true;

    const hay = `${u.name||""} ${u.email||""} ${u.role||""}`.toLowerCase();
    return hay.includes(q);
  });
}

function render(){
  const list = applyFilterLocal();
  $("hint").textContent = `${list.length}/${users.length} tài khoản`;

  const tbody = $("tbody");
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u=>`
    <tr>
      <td>
        <div class="fw-semibold">${u.name || "-"}</div>
        <div class="text-muted small">${u._id || ""}</div>
      </td>
      <td>${u.email || "-"}</td>
      <td>${badgeRole(u.role)}</td>
      <td class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary btn-sm" data-toggle-role="${u._id}" data-next="${(u.role||"").toLowerCase()==="owner" ? "staff" : "owner"}">
          <i class="bi bi-shuffle me-1"></i> Đổi role
        </button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("button[data-toggle-role]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-toggle-role");
      const next = btn.getAttribute("data-next");
      if(!confirm(`Đổi role thành "${next}"?`)) return;

      try{
        // ✅ 2) UPDATE ROLE
        await api(`/api/users/${encodeURIComponent(id)}`, {
          method:"PUT",
          body: JSON.stringify({ role: next })
        });
        await loadUsers();
      }catch(e){
        alert("❌ " + e.message);
      }
    });
  });
}

function setAddLoading(on){
  $("aSave").disabled = on;
  $("aSpin").classList.toggle("d-none", !on);
}

async function addUser(){
  $("aErr").classList.add("d-none");
  $("aErr").textContent = "";

  const body = {
    name: ($("aName").value || "").trim(),
    email: ($("aEmail").value || "").trim(),
    password: $("aPass").value || "",
    role: $("aRole").value
  };

  if(!body.name || !body.email || !body.password){
    $("aErr").textContent = "Vui lòng nhập đủ Tên/Email/Mật khẩu";
    $("aErr").classList.remove("d-none");
    return;
  }

  setAddLoading(true);
  try{
    // ✅ 3) CREATE USER
    await api("/api/users", {
      method:"POST",
      body: JSON.stringify(body)
    });

    modal.hide();
    $("aName").value = "";
    $("aEmail").value = "";
    $("aPass").value = "";
    $("aRole").value = "staff";

    await loadUsers();
  }catch(e){
    $("aErr").textContent = e.message;
    $("aErr").classList.remove("d-none");
  }finally{
    setAddLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("btnLogout").addEventListener("click", logout);
  $("btnRefresh").addEventListener("click", loadUsers);

  $("search").addEventListener("input", render);
  $("filterRole").addEventListener("change", render);

  modal = new bootstrap.Modal(document.getElementById("modalAdd"));

  $("btnOpenAdd").addEventListener("click", ()=> modal.show());
  $("aSave").addEventListener("click", addUser);

  $("aTogglePw").addEventListener("click", ()=>{
    const ip = $("aPass");
    const icon = $("aTogglePw").querySelector("i");
    const is = ip.type === "password";
    ip.type = is ? "text" : "password";
    icon.className = is ? "bi bi-eye-slash" : "bi bi-eye";
  });

  loadUsers();
});
