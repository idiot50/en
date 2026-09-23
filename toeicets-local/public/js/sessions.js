// Sessions — a finished practice run, kept so it can be reopened or redone later.
// Storage: localStorage 'toeicets_sessions_v1'
//   { items: [ { id, at, feature, part, secs, total, correct, wrong, blank,
//                cards: [ { y, n, p, qs: ["147","148"], picks: ["A", null] } ] } ] }
//
// Only the identity of each question is stored — set, test, part, question number — plus
// the letter that was picked. The CSVs are reloaded when a run is reopened, so a session
// costs about a kilobyte instead of the ~100 KB a full snapshot of texts, options and
// explanations would take, and a redo serves exactly the same questions in the same order.
window.Sessions = (function () {
  const KEY = 'toeicets_sessions_v1';
  const MAX_ITEMS = 60;

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
      part: entry.part != null ? entry.part : null,
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
  const p2 = n => String(n).padStart(2, '0');
  function when(at) {
    const d = new Date(at), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    const time = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    if (sameDay) return `Hôm nay ${time}`;
    if (yest) return `Hôm qua ${time}`;
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
  }
  function duration(secs) {
    if (!secs) return '';
    const m = Math.floor(secs / 60), s = secs % 60;
    return m ? `${m} phút${s ? ' ' + s + ' giây' : ''}` : `${s} giây`;
  }

  return { add, list, get, remove, clear, when, duration, cardsFromResults };
})();
