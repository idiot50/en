// History — every answered question, anywhere in the app, logged per day and per Part.
// Storage: localStorage 'toeicets_history_v1'
//   { days: { "YYYY-MM-DD": {
//       parts: { "1": {n, ok}, ..., "7": {n, ok} },   // n = câu đã làm, ok = câu đúng
//       feats: { "drill": {n, ok}, "quick": {...}, "test": {...}, "part2": {...},
//                "dictation": {...}, "mistakes": {...}, "grammar": {...}, "study": {...} },
//       secs: <seconds studied>                        // optional, best-effort
//   } } }
// Kept small on purpose: only counters, never the questions themselves.
window.Hist = (function () {
  const KEY = 'toeicets_history_v1';
  const MAX_DAYS = 400;

  const FEATS = {
    drill:     { icon: '🔁', label: 'Ôn theo Part' },
    quick:     { icon: '⚡', label: 'Kiểm tra nhanh' },
    test:      { icon: '📝', label: 'Bài thi' },
    part2:     { icon: '🎧', label: '100 câu Part 2' },
    dictation: { icon: '✍️', label: 'Chép chính tả' },
    mistakes:  { icon: '🩹', label: 'Sổ lỗi sai' },
    grammar:   { icon: '🎯', label: 'Luyện ngữ pháp' },
    study:     { icon: '🧠', label: 'Học & Ôn' },
    other:     { icon: '📌', label: 'Khác' }
  };

  function todayISO(d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return s && s.days ? s : { days: {} }; }
    catch (e) { return { days: {} }; }
  }
  function save(s) {
    try {
      const keys = Object.keys(s.days).sort();
      while (keys.length > MAX_DAYS) delete s.days[keys.shift()];
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function blank() { return { parts: {}, feats: {}, secs: 0 }; }
  function bump(obj, key, ok) {
    const e = obj[key] || (obj[key] = { n: 0, ok: 0 });
    e.n++; if (ok) e.ok++;
  }

  // ---------- writing ----------
  // Log a single answered question.
  function add(part, ok, feature) {
    if (part == null) return;
    const s = load(), t = todayISO();
    const day = s.days[t] || (s.days[t] = blank());
    bump(day.parts, String(part), !!ok);
    bump(day.feats, FEATS[feature] ? feature : 'other', !!ok);
    save(s);
  }
  // Log many at once (counts n items, ok of them correct) — for dictation words etc.
  function addBulk(part, n, ok, feature) {
    n = Math.max(0, parseInt(n, 10) || 0);
    ok = Math.max(0, Math.min(n, parseInt(ok, 10) || 0));
    if (!n) return;
    const s = load(), t = todayISO();
    const day = s.days[t] || (s.days[t] = blank());
    const p = day.parts[String(part)] || (day.parts[String(part)] = { n: 0, ok: 0 });
    p.n += n; p.ok += ok;
    const f = FEATS[feature] ? feature : 'other';
    const fe = day.feats[f] || (day.feats[f] = { n: 0, ok: 0 });
    fe.n += n; fe.ok += ok;
    save(s);
  }
  // Log a finished quiz from quiz-core's results array. Unanswered questions are ignored.
  function addResults(results, feature) {
    if (!results || !results.length) return;
    const s = load(), t = todayISO();
    const day = s.days[t] || (s.days[t] = blank());
    const f = FEATS[feature] ? feature : 'other';
    let any = false;
    results.forEach(r => {
      if (!r || r.chosen == null) return;          // skip blanks — they were not attempted
      bump(day.parts, String(r.part), !!r.isCorrect);
      bump(day.feats, f, !!r.isCorrect);
      any = true;
    });
    if (any) save(s);
  }
  function addSeconds(sec) {
    sec = parseInt(sec, 10) || 0;
    if (sec <= 0) return;
    const s = load(), t = todayISO();
    const day = s.days[t] || (s.days[t] = blank());
    day.secs = (day.secs || 0) + sec;
    save(s);
  }

  // ---------- reading ----------
  function sumOf(map) {
    let n = 0, ok = 0;
    Object.keys(map || {}).forEach(k => { n += map[k].n || 0; ok += map[k].ok || 0; });
    return { n, ok, wrong: n - ok, pct: n ? Math.round(ok / n * 100) : 0 };
  }
  function day(dateISO) {
    const d = load().days[dateISO];
    if (!d) return { date: dateISO, parts: {}, feats: {}, secs: 0, total: { n: 0, ok: 0, wrong: 0, pct: 0 } };
    return { date: dateISO, parts: d.parts || {}, feats: d.feats || {}, secs: d.secs || 0, total: sumOf(d.parts) };
  }
  function dates() { return Object.keys(load().days).sort().reverse(); }      // newest first
  function days() { return dates().map(day); }
  // Last `n` calendar days including today, oldest → newest (for charts).
  function lastDays(n) {
    const out = [], now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push(day(todayISO(d)));
    }
    return out;
  }
  function totals() {
    const all = days();
    const parts = {}, feats = {};
    let secs = 0;
    all.forEach(d => {
      Object.keys(d.parts).forEach(p => { const e = parts[p] || (parts[p] = { n: 0, ok: 0 }); e.n += d.parts[p].n; e.ok += d.parts[p].ok; });
      Object.keys(d.feats).forEach(f => { const e = feats[f] || (feats[f] = { n: 0, ok: 0 }); e.n += d.feats[f].n; e.ok += d.feats[f].ok; });
      secs += d.secs || 0;
    });
    return { days: all.length, parts, feats, secs, total: sumOf(parts) };
  }
  // Consecutive days with at least one answered question, counting back from today.
  function streak() {
    const s = load(); let k = 0; const now = new Date();
    for (;;) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
      const e = s.days[todayISO(d)];
      if (!e || !sumOf(e.parts).n) break;
      k++;
      if (k > 400) break;
    }
    return k;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function exportAll() { return load(); }

  return { FEATS, todayISO, add, addBulk, addResults, addSeconds, day, days, dates, lastDays, totals, streak, clear, exportAll, sumOf };
})();
