const API = "https://api.thefram.site";

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.value,
      password: password.value
    })
  });

  const data = await res.json();
  if (!res.ok) {
    error.innerText = data.message;
    return;
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("name", data.name);
  location.href = "index.html";
}
