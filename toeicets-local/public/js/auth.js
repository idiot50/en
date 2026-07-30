// Auth + Firestore sync. Exposes window.Auth. Depends on: firebase (compat), State.
// localStorage stays the local cache; Firestore is the cross-device source of truth.
window.Auth = (function () {
  let _user = null;
  let _saveTimer = null;
  let _ready = false;
  const listeners = [];
  const USER_CACHE = 'toeicets_user';

  // Instant UI: restore cached user info so every page shows the logged-in state
  // (name, hidden login banner) immediately, before Firebase's async auth check resolves.
  try { const _c = JSON.parse(localStorage.getItem(USER_CACHE) || 'null'); if (_c) window.__authUser = _c; } catch (e) {}

  function fb() { return (window.firebase && firebase.apps && firebase.apps.length) ? firebase : null; }
  function auth() { return fb() ? firebase.auth() : null; }
  function db() { return fb() ? firebase.firestore() : null; }
  function userDoc() { return _user ? db().collection('users').doc(_user.uid) : null; }

  // --- state <-> doc helpers ---
  function docFields(s) {
    return {
      xp: s.xp || 0,
      streak: s.streak || 0,
      lastStudyDate: s.lastStudyDate || null,
      dailyGoal: s.dailyGoal || 10,
      tests: s.tests || {}
    };
  }
  function mergeStates(local, remote) {
    const m = Object.assign({}, local);
    m.xp = Math.max(local.xp || 0, remote.xp || 0);
    m.streak = Math.max(local.streak || 0, remote.streak || 0);
    m.dailyGoal = remote.dailyGoal || local.dailyGoal || 10;
    m.lastStudyDate = [local.lastStudyDate, remote.lastStudyDate].filter(Boolean).sort().pop() || null;
    m.tests = Object.assign({}, remote.tests || {});
    const lt = local.tests || {};
    for (const k in lt) {
      const a = lt[k], b = m.tests[k];
      if (!b) { m.tests[k] = a; continue; }
      m.tests[k] = {
        answered: Math.max(a.answered || 0, b.answered || 0),
        correct: Math.max(a.correct || 0, b.correct || 0),
        completedParts: Array.from(new Set([...(a.completedParts || []), ...(b.completedParts || [])]))
      };
    }
    return m;
  }
  function writeLocal(merged) {
    const cur = State.load();                 // keeps today's counters
    State.save(Object.assign({}, cur, docFields(merged)));
  }

  // write-through: push local state to Firestore (debounced) while logged in
  function pushDebounced(s) {
    if (!_user || !db()) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      userDoc().set(Object.assign(docFields(s), {
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }), { merge: true }).catch(e => console.warn('[auth] push failed:', e));
    }, 1200);
  }

  async function syncOnLogin(user) {
    _user = user;
    window.__authUser = { uid: user.uid, email: user.email, name: user.displayName || (user.email || '').split('@')[0] };
    try { localStorage.setItem(USER_CACHE, JSON.stringify(window.__authUser)); } catch (e) {}
    const local = State.load();
    try {
      const snap = await userDoc().get();
      if (!snap.exists) {
        await userDoc().set(Object.assign(docFields(local), {
          email: user.email, displayName: window.__authUser.name,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
      } else {
        const merged = mergeStates(local, snap.data());
        writeLocal(merged);
        await userDoc().set(Object.assign(docFields(merged), {
          email: user.email, displayName: window.__authUser.name,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }), { merge: true });
      }
    } catch (e) {
      console.warn('[auth] sync failed (check Firestore rules / database created):', e);
    }
    window.__stateSaved = pushDebounced;     // enable write-through
    updateNav();
    notify();
  }

  function onLogout() {
    _user = null;
    window.__authUser = null;
    window.__stateSaved = null;
    try { localStorage.removeItem(USER_CACHE); } catch (e) {}
    updateNav();
    notify();
  }

  function notify() { listeners.forEach(cb => { try { cb(_user); } catch (e) {} }); }

  // --- nav UI patch (works with layout.js #nav-account placeholder) ---
  function updateNav() {
    const el = document.getElementById('nav-account');
    if (!el) return;
    if (_user) {
      const name = (window.__authUser && window.__authUser.name) || 'Tài khoản';
      el.setAttribute('href', '/profile');
      el.innerHTML = `<span class="icon">👤</span><span>${name}</span>`;
    } else {
      el.setAttribute('href', '/login');
      el.innerHTML = `<span class="icon">🔐</span><span>Đăng nhập</span>`;
    }
  }

  // --- public API ---
  function onChange(cb) { listeners.push(cb); if (_ready) cb(_user); }
  function user() { return _user; }

  async function register(email, pw, name) {
    const cred = await auth().createUserWithEmailAndPassword(email, pw);
    if (name) { try { await cred.user.updateProfile({ displayName: name }); } catch (e) {} }
    return cred.user;
  }
  function login(email, pw) { return auth().signInWithEmailAndPassword(email, pw); }
  function loginGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth().signInWithPopup(provider);
  }
  function logout() { return auth().signOut(); }

  async function addHistory(entry) {
    if (!_user || !db()) return;
    try {
      await userDoc().collection('history').add(Object.assign({}, entry, {
        at: firebase.firestore.FieldValue.serverTimestamp()
      }));
    } catch (e) { console.warn('[auth] addHistory failed:', e); }
  }
  async function getHistory(max) {
    if (!_user || !db()) return [];
    try {
      const q = await userDoc().collection('history').orderBy('at', 'desc').limit(max || 50).get();
      return q.docs.map(d => Object.assign({ id: d.id }, d.data()));
    } catch (e) { console.warn('[auth] getHistory failed:', e); return []; }
  }

  // --- boot ---
  if (auth()) {
    // Persist the session across browser restarts so users stay logged in.
    try { auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    auth().onAuthStateChanged(user => {
      _ready = true;
      if (user) syncOnLogin(user);
      else onLogout();
    });
  } else {
    // Firebase not loaded (offline build) — run as guest
    _ready = true;
    window.__authUser = null;
    setTimeout(updateNav, 0);
  }

  return { onChange, user, register, login, loginGoogle, logout, addHistory, getHistory };
})();
