/* Ubah URL gambar Blogger di #reader menjadi s0 (ukuran asli) */
(function () {
  var HOST = /(?:^|\.)(?:googleusercontent\.com|bp\.blogspot\.com)$/i;
  var PATH = /\/((?:s|w)\d+(?:-h\d+)?(?:-[a-z]+)*)\/([^\/?#]*)$/i;
  var PARAM = /=((?:s|w)\d+(?:-h\d+)?(?:-[a-z]+)*)$/i;

  function toS0(u) {
    var h;
    try { h = new URL(u, location.href).hostname; } catch (e) { return u; }
    if (!HOST.test(h)) return u;
    if (PATH.test(u)) return u.replace(PATH, '/s0/$2');
    if (PARAM.test(u)) return u.replace(PARAM, '=s0');
    return u;
  }

  function fix(img) {
    var s = img.getAttribute('src');
    if (!s) return;
    var n = toS0(s);
    if (n !== s) {
      img.removeAttribute('srcset');
      img.setAttribute('src', n);
    }
  }

  function fixAll(root) {
    var imgs = root.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) fix(imgs[i]);
  }

  function start() {
    var r = document.getElementById('reader');
    if (!r) return;
    fixAll(r);
    new MutationObserver(function () { fixAll(r); })
      .observe(r, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
