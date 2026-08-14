// QuizCore — shared engine for the 15-minute quick quiz (and reusable test helpers).
// Depends on globals: Catalog, CSV, State. Renders into a root element provided by the page.
window.QuizCore = (function () {
  const AUDIO_BASE_URL = 'https://f005.backblazeb2.com/file/toeic-audio-nguyengiaphuc';

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return escapeHtml(s).replace(/\n/g, '<br/>'); }
  function highlightBlanks(t) { return escapeHtml(t).replace(/-{3,}|_{3,}/g, '<mark>______</mark>'); }
  const optsLetters = q => ['A', 'B', 'C', 'D'].filter(L => q[L] !== undefined && q[L] !== '');
  const correctLetter = q => (q.Answer || '').trim().toUpperCase().charAt(0);
  const qNumber = q => (q['Question Number'] || '').toString().replace(/\.0+$/, '');
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fmtTime(s) { const m = Math.floor(s / 60), sec = s % 60; return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; }

  function assetUrl(year, n, subdir, v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    // Absolute data.toeicets.com URLs (the 2026 set) still have to go through the
    // same audio-on-B2 / images-on-origin split as bare filenames do.
    if (/^https?:\/\//i.test(s)) {
      const rel = s.replace(/^https?:\/\/data\.toeicets\.com\//i, '');
      if (rel === s) return s;
      return subdir === 'audio' ? `${AUDIO_BASE_URL}/data/${rel}` : `/data/${rel}`;
    }
    const path = `/data/${year}/test${n}/${subdir}/${s}`;
    return subdir === 'audio' ? (AUDIO_BASE_URL + path) : path;
  }

  // Group consecutive questions sharing Audio (3,4) or Text (6,7); 1/2/5 are singletons.
  function buildGroups(questions, partNum) {
    if (partNum === 1 || partNum === 2 || partNum === 5) return questions.map(q => [q]);
    const groups = [];
    let cur = [], curKey = null;
    for (const q of questions) {
      const k = partNum <= 4 ? (q.Audio || '') : (q.Text || '');
      if (partNum >= 6 && !k && cur.length) { cur.push(q); continue; }
      if (k !== curKey || !cur.length) { if (cur.length) groups.push(cur); cur = [q]; curKey = k; }
      else cur.push(q);
    }
    if (cur.length) groups.push(cur);
    return groups;
  }

  const PARTS_BY_MODE = { reading: [5, 6, 7], listening: [1, 2, 3, 4], mixed: [1, 2, 3, 4, 5, 6, 7] };

  // Question share of each part in a real TOEIC (Listening 6/25/39/30, Reading 30/16/54).
  // Drawing shuffled (test × part) pairs uniformly does NOT reproduce this: a card is one
  // group, and groups differ wildly in size — a Part 5 card is 1 question while a Part 6
  // card is 4 — so Part 5 landed at ~11% of a Reading set instead of ~30%.
  const PART_WEIGHT = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };

  // Split `target` questions across `parts` in proportion to PART_WEIGHT. Largest-remainder
  // so the quotas add up to exactly `target` instead of drifting on rounding.
  function partQuotas(parts, target) {
    const sum = parts.reduce((s, p) => s + (PART_WEIGHT[p] || 1), 0);
    const rows = parts.map(p => ({ p, exact: target * (PART_WEIGHT[p] || 1) / sum }));
    const quota = {};
    let used = 0;
    for (const r of rows) { quota[r.p] = Math.floor(r.exact); used += quota[r.p]; }
    rows.sort((a, b) => (b.exact % 1) - (a.exact % 1));
    for (let i = 0; used < target; i++, used++) quota[rows[i % rows.length].p]++;
    return quota;
  }

  // ---------- sampler: returns array of "cards" (each = {part,year,n,srcLabel,questions[]}) ----------
  // mode: 'reading' | 'listening' | 'mixed' | 'p1'..'p7' | array of part numbers
  async function sample(mode, target) {
    let parts;
    if (Array.isArray(mode)) parts = mode;
    else if (/^p[1-7]$/.test(String(mode))) parts = [parseInt(String(mode).slice(1), 10)];
    else parts = PARTS_BY_MODE[mode] || PARTS_BY_MODE.mixed;

    // One shuffled queue of (test, part) pairs per part; drawn from in quota order below.
    const queues = {};
    for (const p of parts) queues[p] = [];
    for (const t of Catalog.all()) for (const p of parts) {
      queues[p].push({ year: t.year, n: t.n, part: p, label: `${t.year === 'Economy' ? 'Cơ bản' : t.year} • ${t.label}` });
    }
    for (const p of parts) shuffle(queues[p]);

    const need = partQuotas(parts, target);
    const cache = {};
    const cards = [];
    let qCount = 0;

    // Rotate across group sizes (largest first) so e.g. Part 7 mixes 5/4/3/2-question
    // passages instead of whatever uniform luck returns. Counted per part, so Part 5's
    // fixed size-1 groups don't skew Part 7's rotation.
    const sizeSeen = {};
    function pickGroup(groups, part, room) {
      const fits = groups.filter(g => g.length <= room);
      if (!fits.length) {
        // Nothing fits the room left — take a smallest group so we overshoot as little as
        // possible, instead of letting the size rotation below reach for the largest.
        const min = Math.min(...groups.map(g => g.length));
        const smallest = groups.filter(g => g.length === min);
        return smallest[Math.floor(Math.random() * smallest.length)];
      }
      const pool = fits;
      const seen = sizeSeen[part] || (sizeSeen[part] = {});
      const bySize = {};
      pool.forEach(g => { (bySize[g.length] = bySize[g.length] || []).push(g); });
      const size = Object.keys(bySize).map(Number)
        .sort((a, b) => (seen[a] || 0) - (seen[b] || 0) || b - a)[0];
      seen[size] = (seen[size] || 0) + 1;
      const arr = bySize[size];
      return arr[Math.floor(Math.random() * arr.length)];
    }

    while (qCount < target) {
      // Always serve the part furthest behind its quota; parts whose queue ran dry drop out,
      // and their unfilled share is absorbed by the rest so we still reach `target`.
      // Deliberately NOT gated on "quota must fit a whole block": that gate makes the totals
      // land exactly on target but starves the coarse parts (a 3-question Part 4 talk never
      // fits a 2-slot quota, so Part 4 vanishes). A question or two of overshoot is the
      // cheaper trade against a set that is missing a part outright.
      const live = parts.filter(p => queues[p].length);
      if (!live.length) break;
      const p = live.sort((a, b) => (need[b] - need[a]) || (Math.random() - 0.5))[0];
      const pr = queues[p].shift();
      const url = `/data/${encodeURIComponent(pr.year)}/test${pr.n}/test${pr.n}-part${pr.part}.csv`;
      let rows;
      try { rows = cache[url] || (cache[url] = await CSV.load(url)); } catch (e) { continue; }
      if (!rows || !rows.length) continue;
      const groups = buildGroups(rows, pr.part);
      if (!groups.length) continue;
      // Room is bounded by the whole set too, not just this part's quota — Part 7 has some
      // very large multi-passage groups that would otherwise blow past `target` in one card.
      const g = pickGroup(groups, pr.part, Math.max(1, Math.min(need[p], target - qCount)));
      cards.push({ part: pr.part, year: pr.year, n: pr.n, srcLabel: pr.label, questions: g });
      need[p] -= g.length;
      qCount += g.length;
    }
    // Quota order groups the parts together; shuffle back so the quiz still feels mixed.
    return shuffle(cards);
  }

  // ---------- player ----------
  // opts: { root, sidebar, cards, minutes, onFinish(summary) }
  function startQuiz(opts) {
    const { root, sidebar, cards } = opts;
    const minutes = opts.minutes || 15;

    // Flatten questions, assign a unique id (question numbers repeat across tests).
    const items = [];
    cards.forEach((card, ci) => card.questions.forEach((q, qi) => {
      items.push({ uid: `${ci}.${qi}`, card, q });
    }));
    const picks = {};           // uid -> chosen letter
    const skipped = {};         // uid -> true when the clip could not be loaded (not counted anywhere)
    let cardIdx = 0;
    let timerSeconds = minutes * 60;
    let timerInterval = null;
    let finished = false;

    function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
    function paintTimer() {
      const el = document.getElementById('quiz-timer');
      if (!el) return;
      el.innerHTML = `⏳ ${fmtTime(timerSeconds)}`;
      el.classList.toggle('warning', timerSeconds <= 60);
    }
    function startTimer() {
      if (timerInterval) return;
      timerInterval = setInterval(() => {
        timerSeconds--;
        if (timerSeconds <= 0) { timerSeconds = 0; paintTimer(); stopTimer(); finish(); return; }
        paintTimer();
      }, 1000);
    }

    function answeredCount() { return Object.keys(picks).length; }

    // Two-column layout for Part 7 (passage | questions) so learners don't scroll
    // up and down between a long reading passage and its questions. Injected once.
    function ensureSplitStyle() {
      if (document.getElementById('qc-split-style')) return;
      const st = document.createElement('style');
      st.id = 'qc-split-style';
      st.textContent =
        '.rv-q{padding:18px 0;border-top:2px dashed var(--border);}' +
        '.rv-q:first-of-type{border-top:none;padding-top:6px;}' +
        '.rv-q.cur{background:#fffdf3;border-radius:12px;padding:14px;margin:8px -8px;box-shadow:inset 0 0 0 2px #ffe08a;}' +
        '.main.main-wide{max-width:none;}.main-wide .player{max-width:none;}' +   // Part 7 uses the full screen width
        '.q-split{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:18px;align-items:start;margin-bottom:16px;}' +
        '.q-split .q-card{margin-bottom:0;}' +
        '.q-split-pass{position:sticky;top:64px;max-height:calc(100vh - 168px);overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;}' +
        '.q-split-pass::-webkit-scrollbar{width:11px;}' +
        '.q-split-pass::-webkit-scrollbar-track{background:#eef2f4;border-radius:7px;}' +
        '.q-split-pass::-webkit-scrollbar-thumb{background:#b9c6cf;border-radius:7px;border:2px solid #eef2f4;}' +
        '.q-split-pass::-webkit-scrollbar-thumb:hover{background:#94a6b2;}' +
        '.q-split-pass .q-passage{max-height:none;overflow:visible;border-left:none;background:transparent;padding:0;margin-bottom:0;font-size:15.5px;}' +
        '.q-split-pass .q-image{max-height:none;}' +
        '@media(max-width:860px){.main.main-wide{max-width:100%;}.q-split{grid-template-columns:1fr;}.q-split-pass{position:static;max-height:44vh;}.q-split-pass .q-passage{max-height:none;}}';
      document.head.appendChild(st);
    }

    function renderCard() {
      if (cardIdx >= cards.length) { finish(); return; }
      const card = cards[cardIdx];
      const partNum = card.part;
      const isListening = partNum <= 4;
      const isBlind = partNum === 1 || partNum === 2;   // hide question + option text while listening
      const first = card.questions[0];
      const sharedAudio = assetUrl(card.year, card.n, 'audio', first.Audio);
      const sharedImage = assetUrl(card.year, card.n, 'image', first.Image);
      const sharedText = first.Text || '';
      const progressPct = Math.round(cardIdx / cards.length * 100);

      const audioHtml = sharedAudio ? `<audio controls autoplay preload="auto" src="${sharedAudio}"></audio>` : '';
      const imageHtml = sharedImage ? `<img class="q-image" src="${sharedImage}" alt="image"/>` : '';
      const passageHtml = (!isListening && sharedText) ? `<div class="q-passage">${nl2br(sharedText)}</div>` : '';

      const subQs = card.questions.map((q, i) => {
        const item = items.find(it => it.card === card && it.q === q);
        const uid = item.uid;
        const letters = optsLetters(q);
        const opts = letters.map(L => `
          <button class="option ${picks[uid] === L ? 'selected' : ''}" data-uid="${uid}" data-letter="${L}">
            <span class="letter">${L}</span><span>${escapeHtml(q[L] || '')}</span>
          </button>`).join('');
        const qText = q.Question ? `<div class="q-text">${highlightBlanks(q.Question)}</div>` : '';
        return `
          <div class="sub-q${isBlind ? ' blind' : ''}">
            <div class="q-num">${card.srcLabel} • Part ${partNum} • Câu ${qNumber(q)}</div>
            ${qText}
            <div class="options">${opts}</div>
            <div class="qfb" id="qfb-${uid}"></div>
          </div>`;
      }).join('');

      const isLast = cardIdx >= cards.length - 1;
      const lastLabel = opts.instantFeedback ? 'Kết thúc ✓' : 'Nộp bài ✓';
      // Grouped instant-feedback (Part 3/4/6/7): answer ALL questions in the group
      // before any answer/explanation is revealed — so earlier answers don't leak
      // clues to later questions in the same conversation/passage.
      const isGroup = opts.instantFeedback && card.questions.length > 1;
      const groupHint = isGroup
        ? `<div id="group-hint" style="background:#eaf6ff;border:2px dashed var(--blue,#1cb0f6);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;font-weight:700;color:var(--blue-dark,#1899d6);">📝 Trả lời <b>tất cả ${card.questions.length} câu</b> trong cụm — xong hệ thống sẽ hiện đáp án &amp; giải thích.</div>`
        : '';
      // Part 7 (reading) with a passage → split into passage | questions columns.
      const useSplit = partNum === 7 && !!(passageHtml || imageHtml);
      if (useSplit) ensureSplitStyle();
      const cardBody = useSplit
        ? `<div class="q-split">
             <div class="q-card q-split-pass">${imageHtml}${passageHtml}</div>
             <div class="q-card q-split-q">${groupHint}${subQs}</div>
           </div>`
        : `<div class="q-card">${audioHtml}${imageHtml}${passageHtml}${groupHint}${subQs}</div>`;
      root.innerHTML = sidebar + `
        <main class="main${useSplit ? ' main-wide' : ''}">
          <div class="player">
            <div class="player-header">
              <a class="close" href="${opts.backUrl || '/quick'}" title="Thoát">✕</a>
              <div class="progress-bar"><div class="fill" style="width:${progressPct}%"></div></div>
              <div class="test-timer" id="quiz-timer">⏳ ${fmtTime(timerSeconds)}</div>
            </div>
            ${cardBody}
            <div class="group-toolbar">
              <button class="btn ghost" id="q-prev" ${cardIdx <= 0 ? 'disabled' : ''}>← Trước</button>
              ${opts.noteButton ? '<button class="btn ghost small" id="q-note">📒 Ghi từ</button>' : ''}
              <span class="pick-count">Cụm ${cardIdx + 1}/${cards.length} • Đã chọn ${answeredCount()}/${items.length}</span>
              <span style="flex:1"></span>
              ${!opts.instantFeedback ? `<button class="btn ${isLast ? '' : 'ghost'}" id="q-submit">✓ Kiểm tra</button>` : ''}
              ${(opts.instantFeedback || !isLast) ? `<button class="btn ${isLast ? '' : 'blue'}" id="q-next">${isLast ? lastLabel : 'Tiếp →'}</button>` : ''}
            </div>
          </div>
        </main>`;

      paintTimer();
      startTimer();

      // Instant-feedback mode: lock the question on first pick, color it, show the explanation
      function applyFeedback(uid) {
        const item = items.find(it => it.uid === uid);
        if (!item) return;
        const q = item.q, correct = correctLetter(q), chosen = picks[uid];
        root.querySelectorAll(`.option[data-uid="${uid}"]`).forEach(b => {
          b.setAttribute('disabled', '1');
          b.classList.remove('selected');
          if (b.dataset.letter === correct) b.classList.add('correct');
          else if (b.dataset.letter === chosen) b.classList.add('wrong');
          const sq = b.closest('.sub-q');
          if (sq) sq.classList.remove('blind');
        });
        const fb = document.getElementById('qfb-' + uid);
        if (fb && !fb.innerHTML) {
          const ok = chosen === correct;
          fb.innerHTML = `<div class="feedback ${ok ? 'correct' : 'wrong'}">
            <div class="heading">${ok ? '🎉 Chính xác!' : '❌ Chưa đúng — Đáp án: ' + correct}</div>
            ${q.Explain ? `<div style="margin-top:6px;">${nl2br(q.Explain)}</div>` : ''}
          </div>`;
        }
      }
      function maybeRevealShared() {
        const allDone = card.questions.every(q => {
          const it = items.find(x => x.card === card && x.q === q);
          return it && picks[it.uid] != null;
        });
        if (!allDone) return;
        const qc = root.querySelector('.q-split-q') || root.querySelector('.q-card');
        if (!qc || qc.querySelector('.shared-reveal')) return;
        let html = '';
        if (isListening && sharedText) {
          // Replay button right next to the script so users don't have to scroll
          // back up to the audio bar to listen again.
          const replayBtn = sharedAudio
            ? `<button class="btn ghost small" id="replay-script" style="margin:2px 0 10px;">🔊 Nghe lại script</button>`
            : '';
          html += `<div class="reveal-block shared-reveal"><div class="heading">📜 Script</div>${replayBtn}<div class="body">${nl2br(sharedText)}</div></div>`;
        }
        const trans = Array.from(new Set(card.questions.map(q => q.Transcript || q.Translate || '').filter(Boolean)));
        if (trans.length) html += `<div class="reveal-block shared-reveal" style="border-left-color:var(--green);"><div class="heading">🇻🇳 Bản dịch</div><div class="body">${nl2br(trans.join('\n\n'))}</div></div>`;
        if (html) qc.insertAdjacentHTML('beforeend', html);
        // Wire the replay button to the shared audio element at the top of the card
        const rb = document.getElementById('replay-script');
        const au = root.querySelector('.player audio');
        if (rb && au) {
          const sync = () => { rb.textContent = au.paused ? (au.currentTime > 0.1 && !au.ended ? '▶ Tiếp tục' : '🔊 Nghe lại script') : '⏸ Tạm dừng'; };
          rb.addEventListener('click', () => {
            if (au.paused) {
              if (au.ended || (au.duration && au.currentTime >= au.duration - 0.3)) au.currentTime = 0;
              const p = au.play(); if (p && p.catch) p.catch(() => {});
            } else { au.pause(); }
          });
          au.addEventListener('play', sync);
          au.addEventListener('pause', sync);
          au.addEventListener('ended', sync);
          sync();
        }
      }
      // Group helpers (deferred reveal for multi-question cards)
      function groupAllAnswered() {
        return card.questions.every(q => {
          const it = items.find(x => x.card === card && x.q === q);
          return it && picks[it.uid] != null;
        });
      }
      function groupRevealed() {
        return card.questions.some(q => {
          const it = items.find(x => x.card === card && x.q === q);
          const fb = it && document.getElementById('qfb-' + it.uid);
          return fb && fb.innerHTML;
        });
      }
      function revealGroup() {
        const gh = document.getElementById('group-hint');
        if (gh) gh.remove();
        card.questions.forEach(q => {
          const it = items.find(x => x.card === card && x.q === q);
          if (it) applyFeedback(it.uid);
        });
        maybeRevealShared();
      }

      root.querySelectorAll('.option').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.dataset.uid;
          if (opts.instantFeedback) {
            if (isGroup) {
              // Multi-question group: pick is changeable until every question is
              // answered; only then reveal all answers + explanations at once.
              if (groupRevealed()) return;            // locked after reveal
              picks[uid] = btn.dataset.letter;
              root.querySelectorAll(`.option[data-uid="${uid}"]`).forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
              if (groupAllAnswered()) revealGroup();
            } else {
              if (picks[uid] != null) return;         // single question — lock on first pick
              picks[uid] = btn.dataset.letter;
              applyFeedback(uid);
              maybeRevealShared();
            }
          } else {
            picks[uid] = btn.dataset.letter;
            root.querySelectorAll(`.option[data-uid="${uid}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
          }
          const pc = root.querySelector('.pick-count');
          if (pc) pc.textContent = `Cụm ${cardIdx + 1}/${cards.length} • Đã chọn ${answeredCount()}/${items.length}`;
        });
      });
      // Restore state when navigating back/forward.
      // (Selections are already re-applied by the template's `selected` class.)
      if (opts.instantFeedback) {
        if (isGroup) {
          if (groupAllAnswered()) revealGroup();       // whole group done -> show feedback
        } else {
          card.questions.forEach(q => {
            const it = items.find(x => x.card === card && x.q === q);
            if (it && picks[it.uid] != null) applyFeedback(it.uid);
          });
          maybeRevealShared();
        }
      }
      const noteBtn = document.getElementById('q-note');
      if (noteBtn && opts.noteButton) noteBtn.addEventListener('click', () => opts.noteButton({ src: card.srcLabel + ' • Part ' + card.part }));
      const prev = document.getElementById('q-prev');
      if (prev) prev.onclick = () => { if (cardIdx > 0) { cardIdx--; window.scrollTo({ top: 0 }); renderCard(); } };
      const nextBtnEl = document.getElementById('q-next');
      if (nextBtnEl) nextBtnEl.onclick = () => {
        if (cardIdx >= cards.length - 1) { finish(); return; }
        cardIdx++; window.scrollTo({ top: 0 }); renderCard();
      };
      // Explicit "check" button (no-instant-feedback mode): grade the whole set at any time.
      const submitEl = document.getElementById('q-submit');
      if (submitEl) submitEl.onclick = () => {
        const left = items.length - answeredCount();
        if (left > 0 && !confirm(`Còn ${left} câu chưa chọn đáp án. Kiểm tra kết quả luôn?`)) return;
        finish();
      };

      // Audio autoplay (browsers block until a gesture — also start on first tap)
      const audioEl = root.querySelector('.player audio');
      if (audioEl) {
        const tryPlay = () => { const p = audioEl.play(); if (p && p.catch) p.catch(() => {}); };
        tryPlay();
        document.addEventListener('pointerdown', tryPlay, { once: true });
        // Clip missing / failed to download: offer retry + skip. A skipped group is not
        // graded and never reaches the history or the error box.
        audioEl.onerror = () => showAudioError(audioEl, sharedAudio);
      }
    }

    // Banner shown when a listening clip cannot be loaded.
    function showAudioError(audioEl, url) {
      if (!audioEl || document.getElementById('au-err')) return;
      const card = audioEl.closest('.q-card') || root.querySelector('.q-card');
      if (!card) return;
      const box = document.createElement('div');
      box.id = 'au-err';
      box.style.cssText = 'background:#fff0f0;border:2px solid var(--red,#ff4b4b);border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:14px;line-height:1.6;';
      box.innerHTML = `<b style="color:var(--red,#ff4b4b);">⚠️ Không tải được file nghe của câu này.</b>
        <div style="color:var(--text-mute);font-size:12.5px;margin:4px 0 10px;word-break:break-all;">${escapeHtml(url || '')}</div>
        <button class="btn ghost small" id="au-retry">🔄 Thử lại</button>
        <button class="btn small" id="au-skip" style="margin-left:8px;">⏭ Bỏ qua câu này</button>
        <div style="font-size:12.5px;color:var(--text-mute);margin-top:8px;">Bỏ qua thì câu này <b>không bị tính</b> là đúng hay sai, và không vào lịch sử luyện tập.</div>`;
      card.insertBefore(box, card.firstChild);
      document.getElementById('au-retry').onclick = () => {
        box.remove();
        const bust = url + (url.indexOf('?') === -1 ? '?' : '&') + 'r=' + Date.now();
        audioEl.src = bust; audioEl.load();
        const p = audioEl.play(); if (p && p.catch) p.catch(() => {});
      };
      document.getElementById('au-skip').onclick = () => skipCurrentCard();
    }

    // Mark every question of the current card as skipped and move on.
    function skipCurrentCard() {
      const card = cards[cardIdx];
      if (card) {
        card.questions.forEach(q => {
          const it = items.find(x => x.card === card && x.q === q);
          if (it) { skipped[it.uid] = true; delete picks[it.uid]; }
        });
      }
      if (cardIdx >= cards.length - 1) { finish(); return; }
      cardIdx++; window.scrollTo({ top: 0 }); renderCard();
    }

    function buildResults() {
      return items.map(it => {
        const chosen = picks[it.uid] || null;
        const correct = correctLetter(it.q);
        return {
          srcLabel: it.card.srcLabel, part: it.card.part, qNum: qNumber(it.q),
          year: it.card.year, n: it.card.n,
          gid: String(it.uid).split('.')[0],   // group index: questions sharing one clip/passage
          audioFile: it.card.questions[0].Audio || '',
          imageFile: it.q.Image || it.card.questions[0].Image || '',
          question: it.q.Question || '',
          image: assetUrl(it.card.year, it.card.n, 'image', it.q.Image) || (it.card.questions[0] === it.q ? null : null),
          options: optsLetters(it.q).map(L => ({ L, text: it.q[L] || '' })),
          chosen, correct, isCorrect: chosen === correct,
          skipped: !!skipped[it.uid],          // clip could not be loaded -> not graded at all
          explain: it.q.Explain || '',
          script: it.card.questions[0].Text || '',
          translation: it.q.Transcript || it.q.Translate || ''
        };
      });
    }

    // Redo the same set of questions from scratch (same cards, fresh answers + timer).
    function restart() {
      stopTimer();
      Object.keys(picks).forEach(k => delete picks[k]);
      Object.keys(skipped).forEach(k => delete skipped[k]);
      cardIdx = 0;
      timerSeconds = minutes * 60;
      finished = false;
      window.scrollTo({ top: 0 });
      renderCard();
    }

    function finish() {
      if (finished) return;
      finished = true;
      stopTimer();
      const results = buildResults();
      // Questions whose audio never loaded are excluded from grading, XP, the error box
      // and the daily history — they were not really attempted.
      const graded = results.filter(r => !r.skipped);
      const st = State.load();
      graded.forEach(r => { if (r.chosen != null) State.recordAnswer(st, 'quick', 0, r.isCorrect); });
      try { ErrorBox.addFromResults(graded); } catch (e) {}
      try { if (window.Hist) Hist.addResults(graded, opts.feature || 'other'); } catch (e) {}
      if (opts.onResults) { try { opts.onResults(graded); } catch (e) {} }
      if (opts.onFinish) {
        const correct = graded.filter(r => r.isCorrect).length;
        const blank = graded.filter(r => r.chosen == null).length;
        opts.onFinish({ total: graded.length, correct, wrong: graded.length - correct - blank, blank,
                        skipped: results.length - graded.length });
      }
      renderResults(results);
    }

    function renderResults(all) {
      // Skipped (audio failed) questions are shown separately and excluded from the stats.
      const results = all.filter(r => !r.skipped);
      const skipCount = all.length - results.length;
      const total = results.length;
      const correctCount = results.filter(r => r.isCorrect).length;
      const blankCount = results.filter(r => r.chosen == null).length;
      const wrongCount = total - correctCount - blankCount;
      const answered = total - blankCount;
      const acc = answered ? Math.round(correctCount / answered * 100) : 0;
      const xp = correctCount * 10;
      const grid = total ? results.map((r, idx) => {
        const stt = r.chosen == null ? 'blank' : (r.isCorrect ? 'correct' : 'wrong');
        const lbl = stt === 'correct' ? 'Đúng' : stt === 'wrong' ? 'Sai' : 'Chưa làm';
        return `<button class="q-result ${stt}" data-idx="${idx}" title="${r.srcLabel} • Câu ${r.qNum} — ${lbl}">${idx + 1}</button>`;
      }).join('') : '<p style="color:var(--text-mute);">Chưa có câu nào.</p>';

      root.innerHTML = sidebar + `
        <main class="main">
          <div class="modal" style="margin:40px auto;max-width:680px;">
            <div style="font-size:80px;">${opts.icon || '⚡'}</div>
            <h2>${opts.title || 'Kết quả kiểm tra nhanh'}</h2>
            <p style="color:var(--text-mute);margin-top:8px;">Đúng ${correctCount} • Sai ${wrongCount}${blankCount ? ` • Chưa làm ${blankCount}` : ''} • Tổng ${total} câu</p>
            ${skipCount ? `<p style="color:var(--text-mute);font-size:13px;margin-top:4px;">⏭ Đã bỏ qua ${skipCount} câu vì không tải được file nghe — không tính vào kết quả.</p>` : ''}
            <div class="stats-grid" style="margin-top:24px;">
              <div class="stat-card"><div class="big" style="color:var(--green);">✅ ${correctCount}</div><div class="label">Câu đúng</div></div>
              <div class="stat-card"><div class="big" style="color:var(--red);">❌ ${wrongCount}</div><div class="label">Câu sai</div></div>
              ${blankCount ? `<div class="stat-card"><div class="big" style="color:var(--text-mute);">⬜ ${blankCount}</div><div class="label">Chưa làm</div></div>` : ''}
              <div class="stat-card xp"><div class="big">+${xp}</div><div class="label">XP nhận được</div></div>
              <div class="stat-card accuracy"><div class="big">${acc}%</div><div class="label">Độ chính xác</div></div>
            </div>
            ${opts.scoreFn ? opts.scoreFn(results) : ''}
            <h3 class="section-title" style="margin-top:24px;text-align:left;">Chi tiết từng câu — bấm để xem lại</h3>
            <div class="q-result-grid">${grid}</div>
            ${total ? '<button class="btn blue" id="q-reviewall" style="margin-top:16px;">📖 Xem lại toàn bộ bài làm</button>' : ''}
            <div class="row" style="margin-top:24px;">
              <button class="btn gold" id="q-redo">↻ Làm lại</button>
              <a class="btn ghost" href="${opts.backUrl || '/quick'}">${opts.backLabel || 'Làm bài khác'}</a>
              <a class="btn" href="/">Về trang chủ</a>
            </div>
          </div>
        </main>`;
      const redoBtn = document.getElementById('q-redo');
      if (redoBtn) redoBtn.addEventListener('click', restart);
      const revAll = document.getElementById('q-reviewall');
      if (revAll) revAll.addEventListener('click', () => renderReview(results, 0));
      root.querySelectorAll('.q-result').forEach(b => b.addEventListener('click', () => renderReview(results, parseInt(b.dataset.idx, 10))));
    }

    // Review one item. Questions that share a clip or a passage (Part 3/4/6/7) are shown
    // TOGETHER — the whole set of 3-4 questions, including the ones answered correctly —
    // so the group can be re-read as a unit.
    function renderReview(results, idx) {
      const r = results[idx];
      if (!r) { renderResults(results); return; }
      ensureSplitStyle();   // also carries the .rv-q styles used below
      const mates = results.filter(x => x.gid != null && x.gid === r.gid);
      const group = mates.length > 1 ? mates : [r];
      const isGroup = group.length > 1;
      const first = group[0], last = group[group.length - 1];

      const audioUrl = first.audioFile ? assetUrl(first.year, first.n, 'audio', first.audioFile) : null;
      const imgUrl = first.imageFile ? assetUrl(first.year, first.n, 'image', first.imageFile) : null;
      const script = group.map(x => x.script).find(Boolean) || '';
      // Translations can differ per question; show the group's distinct ones together.
      const trans = Array.from(new Set(group.map(x => x.translation).filter(Boolean)));

      const okN = group.filter(x => x.isCorrect).length;
      const stt = r.chosen == null ? 'blank' : (r.isCorrect ? 'correct' : 'wrong');

      const qBlocks = group.map((x, k) => {
        const s2 = x.chosen == null ? 'blank' : (x.isCorrect ? 'correct' : 'wrong');
        const opts = x.options.map(o => {
          let cls = 'option';
          if (o.L === x.correct) cls += ' correct';
          else if (o.L === x.chosen) cls += ' wrong';
          return `<button class="${cls}" disabled><span class="letter">${o.L}</span><span>${escapeHtml(o.text)}</span></button>`;
        }).join('');
        const verdict = s2 === 'correct'
          ? `<div class="feedback correct"><div class="heading">🎉 Đúng — Đáp án: ${x.correct}</div></div>`
          : s2 === 'blank'
            ? `<div class="feedback wrong"><div class="heading">⬜ Chưa trả lời — Đáp án đúng: ${x.correct}</div></div>`
            : `<div class="feedback wrong"><div class="heading">❌ Sai — Bạn chọn: ${x.chosen} • Đáp án đúng: ${x.correct}</div></div>`;
        const explain = x.explain ? `<div class="reveal-block"><div class="heading">💡 Giải thích</div><div class="body">${nl2br(x.explain)}</div></div>` : '';
        const isCur = x === r;
        return `<div class="rv-q${isCur ? ' cur' : ''}"${isCur ? ' id="rv-cur"' : ''}>
            ${isGroup ? `<div class="q-num" style="font-size:12px;font-weight:800;color:var(--text-mute);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
                 Câu ${x.qNum} ${s2 === 'correct' ? '· ✅ đúng' : s2 === 'blank' ? '· ⬜ chưa làm' : '· ❌ sai'}${isCur ? ' · đang xem' : ''}</div>` : ''}
            ${x.question ? `<div class="q-text">${highlightBlanks(x.question)}</div>` : ''}
            <div class="options">${opts}</div>
            ${verdict}${explain}
          </div>`;
      }).join('');

      const headTitle = isGroup
        ? `${r.srcLabel} • Part ${r.part} • Câu ${first.qNum}–${last.qNum}`
        : `${r.srcLabel} • Part ${r.part} • Câu ${r.qNum}`;
      const headBadge = isGroup
        ? `<div class="test-timer ${okN === group.length ? '' : 'warning'}">${okN}/${group.length} đúng</div>`
        : `<div class="test-timer ${stt === 'correct' ? '' : 'warning'}">${stt === 'correct' ? '✅ Đúng' : stt === 'blank' ? '⬜ Chưa làm' : '❌ Sai'}</div>`;

      // Jump to the previous/next GROUP (or question when it stands alone)
      const prevIdx = (() => { for (let i = idx - 1; i >= 0; i--) if (results[i].gid !== r.gid) return i; return -1; })();
      const nextIdx = (() => { for (let i = idx + 1; i < results.length; i++) if (results[i].gid !== r.gid) return i; return -1; })();

      root.innerHTML = sidebar + `
        <main class="main">
          <div class="player">
            <div class="player-header">
              <button class="close" id="rv-back" title="Về danh sách">←</button>
              <div style="font-weight:900;flex:1;">${headTitle}</div>
              ${headBadge}
            </div>
            <div class="q-card">
              ${audioUrl ? `<audio controls preload="none" src="${audioUrl}"></audio>` : ''}
              ${imgUrl ? `<img class="q-image" src="${imgUrl}" alt="image"/>` : ''}
              ${script ? `<div class="reveal-block"><div class="heading">📜 ${r.part <= 4 ? 'Script bài nghe' : 'Đoạn văn'}</div><div class="body">${nl2br(script)}</div></div>` : ''}
              ${isGroup ? `<p style="font-size:12.5px;color:var(--text-mute);margin:12px 0 0;">Cả cụm ${group.length} câu của bài nghe/đoạn văn này:</p>` : ''}
              ${qBlocks}
              ${trans.length ? `<div class="reveal-block" style="border-left-color:var(--green);"><div class="heading">🇻🇳 Bản dịch</div><div class="body">${nl2br(trans.join(String.fromCharCode(10, 10)))}</div></div>` : ''}
            </div>
            <div class="group-toolbar">
              <button class="btn ghost" id="rv-prev" ${prevIdx < 0 ? 'disabled' : ''}>← ${isGroup ? 'Cụm trước' : 'Câu trước'}</button>
              <button class="btn ghost small" id="rv-list">Danh sách</button>
              <span style="flex:1"></span>
              <button class="btn blue" id="rv-next" ${nextIdx < 0 ? 'disabled' : ''}>${isGroup ? 'Cụm sau' : 'Câu sau'} →</button>
            </div>
          </div>
        </main>`;
      document.getElementById('rv-back').onclick = () => renderResults(results);
      document.getElementById('rv-list').onclick = () => renderResults(results);
      const p = document.getElementById('rv-prev'); if (p && prevIdx >= 0) p.onclick = () => renderReview(results, prevIdx);
      const nx = document.getElementById('rv-next'); if (nx && nextIdx >= 0) nx.onclick = () => renderReview(results, nextIdx);
      window.scrollTo({ top: 0 });
      // If the user opened a specific question of a group, bring it into view.
      if (isGroup) {
        const cur = document.getElementById('rv-cur');
        if (cur && group.indexOf(r) > 0) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 60);
      }
    }

    renderCard();
  }

  // ---------- ErrorBox: wrong answers auto-collected, re-served on a Leitner schedule ----------
  const ErrorBox = (function () {
    const KEY = 'toeicets_errors_v1';
    const IV = [0, 1, 3, 7, 21];           // days until re-review per box
    const GRAD_BOX = 4;                    // reaching this box = graduated (mastered)
    const MAX_ITEMS = 300;
    function todayISO() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function addDays(iso, nd) {
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(y, m - 1, d + nd);
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    }
    function load() {
      try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return s && s.items ? s : { items: {} }; }
      catch (e) { return { items: {} }; }
    }
    function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
    const idOf = r => [r.year, r.n, r.part, r.qNum].join('|');
    function addFromResults(results) {
      const st = load(); const t = todayISO();
      let changed = false;
      (results || []).forEach(r => {
        if (!r || r.chosen == null || r.isCorrect || !r.year || !r.qNum) return;
        const id = idOf(r);
        const prev = st.items[id];
        st.items[id] = {
          box: 1, due: addDays(t, IV[1]), grad: false,
          wrong: (prev ? prev.wrong : 0) + 1, at: t,
          d: {
            year: r.year, n: r.n, part: r.part, qNum: r.qNum,
            q: r.question || '', o: r.options || [], a: r.correct || '',
            c: r.chosen || '',                     // what you picked, so the review can show it
            e: (r.explain || '').slice(0, 4000), s: (r.script || '').slice(0, 5000),
            tr: (r.translation || '').slice(0, 5000), au: r.audioFile || '', im: r.imageFile || ''
          }
        };
        changed = true;
      });
      if (changed) { prune(st); save(st); }
    }
    function prune(st) {
      const ids = Object.keys(st.items);
      if (ids.length <= MAX_ITEMS) return;
      // drop graduated first, then oldest
      ids.sort((a, b) => (st.items[a].grad === st.items[b].grad ? (st.items[a].at < st.items[b].at ? -1 : 1) : (st.items[a].grad ? -1 : 1)));
      ids.slice(0, ids.length - MAX_ITEMS).forEach(id => delete st.items[id]);
    }
    function grade(id, ok) {
      const st = load(); const it = st.items[id];
      if (!it) return;
      const t = todayISO();
      if (ok) {
        it.box = Math.min(it.box + 1, GRAD_BOX);
        if (it.box >= GRAD_BOX) it.grad = true;
      } else { it.box = 1; it.grad = false; it.wrong++; }
      it.due = addDays(t, IV[Math.min(it.box, IV.length - 1)]);
      save(st);
    }
    function entries() {
      const st = load();
      return Object.keys(st.items).map(id => Object.assign({ id }, st.items[id]));
    }
    function dueList() {
      const t = todayISO();
      return entries().filter(e => !e.grad && e.due <= t);
    }
    function counts() {
      const es = entries();
      const t = todayISO();
      return { total: es.length, active: es.filter(e => !e.grad).length, due: es.filter(e => !e.grad && e.due <= t).length, grad: es.filter(e => e.grad).length };
    }
    function removeId(id) { const st = load(); delete st.items[id]; save(st); }
    // Rebuild quiz-core cards from stored entries so startQuiz can replay them
    function toCards(list) {
      const clean = v => { const s = String(v || ''); return s.indexOf('/') === -1 ? s : s.split('/').pop(); };
      return (list || []).map(e => {
        const row = { 'Question Number': e.d.qNum, Question: e.d.q, Answer: e.d.a, Explain: e.d.e, Text: e.d.s, Transcript: e.d.tr, Audio: clean(e.d.au), Image: clean(e.d.im) };
        (e.d.o || []).forEach(op => { row[op.L] = op.text; });
        const label = (e.d.year === 'Economy' ? 'Cơ bản' : e.d.year) + ' • Đề ' + e.d.n;
        return { part: e.d.part, year: e.d.year, n: e.d.n, srcLabel: label, questions: [row] };
      });
    }
    return { addFromResults, grade, entries, dueList, counts, toCards, idOf, removeId };
  })();

  return { sample, startQuiz, escapeHtml, nl2br, highlightBlanks, PARTS_BY_MODE, ErrorBox, assetUrl };
})();
