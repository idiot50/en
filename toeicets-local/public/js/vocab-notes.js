// VocabNotes — personal vocabulary notebook (word · part of speech · VN meaning · pronunciation)
// + select-a-word capture bubble + 3-tier auto-fill:
//   1) the app's own vocab CSVs (offline, ~1,300 entries)
//   2) dictionaryapi.dev  -> part of speech + IPA
//   3) Google translate (gtx) -> Vietnamese meaning (MyMemory as fallback)
window.VocabNotes = (function () {
  const KEY = 'toeicets_vocab_notes_v1';

  // ---------- store ----------
  function list() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function saveAll(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function add(n) {
    const w = (n.w || '').trim();
    if (!w) return list().length;
    const a = list();
    a.unshift({
      w, type: (n.type || '').trim(), mean: (n.mean || '').trim(),
      ipa: (n.ipa || '').trim(), src: (n.src || '').trim(),
      at: new Date().toISOString().slice(0, 10)
    });
    saveAll(a);
    return a.length;
  }
  function remove(idx) { const a = list(); a.splice(idx, 1); saveAll(a); return a.length; }
  function count() { return list().length; }

  // ---------- shared styles ----------
  function injectStyles() {
    if (document.getElementById('vn-css')) return;
    const st = document.createElement('style');
    st.id = 'vn-css';
    st.textContent = `
      .vn-overlay{position:fixed;inset:0;background:rgba(20,30,40,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}
      .vn-modal{background:white;border-radius:16px;padding:20px;width:100%;max-width:420px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:inherit}
      .vn-modal h3{margin:0 0 12px;font-size:18px}
      .vn-field{margin-bottom:10px}
      .vn-field label{display:block;font-weight:700;font-size:12.5px;margin-bottom:3px;color:#777}
      .vn-field input,.vn-field select{width:100%;padding:10px 12px;border:2px solid #E5E5E5;border-radius:10px;font-family:inherit;font-size:14.5px;box-sizing:border-box}
      .vn-wrow{display:flex;gap:8px}
      .vn-wrow input{flex:1}
      .vn-lookup{flex:none;border:2px solid #E5E5E5;background:#F7F7F7;border-radius:10px;padding:0 12px;font-weight:800;cursor:pointer;font-size:13px;font-family:inherit}
      .vn-lookup:hover{border-color:#1CB0F6;color:#1899D6}
      .vn-status{font-size:12px;font-weight:700;margin-top:4px;min-height:16px;color:#777}
      .vn-status.ok{color:#58A700}
      .vn-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
      .vn-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#58CC02;color:white;font-weight:800;padding:10px 18px;border-radius:12px;z-index:70;box-shadow:0 4px 14px rgba(0,0,0,.2);font-family:inherit}
      .vn-pop{position:fixed;z-index:65;background:white;border:2px solid #E5E5E5;border-radius:14px;padding:12px 14px;max-width:300px;min-width:200px;box-shadow:0 8px 28px rgba(0,0,0,.22);font-family:inherit;font-size:14px}
      .vn-pop-w{font-weight:900;font-size:16px;color:#3C3C3C;word-break:break-word}
      .vn-pop-ipa{font-weight:600;font-size:13px;color:#1899D6;margin-left:6px}
      .vn-pop-type{display:inline-block;font-size:11.5px;font-weight:800;color:#1899D6;background:#eaf6ff;border-radius:8px;padding:2px 8px;margin:4px 0}
      .vn-pop-mean{font-size:14px;color:#555;margin-top:3px;line-height:1.5;word-break:break-word}
      .vn-pop-mean.vn-dim{color:#AFAFAF;font-weight:700}
      .vn-pop-row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
      .vn-pop-badge{font-size:12px;font-weight:800;color:#58A700;background:#f0ffe6;border-radius:8px;padding:4px 9px}
      .vn-pop-link{font-size:12.5px;font-weight:800;color:#1899D6;text-decoration:underline;cursor:pointer}
      .vn-pop-save{border:none;background:#58CC02;color:white;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px;box-shadow:0 2px 0 #58A700}
      .vn-pop-save:hover{filter:brightness(1.06)}
      .vn-pop-edit{border:2px solid #E5E5E5;background:#F7F7F7;border-radius:10px;padding:7px 11px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px}
      .vn-pop-edit:hover{border-color:#1CB0F6;color:#1899D6}
      .vn-tts{border:2px solid #E5E5E5;background:white;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:14px;font-family:inherit;line-height:1}
      .vn-tts:hover{border-color:#1CB0F6}
      .vn-pop-sent{font-size:13.5px;font-weight:700;font-style:italic;color:#555;word-break:break-word}`;
    document.head.appendChild(st);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'vn-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------- pronunciation via the browser's built-in speech synthesis ----------
  function speak(text) {
    try {
      if (!('speechSynthesis' in window) || !text) return false;
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'en-US';
      u.rate = 0.92;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // ---------- tier 1: dictionary from the app's own vocab CSVs ----------
  const TYPE_VI = { n: '(n) danh từ', v: '(v) động từ', adj: '(adj) tính từ', adv: '(adv) trạng từ', prep: '(prep) giới từ', conj: '(conj) liên từ', phr: '(phr) cụm từ' };
  const POS_EN_VI = { noun: '(n) danh từ', verb: '(v) động từ', adjective: '(adj) tính từ', adverb: '(adv) trạng từ', preposition: '(prep) giới từ', conjunction: '(conj) liên từ', pronoun: '(pron) đại từ', interjection: '(intj) thán từ', exclamation: '(intj) thán từ', determiner: '(det) hạn định từ' };
  let _dict = null, _dictBuilding = null;
  function colOf(row, cands) {
    const keys = Object.keys(row);
    for (const c of cands) {
      const k = keys.find(k => k.toLowerCase().indexOf(c) !== -1);
      if (k && row[k] && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  }
  function dictPut(word, mean, ipa, type) {
    if (!word || !mean) return;
    let w = word, t = type || '';
    const m = word.match(/^(.*?)\s*\(([^)]{1,12})\)\s*$/);
    if (m) {
      w = m[1].trim();
      const raw = m[2].trim().toLowerCase();
      t = t || TYPE_VI[raw] || ('(' + m[2].trim() + ')');
    }
    const k = w.toLowerCase();
    if (!_dict[k]) _dict[k] = { mean: mean.split('\n')[0], ipa: ipa || '', type: t };
  }
  async function buildDict() {
    if (_dict) return _dict;
    if (_dictBuilding) return _dictBuilding;
    _dictBuilding = (async () => {
      _dict = {};
      if (!window.CSV) return _dict;
      const files = ['vocabulary600.csv', 'vocabulary-part1.csv', 'vocabulary-part2.csv', 'vocabulary-part3.csv',
        'vocabulary-part4.csv', 'vocabulary-part5.csv', 'vocabulary-part6.csv', 'vocabulary-part7.csv', 'conjunctions.csv'];
      for (const f of files) {
        try {
          const rows = await CSV.load('/data/vocabulary/' + f);
          rows.forEach(r => {
            const w = colOf(r, ['từ vựng', 'liên từ']);
            const mean = colOf(r, ['ý nghĩa', 'nghĩa', 'dịch nghĩa']);
            dictPut(w, mean, colOf(r, ['phiên âm']), '');
          });
        } catch (e) {}
      }
      return _dict;
    })();
    return _dictBuilding;
  }
  async function lookup(text) {
    const d = await buildDict();
    const norm = String(text || '').toLowerCase().trim().replace(/[^a-zà-ỹ' -]/gi, '');
    if (!norm) return null;
    const cands = [norm,
      norm.replace(/ies$/, 'y'), norm.replace(/es$/, ''), norm.replace(/s$/, ''),
      norm.replace(/ied$/, 'y'), norm.replace(/ed$/, ''), norm.replace(/ed$/, 'e'),
      norm.replace(/ing$/, ''), norm.replace(/ing$/, 'e')];
    for (const c of cands) if (c && d[c]) return c === norm ? d[c] : Object.assign({ base: c }, d[c]);
    return null;
  }

  // ---------- tiers 2+3: online dictionary + machine translation ----------
  function fetchJson(url, ms) {
    return new Promise((resolve, reject) => {
      const ctl = ('AbortController' in window) ? new AbortController() : null;
      const to = setTimeout(() => { if (ctl) ctl.abort(); reject(new Error('timeout')); }, ms || 5000);
      fetch(url, ctl ? { signal: ctl.signal } : {})
        .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(j => { clearTimeout(to); resolve(j); })
        .catch(e => { clearTimeout(to); reject(e); });
    });
  }
  // Vietnamese translation for a word OR a whole sentence (gtx joins all segments; MyMemory fallback)
  async function translateVi(text, ms) {
    const w = String(text || '').trim();
    if (!w) return '';
    try {
      const j = await fetchJson('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(w), ms || 6000);
      const segs = (j && j[0] || []).map(s => s && s[0]).filter(Boolean);
      const t = segs.join('').trim();
      if (t && t.toLowerCase() !== w.toLowerCase()) return t;
    } catch (e) {}
    try {
      const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(w) + '&langpair=en%7Cvi', ms || 6000);
      const t = j && j.responseData && j.responseData.translatedText;
      if (t && t.toLowerCase() !== w.toLowerCase()) return t;
    } catch (e) {}
    return '';
  }
  async function onlineLookup(word) {
    const w = String(word || '').trim();
    if (!w) return null;
    const out = { mean: '', ipa: '', type: '' };
    const jobs = [
      // part of speech + IPA (English dictionary, CORS *)
      fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w.toLowerCase()), 5000).then(j => {
        const e = Array.isArray(j) && j[0];
        if (!e) return;
        out.ipa = e.phonetic || ((e.phonetics || []).map(p => p.text).filter(Boolean)[0] || '');
        const pos = ((e.meanings || [])[0] || {}).partOfSpeech || '';
        out.type = POS_EN_VI[pos] || '';
      }).catch(() => {}),
      translateVi(w, 5000).then(t => { out.mean = t; })
    ];
    await Promise.all(jobs);
    return (out.mean || out.ipa || out.type) ? out : null;
  }

  // ---------- note modal (opens instantly; fields auto-fill as lookups resolve) ----------
  function openModal(prefill) {
    injectStyles();
    prefill = prefill || {};
    const old = document.getElementById('vn-ov');
    if (old) old.remove();
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const baseTypes = Object.values(TYPE_VI).concat(['(pron) đại từ', '(intj) thán từ', '(det) hạn định từ']);
    const typeOpts = ['<option value="">— chọn —</option>']
      .concat(baseTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`)).join('');
    const ov = document.createElement('div');
    ov.className = 'vn-overlay'; ov.id = 'vn-ov';
    ov.innerHTML = `
      <div class="vn-modal">
        <h3>📒 Ghi từ vào sổ tay</h3>
        <div class="vn-field"><label>Từ vựng *</label>
          <div class="vn-wrow">
            <input id="vn-w" type="text" value="${esc(prefill.w || '')}" placeholder="vd: negotiate" autocomplete="off"/>
            <button class="vn-lookup" id="vn-btn-lookup" title="Tự tra loại từ, nghĩa, cách đọc">🔍 Tự tra</button>
          </div>
          <div class="vn-status" id="vn-status"></div>
        </div>
        <div class="vn-field"><label>Loại từ</label><select id="vn-t">${typeOpts}</select></div>
        <div class="vn-field"><label>Nghĩa tiếng Việt *</label><input id="vn-m" type="text" value="${esc(prefill.mean || '')}" placeholder="vd: đàm phán, thương lượng"/></div>
        <div class="vn-field"><label>Cách đọc</label><input id="vn-i" type="text" value="${esc(prefill.ipa || '')}" placeholder="vd: /nɪˈɡoʊʃieɪt/"/></div>
        <div class="vn-actions">
          <button class="btn ghost small" id="vn-cancel" style="border:2px solid #E5E5E5;background:#F7F7F7;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer;">Đóng</button>
          <button class="btn small" id="vn-save" style="border:none;background:#58CC02;color:white;border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 #58A700;">💾 Lưu từ</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const $ = id => ov.querySelector(id);
    const setStatus = (msg, ok) => { const s = $('#vn-status'); if (s) { s.textContent = msg || ''; s.className = 'vn-status' + (ok ? ' ok' : ''); } };
    const setType = t => {
      if (!t) return;
      const sel = $('#vn-t');
      if (!Array.prototype.some.call(sel.options, o => o.value === t)) {
        const o = document.createElement('option'); o.value = t; o.textContent = t; sel.insertBefore(o, sel.options[1] || null);
      }
      if (!sel.value) sel.value = t;
    };
    if (prefill.type) { setType(prefill.type); $('#vn-t').value = prefill.type; }
    // fill only fields the user hasn't typed in
    function fillFields(res, label) {
      if (!ov.isConnected || !res) return false;
      let filled = false;
      if (res.mean && !$('#vn-m').value.trim()) { $('#vn-m').value = res.mean; filled = true; }
      if (res.ipa && !$('#vn-i').value.trim()) { $('#vn-i').value = res.ipa; filled = true; }
      if (res.type && !$('#vn-t').value) { setType(res.type); filled = true; }
      if (filled && label) setStatus(label, true);
      return filled;
    }
    async function autoFill(word) {
      if (!word) return;
      setStatus('🔍 Đang tự tra “' + word + '”…');
      let any = false;
      try { any = fillFields(await lookup(word), '✓ Tự điền từ kho từ vựng — kiểm tra rồi lưu') || any; } catch (e) {}
      const needMore = !$('#vn-m').value.trim() || !$('#vn-i').value.trim() || !$('#vn-t').value;
      if (needMore) {
        try { any = fillFields(await onlineLookup(word), '✓ Đã tự tra online — kiểm tra rồi lưu') || any; } catch (e) {}
      }
      if (ov.isConnected && !any) setStatus('Không tra được từ này — điền thủ công giúp nhé.');
    }
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    $('#vn-cancel').addEventListener('click', () => ov.remove());
    $('#vn-btn-lookup').addEventListener('click', () => autoFill($('#vn-w').value.trim()));
    $('#vn-w').addEventListener('keydown', e => { if (e.key === 'Enter') autoFill($('#vn-w').value.trim()); });
    ($('#vn-w').value ? $('#vn-m') : $('#vn-w')).focus();
    $('#vn-save').addEventListener('click', () => {
      const w = $('#vn-w').value.trim(), mean = $('#vn-m').value.trim();
      if (!w || !mean) { alert('Cần nhập ít nhất Từ vựng và Nghĩa.'); return; }
      const n = add({ w, type: $('#vn-t').value, mean, ipa: $('#vn-i').value, src: prefill.src || '' });
      ov.remove();
      toast(`✓ Đã lưu "${w}" — sổ tay có ${n} từ`);
    });
    if (prefill.lookup && prefill.w) autoFill(prefill.w);
    return ov;
  }

  // ---------- selection capture: highlight -> instant dictionary popup ----------
  let _capOn = false, _reqId = 0;
  function currentSrc() {
    const qn = document.querySelector('.q-num');
    if (qn) return qn.textContent.trim();
    return location.pathname.replace('/', '') || 'trang chủ';
  }
  // tier 0: the user's own notebook
  function findNote(word) {
    const k = String(word || '').toLowerCase().trim();
    if (!k) return null;
    return list().find(n => (n.w || '').toLowerCase().trim() === k) || null;
  }
  function enableCapture() {
    if (_capOn) return;
    _capOn = true;
    injectStyles();
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let pop = null, lastRect = null;
    function hide() { if (pop) { pop.remove(); pop = null; } }
    function position() {
      if (!pop || !lastRect) return;
      const pw = pop.offsetWidth || 260, ph = pop.offsetHeight || 110;
      let left = Math.max(8, Math.min(lastRect.left, window.innerWidth - pw - 8));
      let top = lastRect.top - ph - 10;
      if (top < 8) top = lastRect.bottom + 10;
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }
    function headHtml(word, ipa, type) {
      return `<div class="vn-pop-w">${esc(word)}${ipa ? `<span class="vn-pop-ipa">${esc(ipa)}</span>` : ''}</div>
        ${type ? `<span class="vn-pop-type">${esc(type)}</span>` : ''}`;
    }
    function renderResult(word, res, src, isSentence) {
      if (!pop || !pop.isConnected) return;
      const hasMean = res && res.mean;
      const saveLabel = hasMean ? (isSentence ? '➕ Ghi câu vào sổ' : '➕ Ghi vào sổ') : '📒 Ghi thủ công';
      const head = isSentence
        ? `<div class="vn-pop-sent">“${esc(word)}”</div><span class="vn-pop-type">🗨 câu</span>`
        : headHtml(word, res && res.ipa, res && res.type);
      pop.innerHTML = head + `
        <div class="vn-pop-mean${hasMean ? '' : ' vn-dim'}">${hasMean ? esc(res.mean) : (isSentence ? 'Không dịch được câu này' : 'Không tra được nghĩa từ này')}</div>
        <div class="vn-pop-row">
          <button class="vn-tts" id="vn-pop-tts" title="Phát âm">🔊</button>
          <button class="vn-pop-save" id="vn-pop-save">${saveLabel}</button>
          ${hasMean ? '<button class="vn-pop-edit" id="vn-pop-edit" title="Sửa trước khi lưu">✏️ Sửa</button>' : ''}
        </div>`;
      position();
      pop.querySelector('#vn-pop-tts').addEventListener('click', () => speak(word));
      const saveBtn = pop.querySelector('#vn-pop-save');
      saveBtn.addEventListener('click', () => {
        if (hasMean) {
          const type = isSentence ? '(câu)' : (res.type || '');
          const n = add({ w: word, type, mean: res.mean, ipa: isSentence ? '' : (res.ipa || ''), src });
          pop.innerHTML = head + `
            <div class="vn-pop-mean">${esc(res.mean)}</div>
            <div class="vn-pop-row"><span class="vn-pop-badge">✓ Đã lưu — sổ có ${n} mục</span><a class="vn-pop-link" href="/notes">Mở sổ</a></div>`;
          position();
          setTimeout(hide, 2200);
        } else {
          const w = word, s = src;
          hide();
          openModal({ w, src: s, lookup: !isSentence, type: isSentence ? '(câu)' : '' });
        }
      });
      const editBtn = pop.querySelector('#vn-pop-edit');
      if (editBtn) editBtn.addEventListener('click', () => {
        const pre = { w: word, mean: res.mean, ipa: isSentence ? '' : (res.ipa || ''), type: isSentence ? '(câu)' : (res.type || ''), src };
        hide();
        openModal(pre);
      });
    }
    async function show(word) {
      const myId = ++_reqId;
      hide();
      pop = document.createElement('div');
      pop.className = 'vn-pop';
      const src = currentSrc();
      const isSentence = word.split(/\s+/).length > 3 || word.length > 40;
      // Tier 0: already in the notebook -> show the saved entry, no save button
      const note = findNote(word);
      if (note) {
        const head = note.type === '(câu)'
          ? `<div class="vn-pop-sent">“${esc(note.w)}”</div><span class="vn-pop-type">🗨 câu</span>`
          : headHtml(note.w, note.ipa, note.type);
        pop.innerHTML = head + `
          <div class="vn-pop-mean">${esc(note.mean)}</div>
          <div class="vn-pop-row"><button class="vn-tts" id="vn-note-tts" title="Phát âm">🔊</button><span class="vn-pop-badge">✓ Đã có trong sổ tay</span><a class="vn-pop-link" href="/notes">Mở sổ</a></div>`;
        document.body.appendChild(pop);
        position();
        pop.querySelector('#vn-note-tts').addEventListener('click', () => speak(note.w));
        return;
      }
      if (isSentence) {
        // Whole sentence: translate only (no POS/IPA)
        pop.innerHTML = `<div class="vn-pop-sent">“${esc(word.length > 120 ? word.slice(0, 120) + '…' : word)}”</div>
          <div class="vn-pop-mean vn-dim">🔍 Đang dịch câu…</div>`;
        document.body.appendChild(pop);
        position();
        let vi = '';
        try { vi = await translateVi(word, 7000); } catch (e) {}
        if (myId !== _reqId || !pop || !pop.isConnected) return;
        renderResult(word, vi ? { mean: vi } : null, src, true);
        return;
      }
      pop.innerHTML = headHtml(word, '', '') + '<div class="vn-pop-mean vn-dim">🔍 Đang tra…</div>';
      document.body.appendChild(pop);
      position();
      // Tier 1: app dictionary; tiers 2+3: online — merge with tier-1 fields taking priority
      let t1 = null, on = null;
      try { t1 = await lookup(word); } catch (e) {}
      if (!t1 || !t1.mean || !t1.type || !t1.ipa) {
        try { on = await onlineLookup(word); } catch (e) {}
      }
      if (myId !== _reqId || !pop || !pop.isConnected) return;   // superseded by a newer selection
      const res = (t1 || on) ? {
        mean: (t1 && t1.mean) || (on && on.mean) || '',
        ipa: (t1 && t1.ipa) || (on && on.ipa) || '',
        type: (t1 && t1.type) || (on && on.type) || ''
      } : null;
      renderResult(word, res, src, false);
    }
    function maybeShow() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { hide(); return; }
      const text = sel.toString().trim();
      if (!text || text.length > 250 || !/[a-zA-Z]/.test(text)) { hide(); return; }
      const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (!node || node.closest('.vn-modal') || node.closest('input') || node.closest('select')) { hide(); return; }
      let rect;
      try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { hide(); return; }
      if (!rect || (!rect.width && !rect.height)) { hide(); return; }
      lastRect = rect;
      show(text.replace(/\s+/g, ' '));
    }
    document.addEventListener('mouseup', e => { if (pop && pop.contains(e.target)) return; setTimeout(maybeShow, 60); });
    document.addEventListener('touchend', e => { if (pop && pop.contains(e.target)) return; setTimeout(maybeShow, 250); });
    document.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target)) hide(); });
    setTimeout(() => { buildDict(); }, 2500);   // warm tier-1 dictionary in the background
  }

  return { list, add, remove, count, openModal, enableCapture, lookup, onlineLookup, findNote, speak, translateVi };
})();
