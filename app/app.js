/* Naano app — shared chrome builders + interactions + motion. Load on every app/*.html page. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const MARK = '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M3 20 15 5l3 7-10 12z" fill="#101116"/><path d="M14 22 24 9l5 13z" fill="#101116"/><circle cx="12" cy="23" r="2.4" fill="#2d61f5"/></svg>';
  const I = {
    overview: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M13 10h5M13 14h5"/>',
    opportunities: '<path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5zM3 9l2-5h14l2 5M9 13h6"/>',
    collaborations: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
    analytics: '<path d="M4 19V5M4 19h16M8 15l3-4 3 3 4-6"/>',
    community: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M21 20a6 6 0 0 0-4-5.7"/>',
    earnings: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
    affiliate: '<path d="M19 5 5 19M8.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM18.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>',
    messages: '<path d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12z"/>',
  };
  const NAV = [
    ["overview.html", "Overview", I.overview],
    ["card.html", "My card", I.card],
    ["opportunities.html", "Opportunities", I.opportunities],
    ["collaborations.html", "Collaborations", I.collaborations],
    ["analytics.html", "Analytics", I.analytics],
    ["community.html", "Community", I.community],
    ["earnings.html", "Earnings", I.earnings],
    ["affiliate.html", "Affiliate program", I.affiliate],
    ["messages.html", "Messages", I.messages],
  ];
  const svg = (p, w = 19) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  /* ---- build app shell around <main data-page> ---------------------- */
  const page = $("main[data-page]");
  if (page) {
    const here = location.pathname.split("/").pop();
    const rail = h(`<nav class="rail">
      <div class="rail__logo">${MARK}<span>naano</span></div>
      ${NAV.map(([href, label, ic]) => `<a href="${href}" class="${href === here ? "is-on" : ""}">${svg(ic)}<span>${label}</span></a>`).join("")}
    </nav>`);
    const topbar = h(`<header class="topbar">
      <span class="topbar__pill">${svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>', 14)}€0</span>
      <span class="lang"><button class="is-on">EN</button><button>FR</button></span>
      <button class="icon-btn" aria-label="Notifications">${svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>', 16)}</button>
      <button class="avatar-btn" data-menu-btn aria-label="Account">A</button>
      <div class="menu" data-menu hidden>
        <a href="#">${svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>', 15)}Integrations</a>
        <a href="settings.html">${svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L13.5 2h-3l-.4 2.8a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.4 2.8h3l.4-2.8a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6c.1-.5.1-.9.1-1.4z"/>', 15)}Settings</a>
        <a href="overview.html?tour=1">${svg(I.overview, 15)}Guided tour</a>
        <hr>
        <a href="signin.html">${svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', 15)}Sign out</a>
      </div>
    </header>`);
    const shell = h('<div class="shell"></div>');
    const main = h('<div class="main"></div>');
    page.replaceWith(shell);
    shell.append(rail, main);
    main.append(topbar, page);
    main.append(
      h(`<div class="assistant">${svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 16)}<input placeholder="What can I help you find?" aria-label="Ask NaanoBot"><button class="pw__toggle" aria-label="Voice">${svg('<path d="M12 4v16M8 8v8M4 11v2M16 7v10M20 10v4"/>', 16)}</button></div>`)
    );
    document.body.append(h('<button class="feedback" aria-label="Feedback">✷</button>'));
  }

  /* ---- marketplace card injector: <div data-mcard="blank|named|perf|priced|final"> --- */
  const CARD_LI = '<svg viewBox="0 0 24 24" fill="currentColor" width="15"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45z"/></svg>';
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let LIVE = null;
  try { LIVE = JSON.parse(localStorage.getItem("naano.card") || sessionStorage.getItem("naano.card") || "null"); } catch {}
  const initials = (n) => (n || "A").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "A";

  function cardFront(o) {
    return `<div class="mcard">
      <div class="mcard__head"><span class="mcard__corner mcard__corner--l">${CARD_LI}</span>${o.perf ? '<span class="mcard__corner mcard__corner--r">IN</span>' : ""}<img class="mcard__logo" src="https://naano.com/lp/naano-logo-nav.png" alt=""><span class="mcard__av">${esc(o.av || "A")}</span></div>
      <div class="mcard__body">
        <div class="mcard__name">${esc(o.name || "Your name")}</div>
        ${o.cats ? `<div class="mcard__cats">${esc(o.cats)}</div>` : ""}
        <div class="mcard__headline">${esc(o.headline || "Your LinkedIn headline and topics will appear here.")}</div>
        <div class="mcard__data"><span>Data</span><span class="bar"><i style="width:${o.data || 8}%"></i></span><span>${o.data >= 90 ? "Live" : "Pending"}</span></div>
      </div>
      <div class="mcard__stats">
        <div class="mcard__stat"><b>${esc(o.followers || "—")}</b><span>Followers</span></div>
        <div class="mcard__stat"><b>${esc(o.impr || "—")}</b><span>Est. impressions</span></div>
        <div class="mcard__stat"><b>${esc(o.cost || "—")}</b><span>Cost / post</span></div>
      </div>
    </div>`;
  }
  function cardPerf(o) {
    const c = o.live || {};
    const v = (x) => (x == null || x === "" ? "—" : esc(x));
    const tile = (ic, lbl, val) => `<div class="mcard__mtile">${svg(ic, 15)}<div class="lbl">${lbl}</div><div class="val">${v(val)}</div></div>`;
    return `<div class="mcard mcard--perf">
      <div class="mcard__head"><span class="mcard__corner mcard__corner--l">${CARD_LI}</span><span class="mcard__corner mcard__corner--r">IN</span><img class="mcard__logo" src="https://naano.com/lp/naano-logo-nav.png" alt=""><span class="mcard__av">${o.av || "A"}</span></div>
      <div class="mcard__body">
        <h3>Performance &amp; ICP</h3><p class="sub">Public LinkedIn profile data from Apify (Basic card).</p>
        <div class="mcard__grid">
          ${tile(I.community, "Followers", c.followers != null ? c.followers_display : null)}
          ${tile('<path d="M7 10v11H4V10zM7 10l3-7a2 2 0 0 1 4 1v3h5a2 2 0 0 1 2 2.5l-2 7a2 2 0 0 1-2 1.5H7"/>', "Reactions per post", c.reactions_per_post)}
          ${tile('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', "Typical impressions per post", c.typical_impressions_per_post != null ? c.est_impressions_display : null)}
          ${tile(I.messages, "Comments per post", c.comments_per_post)}
          ${tile(I.affiliate, "Engagement rate", c.engagement_rate_pct != null ? c.engagement_rate_pct + "%" : null)}
        </div>
        <span class="mcard__note">${c.presence_score != null ? `Presence ${c.presence_score}/100 (grade ${esc(c.grade)}) · estimated by Naano` : "Public LinkedIn data estimated by Naano"}</span>
        <div class="mcard__about"><b>About</b><p>${c.bio ? esc(c.bio.split("\n")[0].slice(0, 180)) : "No LinkedIn bio yet."}</p></div>
        ${c.target_summary ? `<div class="mcard__about"><b>Who you target (est.)</b><p>${esc(c.target_summary)}</p></div>` : ""}
      </div>
    </div>`;
  }
  $$("[data-mcard]").forEach((el) => {
    const t = el.dataset.mcard;
    const L = LIVE;
    const nm = L?.name && L.name !== "Your name" ? L.name : "ARANYA BANDHU";
    const cats = L?.industries?.length ? L.industries.join(" · ") : "B2B · AI · Software";
    const head = L?.headline && !/will appear here/.test(L.headline) ? L.headline : "";
    const cost = L?.cost_display || "€240";
    const foll = L?.followers != null ? L.followers_display : "0";
    const impr = L?.est_impressions != null ? L.est_impressions_display : "—";
    const dataW = L?.data_ready ? 100 : 30;
    const map = {
      blank: cardFront({ av: "Y", name: "Your name" }),
      named: cardFront({ av: initials(nm), name: nm, headline: head }),
      perf: cardPerf({ live: L || {} }),
      priced: cardFront({ av: initials(nm), name: nm, cats, headline: head, cost, data: dataW }),
      final: cardFront({ av: initials(nm), name: nm, cats, headline: head, cost, followers: foll, impr, data: dataW, perf: true }),
    };
    el.innerHTML = map[t] || map.blank;
  });

  /* ---- password show/hide ---------------------------------------- */
  $$(".pw__toggle").forEach((btn) => {
    const inp = btn.parentElement.querySelector("input[type=password],input[type=text]");
    if (!inp || btn.closest(".assistant")) return;
    btn.addEventListener("click", () => {
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
    });
  });

  /* ---- topbar: language + account menu ------------------------- */
  $$(".lang button").forEach((b) => b.addEventListener("click", () => $$(".lang button").forEach((x) => x.classList.toggle("is-on", x === b))));
  const menuBtn = $("[data-menu-btn]"), menu = $("[data-menu]");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.toggleAttribute("hidden"); });
    document.addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.setAttribute("hidden", ""); });
    addEventListener("keydown", (e) => e.key === "Escape" && menu.setAttribute("hidden", ""));
  }

  /* ---- radio groups ----------------------------------------- */
  $$("[data-radio-group]").forEach((g) => {
    const items = $$("[data-radio]", g);
    items.forEach((it) => it.addEventListener("click", () => {
      items.forEach((x) => x.classList.toggle("is-on", x === it));
      const r = it.querySelector("input[type=radio]"); if (r) r.checked = true;
      g.dispatchEvent(new CustomEvent("change", { detail: it.dataset.radio }));
    }));
  });

  /* ---- multi-select chips (data-max) ------------------------ */
  $$("[data-chips]").forEach((wrap) => {
    const max = +wrap.dataset.max || 99, tints = ["", "t-purple", "t-green"];
    wrap.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      if (!chip.classList.contains("is-on") && $$(".chip.is-on", wrap).length >= max) return;
      chip.classList.toggle("is-on");
      $$(".chip.is-on", wrap).forEach((c, i) => { c.classList.remove("t-purple", "t-green"); if (tints[i]) c.classList.add(tints[i]); });
      wrap.dispatchEvent(new CustomEvent("chipchange", { detail: $$(".chip.is-on", wrap).map((c) => c.textContent.trim()) }));
    });
  });

  /* ---- card flip ------------------------------------------ */
  $$("[data-flip]").forEach((el) => el.addEventListener("click", () => el.classList.toggle("is-flipped")));

  /* ---- tabs --------------------------------------------- */
  $$("[data-tabs]").forEach((bar) => {
    const tabs = $$(".tab", bar);
    tabs.forEach((t) => t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.toggle("is-on", x === t));
      $$("[data-panel]").forEach((p) => p.toggleAttribute("hidden", p.dataset.panel !== t.dataset.tab));
    }));
  });

  /* ---- guided tour ------------------------------------- */
  const tour = $("[data-tour]");
  if (tour && (location.search.includes("tour=1") || tour.dataset.auto === "1")) {
    tour.hidden = false;
    const steps = JSON.parse(tour.dataset.tour);
    let i = 0;
    const dots = $("[data-dots]", tour); dots.innerHTML = steps.map(() => "<i></i>").join("");
    const render = () => {
      const s = steps[i];
      $("[data-count]", tour).textContent = `STEP ${i + 1} OF ${steps.length}`;
      $("[data-title]", tour).textContent = s.t;
      $("[data-body]", tour).textContent = s.b;
      $$("i", dots).forEach((d, n) => d.classList.toggle("is-on", n === i));
      $("[data-back]", tour).toggleAttribute("hidden", i === 0);
      $("[data-next]", tour).textContent = i === steps.length - 1 ? "Finish" : "Next";
    };
    const close = () => { tour.style.animation = "fadeIn .2s reverse"; setTimeout(() => tour.remove(), 180); };
    $("[data-next]", tour).addEventListener("click", () => { if (i === steps.length - 1) return close(); i++; render(); });
    $("[data-back]", tour).addEventListener("click", () => { if (i) { i--; render(); } });
    $("[data-skip]", tour).addEventListener("click", close);
    render();
  } else if (tour) { tour.remove(); }

  /* ---- scroll reveal + count-up + button light-follow -------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("reveal"); io.unobserve(e.target); } }), { threshold: 0.08 });
  $$(".reveal-scroll").forEach((el) => io.observe(el));
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "K" : "" + n);
  $$("[data-countup]").forEach((el) => {
    const end = +el.dataset.countup, pre = el.dataset.prefix || "";
    if (reduce) return (el.textContent = pre + fmt(end));
    let t0;
    const tick = (t) => { t0 = t0 || t; const p = Math.min(1, (t - t0) / 900); el.textContent = pre + fmt(Math.round(end * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  $$(".btn--primary,.btn--dark").forEach((b) => b.addEventListener("pointermove", (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty("--x", ((e.clientX - r.left) / r.width) * 100 + "%");
    b.style.setProperty("--y", ((e.clientY - r.top) / r.height) * 100 + "%");
  }));

  /* ===== "Connect your accounts" — LinkedIn + X scrape → live card ===== */
  const STORE = "naano.card", TOK = "naano.apifyToken";
  const hereFile = () => location.pathname.split("/").pop() || "overview.html";
  const overlay = h(`<div class="cm-overlay" hidden>
    <div class="cm" role="dialog" aria-modal="true" aria-label="Connect your accounts">
      <button class="cm__x" data-cm-x aria-label="Close">&times;</button>
      <h3>Connect your accounts</h3>
      <p>Naano builds your Marketplace card from your public presence — bio, recent posts, audience and engagement — then evaluates it.</p>
      <label class="field"><span class="field__label">LinkedIn profile URL</span>
        <input id="cm-li" class="input" value="https://www.linkedin.com/in/aranyabandhu/" placeholder="https://www.linkedin.com/in/your-slug/"></label>
      <label class="field"><span class="field__label">X (Twitter) profile URL</span>
        <input id="cm-x" class="input" placeholder="https://x.com/yourhandle"></label>
      <details class="cm__adv"><summary>Advanced — post links &amp; token</summary>
        <label class="field"><span class="field__label">X post links (optional · one per line · up to 5)</span>
          <textarea id="cm-xp" class="input" rows="3" placeholder="https://x.com/yourhandle/status/123…"></textarea></label>
        <label class="field" style="margin-bottom:0"><span class="field__label">Apify token — for a live LinkedIn scrape</span>
          <input id="cm-token" class="input" placeholder="apify_api_…"></label>
        <p class="field__help">No token → LinkedIn uses the cached scrape for <code>/in/aranyabandhu/</code>.</p>
      </details>
      <div class="cm__status" data-cm-status hidden></div>
      <button class="btn btn--primary btn--block" data-cm-go>Analyze &amp; build my card</button>
      <button class="btn btn--ghost btn--block btn--sm" style="margin-top:8px" data-cm-skip>Skip — use demo data</button>
    </div></div>`);
  document.body.appendChild(overlay);
  const cmStatus = $("[data-cm-status]", overlay), cmToken = $("#cm-token", overlay);
  try { cmToken.value = localStorage.getItem(TOK) || ""; } catch {}
  let cmNext = null;
  const cmOpen = (n) => { cmNext = n || hereFile(); overlay.hidden = false; document.body.style.overflow = "hidden"; };
  const cmClose = () => { overlay.hidden = true; document.body.style.overflow = ""; };
  const cmDone = () => { (cmNext && cmNext !== hereFile()) ? (location.href = cmNext) : location.reload(); };
  window.naanoConnect = cmOpen;
  overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target.hasAttribute("data-cm-x")) cmClose(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) cmClose(); });
  $("[data-cm-skip]", overlay).addEventListener("click", () => { try { localStorage.removeItem(STORE); } catch {} cmDone(); });
  $$("[data-connect]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); cmOpen(el.getAttribute("href") || el.dataset.next); }));
  $("[data-cm-go]", overlay).addEventListener("click", async () => {
    const linkedinUrl = $("#cm-li", overlay).value.trim();
    const xUrl = $("#cm-x", overlay).value.trim();
    const xPosts = $("#cm-xp", overlay).value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const apifyToken = cmToken.value.trim();
    if (!linkedinUrl && !xUrl) { cmStatus.hidden = false; cmStatus.className = "cm__status is-err"; cmStatus.textContent = "Add a LinkedIn or X profile link."; return; }
    try { localStorage.setItem(TOK, apifyToken); } catch {}
    const go = $("[data-cm-go]", overlay); go.classList.add("is-disabled");
    cmStatus.hidden = false; cmStatus.className = "cm__status is-run";
    cmStatus.innerHTML = [
      linkedinUrl && `<div class="row"><span class="sp"></span>Scraping LinkedIn — bio &amp; last 5 posts…</div>`,
      xUrl && `<div class="row"><span class="sp"></span>Reading X presence…</div>`,
      `<div class="row"><span class="sp"></span>Evaluating against the card…</div>`,
    ].filter(Boolean).join("");
    try {
      const r = await fetch("/api/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkedinUrl, xUrl, xPosts, apifyToken }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `server ${r.status}`);
      const data = await r.json();
      try { localStorage.setItem(STORE, JSON.stringify(data.card)); } catch {}
      cmStatus.querySelectorAll(".row").forEach((el) => el.classList.add("done"));
      const c = data.card, bits = [];
      if (c.followers != null) bits.push(`${c.followers_display} followers`);
      if (c.presence_score != null) bits.push(`presence ${c.presence_score}/100 (${c.grade})`);
      if (c.cost_per_post) bits.push(c.cost_display + "/post");
      cmStatus.className = "cm__status is-ok";
      cmStatus.innerHTML = `Card ready — ${bits.join(" · ") || "loaded"}. ${(c.notes || []).join(" ")}`;
      setTimeout(cmDone, 1200);
    } catch (err) {
      const offline = /Failed to fetch|NetworkError|server 404|ECONNREFUSED/i.test(String(err));
      cmStatus.hidden = false; cmStatus.className = "cm__status is-err";
      cmStatus.innerHTML = offline
        ? "Card analyzer unavailable — locally run <code>node server/serve.mjs</code>; on Vercel the <code>/api/evaluate</code> function must be deployed. Continuing with demo data…"
        : `Couldn't build the card: ${err.message}. Continuing with demo data…`;
      go.classList.remove("is-disabled");
      setTimeout(cmDone, offline ? 3000 : 2400);
    }
  });

  /* source chip on workspace pages */
  if (page) {
    const chip = h(`<button class="src-chip" type="button"></button>`);
    const paintChip = () => {
      chip.classList.toggle("is-live", !!LIVE);
      chip.innerHTML = LIVE
        ? `<span class="dot"></span>Live card — built from your LinkedIn + X&nbsp; <b>Re-analyze</b>`
        : `<span class="dot"></span>Demo card&nbsp; <b>Connect your accounts</b>`;
    };
    paintChip();
    chip.addEventListener("click", () => window.naanoConnect());
    const head = $(".page__head", page);
    (head || page).insertAdjacentElement(head ? "afterend" : "afterbegin", chip);
  }

  window.__naano = { $, $$ };
})();
