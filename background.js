/* ===== ThaiQuick Reply — Background v2.2 + Cloudflare ===== */

// --- Context menu ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "tqr-translate-selection", title: "🇹🇭 ThaiQuick: Dịch Thái → Việt", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "tqr-translate-copy", title: "🇹🇭 ThaiQuick: Dịch & Copy", contexts: ["selection"] });
});

// --- Defaults ---
const DEFAULT_GEMINI_KEYS = [];
const DEFAULT_KIMI_KEY = "";
const DEFAULT_CF_ACCOUNT = "";
const DEFAULT_CF_TOKEN = "";
const DEFAULT_CLIPROXY_URL = "http://localhost:8317";

async function getConfig() {
  try {
    const d = await chrome.storage.local.get([
      "provider","geminiKeys","geminiModel","kimiKey","kimiModel",
      "cfAccountId","cfApiToken","cfModel",
      "cliproxyUrl","cliproxyModel","cliproxyApiKey","cliproxyManagementKey",
      "defaultTone", "defaultSpeaker", "customPrompt"
    ]);
    return {
      provider: d.provider || "gemini",
      geminiKeys: d.geminiKeys?.length > 0 ? d.geminiKeys : DEFAULT_GEMINI_KEYS,
      geminiModel: d.geminiModel || "gemini-3.1-flash-lite-preview",
      kimiKey: d.kimiKey || DEFAULT_KIMI_KEY,
      kimiModel: d.kimiModel || "k2p5",
      cfAccountId: d.cfAccountId || DEFAULT_CF_ACCOUNT,
      cfApiToken: d.cfApiToken || DEFAULT_CF_TOKEN,
      cfModel: d.cfModel || "@cf/meta/llama-3-8b-instruct",
      cliproxyUrl: d.cliproxyUrl || DEFAULT_CLIPROXY_URL,
      cliproxyModel: d.cliproxyModel || "GPT-5.3-Codex",
      cliproxyApiKey: d.cliproxyApiKey || "",
      cliproxyManagementKey: d.cliproxyManagementKey || "",
      defaultTone: d.defaultTone || "polite",
      defaultSpeaker: d.defaultSpeaker || "neutral",
      fastAutoTranslate: d.fastAutoTranslate !== undefined ? d.fastAutoTranslate : true,
      customPrompt: d.customPrompt || ""
    };
  } catch {
    return {
      provider: "gemini",
      geminiKeys: DEFAULT_GEMINI_KEYS, geminiModel: "gemini-3.1-flash-lite-preview",
      kimiKey: DEFAULT_KIMI_KEY, kimiModel: "k2p5",
      cfAccountId: DEFAULT_CF_ACCOUNT, cfApiToken: DEFAULT_CF_TOKEN,
      cfModel: "@cf/meta/llama-3-8b-instruct",
      cliproxyUrl: DEFAULT_CLIPROXY_URL, cliproxyModel: "GPT-5.3-Codex", cliproxyApiKey: "", cliproxyManagementKey: "",
      defaultTone: "polite",
      defaultSpeaker: "neutral",
      fastAutoTranslate: true,
      customPrompt: ""
    };
  }
}

const bgCache = new Map();

// ===========================
// GEMINI API
// ===========================
async function callGemini(prompt, cfg) {
  let lastErr;
  for (const key of cfg.geminiKeys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, topP: 0.85, maxOutputTokens: 600 },
        }),
      });
      if (!res.ok) {
        if ([401,403,429].includes(res.status)) { lastErr = new Error("Gemini key fail"); continue; }
        throw new Error(`Gemini ${res.status}`);
      }
      const out = (await res.json())?.candidates?.[0]?.content?.parts?.map(p=>p?.text||"").join("\n").trim()||"";
      if (!out) throw new Error("Empty");
      return out;
    } catch(e) { lastErr = e; }
  }
  throw lastErr || new Error("Gemini: all keys failed");
}

// ===========================
// KIMI API
// ===========================
async function callKimi(prompt, cfg) {
  if (!cfg.kimiKey) throw new Error("No Kimi key");
  const res = await fetch("https://api.kimi.com/coding/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${cfg.kimiKey}`,
      "x-api-key":cfg.kimiKey,
      "anthropic-version":"2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.kimiModel,
      system: "Bạn là chuyên gia dịch thuật Thái-Việt. Trả lời ngắn gọn, chính xác. Không sử dụng thinking mode.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Kimi ${res.status}`);
  const data = await res.json();
  return data?.content?.find(c=>c.type==="text")?.text?.trim() || (() => { throw new Error("Kimi empty"); })();
}

// ===========================
// CLIproxyAPI (OpenAI-compatible)
// ===========================
async function callCLIProxy(prompt, cfg) {
  if (!cfg.cliproxyUrl) throw new Error("No CLIproxyAPI URL");

  const url = `${cfg.cliproxyUrl.replace(/\/+$/, "")}/v1/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (cfg.cliproxyApiKey) headers["Authorization"] = `Bearer ${cfg.cliproxyApiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.cliproxyModel || "GPT-5.3-Codex",
      messages: [
        { role: "system", content: "Bạn là chuyên gia dịch thuật Thái-Việt cho mạng xã hội. Trả lời ngắn gọn, trực tiếp. KHÔNG giải thích, KHÔNG dùng <think>." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`CLIproxyAPI ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("CLIproxyAPI: empty response");
  return text;
}

// ===========================
// CLOUDFLARE WORKERS AI
// ===========================
async function callCloudflare(prompt, cfg) {
  if (!cfg.cfAccountId || !cfg.cfApiToken) throw new Error("No Cloudflare credentials");

  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.cfAccountId}/ai/run/${cfg.cfModel}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.cfApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "Bạn là chuyên gia dịch thuật Thái-Việt cho mạng xã hội. Trả lời ngắn gọn, trực tiếp. KHÔNG giải thích, KHÔNG dùng <think>." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  let result = data.result || data;
  let text = "";

  // Standard format
  if (result.response) {
    text = result.response;
  }
  // OpenAI-compatible (Qwen3, etc.)
  else if (result.choices?.[0]?.message?.content) {
    text = result.choices[0].message.content;
  }
  // Other
  else if (result.content) {
    text = result.content;
  } else if (result.output) {
    text = typeof result.output === "string" ? result.output : JSON.stringify(result.output);
  }

  if (!text) throw new Error("Cloudflare: empty response");
  return text;
}

// ===========================
// UNIFIED AI CALL
// ===========================
async function callAI(prompt) {
  const cfg = await getConfig();
  const providers = [];

  // Primary provider first
  if (cfg.provider === "cliproxy") providers.push(() => callCLIProxy(prompt, cfg));
  else if (cfg.provider === "cloudflare") providers.push(() => callCloudflare(prompt, cfg));
  else if (cfg.provider === "kimi") providers.push(() => callKimi(prompt, cfg));
  else providers.push(() => callGemini(prompt, cfg));

  // Fallbacks
  if (cfg.provider !== "gemini" && cfg.geminiKeys.length > 0) providers.push(() => callGemini(prompt, cfg));
  if (cfg.provider !== "kimi" && cfg.kimiKey) providers.push(() => callKimi(prompt, cfg));
  if (cfg.provider !== "cloudflare" && cfg.cfAccountId && cfg.cfApiToken) providers.push(() => callCloudflare(prompt, cfg));
  if (cfg.provider !== "cliproxy" && cfg.cliproxyUrl) providers.push(() => callCLIProxy(prompt, cfg));

  let lastErr;
  for (const call of providers) {
    try { 
       let text = await call(); 
       if (typeof text === 'string') {
          // Globally strip <think> ... </think> or unclosed <think> blocks
          text = text.replace(/<think\s*>[\s\S]*?(<\/think\s*>|$)/gi, "").trim();
          if (!text) throw new Error("Model generated empty response after removing think blocks.");
       }
       return text;
    }
    catch (e) { lastErr = e; console.warn("Provider failed:", e.message); }
  }
  throw lastErr || new Error("All providers failed");
}

// --- MyMemory fallback ---
async function myMemoryFallback(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=th|vi`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  return (await res.json())?.responseData?.translatedText || "";
}

// --- Thai → Viet ---
async function translateThaiToVi(thaiText, forceAI = false) {
  if (bgCache.has(thaiText)) return bgCache.get(thaiText);
  
  const cfg = await getConfig();
  
  // If fast translation is enabled and AI isn't strictly forced
  if (cfg.fastAutoTranslate && !forceAI) {
     try {
       const fb = await myMemoryFallback(thaiText);
       bgCache.set(thaiText, fb);
       return fb;
     } catch (e) {
       console.warn("MyMemory failed, falling back to AI", e);
     }
  }

  const prompt = `Dịch tiếng Thái → Việt sát nghĩa, tự nhiên. Giữ emoji. CHỈ trả bản dịch.\n\n${thaiText}`;
  try {
    const r = await callAI(prompt);
    bgCache.set(thaiText, r);
    return r;
  } catch {
    const fb = await myMemoryFallback(thaiText);
    bgCache.set(thaiText, fb);
    return fb;
  }
}

// --- Viet → Thai ---
async function translateViToThai(viText) {
  const cfg = await getConfig();
  const toneMap = {
    genz:"Gen Z, 555",polite:"Lịch sự",formal:"Nghiêm túc",
    sales:"Bán hàng",funny:"Hài hước",thankfan:"Cảm ơn fan",cute:"Dễ thương",
  };
  const speakerMap = { female:"NỮ → ค่ะ",male:"NAM → ครับ",neutral:"Tự do" };
  const tone = cfg.defaultTone || "polite";
  const speaker = cfg.defaultSpeaker || "neutral";

  const k = `vi2th:${viText}:${tone}:${speaker}`;
  if (bgCache.has(k)) return bgCache.get(k);

  const prompt = `Dịch và viết lại câu Tiếng Việt sau sang Tiếng Thái.
Yêu cầu:
1. Sát nghĩa, tự nhiên, đúng văn phong mạng xã hội Thái Lan.
2. Viết lại cho hay hơn, biểu cảm hơn theo phong cách: ${toneMap[tone] || "Tự do"}.
3. Danh xưng / Giới tính người viết: ${speakerMap[speaker] || "Tự do"}.
4. CHỈ TRẢ VỀ CÂU TIẾNG THÁI. KHÔNG GIẢI THÍCH HAY OUTPUT DƯ THỪA.

Câu Tiếng Việt: "${viText}"`;

  const r = await callAI(prompt);
  bgCache.set(k, r);
  return r;
}

// --- Context menu ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selected = (info.selectionText || "").trim();
  if (!selected || !tab?.id) return;
  if (info.menuItemId === "tqr-translate-selection" || info.menuItemId === "tqr-translate-copy") {
    try {
      // Force AI for manual translation action
      const translated = await translateThaiToVi(selected, true);
      await chrome.tabs.sendMessage(tab.id, { type: "SHOW_TRANSLATION_TOOLTIP", original: selected, translated });
      if (info.menuItemId === "tqr-translate-copy")
        await chrome.tabs.sendMessage(tab.id, { type: "COPY_TO_CLIPBOARD", text: translated });
    } catch {
      await chrome.tabs.sendMessage(tab.id, { type: "SHOW_TRANSLATION_TOOLTIP", original: selected, translated: "❌ Lỗi dịch." });
    }
  }
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "TRANSLATE_INLINE") {
    translateThaiToVi(msg.text || "", false).then(t => sendResponse({ translated: t })).catch(e => sendResponse({ translated: `Lỗi: ${e.message}` }));
    return true;
  }
  if (msg?.type === "TRANSLATE_INLINE_FORCE_AI") {
    translateThaiToVi(msg.text || "", true).then(t => sendResponse({ translated: t })).catch(e => sendResponse({ translated: `Lỗi: ${e.message}` }));
    return true;
  }
  if (msg?.type === "TRANSLATE_VI_TO_THAI") {
    translateViToThai(msg.text || "").then(t => sendResponse({ translated: t })).catch(e => sendResponse({ translated: `Lỗi: ${e.message}` }));
    return true;
  }
  if (msg?.type === "REWRITE_AND_TRANSLATE") {
    const { text, context } = msg;
    const ctxBlock = context ? `\n\nBình luận gốc đang reply (ngữ cảnh): ${context}` : "";
    
    getConfig().then(cfg => {
      const toneMap = {
        genz:"Gen Z, 555",polite:"Lịch sự",formal:"Nghiêm túc",
        sales:"Bán hàng",funny:"Hài hước",thankfan:"Cảm ơn fan",cute:"Dễ thương",
      };
      const speakerMap = { female:"NỮ → ค่ะ",male:"NAM → ครับ",neutral:"Tự do" };
      const tone = cfg.defaultTone || "polite";
      const speaker = cfg.defaultSpeaker || "neutral";

      const prompt = `Bạn là chuyên gia về tiếng Thái trên mạng xã hội. 
Câu trả lời của tôi (tiếng Việt): "${text}"${ctxBlock}

Nhiệm vụ: 
1. Đọc ngữ cảnh (nếu có).
2. Dịch và viết lại câu trả lời của tôi sang tiếng Thái sao cho tự nhiên, thân thiện và chuẩn người Thái hay nói.
Phong cách yêu cầu: ${toneMap[tone]||"Lịch sự"}. Danh xưng/giới tính: ${speakerMap[speaker]||"Tự do"}.
3. CHỈ trả về đúng 1 câu tiếng Thái. Không giải thích, không thêm format.`;
      
      callAI(prompt).then(r => sendResponse({ reply: r.trim() })).catch(e => sendResponse({ reply: `Lỗi: ${e.message}` }));
    });
    return true;
  }
  if (msg?.type === "AUTO_REPLY_INLINE") {
    const { thaiComment, hint } = msg;
    
    getConfig().then(cfg => {
      const toneMap = {
        genz:"Gen Z, 555",polite:"Lịch sự",formal:"Nghiêm túc",
        sales:"Bán hàng",funny:"Hài hước",thankfan:"Cảm ơn fan",cute:"Dễ thương",
      };
      const speakerMap = { female:"NỮ → ค่ะ",male:"NAM → ครับ",neutral:"Tự chọn" };
      const tone = cfg.defaultTone || "polite";
      const speaker = cfg.defaultSpeaker || "neutral";
      
      const hintBlock = hint ? `\nGợi ý: ${hint}` : "";

      let prompt;
      if (cfg.customPrompt) {
        // Use custom prompt with variable substitution
        prompt = cfg.customPrompt
          .replace(/\{tone\}/g, toneMap[tone] || "Lịch sự")
          .replace(/\{speaker\}/g, speakerMap[speaker] || "Tự chọn")
          .replace(/\{comment\}/g, thaiComment)
          .replace(/\{hint\}/g, hint || "Không có");
        // Always prepend the required output format
        prompt = `${prompt}\n\nBẮT BUỘC trả về đúng 2 dòng:\nDỊCH: [Dịch bình luận sang tiếng Việt]\nREPLY: [1 câu trả lời bằng tiếng Thái]\n\nBình luận gốc: "${thaiComment}"`;
      } else {
        prompt = `Bạn là chuyên gia reply bình luận Thái cho creator Việt.

Yêu cầu BẮT BUỘC trả về đúng 2 dòng như mẫu bên dưới. Tuyệt đối không giải thích thêm:
DỊCH: [Dịch bình luận của người nhận sang tiếng Việt]
REPLY: [1 câu trả lời bằng tiếng Thái tự nhiên, phong cách ${toneMap[tone]||"Lịch sự"}, xưng hô ${speakerMap[speaker]||"Tự chọn"}]

Gợi ý ý chính để reply (nếu có): ${hint||"Không có"}
Bình luận gốc: "${thaiComment}"`;
      }
      callAI(prompt).then(result => {
        const lines = result.split("\n").map(l=>l.trim()).filter(Boolean);
        let meaning="", reply="";
        for (const line of lines) {
          if (/^(DỊCH|Dịch)\s*:/i.test(line)) meaning = line.replace(/^(DỊCH|Dịch)\s*:\s*/i,"");
          else if (/^(REPLY|Reply)\s*:/i.test(line)) reply = line.replace(/^(REPLY|Reply)\s*:\s*/i,"");
        }
        if (!reply && lines.length >= 1) { reply = lines[lines.length-1]; if (lines.length >= 2) meaning = lines[0]; }
        sendResponse({ meaning: meaning||"", reply: reply||result });
      }).catch(e => sendResponse({ meaning:"", reply:`Lỗi: ${e.message}` }));
    });
    return true;
  }
  // --- CLIproxyAPI OAuth handlers ---
  if (msg?.type === "CLIPROXY_LOGIN") {
    (async () => {
      try {
        const cfg = await getConfig();
        const baseUrl = (cfg.cliproxyUrl || DEFAULT_CLIPROXY_URL).replace(/\/+$/, "");
        const mgmtKey = cfg.cliproxyManagementKey || "";
        const headers = { "Content-Type": "application/json" };
        if (mgmtKey) headers["Authorization"] = `Bearer ${mgmtKey}`;
        const provider = msg.provider || "codex";
        const authEndpoint = {
          codex: "codex-auth-url",
          claude: "anthropic-auth-url",
          gemini: "gemini-cli-auth-url",
          qwen: "qwen-auth-url",
          iflow: "iflow-auth-url",
        }[provider] || "codex-auth-url";
        const res = await fetch(`${baseUrl}/v0/management/${authEndpoint}?is_webui=true`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status === "ok" && data.url) {
          chrome.tabs.create({ url: data.url });
          sendResponse({ status: "ok", state: data.state });
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      }
    })();
    return true;
  }
  if (msg?.type === "CLIPROXY_CHECK_AUTH") {
    (async () => {
      try {
        const cfg = await getConfig();
        const baseUrl = (cfg.cliproxyUrl || DEFAULT_CLIPROXY_URL).replace(/\/+$/, "");
        const mgmtKey = cfg.cliproxyManagementKey || "";
        const headers = {};
        if (mgmtKey) headers["Authorization"] = `Bearer ${mgmtKey}`;
        const res = await fetch(`${baseUrl}/v0/management/get-auth-status?state=${encodeURIComponent(msg.state)}`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        sendResponse(data);
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      }
    })();
    return true;
  }
  if (msg?.type === "CLIPROXY_LIST_AUTHS") {
    (async () => {
      try {
        const cfg = await getConfig();
        const baseUrl = (cfg.cliproxyUrl || DEFAULT_CLIPROXY_URL).replace(/\/+$/, "");
        const mgmtKey = cfg.cliproxyManagementKey || "";
        const headers = {};
        if (mgmtKey) headers["Authorization"] = `Bearer ${mgmtKey}`;
        const res = await fetch(`${baseUrl}/v0/management/auth-files`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        sendResponse({ status: "ok", files: data.files || [] });
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      }
    })();
    return true;
  }
  if (msg?.type === "CLIPROXY_SERVER_CONTROL") {
    try {
      chrome.runtime.sendNativeMessage("com.thaiquick.cliproxy_host", { action: msg.action }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: "error", error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response || { status: "error", error: "No response" });
        }
      });
    } catch (e) {
      sendResponse({ status: "error", error: e.message });
    }
    return true;
  }
});
