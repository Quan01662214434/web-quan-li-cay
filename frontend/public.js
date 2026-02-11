const API = "https://api.thefram.site";

function getTreeCode() {
  const params = new URLSearchParams(location.search);

  // ✅ QR của bạn đang dùng treeId=...
  let code =
    params.get("treeId") ||
    params.get("id") ||
    params.get("code") ||
    params.get("_id") ||
    params.get("numericId") ||
    params.get("vietGapCode") ||
    params.get("yieldGapCode");

  if (code && code.trim()) return code.trim();

  // Hỗ trợ dạng hash: public.html#<code>
  if (location.hash && location.hash.length > 1) {
    const h = location.hash.replace(/^#/, "").trim();
    if (h) return h;
  }

  // Hỗ trợ dạng đường dẫn: /t/<code>
  const m = location.pathname.match(/\/t\/([^\/?#]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]).trim();

  return "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value ?? "-";
}

function showError(msg) {
  alert("❌ " + msg + "\n\nURL hiện tại:\n" + location.href);
}

(async function main() {
  const code = getTreeCode();

  if (!code) {
    showError("Thiếu ID/mã cây. Link QR phải có ?treeId=... (hoặc ?id=..., ?code=...).");
    return;
  }

  try {
    const res = await fetch(`${API}/api/trees/public/${encodeURIComponent(code)}`);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Không thể tải thông tin cây (${res.status}) ${txt}`);
    }

    const t = await res.json();

    setText("name", t.name);
    setText("species", t.species);
    setText("area", t.area);
    setText("location", t.location);
    setText("gardenAddress", t.gardenAddress);
    setText("plantDate", t.plantDate ? new Date(t.plantDate).toLocaleDateString("vi-VN") : "-");
    setText("health", t.currentHealth);

    // QR hiển thị (nếu muốn show lại QR)
    const qrImg = document.getElementById("qrImage");
    const qrLink = document.getElementById("qrLink");

    if (t.qrCode && qrImg && qrLink) {
      qrImg.src = t.qrCode;
      qrImg.style.display = "block";
      qrLink.innerHTML = `<a href="${t.qrCode}" download="qr-${t.numericId || t.vietGapCode || "tree"}.png">Tải QR Code</a>`;
    } else if (qrImg && qrLink) {
      qrImg.style.display = "none";
      qrLink.innerText = "(Không có QR để hiển thị)";
    }
  } catch (e) {
    showError(e.message);
  }
})();
