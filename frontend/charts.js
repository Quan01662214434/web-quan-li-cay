async function loadChart() {
  hideAll();
  charts.style.display = "block";

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (role !== "owner") {
    charts.innerHTML = "<p>Không có quyền xem thống kê</p>";
    return;
  }

  const res = await fetch(`${API}/api/trees/stats/qr`, {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  const labels = data.map(d => d.label);
  const values = data.map(d => d.value);

  charts.innerHTML = `<canvas id="qrChart"></canvas>`;

  new Chart(document.getElementById("qrChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Lượt quét QR",
        data: values,
        backgroundColor: "#2e7d32"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}
async function loadAuditChart() {
  hideAll();
  charts.style.display = "block";

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (role !== "owner") {
    charts.innerHTML = "<p>Không có quyền</p>";
    return;
  }

  const res = await fetch(`${API}/api/audit/stats/users`, {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  charts.innerHTML = `<canvas id="auditChart"></canvas>`;

  new Chart(document.getElementById("auditChart"), {
    type: "bar",
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: "Số lần chỉnh sửa",
        data: data.map(d => d.value),
        backgroundColor: "#1565c0"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

