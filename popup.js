/* ===== ThaiQuick Reply — Popup ===== */

const statusEl = document.getElementById("status");
const geminiKeysInputEl = document.getElementById("geminiKeysInput");
const geminiModelEl = document.getElementById("geminiModel");
const kimiKeyInputEl = document.getElementById("kimiKeyInput");
const kimiModelEl = document.getElementById("kimiModel");
const apiProviderEl = document.getElementById("apiProvider");
const cfAccountIdEl = document.getElementById("cfAccountId");
const cfApiTokenEl = document.getElementById("cfApiToken");
const cfModelEl = document.getElementById("cfModel");
const cliproxyUrlEl = document.getElementById("cliproxyUrl");
const cliproxyApiKeyEl = document.getElementById("cliproxyApiKey");
const cliproxyModelEl = document.getElementById("cliproxyModel");
const cliproxyManagementKeyEl = document.getElementById("cliproxyManagementKey");
const zunefUrlEl = document.getElementById("zunefUrl");
const zunefApiKeyEl = document.getElementById("zunefApiKey");
const zunefModelEl = document.getElementById("zunefModel");
const defaultToneEl = document.getElementById("defaultTone");
const defaultSpeakerEl = document.getElementById("defaultSpeaker");
const fastAutoTranslateEl = document.getElementById("fastAutoTranslate");
const autoTranslateCommentsEl = document.getElementById("autoTranslateComments");
const customPromptEl = document.getElementById("customPrompt");
const apiStatusDot = document.querySelector(".api-dot");
const apiStatusText = document.getElementById("apiStatusText");
const poweredByEl = document.getElementById("poweredBy");
const cliproxyAuthStatusEl = document.getElementById("cliproxyAuthStatus");
const cliproxyAuthAccountsEl = document.getElementById("cliproxyAuthAccounts");

// --- Tab Switching ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab)?.classList.add("active");
  });
});

function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.className = type;
}

// Model tag quick-select
document.querySelectorAll(".tqr-model-tag").forEach(tag => {
  tag.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = tag.dataset.target || "cfModel";
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.value = tag.dataset.model;
  });
});

// --- Prompt Presets ---
const PROMPT_PRESETS = {
  cheerful: `Bạn là người vui vẻ, lạc quan, luôn tràn đầy năng lượng.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái vui tươi, hào hứng, hay dùng 555 (haha).
Dùng nhiều emoji vui 😆🎉✨. Mọi bình luận đều đáng vui!
Khiến người đọc cảm thấy được truyền năng lượng tích cực.`,

  polite: `Bạn là người lịch sự, nhã nhặn, đầy tôn trọng.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái lịch sự, nhẹ nhàng, đúng mực.
Dùng kính ngữ phù hợp. Luôn cảm ơn và tỏ lòng biết ơn.
Giọng văn trang nhã, lễ phép, tạo ấn tượng chuyên nghiệp.`,

  genz: `Bạn là Gen Z Thái, cập nhật trend mới nhất.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái kiểu Gen Z: ngắn, gọn, trendy.
Dùng 555, slang Thái, từ viết tắt, emoji fire 🔥💀😭.
Có thể pha tiếng Anh vào. Vibe chill, không gồng, slay mọi lúc.`,

  serious: `Bạn là người nghiêm túc, chín chắn, đáng tin cậy.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái rõ ràng, mạch lạc, không dông dài.
Ít emoji, trả lời thẳng vào vấn đề. Giọng điệu chuyên nghiệp.
Thể hiện sự uy tín và đáng tin cậy trong từng câu chữ.`,

  cute: `Bạn là người dễ thương, đáng yêu, hay nhõng nhẽo.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái siêu cute, dùng nhiều emoji 🥰💗🌈✨.
Giọng ngọt ngào, đáng yêu, hay kéo dài âm cuối.
Khiến người đọc cảm thấy ấm lòng và muốn tương tác thêm.`,

  shop: `Bạn là admin shop online bán hàng trên mạng xã hội.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bình luận Thái bằng tiếng Thái tự nhiên, thân thiện.
Luôn cảm ơn khách và mời inbox/DM để tư vấn thêm.
Nếu khách khen → cảm ơn + giới thiệu sản phẩm mới.
Nếu khách hỏi giá → trả lời inbox để báo giá chi tiết.`,

  thankfan: `Bạn là creator/nghệ sĩ đang reply fan trên mạng xã hội.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái tự nhiên, ấm áp, chân thành.
Luôn cảm ơn fan đã ủng hộ, thể hiện sự trân trọng.
Dùng emoji phù hợp. Tạo cảm giác gần gũi, không xa cách.`,

  idol: `Bạn là KOL/Idol nổi tiếng trên mạng xã hội.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái cool, tự tin nhưng thân thiện.
Giữ hình ảnh chuyên nghiệp nhưng không quá xa cách.
Thỉnh thoảng dùng slang Thái trending. Ngắn gọn, đầy cá tính.`,

  reviewer: `Bạn là reviewer/content creator về công nghệ hoặc sản phẩm.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái chuyên nghiệp nhưng gần gũi.
Nếu ai hỏi về sản phẩm → chia sẻ nhận xét trung thực.
Nếu ai đồng ý → cảm ơn + gợi ý xem thêm video khác.`,

  food: `Bạn là food blogger/reviewer ẩm thực.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái vui vẻ, dùng nhiều emoji đồ ăn 🍜🤤😋.
Nếu ai hỏi quán → chia sẻ tên + địa chỉ.
Nếu ai khen → cảm ơn + hẹn review thêm món mới.
Giọng điệu phải khiến người đọc thèm ăn!`,

  motivator: `Bạn là life coach/motivational speaker.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái truyền cảm hứng, tích cực.
Luôn động viên, khích lệ người bình luận.
Dùng câu nói hay, quotes ý nghĩa khi phù hợp.
Tạo năng lượng tích cực trong mỗi câu reply. 💪✨`,

  teacher: `Bạn là giáo viên/chuyên gia chia sẻ kiến thức.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái lịch sự, dễ hiểu.
Nếu ai hỏi → trả lời ngắn gọn, chính xác.
Nếu ai cảm ơn → khuyến khích học thêm.
Giọng ấm áp như thầy/cô giáo quan tâm học sinh.`,

  flirty: `Bạn là người vui tính, biết tán tỉnh hài hước.
Phong cách: {tone}, xưng hô: {speaker}.
Reply bằng tiếng Thái dí dỏm, hài hước, có chút tán tỉnh nhẹ nhàng.
Dùng emoji cute 😏😘💕. Không quá lố, chỉ vừa đủ thú vị.
Mục tiêu: khiến người đọc mỉm cười và muốn reply lại.`,
};

document.querySelectorAll(".prompt-preset").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const preset = btn.dataset.preset;
    const promptEl = document.getElementById("customPrompt");
    if (!promptEl) return;
    if (preset === "clear") {
      promptEl.value = "";
    } else if (PROMPT_PRESETS[preset]) {
      promptEl.value = PROMPT_PRESETS[preset];
    }
    promptEl.focus();
  });
});

let _cfg = {
  provider: "gemini",
  geminiKeys: [], geminiModel: "gemini-3.1-flash-lite-preview",
  kimiKey: "", kimiModel: "k2p5",
  cfAccountId: "", cfApiToken: "", cfModel: "@cf/meta/llama-3-8b-instruct",
  cliproxyUrl: "http://localhost:8317", cliproxyModel: "GPT-5.3-Codex", cliproxyApiKey: "", cliproxyManagementKey: "",
  zunefUrl: "https://claude.zunef.com/v1", zunefApiKey: "", zunefModel: "claude-sonnet-4-20250514",
  defaultTone: "polite", defaultSpeaker: "neutral", fastAutoTranslate: true, autoTranslateComments: false,
  customPrompt: "",
};

async function loadSettings() {
  const defaults = window.THAIQUICK_CONFIG || {};
  try {
    const data = await chrome.storage.local.get([
      "provider", "geminiKeys", "geminiModel", "kimiKey", "kimiModel",
      "cfAccountId", "cfApiToken", "cfModel",
      "cliproxyUrl", "cliproxyModel", "cliproxyApiKey", "cliproxyManagementKey",
      "zunefUrl", "zunefApiKey", "zunefModel",
      "defaultTone", "defaultSpeaker", "fastAutoTranslate", "autoTranslateComments",
      "customPrompt"
    ]);
    _cfg.provider = data.provider || defaults.defaultProvider || "gemini";
    _cfg.geminiKeys = data.geminiKeys?.length > 0 ? data.geminiKeys : (defaults.geminiKeys || []);
    _cfg.geminiModel = data.geminiModel || defaults.geminiModel || "gemini-3.1-flash-lite-preview";
    _cfg.kimiKey = data.kimiKey || defaults.kimiKey || "";
    _cfg.kimiModel = data.kimiModel || defaults.kimiModel || "k2p5";
    _cfg.cfAccountId = data.cfAccountId || defaults.cfAccountId || "";
    _cfg.cfApiToken = data.cfApiToken || defaults.cfApiToken || "";
    _cfg.cfModel = data.cfModel || defaults.cfModel || "@cf/meta/llama-3-8b-instruct";
    _cfg.cliproxyUrl = data.cliproxyUrl || defaults.cliproxyUrl || "http://localhost:8317";
    _cfg.cliproxyModel = data.cliproxyModel || defaults.cliproxyModel || "GPT-5.3-Codex";
    _cfg.cliproxyApiKey = data.cliproxyApiKey || defaults.cliproxyApiKey || "";
    _cfg.cliproxyManagementKey = data.cliproxyManagementKey || defaults.cliproxyManagementKey || "";
    _cfg.zunefUrl = data.zunefUrl || defaults.zunefUrl || "https://claude.zunef.com/v1";
    _cfg.zunefApiKey = data.zunefApiKey || defaults.zunefApiKey || "";
    _cfg.zunefModel = data.zunefModel || defaults.zunefModel || "claude-sonnet-4-20250514";
    _cfg.defaultTone = data.defaultTone || defaults.defaultTone || "polite";
    _cfg.defaultSpeaker = data.defaultSpeaker || defaults.defaultSpeaker || "neutral";
    _cfg.fastAutoTranslate = data.fastAutoTranslate !== undefined ? data.fastAutoTranslate : (defaults.fastAutoTranslate !== undefined ? defaults.fastAutoTranslate : true);
    _cfg.autoTranslateComments = data.autoTranslateComments !== undefined ? data.autoTranslateComments : false;
    _cfg.customPrompt = data.customPrompt || "";
  } catch {
    _cfg.geminiKeys = defaults.geminiKeys || [];
    _cfg.kimiKey = defaults.kimiKey || "";
    _cfg.cfAccountId = defaults.cfAccountId || "";
    _cfg.cfApiToken = defaults.cfApiToken || "";
    _cfg.cliproxyUrl = defaults.cliproxyUrl || "http://localhost:8317";
    _cfg.cliproxyModel = defaults.cliproxyModel || "GPT-5.3-Codex";
    _cfg.cliproxyApiKey = defaults.cliproxyApiKey || "";
    _cfg.cliproxyManagementKey = defaults.cliproxyManagementKey || "";
    _cfg.zunefUrl = defaults.zunefUrl || "https://claude.zunef.com/v1";
    _cfg.zunefApiKey = defaults.zunefApiKey || "";
    _cfg.zunefModel = defaults.zunefModel || "claude-sonnet-4-20250514";
    _cfg.defaultTone = "polite";
    _cfg.defaultSpeaker = "neutral";
    _cfg.fastAutoTranslate = true;
    _cfg.autoTranslateComments = false;
    _cfg.customPrompt = "";
  }

  apiProviderEl.value = _cfg.provider;
  geminiKeysInputEl.value = _cfg.geminiKeys.join("\n");
  geminiModelEl.value = _cfg.geminiModel;
  kimiKeyInputEl.value = _cfg.kimiKey;
  kimiModelEl.value = _cfg.kimiModel;
  cfAccountIdEl.value = _cfg.cfAccountId;
  cfApiTokenEl.value = _cfg.cfApiToken;
  cfModelEl.value = _cfg.cfModel;
  cliproxyUrlEl.value = _cfg.cliproxyUrl;
  cliproxyApiKeyEl.value = _cfg.cliproxyApiKey;
  cliproxyModelEl.value = _cfg.cliproxyModel;
  cliproxyManagementKeyEl.value = _cfg.cliproxyManagementKey;
  if (zunefUrlEl) zunefUrlEl.value = _cfg.zunefUrl;
  if (zunefApiKeyEl) zunefApiKeyEl.value = _cfg.zunefApiKey;
  if (zunefModelEl) zunefModelEl.value = _cfg.zunefModel;
  defaultToneEl.value = _cfg.defaultTone;
  defaultSpeakerEl.value = _cfg.defaultSpeaker;
  fastAutoTranslateEl.checked = _cfg.fastAutoTranslate;
  autoTranslateCommentsEl.checked = _cfg.autoTranslateComments;
  if (customPromptEl) customPromptEl.value = _cfg.customPrompt;
  updateUI();
  loadCliproxyAuthAccounts();
}

function updateUI() {
  const hasGemini = _cfg.geminiKeys.length > 0;
  const hasKimi = !!_cfg.kimiKey;
  const hasCf = !!_cfg.cfAccountId && !!_cfg.cfApiToken;
  const hasCliproxy = !!_cfg.cliproxyUrl;
  const hasZunef = !!_cfg.zunefUrl && !!_cfg.zunefApiKey;

  const providerNames = { gemini: "Gemini", kimi: "Kimi", cloudflare: "Cloudflare AI", cliproxy: "CLIproxyAPI", zunef: "ZuneF" };
  const prov = _cfg.provider;

  if ((prov === "gemini" && hasGemini) || (prov === "kimi" && hasKimi) || (prov === "cloudflare" && hasCf) || (prov === "cliproxy" && hasCliproxy) || (prov === "zunef" && hasZunef)) {
    apiStatusDot.className = "api-dot active";
    const fallbacks = [];
    if (prov !== "gemini" && hasGemini) fallbacks.push("Gemini");
    if (prov !== "kimi" && hasKimi) fallbacks.push("Kimi");
    if (prov !== "cloudflare" && hasCf) fallbacks.push("CF");
    if (prov !== "cliproxy" && hasCliproxy) fallbacks.push("CLIproxy");
    if (prov !== "zunef" && hasZunef) fallbacks.push("ZuneF");
    apiStatusText.textContent = `✅ ${providerNames[prov]} active • Fallback: ${fallbacks.length ? fallbacks.join(", ") : "❌"}`;
  } else {
    apiStatusDot.className = "api-dot error";
    apiStatusText.textContent = "❌ Cần nhập API key cho provider đã chọn.";
  }

  const modelName = prov === "cloudflare" ? _cfg.cfModel.split("/").pop() : (prov === "cliproxy" ? _cfg.cliproxyModel : (prov === "kimi" ? _cfg.kimiModel : (prov === "zunef" ? _cfg.zunefModel : _cfg.geminiModel)));
  poweredByEl.textContent = `Powered by ${providerNames[prov]} (${modelName})`;
}

document.getElementById("btnSaveSettings").addEventListener("click", async () => {
  _cfg.provider = apiProviderEl.value;
  _cfg.geminiKeys = geminiKeysInputEl.value.trim().split("\n").map(k => k.trim()).filter(Boolean);
  _cfg.geminiModel = geminiModelEl.value;
  _cfg.kimiKey = kimiKeyInputEl.value.trim();
  _cfg.kimiModel = kimiModelEl.value;
  _cfg.cfAccountId = cfAccountIdEl.value.trim();
  _cfg.cfApiToken = cfApiTokenEl.value.trim();
  _cfg.cfModel = cfModelEl.value.trim() || "@cf/meta/llama-3-8b-instruct";
  _cfg.cliproxyUrl = cliproxyUrlEl.value.trim() || "http://localhost:8317";
  _cfg.cliproxyApiKey = cliproxyApiKeyEl.value.trim();
  _cfg.cliproxyModel = cliproxyModelEl.value.trim() || "GPT-5.3-Codex";
  _cfg.cliproxyManagementKey = cliproxyManagementKeyEl.value.trim();
  if (zunefUrlEl) _cfg.zunefUrl = zunefUrlEl.value.trim() || "https://claude.zunef.com/v1";
  if (zunefApiKeyEl) _cfg.zunefApiKey = zunefApiKeyEl.value.trim();
  if (zunefModelEl) _cfg.zunefModel = zunefModelEl.value.trim() || "claude-sonnet-4-20250514";
  _cfg.defaultTone = defaultToneEl.value;
  _cfg.defaultSpeaker = defaultSpeakerEl.value;
  _cfg.fastAutoTranslate = fastAutoTranslateEl.checked;
  _cfg.autoTranslateComments = autoTranslateCommentsEl.checked;
  _cfg.customPrompt = customPromptEl?.value || "";

  await chrome.storage.local.set({
    provider: _cfg.provider,
    geminiKeys: _cfg.geminiKeys, geminiModel: _cfg.geminiModel,
    kimiKey: _cfg.kimiKey, kimiModel: _cfg.kimiModel,
    cfAccountId: _cfg.cfAccountId, cfApiToken: _cfg.cfApiToken, cfModel: _cfg.cfModel,
    cliproxyUrl: _cfg.cliproxyUrl, cliproxyApiKey: _cfg.cliproxyApiKey, cliproxyModel: _cfg.cliproxyModel,
    cliproxyManagementKey: _cfg.cliproxyManagementKey,
    zunefUrl: _cfg.zunefUrl, zunefApiKey: _cfg.zunefApiKey, zunefModel: _cfg.zunefModel,
    defaultTone: _cfg.defaultTone, defaultSpeaker: _cfg.defaultSpeaker,
    fastAutoTranslate: _cfg.fastAutoTranslate, autoTranslateComments: _cfg.autoTranslateComments,
    customPrompt: _cfg.customPrompt
  });

  updateUI();
  setStatus("✅ Đã lưu!", "success");
});

// --- CLIproxyAPI OAuth Login ---
document.querySelectorAll(".btn-cliproxy-login[data-provider]").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const provider = btn.dataset.provider;
    const provLabel = btn.textContent;
    
    // Save current settings first
    _cfg.cliproxyUrl = cliproxyUrlEl.value.trim() || "http://localhost:8317";
    _cfg.cliproxyManagementKey = cliproxyManagementKeyEl.value.trim();
    await chrome.storage.local.set({
      cliproxyUrl: _cfg.cliproxyUrl,
      cliproxyManagementKey: _cfg.cliproxyManagementKey
    });

    cliproxyAuthStatusEl.textContent = `⏳ Đang kết nối ${provLabel}...`;
    cliproxyAuthStatusEl.style.color = "#f59e0b";

    try {
      const res = await chrome.runtime.sendMessage({ type: "CLIPROXY_LOGIN", provider });
      if (res.status === "ok") {
        cliproxyAuthStatusEl.textContent = `🔗 Đã mở trang đăng nhập ${provLabel}. Đang chờ xác thực...`;
        cliproxyAuthStatusEl.style.color = "#10a37f";
        // Poll auth status
        pollAuthStatus(res.state, provLabel);
      } else {
        cliproxyAuthStatusEl.textContent = `❌ Lỗi: ${res.error}`;
        cliproxyAuthStatusEl.style.color = "#ff6b81";
      }
    } catch (err) {
      cliproxyAuthStatusEl.textContent = `❌ Lỗi: ${err.message}`;
      cliproxyAuthStatusEl.style.color = "#ff6b81";
    }
  });
});

async function pollAuthStatus(state, provLabel) {
  let attempts = 0;
  const maxAttempts = 90; // 3 min (2s interval)
  
  const poll = async () => {
    if (attempts >= maxAttempts) {
      cliproxyAuthStatusEl.textContent = `⏰ Hết thời gian chờ đăng nhập ${provLabel}`;
      cliproxyAuthStatusEl.style.color = "#ff6b81";
      return;
    }
    attempts++;
    try {
      const res = await chrome.runtime.sendMessage({ type: "CLIPROXY_CHECK_AUTH", state });
      if (res.status === "ok") {
        cliproxyAuthStatusEl.textContent = `✅ Đăng nhập ${provLabel} thành công!`;
        cliproxyAuthStatusEl.style.color = "#2ed573";
        loadCliproxyAuthAccounts();
        return;
      } else if (res.status === "error") {
        cliproxyAuthStatusEl.textContent = `❌ Đăng nhập thất bại: ${res.error || "Unknown"}`;
        cliproxyAuthStatusEl.style.color = "#ff6b81";
        return;
      }
      // status === "wait" → continue polling
      setTimeout(poll, 2000);
    } catch {
      setTimeout(poll, 2000);
    }
  };
  
  setTimeout(poll, 2000);
}

async function loadCliproxyAuthAccounts() {
  if (!cliproxyAuthAccountsEl) return;
  try {
    const res = await chrome.runtime.sendMessage({ type: "CLIPROXY_LIST_AUTHS" });
    if (res.status === "ok" && res.files?.length > 0) {
      const accounts = res.files.map(f => {
        const icon = f.provider === "codex" ? "🤖" : (f.provider === "claude" ? "🟣" : (f.provider === "gemini" ? "🔵" : "⚪"));
        const status = f.status === "ready" ? "✅" : (f.unavailable ? "❌" : "⏳");
        return `${icon} ${f.email || f.name} ${status}`;
      });
      cliproxyAuthAccountsEl.innerHTML = `<strong>Tài khoản đã đăng nhập:</strong><br>` + accounts.join("<br>");
    } else if (res.status === "ok") {
      cliproxyAuthAccountsEl.textContent = "Chưa có tài khoản nào. Hãy đăng nhập OAuth ở trên.";
    } else {
      cliproxyAuthAccountsEl.textContent = "";
    }
  } catch {
    cliproxyAuthAccountsEl.textContent = "";
  }
}

// --- CLIproxyAPI Server Control ---
const cliproxyServerStatusEl = document.getElementById("cliproxyServerStatus");
const btnStartServer = document.getElementById("btnStartServer");
const btnStopServer = document.getElementById("btnStopServer");

async function checkServerStatus() {
  if (!cliproxyServerStatusEl) return;
  try {
    const url = (cliproxyUrlEl?.value?.trim() || _cfg.cliproxyUrl || "http://localhost:8317").replace(/\/+$/, "");
    const res = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(3000) });
    cliproxyServerStatusEl.textContent = "🟢 Server đang chạy";
    cliproxyServerStatusEl.style.color = "#2ed573";
    if (btnStartServer) btnStartServer.disabled = true;
    if (btnStopServer) btnStopServer.disabled = false;
  } catch {
    cliproxyServerStatusEl.textContent = "🔴 Server chưa chạy";
    cliproxyServerStatusEl.style.color = "#ff6b81";
    if (btnStartServer) btnStartServer.disabled = false;
    if (btnStopServer) btnStopServer.disabled = true;
  }
}

if (btnStartServer) {
  btnStartServer.addEventListener("click", async () => {
    cliproxyServerStatusEl.textContent = "⏳ Đang bật server...";
    cliproxyServerStatusEl.style.color = "#f59e0b";
    btnStartServer.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "CLIPROXY_SERVER_CONTROL", action: "start" });
      if (res.status === "ok" || res.message) {
        cliproxyServerStatusEl.textContent = "⏳ Server đang khởi động...";
        // Wait a bit then check
        setTimeout(checkServerStatus, 3000);
      } else {
        cliproxyServerStatusEl.textContent = `❌ ${res.error || "Không thể bật server"}`;
        cliproxyServerStatusEl.style.color = "#ff6b81";
        btnStartServer.disabled = false;
      }
    } catch (e) {
      cliproxyServerStatusEl.textContent = `❌ ${e.message}`;
      cliproxyServerStatusEl.style.color = "#ff6b81";
      btnStartServer.disabled = false;
    }
  });
}

if (btnStopServer) {
  btnStopServer.addEventListener("click", async () => {
    cliproxyServerStatusEl.textContent = "⏳ Đang tắt server...";
    cliproxyServerStatusEl.style.color = "#f59e0b";
    btnStopServer.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "CLIPROXY_SERVER_CONTROL", action: "stop" });
      if (res.status === "ok" || res.message) {
        cliproxyServerStatusEl.textContent = "🔴 Server đã tắt";
        cliproxyServerStatusEl.style.color = "#ff6b81";
        if (btnStartServer) btnStartServer.disabled = false;
      } else {
        cliproxyServerStatusEl.textContent = `❌ ${res.error || "Không thể tắt server"}`;
        cliproxyServerStatusEl.style.color = "#ff6b81";
        btnStopServer.disabled = false;
      }
    } catch (e) {
      cliproxyServerStatusEl.textContent = `❌ ${e.message}`;
      cliproxyServerStatusEl.style.color = "#ff6b81";
      btnStopServer.disabled = false;
    }
  });
}

// --- Save Reply Settings (Tab 2) ---
const btnSaveReply = document.getElementById("btnSaveReply");
if (btnSaveReply) {
  btnSaveReply.addEventListener("click", async () => {
    _cfg.defaultTone = defaultToneEl.value;
    _cfg.defaultSpeaker = defaultSpeakerEl.value;
    _cfg.fastAutoTranslate = fastAutoTranslateEl.checked;
    _cfg.autoTranslateComments = autoTranslateCommentsEl.checked;
    _cfg.customPrompt = customPromptEl?.value || "";
    await chrome.storage.local.set({
      defaultTone: _cfg.defaultTone, defaultSpeaker: _cfg.defaultSpeaker,
      fastAutoTranslate: _cfg.fastAutoTranslate, autoTranslateComments: _cfg.autoTranslateComments,
      customPrompt: _cfg.customPrompt
    });
    setStatus("✅ Đã lưu Reply settings!", "success");
  });
}

loadSettings();
// Check server status on popup open
setTimeout(checkServerStatus, 500);
