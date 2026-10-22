/* langitoren: author-cache.js (diekstrak dari tema, baris 12956) */
//
(function(){
  var API_KEY = 'AIzaSyC7KzzyDxOWAgulH1nSB5jbeukfPsP4Exk';
  var BLOG_ID = '7136353989302788145';

  // Cache nama -> {name}
  var _authorCache = {};
  // Cache postUrl -> {name}
  var _urlCache = {};
  var _fetched = false;

  // ── Normalize URL untuk matching ────────────────────────────────────────────
  function _normalizeUrl(u) {
    if (!u) return '';
    return u.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\?.*$/, '').toLowerCase();
  }

  // ── Terapkan nama author ke elemen DOM (tanpa avatar, tanpa link profil) ────
  function _applyName(nameEl, authorName) {
    if (!nameEl || !authorName) return;
    nameEl.textContent = authorName; // tampilkan dulu nama Blogger apa adanya
    // Kalau uploader ini sudah dipetakan admin ke akun Firebase (koleksi
    // 'uploader_map'), ganti tampilan ke username Firebase + badge role
    // (Translator/Mod/Dev). Tidak ada mapping = tetap pakai nama Blogger di atas.
    if (typeof window.LO_applyUploaderToEl === 'function') {
      window.LO_applyUploaderToEl(nameEl, authorName);
    }
  }

  // ── Cocokkan cache ke semua baris chapter list ───────────────────────────────
  function applyAuthorToRows(authorMap, urlMap) {
    // Strategi 1: elemen dengan data-author yang valid
    document.querySelectorAll('[data-author]').forEach(function(li) {
      var name = li.getAttribute('data-author');
      var authorName = null;

      // Coba cocokkan berdasarkan nama
      if (name && authorMap[name]) {
        authorName = authorMap[name].name;
      }

      // Jika tidak ditemukan, coba cocokkan berdasarkan URL
      if (!authorName && urlMap) {
        var chUrl = li.getAttribute('data-ch-url') || '';
        var linkEl = li.querySelector('a[href]');
        if (!chUrl && linkEl) chUrl = linkEl.getAttribute('href') || '';
        var normUrl = _normalizeUrl(chUrl);
        if (normUrl && urlMap[normUrl]) {
          authorName = urlMap[normUrl].name;
          if (authorName) li.setAttribute('data-author', authorName);
        }
      }

      if (!authorName) return;
      var nameEl = li.querySelector('.ch-uploader-name');
      _applyName(nameEl, authorName);
    });

    // Strategi 2: elemen dengan data-ch-url tapi tanpa data-author (npXbottom dll)
    document.querySelectorAll('[data-ch-url]').forEach(function(li) {
      if (li.hasAttribute('data-author') && li.getAttribute('data-author')) return;
      var nameEl = li.querySelector('.ch-uploader-name');
      if (!nameEl) return;

      var chUrl = li.getAttribute('data-ch-url') || '';
      var normUrl = _normalizeUrl(chUrl);
      var authorName = null;

      if (normUrl && urlMap && urlMap[normUrl]) {
        authorName = urlMap[normUrl].name;
      }

      // Fallback: coba cocokkan berdasarkan nama yang sudah ada
      if (!authorName) {
        var existingName = nameEl.textContent.trim();
        if (existingName && existingName !== '...' && existingName !== 'Unknown' && authorMap[existingName]) {
          authorName = authorMap[existingName].name;
        }
      }

      if (!authorName) return;
      _applyName(nameEl, authorName);
    });

    // Strategi 3: elemen ch-uploader tanpa data-author & data-ch-url (static widget)
    document.querySelectorAll('.ch-uploader').forEach(function(el) {
      if (el.closest('[data-author]') || el.closest('[data-ch-url]')) return;
      var nameEl = el.querySelector('.ch-uploader-name');
      if (!nameEl) return;
      var name = nameEl.textContent.trim();
      if (!name || name === '...' || name === 'Unknown') return;
      if (authorMap[name]) {
        _applyName(nameEl, authorMap[name].name);
      }
    });
  }

  // ── Fetch semua author berdasarkan label (dengan URL post untuk matching) ───
  function fetchAuthorsByLabel(label, pageToken) {
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID
      + '/posts?labels=' + encodeURIComponent(label)
      + '&maxResults=50'
      + '&fields=items(url,author/displayName),nextPageToken'
      + '&key=' + API_KEY;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = data.items || [];
        items.forEach(function(p){
          var a = p.author || {};
          var name = (a.displayName || '').trim();
          if (!name) return;

          var authorObj = { name: name };
          if (!_authorCache[name]) {
            _authorCache[name] = authorObj;
          }

          // Simpan mapping URL post -> author
          if (p.url) {
            var normUrl = _normalizeUrl(p.url);
            if (normUrl) _urlCache[normUrl] = authorObj;
          }
        });

        applyAuthorToRows(_authorCache, _urlCache);

        if (data.nextPageToken) {
          fetchAuthorsByLabel(label, data.nextPageToken);
        }
      })
      .catch(function(e){ console.warn('ch-uploader fetch error:', e); });
  }

  // ── Deteksi label ──────────────────────────────────────────────────────────
  function detectLabel() {
    if (typeof clwd !== 'undefined' && clwd.settings && clwd.settings.cat) {
      return clwd.settings.cat;
    }
    var labelMeta = document.querySelector('meta[property="article:tag"]');
    if (labelMeta) return labelMeta.getAttribute('content').split(',')[0].trim();
    return null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.chUploaderFetch = function(labelOverride) {
    var label = labelOverride || detectLabel();
    if (!label) { console.warn('ch-uploader: label tidak terdeteksi.'); return; }
    if (_fetched) { applyAuthorToRows(_authorCache, _urlCache); return; }
    _fetched = true;
    fetchAuthorsByLabel(label, null);
  };

  // ── Auto-run ──────────────────────────────────────────────────────────────
  function tryRun(attempt) {
    var label = detectLabel();
    var rows  = document.querySelectorAll('.ch-uploader, [data-author], [data-ch-url]');
    if (label && rows.length > 0) {
      window.chUploaderFetch();
    } else if (attempt < 20) {
      setTimeout(function(){ tryRun(attempt + 1); }, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ tryRun(0); }, 500); });
  } else {
    setTimeout(function(){ tryRun(0); }, 500);
  }
})();
//
