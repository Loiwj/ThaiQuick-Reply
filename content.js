/* ===== Thai Comment Manager — Content Script v3.0 ===== */
/* YouTube Studio — JSON Export/Import workflow */

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
// HELPER: get clean text from comment element
// ===========================
function getCleanText(el) {
  let text = "";
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains("tqr-comment-translation")) return;
      if (node.tagName === "IMG" && node.alt) { text += node.alt; return; }
      text += node.textContent || "";
    }
  });
  return text.trim();
}

// ===========================
// SET TEXT INTO REPLY TEXTAREA
// ===========================
function setTextInArea(textarea, text) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(textarea, text);
  else textarea.value = text;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));

  const ironTextarea = textarea.closest("tp-yt-iron-autogrow-textarea");
  if (ironTextarea) {
    const mirror = ironTextarea.querySelector("#mirror");
    if (mirror) mirror.innerHTML = escapeHtml(text) + "&nbsp;";
  }
}

// ===========================
// COLLECT ALL THAI COMMENTS
// ===========================
function collectAllComments(exportLimit = 0) {
  // Find all comment thread containers
  // Use ytcp-comment-thread to avoid duplicates (thread contains ytcp-comment)
  let commentContainers = Array.from(document.querySelectorAll("ytcp-comment-thread"));
  // Fallback if no threads found
  if (commentContainers.length === 0) {
    commentContainers = Array.from(document.querySelectorAll("ytcp-comment"));
  }

  let idx = 0;
  const allRawComments = [];
  commentContainers.forEach(container => {
    // Get the actual comment element (first comment in thread, not replies)
    const commentEl = container.querySelector("ytcp-comment") || container;
    const contentEl = commentEl.querySelector("#content-text");
    if (!contentEl) return;
    
    const text = getCleanText(contentEl);
    if (!text || !isThaiText(text)) return;

    // Get author name
    let author = "";
    const authorEl = commentEl.querySelector(
      "#author-text, .author-text, #name #text, " +
      "a.comment-author-text, #author-name"
    );
    if (authorEl) {
      author = (authorEl.textContent || "").trim();
    }

    // Get video title for this comment
    // YouTube Studio comments page shows video title near each comment
    let videoTitle = "";
    const videoTitleEl = container.querySelector(
      "#video-title, .video-title, " +
      "a.video-title-text, #video-title-text, " +
      ".comment-video-title, [id=\"video-title\"] span, " +
      "ytcp-video-title a, ytcp-video-title span"
    );
    if (videoTitleEl) {
      videoTitle = (videoTitleEl.textContent || "").trim();
    }
    // Fallback: look in parent or nearby elements  
    if (!videoTitle) {
      const threadContainer = container.closest("ytcp-comment-thread") || container;
      const vt = threadContainer.querySelector("a[href*='/video/'], a[href*='/edit/']");
      if (vt) videoTitle = (vt.textContent || "").trim();
    }
    // Fallback: page title
    if (!videoTitle) {
      const pageTitleEl = document.querySelector(
        "ytcp-video-metadata-editor #title textarea, " +
        "#entity-name, .entity-name"
      );
      if (pageTitleEl) videoTitle = (pageTitleEl.value || pageTitleEl.textContent || "").trim();
    }
    if (!videoTitle) {
      videoTitle = document.title.replace(/ - YouTube Studio$/, "").trim();
    }

    // Check if this comment can be replied to
    const replyBtn = container.querySelector(
      'button[aria-label*="Phản hồi"], button[aria-label*="Reply"], ' +
      '#reply-button button, .reply-button, [id="reply-button"]'
    );
    const hasReplyBtn = !!replyBtn;

    idx++;
    container.dataset.tqrCommentId = String(idx);

    allRawComments.push({
      id: idx,
      author: author || `User ${idx}`,
      comment: text,
      translation: "",
      videoTitle: videoTitle,
      hasReplyBtn: hasReplyBtn
    });
  });

  // Apply export limit
  const comments = (exportLimit > 0) ? allRawComments.slice(0, exportLimit) : allRawComments;

  return {
    totalFound: allRawComments.length,
    totalComments: comments.length,
    comments: comments
  };
}

// ===========================
// FIND COMMENT CONTAINER BY TEXT + AUTHOR
// ===========================
function normalizeText(str) {
  return (str || "")
    .trim()
    .replace(/\s+/g, " ")              // collapse whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, ""); // remove zero-width chars
}

function getAllCommentContainers() {
  let containers = Array.from(document.querySelectorAll("ytcp-comment-thread"));
  if (containers.length === 0) {
    containers = Array.from(document.querySelectorAll("ytcp-comment"));
  }
  return containers;
}

function getContainerInfo(container) {
  const commentEl = container.querySelector("ytcp-comment") || container;
  const contentEl = commentEl.querySelector("#content-text");
  if (!contentEl) return null;
  
  const text = getCleanText(contentEl);
  if (!text) return null;

  let author = "";
  const authorEl = commentEl.querySelector(
    "#author-text, .author-text, #name #text, a.comment-author-text, #author-name"
  );
  if (authorEl) author = (authorEl.textContent || "").trim();

  return { text, author, normalizedText: normalizeText(text) };
}

function findCommentContainer(commentText, authorName) {
  if (!commentText) return null;
  const targetNorm = normalizeText(commentText);
  const containers = getAllCommentContainers();
  
  // Pass 1: exact normalized text + author match
  if (authorName) {
    const authorNorm = normalizeText(authorName);
    for (const container of containers) {
      if (container.dataset.tqrUsed) continue;
      const info = getContainerInfo(container);
      if (!info) continue;
      if (info.normalizedText === targetNorm && normalizeText(info.author) === authorNorm) {
        return container;
      }
    }
  }

  // Pass 2: exact normalized text match (no author)
  for (const container of containers) {
    if (container.dataset.tqrUsed) continue;
    const info = getContainerInfo(container);
    if (!info) continue;
    if (info.normalizedText === targetNorm) {
      return container;
    }
  }

  // Pass 3: partial/contains match (for cases where text extraction differs slightly)
  for (const container of containers) {
    if (container.dataset.tqrUsed) continue;
    const info = getContainerInfo(container);
    if (!info) continue;
    // Check if one contains the other (at least 80% overlap)
    if (targetNorm.length > 5 && info.normalizedText.length > 5) {
      if (info.normalizedText.includes(targetNorm) || targetNorm.includes(info.normalizedText)) {
        return container;
      }
    }
  }

  return null;
}

// ===========================
// APPLY REPLIES FROM JSON
// ===========================
async function applyReplies(repliesData) {
  const results = [];
  const replies = repliesData.replies || repliesData;
  
  if (!Array.isArray(replies)) {
    return [{ id: "?", status: "error", message: "JSON không hợp lệ — cần mảng replies" }];
  }

  // Clear previous used markers
  document.querySelectorAll("[data-tqr-used]").forEach(el => delete el.dataset.tqrUsed);

  for (const item of replies) {
    const id = String(item.id);
    const replyText = (item.reply || "").trim();
    const commentText = (item.comment || "").trim();
    const commentTranslation = (item.translation || "").trim();
    const replyTranslation = (item.replyTranslation || "").trim();
    
    if (!replyText) {
      results.push({ id, status: "skip", message: "Không có reply text" });
      continue;
    }

    // Find container by text + author match
    let container = null;
    if (commentText) {
      container = findCommentContainer(commentText, item.author || "");
    }
    // Fallback: try old ID-based matching
    if (!container) {
      container = document.querySelector(`[data-tqr-comment-id="${id}"]`);
    }

    if (!container) {
      results.push({ id, status: "error", message: "Không tìm thấy comment trên trang" });
      continue;
    }

    // Mark as used to avoid double-matching
    container.dataset.tqrUsed = "1";

    try {
      // Step 1: Click the reply button to open reply box
      let replyBtn = container.querySelector(
        '#reply-button button, [id="reply-button"] button, ' +
        'button[aria-label*="Phản hồi"], button[aria-label*="Reply"]'
      );
      
      if (!replyBtn) {
        replyBtn = container.querySelector('#reply-button, [id="reply-button"], .reply-button');
      }

      if (replyBtn) {
        replyBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }

      // Step 2: Find the textarea
      let textarea = container.querySelector("ytcp-commentbox textarea, textarea");
      let ceEl = container.querySelector('#contenteditable-root[contenteditable="true"]');
      let filled = false;

      if (textarea) {
        setTextInArea(textarea, replyText);
        filled = true;
      } else if (ceEl) {
        ceEl.innerHTML = "";
        ceEl.focus();
        document.execCommand("insertText", false, replyText);
        ceEl.dispatchEvent(new Event("input", { bubbles: true }));
        filled = true;
      }

      if (filled) {
        // Show translations as simple inline badges
        if (commentTranslation) {
          // Remove old comment translation
          container.querySelectorAll(".tqr-trans-comment").forEach(el => el.remove());
          const transEl = document.createElement("div");
          transEl.className = "tqr-trans-comment";
          transEl.textContent = `🇻🇳 ${commentTranslation}`;
          // Insert right before the reply/action buttons area
          const commentEl = container.querySelector("ytcp-comment") || container;
          const bodyEl = commentEl.querySelector("#body, #main, .body") || commentEl;
          bodyEl.appendChild(transEl);
        }

        if (replyTranslation) {
          // Remove old reply translation
          container.querySelectorAll(".tqr-trans-reply").forEach(el => el.remove());
          const replyTransEl = document.createElement("div");
          replyTransEl.className = "tqr-trans-reply";
          replyTransEl.textContent = `📝 ${replyTranslation}`;
          container.appendChild(replyTransEl);
        }

        container.style.outline = "2px solid #2ed573";
        container.style.outlineOffset = "2px";
        setTimeout(() => { container.style.outline = ""; container.style.outlineOffset = ""; }, 60000);
        results.push({ id, status: "ok", message: "Đã điền reply" });
      } else {
        results.push({ id, status: "error", message: "Không tìm thấy ô reply — thử nhấn Phản hồi trước" });
      }
    } catch (err) {
      results.push({ id, status: "error", message: err.message });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

// ===========================
// FLOATING PANEL UI
// ===========================
let panelEl = null;

function createPanel() {
  if (panelEl) { panelEl.remove(); panelEl = null; }

  panelEl = document.createElement("div");
  panelEl.className = "tqr-panel";
  panelEl.innerHTML = `
    <div class="tqr-panel-header">
      <span class="tqr-panel-title">💬 Comment Manager</span>
      <div class="tqr-panel-header-actions">
        <button class="tqr-panel-minimize" title="Thu nhỏ">─</button>
        <button class="tqr-panel-close" title="Đóng">✕</button>
      </div>
    </div>
    <div class="tqr-panel-body">
      <div class="tqr-panel-section">
        <div class="tqr-section-title">📤 EXPORT — Xuất bình luận</div>
        <div class="tqr-section-desc">Quét tất cả bình luận tiếng Thái trên trang này</div>
        <div class="tqr-btn-row">
          <button class="tqr-btn tqr-btn-export" id="tqrBtnExport">📋 Quét & Export JSON</button>
          <button class="tqr-btn tqr-btn-refresh" id="tqrBtnRefresh" title="Quét lại">🔄</button>
        </div>
        <div class="tqr-export-stats" id="tqrExportStats" style="display:none;">
          <span class="tqr-stat-badge" id="tqrStatCount">0 bình luận</span>
        </div>
        <textarea class="tqr-json-area" id="tqrExportArea" readonly placeholder="JSON sẽ xuất hiện ở đây..." rows="6"></textarea>
        <button class="tqr-btn tqr-btn-copy" id="tqrBtnCopy" style="display:none;">📋 Copy JSON</button>
      </div>

      <div class="tqr-panel-divider"></div>

      <div class="tqr-panel-section">
        <div class="tqr-section-title">📥 IMPORT — Nhập reply từ AI</div>
        <div class="tqr-section-desc">Paste JSON phản hồi từ ChatGPT/Gemini vào đây</div>
        <textarea class="tqr-json-area" id="tqrImportArea" placeholder='Paste JSON reply vào đây...&#10;Format:&#10;{&#10;  "replies": [&#10;    { "id": 1, "reply": "ขอบคุณค่ะ 🥰" }&#10;  ]&#10;}' rows="6"></textarea>
        <div class="tqr-btn-row">
          <button class="tqr-btn tqr-btn-preview" id="tqrBtnPreview">👁️ Xem trước</button>
        </div>
        <div class="tqr-preview-area" id="tqrPreviewArea" style="display:none;"></div>
        <div class="tqr-btn-row" id="tqrConfirmRow" style="display:none;">
          <button class="tqr-btn tqr-btn-apply" id="tqrBtnApply">✅ Xác nhận & Áp dụng</button>
          <button class="tqr-btn tqr-btn-refresh" id="tqrBtnCancelPreview">❌ Hủy</button>
        </div>
        <div class="tqr-import-log" id="tqrImportLog" style="display:none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(panelEl);

  // Make panel draggable
  makeDraggable(panelEl, panelEl.querySelector(".tqr-panel-header"));

  // Close
  panelEl.querySelector(".tqr-panel-close").addEventListener("click", () => {
    panelEl.remove(); panelEl = null;
  });

  // Minimize/restore
  const minimizeBtn = panelEl.querySelector(".tqr-panel-minimize");
  const panelBody = panelEl.querySelector(".tqr-panel-body");
  minimizeBtn.addEventListener("click", () => {
    const isHidden = panelBody.style.display === "none";
    panelBody.style.display = isHidden ? "" : "none";
    minimizeBtn.textContent = isHidden ? "─" : "□";
  });

  // Export
  panelEl.querySelector("#tqrBtnExport").addEventListener("click", doExport);
  panelEl.querySelector("#tqrBtnRefresh").addEventListener("click", doExport);

  // Copy + optionally open AI tab
  panelEl.querySelector("#tqrBtnCopy").addEventListener("click", async () => {
    const exportArea = panelEl.querySelector("#tqrExportArea");
    const btn = panelEl.querySelector("#tqrBtnCopy");
    try {
      await navigator.clipboard.writeText(exportArea.value);
      btn.textContent = "✅ Đã copy!";
      setTimeout(() => { btn.textContent = "📋 Copy JSON"; }, 2000);

      // Auto-open AI tab if enabled
      const settings = await chrome.storage.local.get(["autoOpenGemini", "geminiUrl"]);
      const autoOpen = settings.autoOpenGemini !== undefined ? settings.autoOpenGemini : true;
      if (autoOpen) {
        const url = settings.geminiUrl || "https://gemini.google.com/app";
        chrome.runtime.sendMessage({ type: "OPEN_AI_TAB", url });
      }
    } catch {
      exportArea.select();
      document.execCommand("copy");
    }
  });

  // Preview
  panelEl.querySelector("#tqrBtnPreview").addEventListener("click", doPreview);

  // Apply (confirm after preview)
  panelEl.querySelector("#tqrBtnApply").addEventListener("click", doImport);

  // Cancel preview
  panelEl.querySelector("#tqrBtnCancelPreview").addEventListener("click", () => {
    panelEl.querySelector("#tqrPreviewArea").style.display = "none";
    panelEl.querySelector("#tqrConfirmRow").style.display = "none";
  });
}

function doExport() {
  const exportArea = panelEl.querySelector("#tqrExportArea");
  const statsEl = panelEl.querySelector("#tqrExportStats");
  const statCount = panelEl.querySelector("#tqrStatCount");
  const copyBtn = panelEl.querySelector("#tqrBtnCopy");
  const exportBtn = panelEl.querySelector("#tqrBtnExport");

  exportBtn.textContent = "⏳ Đang quét..."; exportBtn.disabled = true;

  // Read export limit from settings
  let exportLimit = 15;
  try {
    // chrome.storage.local.get is async, but we can use a sync approach
    // by reading from a cached value or using a default
    const stored = localStorage.getItem("tqr_exportLimit");
    if (stored) exportLimit = parseInt(stored) || 15;
  } catch {}

  // Use async getter then run
  chrome.storage.local.get(["exportLimit"], (settings) => {
    exportLimit = settings.exportLimit !== undefined ? settings.exportLimit : 15;
    
    try {
      const data = collectAllComments(exportLimit);
      const json = JSON.stringify(data, null, 2);
      exportArea.value = json;
      const limitText = (data.totalFound > data.totalComments) 
        ? `${data.totalComments}/${data.totalFound} bình luận Thái` 
        : `${data.totalComments} bình luận Thái`;
      statCount.textContent = limitText;
      statsEl.style.display = "";
      copyBtn.style.display = "";

      if (data.totalComments === 0) {
        exportArea.value = "⚠️ Không tìm thấy bình luận tiếng Thái nào trên trang này.\n\nHãy chắc chắn bạn đang ở trang Comments trong YouTube Studio.";
        copyBtn.style.display = "none";
      }
    } catch (err) {
      exportArea.value = `❌ Lỗi: ${err.message}`;
    }
    exportBtn.textContent = "📋 Quét & Export JSON"; exportBtn.disabled = false;
  });
}

// Parse and store current import data for preview → confirm flow
let _pendingReplies = null;

function doPreview() {
  const importArea = panelEl.querySelector("#tqrImportArea");
  const previewArea = panelEl.querySelector("#tqrPreviewArea");
  const confirmRow = panelEl.querySelector("#tqrConfirmRow");
  const logEl = panelEl.querySelector("#tqrImportLog");
  const jsonText = importArea.value.trim();

  logEl.style.display = "none";

  if (!jsonText) {
    previewArea.innerHTML = '<div class="tqr-log-error">⚠️ Hãy paste JSON reply vào trước!</div>';
    previewArea.style.display = "";
    confirmRow.style.display = "none";
    return;
  }

  let repliesData;
  try {
    repliesData = JSON.parse(jsonText);
  } catch (e) {
    previewArea.innerHTML = `<div class="tqr-log-error">❌ JSON không hợp lệ: ${escapeHtml(e.message)}</div>`;
    previewArea.style.display = "";
    confirmRow.style.display = "none";
    return;
  }

  const replies = repliesData.replies || repliesData;
  if (!Array.isArray(replies) || replies.length === 0) {
    previewArea.innerHTML = '<div class="tqr-log-error">⚠️ Không tìm thấy replies trong JSON</div>';
    previewArea.style.display = "";
    confirmRow.style.display = "none";
    return;
  }

  _pendingReplies = repliesData;

  // Build preview HTML
  let html = `<div class="tqr-preview-header">👁️ Xem trước ${replies.length} reply:</div>`;
  replies.forEach(item => {
    const id = String(item.id);
    const replyText = (item.reply || "").trim();
    const commentTranslation = (item.translation || "").trim();
    const replyTranslation = (item.replyTranslation || "").trim();
    const commentTextFromJson = (item.comment || "").trim();
    const authorFromJson = (item.author || "").trim();
    
    // Find comment in DOM: by text + author match
    let container = null;
    if (commentTextFromJson) {
      container = findCommentContainer(commentTextFromJson, authorFromJson);
    }
    if (!container) {
      container = document.querySelector(`[data-tqr-comment-id="${id}"]`);
    }

    let originalComment = commentTextFromJson;
    let author = authorFromJson;
    if (container) {
      if (!originalComment) {
        const ctEl = container.querySelector("ytcp-comment")?.querySelector("#content-text") || container.querySelector("#content-text");
        if (ctEl) originalComment = getCleanText(ctEl);
      }
      if (!author) {
        const commentEl = container.querySelector("ytcp-comment") || container;
        const authorEl = commentEl.querySelector("#author-text, .author-text, #name #text, a.comment-author-text, #author-name");
        if (authorEl) author = (authorEl.textContent || "").trim();
      }
    }

    const statusCls = container ? (replyText ? "tqr-preview-ok" : "tqr-preview-skip") : "tqr-preview-err";
    const statusIcon = container ? (replyText ? "✅" : "⏭️") : "❌";

    html += `<div class="tqr-preview-item ${statusCls}">`;
    html += `<div class="tqr-preview-id">${statusIcon} #${escapeHtml(id)}${author ? " — " + escapeHtml(author) : ""}</div>`;

    // --- Bình luận gốc + dịch ---
    if (originalComment) {
      html += `<div class="tqr-preview-group">`;
      html += `<div class="tqr-preview-original">🇹🇭 ${escapeHtml(originalComment)}</div>`;
      if (commentTranslation) {
        html += `<div class="tqr-preview-sub">↳ 🇻🇳 ${escapeHtml(commentTranslation)}</div>`;
      }
      html += `</div>`;
    }

    // --- Reply + dịch ---
    if (replyText) {
      html += `<div class="tqr-preview-group tqr-preview-reply-group">`;
      html += `<div class="tqr-preview-reply">💬 ${escapeHtml(replyText)}</div>`;
      if (replyTranslation) {
        html += `<div class="tqr-preview-sub">↳ 📝 ${escapeHtml(replyTranslation)}</div>`;
      }
      html += `</div>`;
    }
    if (!replyText) {
      html += `<div class="tqr-preview-reply tqr-preview-empty">⏭️ (không có reply)</div>`;
    }
    if (!container) {
      html += `<div class="tqr-preview-reply tqr-preview-empty">❌ Không tìm thấy comment #${escapeHtml(id)} trên trang</div>`;
    }
    html += `</div>`;
  });

  previewArea.innerHTML = html;
  previewArea.style.display = "";
  confirmRow.style.display = "";
}

async function doImport() {
  if (!_pendingReplies) {
    // If no preview was done, do preview first
    doPreview();
    return;
  }

  const logEl = panelEl.querySelector("#tqrImportLog");
  const applyBtn = panelEl.querySelector("#tqrBtnApply");
  const previewArea = panelEl.querySelector("#tqrPreviewArea");
  const confirmRow = panelEl.querySelector("#tqrConfirmRow");

  applyBtn.textContent = "⏳ Đang áp dụng..."; applyBtn.disabled = true;
  logEl.innerHTML = '<div class="tqr-log-info">⏳ Đang điền reply vào các ô...</div>';
  logEl.style.display = "";

  try {
    const results = await applyReplies(_pendingReplies);
    const okCount = results.filter(r => r.status === "ok").length;
    const errCount = results.filter(r => r.status === "error").length;
    const skipCount = results.filter(r => r.status === "skip").length;

    let logHtml = `<div class="tqr-log-summary">✅ ${okCount} thành công`;
    if (errCount) logHtml += ` · ❌ ${errCount} lỗi`;
    if (skipCount) logHtml += ` · ⏭️ ${skipCount} bỏ qua`;
    logHtml += `</div>`;

    results.forEach(r => {
      const cls = r.status === "ok" ? "tqr-log-ok" : (r.status === "error" ? "tqr-log-error" : "tqr-log-skip");
      const icon = r.status === "ok" ? "✅" : (r.status === "error" ? "❌" : "⏭️");
      logHtml += `<div class="${cls}">${icon} #${r.id}: ${escapeHtml(r.message)}</div>`;
    });

    logEl.innerHTML = logHtml;
  } catch (err) {
    logEl.innerHTML = `<div class="tqr-log-error">❌ Lỗi: ${escapeHtml(err.message)}</div>`;
  }

  applyBtn.textContent = "✅ Xác nhận & Áp dụng"; applyBtn.disabled = false;
  previewArea.style.display = "none";
  confirmRow.style.display = "none";
  _pendingReplies = null;
}

// ===========================
// DRAGGABLE
// ===========================
function makeDraggable(el, handle) {
  let isDragging = false, startX, startY, origX, origY;
  handle.style.cursor = "move";
  
  handle.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return; // Don't drag when clicking buttons
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = el.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    e.preventDefault();
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = `${origX + dx}px`;
    el.style.top = `${origY + dy}px`;
    el.style.right = "auto";
  });
  
  document.addEventListener("mouseup", () => { isDragging = false; });
}

// ===========================
// TOGGLE BUTTON (fixed on page)
// ===========================
function createToggleButton() {
  if (document.querySelector(".tqr-toggle-btn")) return;
  
  const btn = document.createElement("button");
  btn.className = "tqr-toggle-btn";
  btn.innerHTML = "💬";
  btn.title = "Comment Manager — Export/Import";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (panelEl && document.body.contains(panelEl)) {
      panelEl.remove(); panelEl = null;
    } else {
      createPanel();
    }
  });
}

// ===========================
// MUTATION OBSERVER + POLLING
// ===========================
function startObserver() {
  setTimeout(() => {
    createToggleButton();
  }, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}
