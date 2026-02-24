/*!
 * fix-chapter-images.js
 * Auto-convert Blogger image URLs to /s0-rw/ (original size, no blur)
 * + IntersectionObserver lazy load dengan preload margin 500px
 */
(function () {

  // Konversi URL Blogger ke ukuran asli (tidak blur)
  function toOriginalSize(src) {
    if (!src || src.indexOf('data:') === 0) return src;
    if (src.indexOf('blogger.googleusercontent.com') === -1 &&
        src.indexOf('bp.blogspot.com') === -1) return src;

    src = src.replace(/\/s\d+(-c)?(-rw)?\//g, '/s0-rw/');   // /s1600/ → /s0-rw/
    src = src.replace(/=s\d+(-c)?(-rw)?$/, '=s0-rw');        // =s1600  → =s0-rw
    src = src.replace(/\/w\d+-h\d+(-[^/]*)?\//g, '/s0-rw/'); // /w800-h600/ → /s0-rw/
    return src;
  }

  // Setup lazy load dengan IntersectionObserver
  function setupLazyLoad(imgs) {
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(function (img) {
        var s = img.getAttribute('data-lazy-src');
        if (s) img.src = s;
      });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        var src = img.getAttribute('data-lazy-src');
        if (src) {
          img.src = src;
          img.removeAttribute('data-lazy-src');
        }
        obs.unobserve(img);
      });
    }, { rootMargin: '500px 0px', threshold: 0 });

    imgs.forEach(function (img) { obs.observe(img); });
  }

  // Proses gambar di semua container chapter
  function fixChapterImages() {
    var selectors = [
      '#reader img',
      '.manga-reader img',
      '.manga-pages img',
      '#output_chapter img'
    ];

    var seen = new Set();
    var toLoad = [];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (img) {
        if (seen.has(img)) return;
        seen.add(img);

        var orig = img.getAttribute('src') || '';
        if (!orig || orig.indexOf('data:') === 0) return;

        var fixed = toOriginalSize(orig);
        if (fixed === orig) return;

        // Simpan URL asli, pasang placeholder SVG transparan
        img.setAttribute('data-lazy-src', fixed);
        var w = img.getAttribute('width') || '800';
        var h = img.getAttribute('height') || '300';
        img.src = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%22'
          + w + '%22 height%3D%22' + h + '%22%3E%3C%2Fsvg%3E';
        toLoad.push(img);
      });
    });

    if (toLoad.length) setupLazyLoad(toLoad);
  }

  // Jalankan setelah DOM + manga reader selesai initialize
  function run() { setTimeout(fixChapterImages, 250); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Pantau jika gambar di-inject belakangan (generator / dynamic load)
  if ('MutationObserver' in window) {
    var timer;
    new MutationObserver(function (mutations) {
      var hit = mutations.some(function (m) {
        return Array.prototype.some.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return false;
          return n.id === 'reader' ||
            n.id === 'output_chapter' ||
            (n.classList && (n.classList.contains('manga-reader') || n.classList.contains('manga-pages'))) ||
            !!(n.querySelector && n.querySelector('#reader img, .manga-reader img, .manga-pages img, #output_chapter img'));
        });
      });
      if (hit) { clearTimeout(timer); timer = setTimeout(fixChapterImages, 150); }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

})();
