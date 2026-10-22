/*! pwa-install.js v1.0.4 - daftar service worker + tombol "Install Aplikasi" di menu */
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
  if (standalone) { li.style.display = 'none'; return; }   // sudah dibuka sebagai aplikasi: sembunyikan tombol
  var deferred = null;
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);


  function diag() {
    var out = [];
    var add = function (ok, t) { out.push((ok ? '[OK] ' : '[X] ') + t); };
    var link = document.querySelector('link[rel="manifest"]');
    add(!!link, 'tag manifest di halaman');
    add(location.protocol === 'https:', 'HTTPS');
    add('serviceWorker' in navigator, 'browser mendukung service worker');
    add('onbeforeinstallprompt' in window, 'browser mendukung install');
    var tasks = [];
    tasks.push(fetch('/manifest.json', { cache: 'no-store' }).then(function (r) {
      add(r.ok, 'manifest.json status ' + r.status);
      return r.json();
    }).then(function (m) {
      return Promise.all((m.icons || []).map(function (ic) {
        return (new Promise(function (res) {
          var im = new Image();
          im.onload = function () { add(im.naturalWidth >= 144, 'ikon ' + ic.src + ' ' + im.naturalWidth + 'px'); res(); };
          im.onerror = function () { add(false, 'ikon ' + ic.src + ' GAGAL dimuat'); res(); };
          im.src = ic.src;
        }));
      }));
    }).catch(function (e) { add(false, 'manifest.json tidak terbaca'); }));
    tasks.push(fetch('/sw.js', { cache: 'no-store' }).then(function (r) {
      add(r.ok && /javascript/.test(r.headers.get('content-type') || ''), 'sw.js status ' + r.status);
    }).catch(function () { add(false, 'sw.js tidak terbaca'); }));
    if ('serviceWorker' in navigator) {
      tasks.push(navigator.serviceWorker.getRegistration('/').then(function (reg) {
        add(!!reg && !!reg.active, 'service worker aktif' + (reg && reg.active ? '' : ' (belum)'));
      }).catch(function () { add(false, 'service worker error'); }));
    }
    return Promise.all(tasks).then(function () { return out.join('\n'); });
  }


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
      diag().then(function (txt) {
        alert('Chrome belum memberi izin install.\n\nHasil pengecekan:\n' + txt +
          '\nBuka menu browser (titik tiga) -> "Instal aplikasi" bila ada. Kirim isi pesan ini ke pengembang bila tidak bisa.');
      });
    }
  });
})();
