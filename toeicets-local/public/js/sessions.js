// Sessions — a finished practice run, kept so it can be reopened or redone later.
// Storage: localStorage 'toeicets_sessions_v1'
//   { items: [ { id, at, feature, tag, part, mode, secs, total, correct, wrong, blank,
//                cards: [ { y, n, p, qs: ["147","148"], picks: ["A", null] } ] } ] }
//
// Only the identity of each question is stored — set, test, part, question number — plus
// the letter that was picked. The CSVs are reloaded when a run is reopened, so a session
// costs about a kilobyte instead of the ~100 KB a full snapshot of texts, options and
// explanations would take, and a redo serves exactly the same questions in the same order.
//
// The list UI lives here too, so every page that saves runs shows the same panel: a range
// filter like the one on the history page, then one row per run.
window.Sessions = (function () {
  const KEY = 'toeicets_sessions_v1';
  const MAX_ITEMS = 60;
  const DAY = 86400000;
  const RANGES = [{ d: 7, t: '7 ngày' }, { d: 14, t: '14 ngày' }, { d: 30, t: '30 ngày' }, { d: 0, t: 'Tất cả' }];

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return s && Array.isArray(s.items) ? s : { items: [] };
    } catch (e) { return { items: [] }; }
  }
  function save(s) {
    try {
      s.items.sort((a, b) => b.at - a.at);
      if (s.items.length > MAX_ITEMS) s.items.length = MAX_ITEMS;
      localStorage.setItem(KEY, JSON.stringify(s));
      return true;
    } catch (e) { return false; }   // quota: a lost session must never break the results screen
  }

  // Questions sharing a clip or a passage carry the same gid, which is also the order they
  // were served in — so consecutive results with one gid rebuild one card.
  function cardsFromResults(results) {
    const out = [];
    let cur = null;
    for (const r of results || []) {
      if (!r || !r.year || r.qNum == null) continue;
      if (!cur || cur.gid !== r.gid) {
        cur = { gid: r.gid, y: r.year, n: String(r.n), p: r.part, qs: [], picks: [] };
        out.push(cur);
      }
      cur.qs.push(String(r.qNum));
      cur.picks.push(r.chosen || null);
    }
    return out.map(c => ({ y: c.y, n: c.n, p: c.p, qs: c.qs, picks: c.picks }));
  }

  function add(entry) {
    const results = (entry.results || []).filter(r => !r.skipped);
    if (!results.length) return null;
    const cards = cardsFromResults(results);
    if (!cards.length) return null;
    const correct = results.filter(r => r.isCorrect).length;
    const blank = results.filter(r => r.chosen == null).length;
    const rec = {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      feature: entry.feature || 'drill',
      tag: entry.tag || '',              // what the row shows: "Part 5", "🎧 Listening"…
      part: entry.part != null ? entry.part : null,
      mode: entry.mode || null,
      secs: Math.max(0, parseInt(entry.secs, 10) || 0),
      total: results.length,
      correct,
      blank,
      wrong: results.length - correct - blank,
      cards
    };
    const s = load();
    s.items.push(rec);
    return save(s) ? rec.id : null;
  }

  function list(feature, max) {
    const items = load().items.filter(it => !feature || it.feature === feature);
    items.sort((a, b) => b.at - a.at);
    return max ? items.slice(0, max) : items;
  }
  function get(id) { return load().items.find(it => it.id === id) || null; }
  function remove(id) {
    const s = load();
    const i = s.items.findIndex(it => it.id === id);
    if (i < 0) return false;
    s.items.splice(i, 1);
    save(s);
    return true;
  }
  function clear(feature) {
    const s = load();
    s.items = feature ? s.items.filter(it => it.feature !== feature) : [];
    save(s);
  }

  // ---------- display helpers ----------
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const p2 = n => String(n).padStart(2, '0');
  function when(at) {
    const d = new Date(at), now = new Date();
    const time = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return `Hôm nay ${time}`;
    if (new Date(now.getTime() - DAY).toDateString() === d.toDateString()) return `Hôm qua ${time}`;
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
  }
  function duration(secs) {
    if (!secs) return '';
    const m = Math.floor(secs / 60), s = secs % 60;
    return m ? `${m} phút${s ? ' ' + s + ' giây' : ''}` : `${s} giây`;
  }

  // ---------- range filter, remembered per feature like the history page does ----------
  const rangeKey = feature => 'toeicets_sessions_range_' + (feature || 'all');
  function range(feature) {
    const v = parseInt(localStorage.getItem(rangeKey(feature)), 10);
    return RANGES.some(r => r.d === v) ? v : 7;
  }
  function setRange(feature, d) {
    try { localStorage.setItem(rangeKey(feature), String(d)); } catch (e) {}
  }
  function inRange(items, days) {
    if (!days) return items;
    const from = Date.now() - days * DAY;
    return items.filter(s => s.at >= from);
  }

  // ---------- the panel both pages render ----------
  function ensureStyle() {
    if (document.getElementById('sess-style')) return;
    const st = document.createElement('style');
    st.id = 'sess-style';
    st.textContent =
      '.sess-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;}' +
      '.sess-tab{border:2px solid var(--border);background:white;border-radius:12px;padding:7px 14px;font-weight:800;cursor:pointer;font-size:13px;font-family:inherit;color:var(--text-soft);}' +
      '.sess-tab.active{border-color:var(--green);background:#f3fff0;color:var(--green-dark);}' +
      '.sess{border:2px solid var(--border);border-radius:14px;padding:12px 14px;margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:white;}' +
      '.sess .when{font-weight:800;font-size:13.5px;min-width:132px;}' +
      '.sess .tag{font-weight:900;color:var(--blue-dark,#1899d6);background:#eaf6ff;border-radius:8px;padding:3px 9px;font-size:13px;white-space:nowrap;}' +
      '.sess .n{color:var(--text-mute);font-size:13px;white-space:nowrap;}' +
      '.sess .score{font-weight:800;font-size:13.5px;white-space:nowrap;}' +
      '.sess .score .ok{color:var(--green-dark);}.sess .score .no{color:var(--red);}.sess .score .bl{color:var(--text-mute);}' +
      '.sess .bar{flex:1;min-width:60px;height:8px;border-radius:6px;background:#eef2f4;overflow:hidden;}' +
      '.sess .bar i{display:block;height:100%;background:var(--green);}' +
      '.sess .acts{display:flex;gap:6px;margin-left:auto;}' +
      '.sess .del{border:none;background:none;cursor:pointer;color:var(--text-mute);font-size:18px;line-height:1;padding:4px 6px;border-radius:8px;}' +
      '.sess .del:hover{background:#ffe9e9;color:var(--red);}' +
      '@media(max-width:620px){.sess .bar{display:none;}.sess .acts{margin-left:0;width:100%;}}';
    document.head.appendChild(st);
  }

  // opts: { empty } — the line shown when this feature has never been used.
  function panel(feature, opts) {
    ensureStyle();
    const o = opts || {};
    const all = list(feature);
    const days = range(feature);
    const runs = inRange(all, days);
    const tabs = RANGES.map(r =>
      `<button class="sess-tab ${r.d === days ? 'active' : ''}" data-range="${r.d}">${r.t}</button>`).join('');

    const rows = runs.map(s => {
      const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
      const dur = duration(s.secs);
      const tag = s.tag || (s.part != null ? 'Part ' + s.part : (s.mode || '—'));
      return `<div class="sess">
          <div class="when">${esc(when(s.at))}${dur ? `<div style="font-weight:600;font-size:11.5px;color:var(--text-mute);">${esc(dur)}</div>` : ''}</div>
          <div class="tag">${esc(tag)}</div>
          <div class="n">${s.total} câu</div>
          <div class="score"><span class="ok">✅ ${s.correct}</span> · <span class="no">❌ ${s.wrong}</span>${s.blank ? ` · <span class="bl">⬜ ${s.blank}</span>` : ''} · ${pct}%</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="acts">
            <button class="btn ghost small" data-act="view" data-id="${s.id}">📖 Xem lại</button>
            <button class="btn blue small" data-act="redo" data-id="${s.id}">↻ Làm lại</button>
            <button class="del" data-act="del" data-id="${s.id}" title="Xoá bài này">×</button>
          </div>
        </div>`;
    }).join('');

    const body = all.length
      ? (runs.length ? rows
        : `<p style="color:var(--text-mute);margin:10px 0 0;font-size:14px;">Không có bài nào trong ${days} ngày qua — còn ${all.length} bài cũ hơn, chọn <b>Tất cả</b> để xem.</p>`)
      : `<p style="color:var(--text-mute);margin:10px 0 0;font-size:14px;">${esc(o.empty || 'Chưa có bài nào. Làm xong một lượt là nó tự lưu lại ở đây — xem lại từng câu đúng/sai hoặc làm lại đúng bộ câu đó bất cứ lúc nào.')}</p>`;

    return `<div class="card" style="padding:18px;margin-top:16px;">
        <h3 class="section-title" style="margin-top:0;">🗂 Bài đã làm <span style="font-weight:700;font-size:12.5px;color:var(--text-mute);">— lưu trên máy này${all.length ? ` · ${runs.length}/${all.length} lượt` : ''}</span></h3>
        <div class="sess-tabs">${tabs}</div>
        ${body}
      </div>`;
  }

  // handlers: { open(id, redo), refresh() } — refresh re-renders the page that owns the panel.
  function bind(root, feature, handlers) {
    const h = handlers || {};
    root.querySelectorAll('.sess-tab[data-range]').forEach(b => b.addEventListener('click', () => {
      setRange(feature, parseInt(b.dataset.range, 10));
      if (h.refresh) h.refresh();
    }));
    root.querySelectorAll('.sess [data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'del') {
        if (!confirm('Xoá bài đã làm này khỏi danh sách?')) return;
        remove(id);
        if (h.refresh) h.refresh();
        return;
      }
      if (h.open) h.open(id, b.dataset.act === 'redo');
    }));
  }

  return { add, list, get, remove, clear, when, duration, cardsFromResults,
           range, setRange, panel, bind, RANGES };
})();
