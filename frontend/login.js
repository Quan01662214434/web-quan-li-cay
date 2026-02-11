const API = "https://api.thefram.site";
const $ = (id) => document.getElementById(id);

function showAlert(msg){
  $("alert").textContent = msg;
  $("alert").classList.remove("d-none");
}
function hideAlert(){
  $("alert").textContent = "";
  $("alert").classList.add("d-none");
}
function setLoading(on){
  $("btnLogin").disabled = on;
  $("spin").classList.toggle("d-none", !on);
}

function pickTokenRole(payload){
  const token = payload?.token || payload?.accessToken || payload?.data?.token || payload?.data?.accessToken || "";
  const user = payload?.user || payload?.data?.user || payload?.data || {};
  const role = (user?.role || payload?.role || "").toLowerCase();
  const name = user?.name || payload?.name || "";
  return { token, role, name };
}

$("togglePw").addEventListener("click", ()=>{
  const pw = $("password");
  const icon = $("togglePw").querySelector("i");
  const is = pw.type === "password";
  pw.type = is ? "text" : "password";
  icon.className = is ? "bi bi-eye-slash" : "bi bi-eye";
});

$("formLogin").addEventListener("submit", async (e)=>{
  e.preventDefault();
  hideAlert();
  setLoading(true);
  try{
    const email = $("email").value.trim();
    const password = $("password").value;

    const res = await fetch(`${API}/api/auth/login`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data?.message || "Đăng nhập thất bại");

    const { token, role, name } = pickTokenRole(data);
    if(!token) throw new Error("Không nhận được token từ server");

    localStorage.setItem("token", token);
    if(role) localStorage.setItem("role", role);
    if(name) localStorage.setItem("name", name);

    location.href = "index.html";
  }catch(err){
    showAlert(err.message);
  }finally{
    setLoading(false);
  }
});
