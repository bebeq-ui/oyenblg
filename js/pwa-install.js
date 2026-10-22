/*! pwa-install.js v1.0.1 - daftar service worker + tombol "Install Aplikasi" di menu */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }
  var li = document.getElementById('pwa-install');
  if (!li) return;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return;                       // sudah dibuka sebagai aplikasi
  var deferred = null;
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    li.style.display = '';
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    li.style.display = 'none';
  });
  if (ios) li.style.display = '';               // iOS tidak punya prompt otomatis

  li.addEventListener('click', function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; li.style.display = 'none'; }, function () {});
    } else if (ios) {
      alert('Di iPhone/iPad: ketuk tombol Bagikan (ikon kotak dengan panah) di Safari, lalu pilih "Tambahkan ke Layar Utama".');
    }
  });
})();
