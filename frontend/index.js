const API = "https://api.thefram.site";
const PAGE_SIZE = 20;

let all = [];
let view = [];
let page = 1;

let modal;
let currentTree = null;

const $ = (id) => document.getElementById(id);

function getToken(){ return localStorage.getItem("token") || ""; }
function getRole(){ return (localStorage.getItem("role") || "").toLowerCase(); }
function getName(){ return localStorage.getItem("name") || ""; }

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

function healthBadge(text){
  const t = (text || "").toLowerCase();
  if (!t) return `<span class="badge text-bg-secondary">-</span>`;
  if (t.includes("tốt") || t.includes("khoẻ") || t.includes("khỏe")) return `<span class="badge text-bg-success">${text}</span>`;
  if (t.includes("theo dõi") || t.includes("canh") || t.includes("cảnh")) return `<span class="badge text-bg-warning">${text}</span>`;
  if (t.includes("bệnh") || t.includes("xấu") || t.includes("yếu")) return `<span class="badge text-bg-danger">${text}</span>`;
  return `<span class="badge text-bg-primary">${text}</span>`;
}

function publicLink(tree){
  return `${location.origin}/public.html?treeId=${encodeURIComponent(tree._id)}`;
}

function renderStats(data){
  $("kpiTotal").textContent = data.length;

  const scans = data.reduce((s,x)=>s+(x.qrScans||0),0);
  $("kpiScans").textContent = scans;

  const areas = new Set(data.map(x=>x.area).filter(Boolean));
  $("kpiAreas").textContent = areas.size;

  const map = {};
  for(const x of data){
    const h = (x.currentHealth || "-").trim();
    map[h] = (map[h]||0) + 1;
  }
  const top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
  $("kpiHealth").textContent = top ? `${top[0]} (${top[1]})` : "-";
}

function fillAreaFilter(data){
  const areas = Array.from(new Set(data.map(x=>x.area).filter(Boolean))).sort();
  $("filterArea").innerHTML = `<option value="">Tất cả</option>` +
    areas.map(a=>`<option value="${a}">${a}</option>`).join("");
}

function applyFilters(){
  const q = ($("search").value || "").toLowerCase().trim();
  const area = $("filterArea").value;
  const sort = $("sort").value;

  view = all.filter(x=>{
    if(area && x.area !== area) return false;
    if(!q) return true;
    const hay = `${x.name||""} ${x.numericId||""} ${x.area||""} ${x.currentHealth||""}`.toLowerCase();
    return hay.includes(q);
  });

  const [field, dir] = sort.split("-");
  const mul = dir === "desc" ? -1 : 1;

  view.sort((a,b)=>{
    if(field === "numericId") return ((a.numericId||0) - (b.numericId||0)) * mul;
    if(field === "qrScans") return ((a.qrScans||0) - (b.qrScans||0)) * mul;
    if(field === "name") return String(a.name||"").localeCompare(String(b.name||"")) * mul;
    return 0;
  });

  page = 1;
  renderTable();
}

function renderTable(){
  const total = view.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(page > totalPages) page = totalPages;

  const start = (page-1) * PAGE_SIZE;
  const rows = view.slice(start, start + PAGE_SIZE);

  $("countHint").textContent = `${total} cây`;
  $("pageHint").textContent = `Trang ${page}/${totalPages}`;

  const tbody = $("tbody");
  if(rows.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Không có dữ liệu</td></tr>`;
    return;
  }

  const isOwner = getRole() === "owner";

  tbody.innerHTML = rows.map(t=>{
    const link = publicLink(t);
    return `
      <tr>
        <td class="fw-semibold">${t.numericId ?? "-"}</td>
        <td>
          <div class="fw-semibold">${t.name || "-"}</div>
          <div class="text-muted small">${t._id}</div>
        </td>
        <td>${t.area || "-"}</td>
        <td>${healthBadge(t.currentHealth)}</td>
        <td class="fw-semibold">${t.qrScans ?? 0}</td>
        <td class="action-btns">
          <a class="btn btn-outline-secondary btn-sm" target="_blank" href="${link}">
            <i class="bi bi-box-arrow-up-right me-1"></i> Public
          </a>
          <button class="btn btn-outline-success btn-sm" data-copy="${link}">
            <i class="bi bi-clipboard me-1"></i> Copy link
          </button>
          <button class="btn btn-success btn-sm" data-health="${t._id}">
            <i class="bi bi-clipboard2-pulse me-1"></i> Cập nhật
          </button>
          ${isOwner ? `
            <a class="btn btn-primary btn-sm" href="tree-edit.html?id=${encodeURIComponent(t._id)}">
              <i class="bi bi-pencil-square me-1"></i> Sửa
            </a>
          ` : ``}
        </td>
      </tr>
    `;
  }).join("");

  // copy
  tbody.querySelectorAll("button[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
        const old = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-check2 me-1"></i> Đã copy`;
        setTimeout(()=>btn.innerHTML = old, 900);
      }catch{
        alert("Không copy được trên thiết bị này.");
      }
    });
  });

  // modal health
  tbody.querySelectorAll("button[data-health]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-health");
      const tree = all.find(x=>String(x._id) === String(id));
      if(!tree) return;

      currentTree = tree;

      $("mSub").textContent = `${tree.name || "-"} • Mã ${tree.numericId ?? "-"}`;
      $("mHealth").value = tree.currentHealth || "Tốt";
      $("mNotes").value = "";
      $("mErr").classList.add("d-none");
      $("mErr").textContent = "";

      modal.show();
    });
  });
}

function exportCSV(){
  const rows = view.map(t=>({
    numericId: t.numericId ?? "",
    name: t.name ?? "",
    area: t.area ?? "",
    currentHealth: t.currentHealth ?? "",
    qrScans: t.qrScans ?? 0,
    publicLink: publicLink(t),
    id: t._id
  }));

  const header = Object.keys(rows[0] || {
    numericId:"", name:"", area:"", currentHealth:"", qrScans:"", publicLink:"", id:""
  });

  const csv = [
    header.join(","),
    ...rows.map(r => header.map(k => `"${String(r[k] ?? "").replace(/"/g,'""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trees_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveHealth(){
  if(!currentTree) return;

  $("mSpin").classList.remove("d-none");
  $("mSave").disabled = true;
  $("mErr").classList.add("d-none");
  $("mErr").textContent = "";

  try{
    const res = await fetch(`${API}/api/trees/${encodeURIComponent(currentTree._id)}/health`,{
      method:"PUT",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${getToken()}`
      },
      body: JSON.stringify({
        currentHealth: $("mHealth").value,
        notes: $("mNotes").value.trim()
      })
    });

    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data?.message || "Lưu thất bại");

    currentTree.currentHealth = data.currentHealth || $("mHealth").value;
    applyFilters();
    modal.hide();
  }catch(e){
    $("mErr").textContent = e.message;
    $("mErr").classList.remove("d-none");
  }finally{
    $("mSpin").classList.add("d-none");
    $("mSave").disabled = false;
  }
}

async function load(){
  hideError();

  const token = getToken();
  if(!token){
    location.href = "login.html";
    return;
  }

  const role = getRole();
  const isOwner = role === "owner";

  $("badgeRole").textContent = role ? role.toUpperCase() : "USER";
  $("hello").textContent = getName() ? `Xin chào, ${getName()}` : "";

  $("btnUsers").classList.toggle("d-none", !isOwner);
  $("btnQrSettings").classList.toggle("d-none", !isOwner);
  $("btnAddTree").classList.toggle("d-none", !isOwner);

  try{
    const res = await fetch(`${API}/api/trees/dashboard/list`,{
      headers:{ Authorization:`Bearer ${token}` }
    });

    if(!res.ok){
      const txt = await res.text().catch(()=> "");
      throw new Error(`Không tải được danh sách (${res.status}) ${txt}`);
    }

    all = await res.json();
    renderStats(all);
    fillAreaFilter(all);
    applyFilters();
  }catch(e){
    showError(e.message);
    $("tbody").innerHTML = `<tr><td colspan="6" class="text-muted">Lỗi tải dữ liệu</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("btnLogout").addEventListener("click", logout);
  $("search").addEventListener("input", applyFilters);
  $("filterArea").addEventListener("change", applyFilters);
  $("sort").addEventListener("change", applyFilters);

  $("btnPrev").addEventListener("click", ()=>{ page = Math.max(1, page-1); renderTable(); });
  $("btnNext").addEventListener("click", ()=>{ page = page+1; renderTable(); });

  $("btnExport").addEventListener("click", exportCSV);

  modal = new bootstrap.Modal(document.getElementById("modalHealth"));
  $("mSave").addEventListener("click", saveHealth);

  load();
});
