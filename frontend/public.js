const API = "https://api.thefram.site";  // Đảm bảo API đúng
const id = new URLSearchParams(location.search).get("id");  // Lấy ID từ URL

if (!id) {
  alert("❌ Thiếu ID cây");
  history.back();  // Quay lại trang trước nếu không có ID
}

fetch(`${API}/api/trees/public/${id}`)
  .then(res => {
    if (!res.ok) throw new Error("Không thể tải thông tin cây");
    return res.json();
  })
  .then(t => {
    // Hiển thị thông tin cây từ API
    document.getElementById("name").innerText = t.name || "-";
    document.getElementById("species").innerText = t.species || "-";
    document.getElementById("area").innerText = t.area || "-";
    document.getElementById("location").innerText = t.location || "-";
    document.getElementById("gardenAddress").innerText = t.gardenAddress || "-";
    document.getElementById("plantDate").innerText = t.plantDate ? new Date(t.plantDate).toLocaleDateString() : "-";
    document.getElementById("health").innerText = t.currentHealth || "-";

    // Hiển thị ảnh QR từ base64
    const qrImage = document.createElement("img");
    qrImage.src = t.qrCode;  // ảnh base64 từ API
    document.getElementById("qrImage").src = qrImage.src;
    document.getElementById("qrImage").style.display = "block";  // Hiển thị ảnh QR
    document.getElementById("qrLink").innerText = "Tải QR Code: " + qrImage.src; // Hiển thị URL QR
  })
  .catch(error => {
    alert(`❌ ${error.message}`);
    history.back();  // Quay lại nếu không tải được thông tin cây
  });
