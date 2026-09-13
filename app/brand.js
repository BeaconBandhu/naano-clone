/* Naano brand-agency app shell — sibling to app.js's creator-workspace shell.
 * Kept as a separate file (rather than extending app.js's NAV/rail) because
 * cmp:AppShell is flagged high-blast-radius in agents.md: every CRW-* creator
 * screen depends on app.js's shell exactly as-is. Brand pages use
 * <main data-brand-page="..."> instead of <main data-page="...">, so app.js's
 * own shell-builder simply finds nothing and skips — but its generic wiring
 * further down (lang toggle, account menu, reveal-on-scroll, chips, etc.)
 * still runs against the DOM this file builds, since the class names match.
 * Load this BEFORE app.js: <script src="brand.js"></script><script src="app.js"></script>
 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const svg = (p, w = 19) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  const MARK = '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M3 20 15 5l3 7-10 12z" fill="#101116"/><path d="M14 22 24 9l5 13z" fill="#101116"/><circle cx="12" cy="23" r="2.4" fill="#2d61f5"/></svg>';
  const I = {
    dashboard: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    marketplace: '<path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5zM3 9l2-5h14l2 5M9 13h6"/>',
    campaigns: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
    creators: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M21 20a6 6 0 0 0-4-5.7"/>',
    analytics: '<path d="M4 19V5M4 19h16M8 15l3-4 3 3 4-6"/>',
    messages: '<path d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12z"/>',
    billing: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  };
  const NAV = [
    ["brand-overview.html", "Dashboard", I.dashboard],
    ["marketplace.html", "Marketplace", I.marketplace],
    ["#", "Campaigns", I.campaigns],
    ["#", "Creators", I.creators],
    ["#", "Analytics", I.analytics],
    ["#", "Messages", I.messages],
    ["#", "Billing", I.billing],
  ];

  const page = $("main[data-brand-page]");
  if (!page) return;
  const here = location.pathname.split("/").pop();

  const rail = h(`<nav class="rail">
    <div class="rail__logo">${MARK}<span>naano</span></div>
    ${NAV.map(([href, label, ic]) => `<a href="${href}" class="${href !== "#" && href === here ? "is-on" : ""}">${svg(ic)}<span>${label}</span></a>`).join("")}
  </nav>`);

  const topbar = h(`<header class="topbar" style="justify-content:space-between">
    <span class="topbar__pill" style="font-weight:700;background:#fff;border:1px solid var(--line)">
      ${svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>', 14)}
      <span data-workspace-name>${page.dataset.workspace || "Your agency"}</span>
      <a href="#" style="color:var(--blue);font-weight:700;margin-left:6px;text-decoration:none">Connect →</a>
    </span>
    <span style="display:flex;align-items:center;gap:10px">
      <span class="topbar__pill">${svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>', 14)}€0.00</span>
      <span class="lang"><button class="is-on">EN</button><button>FR</button></span>
      <a class="pill pill--info" href="marketplace.html" style="text-decoration:none;white-space:nowrap">${svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 12)}Discover the Marketplace · 1/3</a>
      <button class="icon-btn" aria-label="Notifications">${svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>', 16)}</button>
      <button class="avatar-btn" data-menu-btn aria-label="Account">${(page.dataset.avatar || "A")}</button>
      <div class="menu" data-menu hidden>
        <a href="#">${svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>', 15)}Integrations</a>
        <a href="#">${svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L13.5 2h-3l-.4 2.8a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.4 2.8h3l.4-2.8a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6c.1-.5.1-.9.1-1.4z"/>', 15)}Settings</a>
        <hr>
        <a href="../pages/agencies.html">${svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', 15)}Sign out</a>
      </div>
    </span>
  </header>`);

  const shell = h('<div class="shell"></div>');
  const main = h('<div class="main"></div>');
  page.replaceWith(shell);
  shell.append(rail, main);
  main.append(topbar, page);
  main.append(h(`<div class="assistant">${svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 16)}<input placeholder="What can I help you find?" aria-label="Ask NaanoBot"><button class="pw__toggle" aria-label="Voice">${svg('<path d="M12 4v16M8 8v8M4 11v2M16 7v10M20 10v4"/>', 16)}</button></div>`));
  document.body.append(h('<button class="feedback" aria-label="Feedback">✷</button>'));
})();
