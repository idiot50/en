// Study — spaced-repetition (Leitner) engine + deck loaders for vocab & grammar.
// Depends on globals: CSV. Persists to localStorage (toeicets_srs_v1).
window.Study = (function () {
  const SKEY = 'toeicets_srs_v1';
  // Days until next review per box. Box 0 = new/failed, box >= 3 counts as "known".
  const INTERVALS = [0, 1, 2, 4, 7, 15];
  const KNOWN_BOX = 3;

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- store ----------
  let store;
  try { store = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { store = {}; }
  if (!store.cards) store.cards = {};
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(store)); } catch (e) {} }
  const ck = (deckId, key) => deckId + '|' + key;

  // ---------- fuzzy column access (headers vary + may carry BOM/quotes) ----------
  function col(row, cands) {
    const keys = Object.keys(row);
    for (const c of cands) {
      const k = keys.find(k => k.toLowerCase().indexOf(c.toLowerCase()) !== -1);
      if (k && row[k] != null && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  }

  // ---------- deck parsers → cards: {key, front, back, ipa?, ex?, topic?} ----------
  function parse600(rows) {
    const cards = []; let topic = '';
    rows.forEach(r => {
      const t = col(r, ['topic']); if (t) topic = t;
      const w = col(r, ['từ vựng']);
      const m = col(r, ['nghĩa']);
      if (!w || !m) return;
      cards.push({ key: w, front: w, ipa: col(r, ['phiên âm']), back: m, topic });
    });
    return cards;
  }
  function parsePart(rows) {
    const cards = [];
    rows.forEach(r => {
      const w = col(r, ['từ vựng']);
      const m = col(r, ['ý nghĩa', 'nghĩa']);
      if (!w || !m) return;
      cards.push({ key: w, front: w, back: m, ex: col(r, ['ví dụ']) });
    });
    return cards;
  }
  function parseConj(rows) {
    const cards = [];
    rows.forEach(r => {
      const w = col(r, ['liên từ']);
      const m = col(r, ['dịch nghĩa']);
      if (!w || !m) return;
      cards.push({ key: w, front: w, back: m, ex: col(r, ['cách dùng']) });
    });
    return cards;
  }
  function grammarParser(frontCands, parts) {
    return function (rows) {
      const cards = [];
      rows.forEach(r => {
        const f = col(r, frontCands);
        if (!f) return;
        const back = parts.map(p => {
          const v = col(r, p.cands);
          return v ? (p.label ? p.label + ':\n' + v : v) : '';
        }).filter(Boolean).join('\n\n');
        if (!back) return;
        cards.push({ key: f.slice(0, 80), front: f, back });
      });
      return cards;
    };
  }

  const DECKS = [
    { id: 'v600', name: '⭐ 600 từ cốt lõi (theo chủ đề)', type: 'vocab', batch: 10,
      url: '/data/vocabulary/vocabulary600.csv', parse: parse600 },
    { id: 'p1', name: '🖼 Từ vựng Part 1', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part1.csv', parse: parsePart },
    { id: 'p2', name: '💬 Từ vựng Part 2', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part2.csv', parse: parsePart },
    { id: 'p3', name: '🗣 Từ vựng Part 3', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part3.csv', parse: parsePart },
    { id: 'p4', name: '📢 Từ vựng Part 4', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part4.csv', parse: parsePart },
    { id: 'p5', name: '✏️ Từ vựng Part 5', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part5.csv', parse: parsePart },
    { id: 'p6', name: '📄 Từ vựng Part 6', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part6.csv', parse: parsePart },
    { id: 'p7', name: '📖 Từ vựng Part 7', type: 'vocab', batch: 10, url: '/data/vocabulary/vocabulary-part7.csv', parse: parsePart },
    { id: 'conj', name: '🔗 80 liên từ hay gặp', type: 'vocab', batch: 10, url: '/data/vocabulary/conjunctions.csv', parse: parseConj },
    { id: 'g-tenses', name: '🕐 Các thì động từ', type: 'grammar', batch: 5, url: '/data/grammar/tenses.csv',
      parse: grammarParser(['thì'], [ { cands: ['cấu trúc'], label: '📐 Cấu trúc' }, { cands: ['dấu hiệu'], label: '🔎 Dấu hiệu' }, { cands: ['ví dụ'], label: '✏️ Ví dụ' } ]) },
    { id: 'g-cond', name: '❓ Câu điều kiện', type: 'grammar', batch: 5, url: '/data/grammar/conditional.csv',
      parse: grammarParser(['câu điều kiện'], [ { cands: ['công thức'], label: '📐 Công thức' }, { cands: ['cách dùng'], label: '💡 Cách dùng' }, { cands: ['ví dụ'], label: '✏️ Ví dụ' } ]) },
    { id: 'g-passive', name: '🔄 Câu bị động', type: 'grammar', batch: 5, url: '/data/grammar/passive.csv',
      parse: grammarParser(['thì'], [ { cands: ['chủ động'], label: '▶ Chủ động' }, { cands: ['bị động'], label: '◀ Bị động' }, { cands: ['ví dụ'], label: '✏️ Ví dụ' } ]) },
    { id: 'g-comp', name: '⚖️ So sánh', type: 'grammar', batch: 5, url: '/data/grammar/comparision.csv',
      parse: grammarParser(['dạng so sánh'], [ { cands: ['công thức'], label: '📐 Công thức' }, { cands: ['cách dùng'], label: '💡 Cách dùng' }, { cands: ['ví dụ'], label: '✏️ Ví dụ' } ]) },
    { id: 'g-pron', name: '👤 Đại từ', type: 'grammar', batch: 5, url: '/data/grammar/pronouns.csv',
      parse: grammarParser(['loại đại từ'], [ { cands: ['cách dùng'], label: '💡 Cách dùng' }, { cands: ['đại từ'], label: '📋 Các đại từ' }, { cands: ['ví dụ'], label: '✏️ Ví dụ' } ]) }
  ];

  const _cache = {};
  async function loadDeck(deckId) {
    if (_cache[deckId]) return _cache[deckId];
    const deck = DECKS.find(d => d.id === deckId);
    if (!deck) return [];
    let rows = [];
    try { rows = await CSV.load(deck.url); } catch (e) { rows = []; }
    const cards = deck.parse(rows);
    // De-duplicate keys (some sources repeat entries) so each card gets its own SRS state
    const seen = {};
    cards.forEach(c => {
      if (seen[c.key]) { seen[c.key]++; c.key = c.key + ' #' + seen[c.key]; }
      else seen[c.key] = 1;
    });
    _cache[deckId] = cards;
    return cards;
  }

  // ---------- SRS ----------
  function cardState(deckId, key) { return store.cards[ck(deckId, key)] || null; }
  function grade(deckId, key, firstTryCorrect) {
    const id = ck(deckId, key);
    const cs = store.cards[id] || { box: 0, due: todayISO(), seen: 0, correct: 0 };
    cs.seen++;
    if (firstTryCorrect) { cs.box = Math.min(cs.box + 1, INTERVALS.length - 1); cs.correct++; }
    else cs.box = 1;
    cs.due = addDays(todayISO(), INTERVALS[cs.box]);
    store.cards[id] = cs;
    save();
    return cs;
  }
  function newCards(cards, deckId, limit) {
    return cards.filter(c => !cardState(deckId, c.key)).slice(0, limit);
  }
  function dueCards(cards, deckId) {
    const t = todayISO();
    return cards.filter(c => { const cs = cardState(deckId, c.key); return cs && cs.due <= t; });
  }
  function deckProgress(cards, deckId) {
    let started = 0, known = 0;
    cards.forEach(c => { const cs = cardState(deckId, c.key); if (cs) { started++; if (cs.box >= KNOWN_BOX) known++; } });
    return { total: cards.length, started, known };
  }
  async function allDue() {
    const out = [];
    for (const d of DECKS) {
      const cards = await loadDeck(d.id);
      dueCards(cards, d.id).forEach(c => out.push({ deck: d, card: c }));
    }
    return shuffle(out);
  }

  // ---------- quiz generation ----------
  // Returns {prompt, promptSub, options:[{text,correct}], reverse}
  function mcq(card, deckCards) {
    const reverse = Math.random() < 0.3;   // 30%: meaning → word
    const pool = deckCards.filter(c => c.key !== card.key && c.back !== card.back);
    const ds = shuffle(pool.slice()).slice(0, 3);
    if (reverse) {
      return { prompt: card.back.split('\n')[0], promptSub: 'Chọn từ đúng với nghĩa trên',
        options: shuffle([{ text: card.front, correct: true }].concat(ds.map(d => ({ text: d.front, correct: false })))), reverse };
    }
    return { prompt: card.front, promptSub: card.ipa || 'Chọn nghĩa đúng',
      options: shuffle([{ text: card.back.split('\n')[0], correct: true }].concat(ds.map(d => ({ text: d.back.split('\n')[0], correct: false })))), reverse };
  }

  function resetAll() { store = { cards: {} }; save(); }

  return { DECKS, loadDeck, cardState, grade, newCards, dueCards, deckProgress, allDue, mcq, shuffle, todayISO, KNOWN_BOX, resetAll };
})();
