/* Naano website chat widget - drop-in, no build step, no framework.
 *   <script src="naano-chat-widget.js" defer></script>
 *
 * Talks to this repo's own POST /api/ask (api/ask.mjs -> api/_lib/rag.mjs):
 * a small precomputed-embeddings index + OpenAI REST calls, answers
 * STRICTLY grounded in whatever's indexed - which, for this widget, is
 * only this site's own public pages (api/_lib/rag-index.json, rebuilt via
 * scripts/build-rag-index.mjs). A query that isn't covered by the site's
 * content is refused, not guessed at - that's the whole point: the
 * reference product's own assistant answers arbitrary coding/math
 * questions with no relation to the product (verified against the live
 * naano.com widget), which is exactly the failure mode this is built to
 * avoid.
 *
 * (This used to call out to a separate Python/FAISS project on localhost -
 * see docs/naano-notes.md's chatbot changelog entries for that history and
 * why it moved in-repo: that stack doesn't fit a Vercel deploy.)
 *
 * Backend override: set window.NAANO_CHAT_API before this script loads to
 * point at a different deployment's /api/ask instead of this same origin.
 */
(function () {
  "use strict";
  var API = window.NAANO_CHAT_API || "";

  var CSS = ""
    + ".naano-chat{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);"
    + "z-index:9999;display:flex;flex-direction:column;align-items:center;"
    + "font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
    + "width:min(640px,calc(100vw - 32px))}"
    + ".naano-chat__toggle{width:28px;height:28px;border-radius:50%;border:1px solid #e6e9ef;"
    + "background:#fff;box-shadow:0 6px 16px rgba(16,17,22,.10);display:grid;place-items:center;"
    + "cursor:pointer;margin-bottom:8px;color:#43454c;transition:transform .15s}"
    + ".naano-chat__toggle:hover{color:#101116}"
    + ".naano-chat.is-open .naano-chat__toggle{transform:rotate(180deg)}"
    + ".naano-chat__panel{width:100%;max-height:min(60vh,520px);overflow-y:auto;background:#fff;"
    + "border:1px solid #e6e9ef;border-radius:18px;box-shadow:0 20px 48px rgba(16,17,22,.16);"
    + "padding:16px;margin-bottom:10px;display:none;flex-direction:column;gap:12px}"
    + ".naano-chat.is-open .naano-chat__panel{display:flex}"
    + ".naano-chat__empty{color:#8a93a2;font-size:13px;text-align:center;padding:18px 8px}"
    + ".naano-chat__msg{font-size:14px;line-height:1.5;max-width:88%}"
    + ".naano-chat__msg--user{align-self:flex-end;background:#101116;color:#fff;"
    + "border-radius:14px 14px 4px 14px;padding:9px 13px}"
    + ".naano-chat__msg--bot{align-self:flex-start;color:#101116;padding:2px 2px}"
    + ".naano-chat__msg--bot.is-declined{color:#697281;font-style:italic}"
    + ".naano-chat__sources{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}"
    + ".naano-chat__source{font-size:11px;color:#2d61f5;background:#eef3ff;border-radius:999px;"
    + "padding:3px 9px;text-decoration:none}"
    + ".naano-chat__pill{width:100%;display:flex;align-items:center;gap:10px;background:#fff;"
    + "border:1px solid #e9edf4;border-radius:999px;padding:9px 10px 9px 18px;"
    + "box-shadow:0 10px 30px rgba(16,17,22,.10)}"
    + ".naano-chat__pill input{flex:1;border:0;outline:0;font-size:14px;color:#101116;background:transparent}"
    + ".naano-chat__pill input::placeholder{color:#8a93a2}"
    + ".naano-chat__send{width:34px;height:34px;border-radius:50%;border:0;background:#101116;"
    + "color:#fff;display:grid;place-items:center;cursor:pointer;flex-shrink:0}"
    + ".naano-chat__send:disabled{opacity:.5;cursor:default}"
    + ".naano-chat__spinner{width:14px;height:14px;flex-shrink:0;border-radius:50%;"
    + "border:2px solid #dbe4ff;border-top-color:#2d61f5;animation:naano-chat-spin .7s linear infinite}"
    + "@keyframes naano-chat-spin{to{transform:rotate(360deg)}}"
    + "@media (prefers-color-scheme:dark){.naano-chat__panel,.naano-chat__pill,.naano-chat__toggle{"
    + "background:#16171c;border-color:#2a2c33}.naano-chat__msg--bot{color:#f2f3f5}"
    + ".naano-chat__pill input{color:#f2f3f5}}";

  var SPARKLE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>';
  var CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = el(
      '<div class="naano-chat">' +
        '<button class="naano-chat__toggle" type="button" aria-label="Toggle chat">' + CHEVRON + "</button>" +
        '<div class="naano-chat__panel"><div class="naano-chat__empty">Ask about Naano - pricing, how it works, creators, agencies. Answers are grounded in this site only.</div></div>' +
        '<form class="naano-chat__pill">' + SPARKLE +
          '<input type="text" placeholder="What can I help you find?" aria-label="Ask a question about Naano" autocomplete="off">' +
          '<button class="naano-chat__send" type="submit" aria-label="Send">' + SEND + "</button>" +
        "</form>" +
      "</div>"
    );
    document.body.appendChild(root);

    var panel = root.querySelector(".naano-chat__panel");
    var toggle = root.querySelector(".naano-chat__toggle");
    var form = root.querySelector("form");
    var input = root.querySelector("input");
    var sendBtn = root.querySelector(".naano-chat__send");
    var hasMessages = false;

    function open() { root.classList.add("is-open"); }
    toggle.addEventListener("click", function () { root.classList.toggle("is-open"); });
    input.addEventListener("focus", open);

    function scrollDown() { panel.scrollTop = panel.scrollHeight; }

    function addMessage(kind, html) {
      if (!hasMessages) { panel.innerHTML = ""; hasMessages = true; }
      var bubble = el('<div class="naano-chat__msg naano-chat__msg--' + kind + '">' + html + "</div>");
      panel.appendChild(bubble);
      scrollDown();
      return bubble;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      open();
      addMessage("user", esc(q));
      input.value = "";
      input.disabled = true;
      sendBtn.disabled = true;
      var pending = addMessage("bot", '<span class="naano-chat__spinner"></span>');

      fetch(API.replace(/\/$/, "") + "/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, top_k: 5 }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error((r.data && r.data.detail) || "Request failed");
          var data = r.data;
          pending.classList.toggle("is-declined", !data.grounded);
          pending.innerHTML = esc(data.answer);
          if (data.grounded && data.sources && data.sources.length) {
            var uniq = [];
            data.sources.forEach(function (s) { if (uniq.indexOf(s.source) === -1) uniq.push(s.source); });
            var srcHtml = '<div class="naano-chat__sources">' +
              uniq.map(function (s) { return '<span class="naano-chat__source">' + esc(s) + "</span>"; }).join("") +
              "</div>";
            pending.insertAdjacentHTML("beforeend", srcHtml);
          }
          scrollDown();
        })
        .catch(function (err) {
          pending.classList.add("is-declined");
          pending.textContent = "Couldn't reach the assistant (" + err.message + "). Is the RAG server running on " + API + "?";
        })
        .finally(function () {
          input.disabled = false;
          sendBtn.disabled = false;
          input.focus();
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
