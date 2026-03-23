/* ===== Thai Comment Manager — Popup v3.1 ===== */

const statusEl = document.getElementById("status");
const autoTranslateCommentsEl = document.getElementById("autoTranslateComments");
const exportLimitEl = document.getElementById("exportLimit");
const autoOpenGeminiEl = document.getElementById("autoOpenGemini");
const geminiUrlEl = document.getElementById("geminiUrl");

function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.className = type;
  if (msg) setTimeout(() => { statusEl.textContent = ""; }, 3000);
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      "autoTranslateComments", "exportLimit", "autoOpenGemini", "geminiUrl"
    ]);
    autoTranslateCommentsEl.checked = data.autoTranslateComments || false;
    if (exportLimitEl) exportLimitEl.value = String(data.exportLimit !== undefined ? data.exportLimit : 15);
    if (autoOpenGeminiEl) autoOpenGeminiEl.checked = data.autoOpenGemini !== undefined ? data.autoOpenGemini : true;
    if (geminiUrlEl) geminiUrlEl.value = data.geminiUrl || "https://gemini.google.com/app";
  } catch {
    autoTranslateCommentsEl.checked = false;
    if (exportLimitEl) exportLimitEl.value = "15";
    if (autoOpenGeminiEl) autoOpenGeminiEl.checked = true;
    if (geminiUrlEl) geminiUrlEl.value = "https://gemini.google.com/app";
  }
}

// Save
const btnSaveReply = document.getElementById("btnSaveReply");
if (btnSaveReply) {
  btnSaveReply.addEventListener("click", async () => {
    await chrome.storage.local.set({
      autoTranslateComments: autoTranslateCommentsEl.checked,
      exportLimit: exportLimitEl ? parseInt(exportLimitEl.value) || 15 : 15,
      autoOpenGemini: autoOpenGeminiEl ? autoOpenGeminiEl.checked : true,
      geminiUrl: geminiUrlEl ? geminiUrlEl.value.trim() || "https://gemini.google.com/app" : "https://gemini.google.com/app"
    });
    setStatus("✅ Đã lưu!", "success");
  });
}

loadSettings();
