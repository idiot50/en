// Firebase initialization (compat SDK, loaded via CDN before this file).
// These web keys are public by design; security is enforced by Firestore rules + Auth.
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAC5shXJ0AJe8ue_a21k9NgllY2APd7IvA",
    authDomain: "ngp-quest.firebaseapp.com",
    projectId: "ngp-quest",
    storageBucket: "ngp-quest.firebasestorage.app",
    messagingSenderId: "1048801442265",
    appId: "1:1048801442265:web:79588c036698b0486b41c8",
    measurementId: "G-LDX9ZBDR25"
  };
  try {
    if (window.firebase && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn('[firebase-init] init failed:', e);
  }
})();
