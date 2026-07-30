// Google Analytics 4 (Firebase Analytics) — counts visitors & page views.
// Measurement ID from the project's Firebase config.
(function () {
  var ID = 'G-LDX9ZBDR25';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ID);
})();
