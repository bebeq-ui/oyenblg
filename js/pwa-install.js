/*! pwa-install.js v1.0.2 - daftar service worker + tombol "Install Aplikasi" di menu */
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
  if (standalone) return;                       // sudah dibuka sebagai aplikasi: tombol tetap tersembunyi
  var deferred = null;
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  li.style.display = '';                        // selalu tampil; Chrome kadang baru siap setelah situs dipakai sebentar

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    li.style.display = 'none';
  });

  li.addEventListener('click', function () {
    if (deferred) {
      var d = deferred;
      d.prompt();
      d.userChoice.then(function (r) { deferred = null; if (r && r.outcome === 'accepted') li.style.display = 'none'; }, function () {});
    } else if (ios) {
      alert('Di iPhone/iPad: ketuk tombol Bagikan (ikon kotak dengan panah) di Safari, lalu pilih "Tambahkan ke Layar Utama".');
    } else {
      alert('Buka menu browser (titik tiga) lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama". Jika belum ada, pakai situs ini beberapa saat lalu coba lagi.');
    }
  });
})();
