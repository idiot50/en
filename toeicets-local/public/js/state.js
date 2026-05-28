// User state stored in localStorage. Pure functions, no globals beyond `State`.
const State = (() => {
  const KEY = 'toeicets_state_v1';
  const TODAY = () => new Date().toISOString().slice(0, 10);

  function fresh() {
    return {
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      tests: {},         // { "2025/test1": { part: 1, answered: 12, correct: 9, completedParts: [1,2] } }
      dailyGoal: 10,     // questions per day
      todayAnswered: 0,
      todayDate: TODAY(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const s = JSON.parse(raw);
      // Reset daily counter if new day
      if (s.todayDate !== TODAY()) {
        s.todayAnswered = 0;
        s.todayDate = TODAY();
      }
      return Object.assign(fresh(), s);
    } catch (e) {
      return fresh();
    }
  }

  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function recordAnswer(s, testKey, partNumber, correct) {
    if (!s.tests[testKey]) s.tests[testKey] = { answered: 0, correct: 0, completedParts: [] };
    const t = s.tests[testKey];
    t.answered += 1;
    if (correct) {
      t.correct += 1;
      s.xp += 10;
    }
    s.todayAnswered += 1;
    // Streak: bump if we answered today and yesterday (or first time)
    const today = TODAY();
    if (s.lastStudyDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (s.lastStudyDate === yesterday) s.streak += 1;
      else s.streak = 1;
      s.lastStudyDate = today;
    }
    save(s);
  }

  function markPartComplete(s, testKey, partNumber) {
    if (!s.tests[testKey]) s.tests[testKey] = { answered: 0, correct: 0, completedParts: [] };
    if (!s.tests[testKey].completedParts.includes(partNumber)) {
      s.tests[testKey].completedParts.push(partNumber);
    }
    save(s);
  }

  function testProgress(s, testKey) {
    const t = s.tests[testKey];
    if (!t) return { percent: 0, parts: 0, status: 'new' };
    const parts = (t.completedParts || []).length;
    const percent = Math.round((parts / 7) * 100);
    let status = 'new';
    if (parts >= 7) status = 'done';
    else if (parts > 0 || t.answered > 0) status = 'current';
    return { percent, parts, status };
  }

  return { load, save, recordAnswer, markPartComplete, testProgress, fresh };
})();
