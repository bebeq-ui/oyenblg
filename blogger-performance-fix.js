/**
 * ============================================================
 *  BLOGGER MANGA THEME — PERFORMANCE FIX
 *  Oleh: Claude (Anthropic)
 * ============================================================
 *
 *  BERISI 3 PERBAIKAN:
 *  1. BCache — Cache engine (localStorage + IndexedDB, TTL 15 menit)
 *  2. BloggerScript.xhr() override — feed otomatis pakai cache
 *  3. MangaLazyLoad — IntersectionObserver untuk gambar chapter
 *
 *  CARA PASANG:
 *  Taruh kode ini di dalam tema Blogger kamu, sebelum tag </head>
 *  dalam sebuah <script> tag, SEBELUM BloggerScript digunakan.
 *
 *  Contoh:
 *    <script>
 *      // paste seluruh isi file ini di sini
 *    </script>
 * ============================================================
 */

(function () {
  'use strict';

  /* ============================================================
   *  BAGIAN 1: BCache — Cache Engine
   *  - localStorage  : untuk feed ringan (homepage, related, tab)
   *  - IndexedDB     : untuk data besar (chapter list, series)
   *  - TTL           : 15 menit (900.000 ms)
   * ============================================================ */

  var BCache = (function () {
    var TTL = 15 * 60 * 1000; // 15 menit dalam ms
    var PREFIX = 'bcache_';
    var IDB_NAME = 'BLoggerCache';
    var IDB_STORE = 'feeds';
    var IDB_VERSION = 1;
    var _db = null;

    // --- IndexedDB helper ---
    function openDB(callback) {
      if (_db) return callback(_db);
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function (e) {
        _db = e.target.result;
        callback(_db);
      };
      req.onerror = function () {
        callback(null);
      };
    }

    function idbSet(key, data, cb) {
      openDB(function (db) {
        if (!db) return cb && cb(false);
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ key: key, data: data, ts: Date.now() });
        tx.oncomplete = function () { cb && cb(true); };
        tx.onerror = function () { cb && cb(false); };
      });
    }

    function idbGet(key, cb) {
      openDB(function (db) {
        if (!db) return cb(null);
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () {
          var rec = req.result;
          if (rec && Date.now() - rec.ts < TTL) {
            cb(rec.data);
          } else {
            cb(null); // expired atau tidak ada
          }
        };
        req.onerror = function () { cb(null); };
      });
    }

    // --- localStorage helper ---
    function lsSet(key, data) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ data: data, ts: Date.now() }));
      } catch (e) { /* storage penuh, skip */ }
    }

    function lsGet(key) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        var rec = JSON.parse(raw);
        if (Date.now() - rec.ts < TTL) return rec.data;
        localStorage.removeItem(PREFIX + key); // expired
        return null;
      } catch (e) { return null; }
    }

    /**
     * Tentukan storage berdasarkan URL:
     * - URL yang mengandung "chapter" / panjang data besar → IndexedDB
     * - Sisanya → localStorage
     */
    function isLargeData(url) {
      return /chapter|chapterlist|max-results=([5-9]\d|[1-9]\d{2})/i.test(url);
    }

    return {
      /**
       * get(key, callback)
       * callback(data) → data = hasil cache atau null jika tidak ada / expired
       */
      get: function (key, cb) {
        if (isLargeData(key)) {
          idbGet(key, cb);
        } else {
          cb(lsGet(key));
        }
      },

      /**
       * set(key, data)
       */
      set: function (key, data) {
        if (isLargeData(key)) {
          idbSet(key, data);
        } else {
          lsSet(key, data);
        }
      },

      /**
       * invalidate(prefix) — hapus semua cache yang key-nya mengandung prefix
       * Berguna saat kamu upload post baru dan ingin refresh manual
       * Panggil: BCache.invalidate() untuk hapus semua
       */
      invalidate: function (prefix) {
        // localStorage
        var keys = Object.keys(localStorage);
        keys.forEach(function (k) {
          if (k.startsWith(PREFIX) && (!prefix || k.includes(prefix))) {
            localStorage.removeItem(k);
          }
        });
        // IndexedDB — hapus semua
        openDB(function (db) {
          if (!db) return;
          var tx = db.transaction(IDB_STORE, 'readwrite');
          if (!prefix) {
            tx.objectStore(IDB_STORE).clear();
          } else {
            var req = tx.objectStore(IDB_STORE).openCursor();
            req.onsuccess = function (e) {
              var cursor = e.target.result;
              if (cursor) {
                if (cursor.key.includes(prefix)) cursor.delete();
                cursor.continue();
              }
            };
          }
        });
        console.log('[BCache] Cache di-invalidate:', prefix || 'semua');
      }
    };
  })();

  // Expose BCache ke window supaya bisa dipanggil manual
  window.BCache = BCache;


  /* ============================================================
   *  BAGIAN 2: Patch BloggerScript.xhr()
   *  Override method xhr() di class BloggerScript agar setiap
   *  request feed dicek ke cache dulu sebelum hit network.
   * ============================================================ */

  // Kita patch setelah DOM siap supaya BloggerScript sudah terdefinisi
  function patchBloggerScript() {
    if (typeof BloggerScript === 'undefined') return;

    var _origProto = BloggerScript.prototype;

    // Simpan xhr asli
    var _originalXhr = _origProto.xhr;

    /**
     * xhr() baru: cek cache dulu, kalau ada langsung panggil callback.
     * Kalau tidak ada, jalankan xhr asli lalu simpan hasilnya ke cache.
     */
    _origProto.xhr = function (method, url, callback) {
      var self = this;

      // Hanya cache GET request ke Blogger feed
      if (method.toUpperCase() !== 'GET' || !url.includes('feeds/posts')) {
        return _originalXhr.call(self, method, url, callback);
      }

      BCache.get(url, function (cached) {
        if (cached) {
          // Cache hit — langsung panggil callback dengan data cache
          // console.log('[BCache] HIT:', url);
          try { callback && callback(cached); } catch (e) {}
          return;
        }

        // Cache miss — jalankan request asli
        var _origCallback = callback;
        var wrappedCallback = function (data) {
          // Simpan ke cache sebelum diteruskan
          BCache.set(url, data);
          try { _origCallback && _origCallback(data); } catch (e) {}
        };

        _originalXhr.call(self, method, url, wrappedCallback);
      });
    };

    // Patch juga method fetch() yang digunakan di beberapa bagian tema
    // (bukan BloggerScript.fetch, tapi window.fetch wrapper)
    var _origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input.url;
      if (!url || !url.includes('/feeds/posts')) {
        return _origFetch.apply(window, arguments);
      }

      return new Promise(function (resolve, reject) {
        BCache.get(url, function (cached) {
          if (cached) {
            // Buat fake Response dari cache
            var fakeResponse = new Response(JSON.stringify(cached), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
            resolve(fakeResponse);
            return;
          }

          _origFetch.apply(window, [input, init])
            .then(function (response) {
              var clone = response.clone();
              clone.json().then(function (data) {
                BCache.set(url, data);
              }).catch(function(){});
              resolve(response);
            })
            .catch(reject);
        });
      });
    };

    console.log('[BCache] BloggerScript.xhr() berhasil di-patch.');
  }

  // Patch setelah semua script selesai load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(patchBloggerScript, 0);
    });
  } else {
    setTimeout(patchBloggerScript, 0);
  }


  /* ============================================================
   *  BAGIAN 3: MangaLazyLoad — Lazy Load Gambar Chapter
   *  Menggantikan loading="lazy" native dengan IntersectionObserver
   *  yang lebih agresif (rootMargin 500px) agar gambar berikutnya
   *  sudah mulai diunduh sebelum user scroll ke sana.
   * ============================================================ */

  var MangaLazyLoad = (function () {

    // Gambar yang sudah diobservasi, hindari duplikat
    var _observed = new WeakSet();

    // Buat satu observer, dipakai ulang untuk semua gambar
    var _observer = null;

    function getObserver() {
      if (_observer) return _observer;
      _observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          var src = img.dataset.lazySrc || img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-lazy-src');
            img.removeAttribute('data-src');
            // Hapus skeleton saat gambar selesai load
            img.onload = function () {
              img.classList.add('manga-img-loaded');
              var skel = img.previousElementSibling;
              if (skel && skel.classList.contains('skeleton')) {
                skel.remove();
              }
            };
          }
          _observer.unobserve(img);
        });
      }, {
        rootMargin: '500px 0px', // preload 500px sebelum masuk viewport
        threshold: 0
      });
      return _observer;
    }

    /**
     * observe(container)
     * Cari semua <img> di dalam container, pindahkan src ke data-lazy-src
     * agar tidak langsung diunduh, lalu observasi dengan IntersectionObserver.
     */
    function observe(container) {
      if (!container) return;
      var imgs = container.querySelectorAll('img');
      var observer = getObserver();

      imgs.forEach(function (img) {
        if (_observed.has(img)) return;
        _observed.add(img);

        // Gambar pertama langsung load (tidak lazy) agar cepat tampil
        // Gambar ke-2 dst baru di-lazy
        var idx = Array.prototype.indexOf.call(imgs, img);
        if (idx < 2) {
          // Gambar pertama dan kedua: biarkan load normal
          return;
        }

        // Pindahkan src ke data-lazy-src
        var currentSrc = img.getAttribute('src');
        if (currentSrc && !currentSrc.startsWith('data:')) {
          img.setAttribute('data-lazy-src', currentSrc);
          // Pasang placeholder transparan agar layout tidak loncat
          img.src = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%22800%22 height%3D%221200%22%3E%3C%2Fsvg%3E';
        }

        // Hapus loading="lazy" native supaya tidak konflik
        img.removeAttribute('loading');

        observer.observe(img);
      });
    }

    /**
     * Auto-init: tunggu sampai #output_chapter atau .manga-reader ada di DOM
     * Pakai MutationObserver untuk mendeteksi saat konten chapter di-render
     */
    function autoInit() {
      // Langsung cek dulu
      var targets = [
        document.getElementById('output_chapter'),
        document.querySelector('.manga-reader'),
        document.querySelector('#reader')
      ];

      targets.forEach(function (el) {
        if (el) observe(el);
      });

      // MutationObserver: pantau kalau konten baru di-inject ke DOM
      var domObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            // Cek apakah node atau descendant-nya adalah target kita
            if (
              node.id === 'output_chapter' ||
              node.classList.contains('manga-reader') ||
              node.id === 'reader'
            ) {
              observe(node);
            }
            // Cek child juga
            var inner = node.querySelector('#output_chapter, .manga-reader, #reader');
            if (inner) observe(inner);
          });
        });
      });

      domObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    return {
      init: autoInit,
      observe: observe
    };
  })();

  // Jalankan MangaLazyLoad setelah DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MangaLazyLoad.init);
  } else {
    MangaLazyLoad.init();
  }

  // Expose ke window
  window.MangaLazyLoad = MangaLazyLoad;

  console.log('[Performance Fix] Loaded: BCache + MangaLazyLoad');

})();
