/* ===== Thai Comment Manager — Popup v3.1 ===== */

const statusEl = document.getElementById("status");
const autoTranslateCommentsEl = document.getElementById("autoTranslateComments");
const exportLimitEl = document.getElementById("exportLimit");
const geminiModeEl = document.getElementById("geminiMode");
const geminiUrlEl = document.getElementById("geminiUrl");

function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.className = type;
  if (msg) setTimeout(() => { statusEl.textContent = ""; }, 3000);
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      "autoTranslateComments", "exportLimit", "geminiMode", "autoOpenGemini", "geminiUrl"
    ]);
    autoTranslateCommentsEl.checked = data.autoTranslateComments || false;
    if (exportLimitEl) exportLimitEl.value = String(data.exportLimit !== undefined ? data.exportLimit : 15);
    // Backward compatibility: convert old boolean to new mode
    let mode = data.geminiMode;
    if (!mode && data.autoOpenGemini !== undefined) {
      mode = data.autoOpenGemini ? "manual" : "off";
    }
    if (geminiModeEl) geminiModeEl.value = mode || "manual";
    if (geminiUrlEl) geminiUrlEl.value = data.geminiUrl || "https://gemini.google.com/app";
  } catch {
    autoTranslateCommentsEl.checked = false;
    if (exportLimitEl) exportLimitEl.value = "15";
    if (geminiModeEl) geminiModeEl.value = "manual";
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
      geminiMode: geminiModeEl ? geminiModeEl.value : "manual",
      geminiUrl: geminiUrlEl ? geminiUrlEl.value.trim() || "https://gemini.google.com/app" : "https://gemini.google.com/app"
    });
    setStatus("✅ Đã lưu!", "success");
  });
}

loadSettings();
