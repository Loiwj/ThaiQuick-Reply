/* ===== ThaiQuick Reply — Content Script v2.5 ===== */
/* YouTube Studio (ytcp-*), YouTube (ytd-*), Facebook, TikTok */

const THAI_REGEX = /[\u0E00-\u0E7F]{3,}/;
function isThaiText(str) { return THAI_REGEX.test(str || ""); }
function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// ===========================
// MESSAGE LISTENER
// ===========================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_SELECTION") {
    sendResponse({ text: (window.getSelection?.()?.toString() || "").trim() });
    return true;
  }
  if (msg?.type === "SHOW_TRANSLATION_TOOLTIP") {
    showTooltip(msg.original || "", msg.translated || "");
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "COPY_TO_CLIPBOARD") {
    navigator.clipboard.writeText(msg.text || "").then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

// ===========================
// TOOLTIP
// ===========================
let tooltipEl;
function showTooltip(original, translated) {
  tooltipEl?.remove();
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tqr-tooltip";
  tooltipEl.innerHTML = `
    <div class="tqr-tooltip-header">
      <span class="tqr-tooltip-title">🇹🇭 ThaiQuick Reply</span>
      <button class="tqr-tooltip-close">✕</button>
    </div>
    <div class="tqr-tooltip-original">${escapeHtml(original)}</div>
    <div class="tqr-tooltip-translated">${escapeHtml(translated)}</div>`;
  document.body.appendChild(tooltipEl);
  tooltipEl.querySelector(".tqr-tooltip-close").addEventListener("click", () => tooltipEl?.remove());
  setTimeout(() => tooltipEl?.remove(), 20000);
}

// ===========================
// FLOATING BAR
// ===========================
let floatBar;
document.addEventListener("mouseup", (e) => {
  floatBar?.remove(); floatBar = null;

  let text = "";
  let activeEl = document.activeElement;
  
  // YouTube Studio uses tp-yt-iron-autogrow-textarea which might wrap the actual textarea
  if (activeEl && activeEl.tagName === "TP-YT-IRON-AUTOGROW-TEXTAREA") {
    activeEl = activeEl.shadowRoot?.querySelector('textarea') || activeEl.querySelector('textarea') || activeEl;
  }

  const isInput = activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT");
  const isCE = activeEl && activeEl.isContentEditable;

  if (isInput) {
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    if (start !== undefined && end !== undefined && start !== end) {
      text = activeEl.value.substring(start, end).trim();
    }
  } else {
    text = (window.getSelection?.()?.toString() || "").trim();
  }

  if (!text || text.length < 3) return;
  if (e.target.closest?.(".tqr-tooltip, .tqr-float-bar, .tqr-inline-result, .tqr-reply-toolbar")) return;

  const isThai = isThaiText(text);

  floatBar = document.createElement("div");
  floatBar.className = "tqr-float-bar";
  floatBar.style.left = `${e.pageX + 5}px`;
  floatBar.style.top = `${e.pageY - 40}px`;

  if (isThai) {
    return; // Fast translate tooltip removed
  } else {
    // If not Thai, provide Translate & Rewrite button
    floatBar = document.createElement("div");
    floatBar.className = "tqr-float-bar";
    floatBar.style.left = `${e.pageX + 5}px`;
    floatBar.style.top = `${e.pageY - 40}px`;
    
    floatBar.innerHTML = `<button class="tqr-float-rewrite">✨ Dịch & Viết lại tiếng Thái</button>`;
    document.body.appendChild(floatBar);

    floatBar.querySelector(".tqr-float-rewrite").addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const btn = floatBar.querySelector(".tqr-float-rewrite");
      btn.textContent = "⏳ AI đang viết..."; btn.style.pointerEvents = "none";
      
      let contextComment = "";
      // find Thai comment based on the nearest ytcp-comment / ytd-comment
      let searchEl = isInput || isCE ? activeEl : e.target;
      // If we are inside shadow DOM, start from the host to find the comment
      if (searchEl && searchEl.getRootNode && searchEl.getRootNode() instanceof ShadowRoot) {
         searchEl = searchEl.getRootNode().host || searchEl;
      }
      contextComment = findThaiComment(searchEl) || "";

      try {
        const r = await chrome.runtime.sendMessage({ 
          type: "REWRITE_AND_TRANSLATE", text, context: contextComment 
        });
        
        let newText = r?.reply || "";
        if (!newText || newText.startsWith("Lỗi")) throw new Error(newText);
        newText = newText.replace(/^(DỊCH|REPLY|Reply|Dịch)\s*:\s*/i, "").trim().replace(/^"|"$/g, "");

        if (isInput) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (start !== undefined && end !== undefined && start !== end) {
                const val = activeEl.value;
                const newVal = val.substring(0, start) + newText + val.substring(end);
                setTextInArea(activeEl, newVal);
                activeEl.setSelectionRange(start, start + newText.length);
            } else {
                showTooltip(text, newText);
            }
        } else if (isCE) {
            document.execCommand("insertText", false, newText);
            activeEl.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            showTooltip(text, newText);
        }
      } catch (err) { showTooltip(text, "Lỗi: " + err.message); }
      floatBar?.remove(); floatBar = null;
    });
  }
});
document.addEventListener("mousedown", (e) => {
  if (floatBar && !e.target.closest?.(".tqr-float-bar")) { floatBar.remove(); floatBar = null; }
});

// ===========================
// HELPER: get clean text from comment element
// ===========================
function getCleanText(el) {
  let text = "";
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains("tqr-inline-btn") || node.classList?.contains("tqr-inline-result")) return;
      if (node.tagName === "IMG" && node.alt) { text += node.alt; return; }
      text += node.textContent || "";
    }
  });
  return text.trim();
}

// ===========================
// INLINE TRANSLATE BUTTONS / AUTO TRANSLATE (🇻🇳 Dịch next to Thai comments)
// ===========================
const processedNodes = new WeakSet();

async function addInlineTranslateButtons() {
  const settings = await chrome.storage.local.get(["autoTranslateComments"]);
  const autoTrans = settings.autoTranslateComments !== false; // Default true or whatever user configured, if false fallback to manual

  const selectors = [
    "ytcp-comment #content-text",
    "ytd-comment-view-model #content-text",
    "ytd-comment-renderer #content-text",
    "#content-text",
    '[data-ad-comet-preview="message"]',
    '[data-e2e="comment-level-1"] p',
    '[data-e2e="comment-level-2"] p',
    ".comment-text", ".comment-body", ".comment-content",
  ];

  const candidates = new Set();
  selectors.forEach(sel => { try { document.querySelectorAll(sel).forEach(el => candidates.add(el)); } catch {} });

  candidates.forEach(async el => {
    if (processedNodes.has(el)) return;
    const text = getCleanText(el);
    if (!text || !isThaiText(text) || text.length < 3) return;
    processedNodes.add(el);

    if (autoTrans) {
      // Auto-translate mode
      const res = document.createElement("div");
      res.className = "tqr-inline-result";
      res.style.marginTop = "4px";
      res.innerHTML = `<span style="font-size: 0.9em; color: #a0a0a0;">⏳ Đang dịch...</span>`;
      el.appendChild(res);

      try {
        const r = await chrome.runtime.sendMessage({ type: "TRANSLATE_INLINE", text }); // Use fast translate for auto
        res.innerHTML = `<span style="color: #2ba64e; font-size: 0.9em; font-weight: 500;">✓ Đã dịch: </span><span style="color: #e4e4f0;">${r?.translated || "Không có kết quả"}</span>`;
      } catch (e) {
        res.innerHTML = `<span style="color: #ff4a4a; font-size: 0.9em;">❌ Lỗi dịch: ${e.message}</span>`;
      }
    } else {
      // Manual mode
      const btn = document.createElement("button");
      btn.className = "tqr-inline-btn";
      btn.textContent = "🇻🇳 Dịch";

      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); e.preventDefault();
        if (btn.nextElementSibling?.classList?.contains("tqr-inline-result")) return;
        btn.classList.add("loading"); btn.textContent = "⏳...";
        try {
          const r = await chrome.runtime.sendMessage({ type: "TRANSLATE_INLINE_FORCE_AI", text });
          const res = document.createElement("div");
          res.className = "tqr-inline-result";
          res.textContent = r?.translated || "Không có kết quả";
          btn.after(res);
          btn.textContent = "✅ Đã dịch";
        } catch { btn.textContent = "❌ Lỗi"; setTimeout(() => { btn.textContent = "🇻🇳 Dịch"; }, 2000); }
        btn.classList.remove("loading");
      });

      el.appendChild(btn);
    }
  });
}

// ===========================
// FIND THAI COMMENT near a reply area
// ===========================
function findThaiComment(el) {
  // Walk up to find the parent comment, then look for Thai text in #content-text
  const selectors = [
    "ytcp-comment",           // YouTube Studio
    "ytcp-comment-thread",
    "ytd-comment-thread-renderer",  // YouTube
    "ytd-comment-view-model",
    "ytd-comment-renderer",
  ];

  for (const sel of selectors) {
    const container = el.closest(sel);
    if (!container) continue;
    const ct = container.querySelector("#content-text");
    if (ct) {
      const text = getCleanText(ct);
      if (text && isThaiText(text)) return text;
    }
  }

  // Broader fallback: walk up and check siblings
  let node = el.parentElement;
  for (let i = 0; i < 15 && node && node !== document.body; i++) {
    const ct = node.querySelector("#content-text");
    if (ct) {
      const text = getCleanText(ct);
      if (text && isThaiText(text)) return text;
    }
    node = node.parentElement;
  }

  return "";
}

// ===========================
// SET TEXT INTO REPLY TEXTAREA
// ===========================
function setTextInArea(textarea, text) {
  // Use native setter to bypass YouTube's Polymer bindings
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(textarea, text);
  else textarea.value = text;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));

  // Update mirror div (YouTube Studio auto-grow)
  const ironTextarea = textarea.closest("tp-yt-iron-autogrow-textarea");
  if (ironTextarea) {
    const mirror = ironTextarea.querySelector("#mirror");
    if (mirror) mirror.innerHTML = escapeHtml(text) + "&nbsp;";
  }
}

// ===========================
// CREATE REPLY TOOLBAR
// ===========================
function createReplyToolbar(textarea, thaiComment) {
  const toolbar = document.createElement("div");
  toolbar.className = "tqr-reply-toolbar";

  const hasCtx = !!thaiComment;
  const short = thaiComment ? (thaiComment.length > 80 ? thaiComment.slice(0, 80) + "..." : thaiComment) : "";

  const contextHTML = hasCtx ? `
    <div class="tqr-toolbar-context">
      <div style="margin-bottom:6px;"><span class="tqr-context-label">💬 Gốc:</span><span class="tqr-context-text">${escapeHtml(short)}</span></div>
      <div><span class="tqr-context-label">🇻🇳 Dịch:</span><span class="tqr-context-text tqr-auto-trans-text" style="color:#e4e4f0">⏳ Đang tự động dịch...</span></div>
    </div>` : "";

  toolbar.innerHTML = `
    <div class="tqr-toolbar-header">
      <span class="tqr-toolbar-title">🇹🇭 ThaiQuick Reply</span>
      <button class="tqr-toolbar-close">✕</button>
    </div>
    ${contextHTML}
    <div class="tqr-toolbar-row">
      <input type="text" class="tqr-hint-input" placeholder="💡 Gợi ý: cảm ơn, mời mua hàng..." />
    </div>
    <div class="tqr-toolbar-actions">
      <button class="tqr-action-btn tqr-btn-ai">🤖 AI tự reply</button>
      <button class="tqr-action-btn tqr-btn-translate">🇹🇭 Dịch VN→TH</button>
    </div>
    <div class="tqr-toolbar-result" hidden>
      <div class="tqr-result-meaning" hidden></div>
      <div class="tqr-result-reply"></div>
      <div class="tqr-result-actions">
        <button class="tqr-btn-use">✅ Điền vào reply</button>
        <button class="tqr-btn-copy2">📋</button>
        <button class="tqr-btn-retry">🔄</button>
      </div>
    </div>`;

  toolbar.querySelector(".tqr-toolbar-close").addEventListener("click", () => toolbar.remove());

  // --- Auto Translate Context ---
  if (hasCtx) {
     chrome.runtime.sendMessage({ type: "TRANSLATE_INLINE", text: thaiComment })
       .then(r => {
          const span = toolbar.querySelector(".tqr-auto-trans-text");
          if (span) span.textContent = r?.translated || "Không dịch được";
       })
       .catch(e => {
          const span = toolbar.querySelector(".tqr-auto-trans-text");
          if (span) span.textContent = "Lỗi dịch: " + e.message;
       });
  }

  // --- AI Reply ---
  const aiBtn = toolbar.querySelector(".tqr-btn-ai");
  aiBtn.addEventListener("click", async () => {
    const comment = thaiComment || "(không có context)";
    const hint = toolbar.querySelector(".tqr-hint-input").value.trim();
    const resultDiv = toolbar.querySelector(".tqr-toolbar-result");
    const replyDiv = toolbar.querySelector(".tqr-result-reply");
    const meaningDiv = toolbar.querySelector(".tqr-result-meaning");

    aiBtn.textContent = "⏳ AI đang nghĩ..."; aiBtn.disabled = true;
    toolbar.querySelector(".tqr-btn-translate").disabled = true;
    resultDiv.hidden = true;

    try {
      const r = await chrome.runtime.sendMessage({
        type: "AUTO_REPLY_INLINE", thaiComment: comment, hint,
      });
      if (r?.meaning) { meaningDiv.textContent = "📖 " + r.meaning; meaningDiv.hidden = false; }
      else meaningDiv.hidden = true;
      replyDiv.textContent = r?.reply || "Không có kết quả";
      resultDiv.hidden = false;
    } catch (e) {
      replyDiv.textContent = "❌ Lỗi: " + e.message;
      resultDiv.hidden = false;
    }
    aiBtn.textContent = "🤖 AI tự reply"; aiBtn.disabled = false;
    toolbar.querySelector(".tqr-btn-translate").disabled = false;
  });

  // --- Translate VN→TH ---
  const transBtn = toolbar.querySelector(".tqr-btn-translate");
  transBtn.addEventListener("click", async () => {
    const viText = textarea.value.trim();
    const resultDiv = toolbar.querySelector(".tqr-toolbar-result");
    const replyDiv = toolbar.querySelector(".tqr-result-reply");
    const meaningDiv = toolbar.querySelector(".tqr-result-meaning");

    if (!viText) {
      replyDiv.textContent = "⚠️ Gõ tiếng Việt vào ô phản hồi trước.";
      meaningDiv.hidden = true; resultDiv.hidden = false;
      return;
    }
    transBtn.textContent = "⏳ Đang dịch..."; transBtn.disabled = true; aiBtn.disabled = true;
    meaningDiv.hidden = true; resultDiv.hidden = true;
    try {
      const r = await chrome.runtime.sendMessage({ type: "TRANSLATE_VI_TO_THAI", text: viText });
      replyDiv.textContent = r?.translated || "Lỗi";
      resultDiv.hidden = false;
    } catch (e) { replyDiv.textContent = "❌ " + e.message; resultDiv.hidden = false; }
    transBtn.textContent = "🇹🇭 Dịch VN→TH"; transBtn.disabled = false; aiBtn.disabled = false;
  });

  // --- Use ---
  toolbar.querySelector(".tqr-btn-use").addEventListener("click", () => {
    const text = toolbar.querySelector(".tqr-result-reply").textContent;
    if (!text || text.startsWith("⚠️") || text.startsWith("❌")) return;
    setTextInArea(textarea, text);
  });

  // --- Copy ---
  toolbar.querySelector(".tqr-btn-copy2").addEventListener("click", async () => {
    const text = toolbar.querySelector(".tqr-result-reply").textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const b = toolbar.querySelector(".tqr-btn-copy2");
      b.textContent = "✅"; setTimeout(() => b.textContent = "📋", 1500);
    } catch {}
  });

  // --- Retry ---
  toolbar.querySelector(".tqr-btn-retry").addEventListener("click", () => aiBtn.click());

  return toolbar;
}

// ===========================
// SCAN FOR REPLY TEXTAREAS — the core detection
// ===========================
function scanForReplyBoxes() {
  // STRATEGY: Find ALL visible textareas on the page.
  // YouTube Studio reply textareas have:
  //   - placeholder="Phản hồi..." or aria-label containing "reply"
  //   - inside tp-yt-iron-autogrow-textarea
  //   - inside ytcp-commentbox
  // We match broadly and filter.

  document.querySelectorAll("textarea").forEach(textarea => {
    const targetParent = textarea.closest("ytcp-commentbox") || textarea.closest("ytd-comment-simplebox-renderer") || textarea.closest("div") || textarea.parentElement;

    // Skip if already processed and toolbar still exists
    if (textarea.dataset.tqrProcessed === "1") {
      if (targetParent && targetParent.querySelector(".tqr-reply-toolbar")) return;
      // Toolbar was removed (e.g. user clicked Hủy), allow re-processing
      textarea.dataset.tqrProcessed = "";
    }

    if (targetParent && targetParent.querySelector(".tqr-reply-toolbar")) {
      textarea.dataset.tqrProcessed = "1";
      return;
    }

    // Check if this is a reply textarea
    const isReply = isReplyTextarea(textarea);
    if (!isReply) return;

    // Check visibility — textarea must be visible on page
    if (textarea.offsetParent === null && !textarea.closest("[hidden]")) return;
    if (textarea.closest("[hidden]")) return;

    textarea.dataset.tqrProcessed = "1";

    // Find Thai comment context
    const thaiComment = findThaiComment(textarea);

    // Create toolbar
    const toolbar = createReplyToolbar(textarea, thaiComment);

    // Find the best insertion point
    // YouTube Studio: textarea → tp-yt-iron-autogrow-textarea → ytcp-form-input-container → div#main
    // We want to insert into #main, before #footer
    const commentbox = textarea.closest("ytcp-commentbox");
    if (commentbox) {
      const footer = commentbox.querySelector("#footer");
      const main = commentbox.querySelector("#main");
      if (footer && footer.parentElement) {
        footer.parentElement.insertBefore(toolbar, footer);
      } else if (main) {
        main.appendChild(toolbar);
      } else {
        commentbox.appendChild(toolbar);
      }
      return;
    }

    // YouTube regular
    const simplebox = textarea.closest("ytd-comment-simplebox-renderer");
    if (simplebox) {
      const buttons = simplebox.querySelector("#buttons");
      if (buttons && buttons.parentElement) {
        buttons.parentElement.insertBefore(toolbar, buttons);
      } else {
        simplebox.appendChild(toolbar);
      }
      return;
    }

    // Generic fallback: insert after the textarea's container
    const parent = textarea.closest("div") || textarea.parentElement;
    if (parent) {
      parent.appendChild(toolbar);
    }
  });

  // ALSO: Look for contenteditable reply boxes (regular YouTube)
  document.querySelectorAll('#contenteditable-root[contenteditable="true"]').forEach(ce => {
    const targetParent = ce.closest("ytd-comment-simplebox-renderer") || ce.closest("ytcp-commentbox") || ce.closest("div") || ce.parentElement;

    if (ce.dataset.tqrProcessed === "1") {
      if (targetParent && targetParent.querySelector(".tqr-reply-toolbar")) return;
      ce.dataset.tqrProcessed = "";
    }

    if (targetParent && targetParent.querySelector(".tqr-reply-toolbar")) {
      ce.dataset.tqrProcessed = "1";
      return;
    }

    if (ce.offsetParent === null) return;
    ce.dataset.tqrProcessed = "1";

    const thaiComment = findThaiComment(ce);

    // Create a fake textarea interface for the toolbar
    const fakeTA = {
      get value() { return (ce.textContent || "").trim(); },
      set value(v) {},
    };

    const toolbar = createReplyToolbar(fakeTA, thaiComment);

    // Override setTextInArea for contenteditable
    toolbar.querySelector(".tqr-btn-use").addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      const text = toolbar.querySelector(".tqr-result-reply").textContent;
      if (!text || text.startsWith("⚠️") || text.startsWith("❌")) return;
      ce.innerHTML = "";
      ce.focus();
      document.execCommand("insertText", false, text);
      ce.dispatchEvent(new Event("input", { bubbles: true }));
    }, true);

    // Override translate click to read from contenteditable
    toolbar.querySelector(".tqr-btn-translate").addEventListener("click", async (e) => {
      e.stopImmediatePropagation();
      const viText = (ce.textContent || "").trim();
      if (!viText) return;
      const transBtn = toolbar.querySelector(".tqr-btn-translate");
      const resultDiv = toolbar.querySelector(".tqr-toolbar-result");
      const replyDiv = toolbar.querySelector(".tqr-result-reply");
      transBtn.textContent = "⏳..."; transBtn.disabled = true;
      try {
        const r = await chrome.runtime.sendMessage({ type: "TRANSLATE_VI_TO_THAI", text: viText });
        replyDiv.textContent = r?.translated || "Lỗi";
        resultDiv.hidden = false;
      } catch (err) { replyDiv.textContent = "❌ " + err.message; resultDiv.hidden = false; }
      transBtn.textContent = "🇹🇭 Dịch VN→TH"; transBtn.disabled = false;
    }, true);

    const simplebox = ce.closest("ytd-comment-simplebox-renderer");
    if (simplebox) {
      const buttons = simplebox.querySelector("#buttons");
      if (buttons && buttons.parentElement) buttons.parentElement.insertBefore(toolbar, buttons);
      else simplebox.appendChild(toolbar);
    } else {
      (ce.closest("div") || ce.parentElement)?.appendChild(toolbar);
    }
  });
}

function isReplyTextarea(textarea) {
  // Check placeholder
  const ph = (textarea.placeholder || "").toLowerCase();
  if (ph.includes("phản hồi") || ph.includes("reply") || ph.includes("comment")) return true;

  // Check aria-label of parent
  const ironTA = textarea.closest("tp-yt-iron-autogrow-textarea");
  if (ironTA) {
    const label = (ironTA.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("phản hồi") || label.includes("reply")) return true;
  }

  // Check if inside ytcp-commentbox (YouTube Studio)
  if (textarea.closest("ytcp-commentbox")) return true;

  // Check if inside ytd-comment-simplebox-renderer (YouTube)
  if (textarea.closest("ytd-comment-simplebox-renderer")) return true;

  return false;
}

// ===========================
// MUTATION OBSERVER + POLLING
// ===========================
function startObserver() {
  // Initial scan after page settles
  setTimeout(() => {
    addInlineTranslateButtons();
    scanForReplyBoxes();
  }, 2000);

  // MutationObserver for dynamic content
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      addInlineTranslateButtons();
      scanForReplyBoxes();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ALSO: Periodic polling as backup (catches shadow DOM changes)
  setInterval(() => {
    scanForReplyBoxes();
  }, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}
