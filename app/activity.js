// Real platform activity feed — GET /api/activity, backed by MongoDB
// (api/_lib/mongo.mjs). Renders into any element with id="activity-feed".
(async () => {
  const el = document.getElementById("activity-feed");
  if (!el) return;
  try {
    const res = await fetch("/api/activity?limit=8");
    const data = await res.json();
    if (!data.mongo) {
      el.innerHTML = `<div class="table__empty">Activity feed not configured (MONGODB_URI not set).</div>`;
      return;
    }
    if (!data.activity?.length) {
      el.innerHTML = `<div class="table__empty">No activity yet — it'll show up here in real time.</div>`;
      return;
    }
    const timeAgo = (iso) => {
      const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
      if (s < 60) return `${s}s ago`;
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      return `${Math.floor(s / 86400)}d ago`;
    };
    el.innerHTML = data.activity
      .map(
        (a) =>
          `<div class="stat-list__row" style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line,#eee)">
             <span>${a.summary}</span>
             <span style="color:var(--faint,#9aa);white-space:nowrap;font-size:12px">${timeAgo(a.createdAt)}</span>
           </div>`
      )
      .join("");
  } catch {
    el.innerHTML = `<div class="table__empty">Couldn't load activity right now.</div>`;
  }
})();
