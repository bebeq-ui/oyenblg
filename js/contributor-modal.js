/* langitoren: contributor-modal.js (diekstrak dari tema, baris 6979) */
/* Contributor Modal Logic */
function _cmHexToRgb(hex) {
  hex = (hex || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c){ return c + c; }).join('');
  var n = parseInt(hex, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function _cmRgbToHex(r, g, b) {
  return '#' + [r, g, b].map(function(v) {
    return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  }).join('');
}
function _cmDarken(rgb, amount) {
  return _cmRgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}
function _cmIsDark() {
  return document.documentElement.classList.contains('dark');
}

function openContribModal(encodedName, encodedAvatar) {
  var name = decodeURIComponent(encodedName);
  var avatar = decodeURIComponent(encodedAvatar);
  var overlay = document.getElementById('contrib-modal-overlay');
  var box = document.getElementById('contrib-modal-box');
  var avatarImg = document.getElementById('contrib-modal-avatar');
  var nameEl = document.getElementById('contrib-modal-name');
  var seriesEl = document.getElementById('contrib-modal-series');
  var bannerWrap = document.getElementById('contrib-modal-banner');
  var bannerImg = document.getElementById('contrib-modal-banner-img');
  var header = document.getElementById('contrib-modal-header');
  var avatarWrap = document.getElementById('contrib-modal-avatar-wrap');
  var publicLink = document.getElementById('contrib-modal-public-link');
  var isDark = _cmIsDark();

  // Reset ke kondisi default tiap kali modal dibuka, supaya tidak "kebawa"
  // banner/warna/link dari kontributor sebelumnya sebelum data baru siap.
  // Default netral (belum tentu kontributor sudah simpan warna sendiri) tetap
  // mengikuti mode terang/gelap SITUS, bukan lagi selalu abu-abu gelap.
  bannerWrap.style.display = 'none';
  bannerImg.src = '';
  avatarWrap.style.transform = '';
  avatarWrap.style.marginBottom = '0.75rem';
  publicLink.style.display = 'none';
  box.style.background = isDark ? '#1f2937' : '#f7f5f2';
  box.style.setProperty('--cm-accent', '#58a1c8');
  box.style.setProperty('--cm-accent-dark', '#2d7aaa');

  nameEl.textContent = name; // fallback: nama akun Blogger
  if (avatar) {
    avatarImg.src = avatar;
    avatarImg.alt = name;
    avatarImg.style.display = 'block';
  } else {
    avatarImg.style.display = 'none';
  }

  // Kalau uploader ini sudah dipetakan admin ke akun Firebase (koleksi
  // 'uploader_map'), tampilkan username + badge role, avatar & banner akun
  // itu, warna aksen yang DIA SENDIRI simpan di profilnya (bukan aksen situs
  // milik pengunjung), dan link ke halaman profil publiknya -- persis seperti
  // tampilan halaman profil.
  if (typeof window.LO_resolveUploaderDisplay === 'function') {
    window.LO_resolveUploaderDisplay(name, function(res) {
      if (!res) return; // tidak ada mapping -> tetap pakai fallback Blogger di atas

      if (res.html) nameEl.innerHTML = res.html;
      if (res.avatar) { avatarImg.src = res.avatar; avatarImg.style.display = 'block'; }

      if (res.uid) {
        publicLink.href = '/u?uid=' + encodeURIComponent(res.uid);
        publicLink.style.display = 'inline-block';
      }

      var rgb = res.themeColor ? _cmHexToRgb(res.themeColor) : null;
      if (rgb) {
        box.style.setProperty('--cm-accent', res.themeColor);
        box.style.setProperty('--cm-accent-dark', _cmDarken(rgb, .3));
        // Warna solid (bukan gradasi, bukan transparan) yang ikut aksen kontributor --
        // dicampur (bukan alpha) supaya tetap opaque, tidak tembus ke backdrop gelap
        // di belakang modal.
        var mix = isDark
          ? { base: { r: 31, g: 41, b: 55 }, amt: .28 }   // #1f2937
          : { base: { r: 255, g: 253, b: 250 }, amt: .14 }; // #fffdfa
        var blended = _cmRgbToHex(
          rgb.r * mix.amt + mix.base.r * (1 - mix.amt),
          rgb.g * mix.amt + mix.base.g * (1 - mix.amt),
          rgb.b * mix.amt + mix.base.b * (1 - mix.amt)
        );
        box.style.background = blended;
      }

      if (res.banner) {
        bannerImg.src = res.banner;
        bannerWrap.style.display = 'block';
        // Ada banner: avatar digeser naik pakai transform (translateY) supaya numpuk
        // di tepi bawah banner. marginBottom negatif dipakai bareng supaya elemen
        // sesudahnya (nama, link) ikut naik mengisi jarak, tanpa avatar-nya sendiri
        // pernah "keluar" dari box layout normal (yang bisa kepotong scroll area
        // kalau dulu dipakai margin-top negatif di header).
        avatarWrap.style.transform = 'translateY(-44px)';
        avatarWrap.style.marginBottom = '-44px';
      }
    });
  }

  seriesEl.innerHTML = '<div style="text-align:center;padding:1.5rem 0;"><div style="width:24px;height:24px;border:2px solid #4b5563;border-top-color:#58a1c8;border-radius:50%;animation:cmspin .6s linear infinite;margin:0 auto;"></div></div>';
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Fetch series by this contributor
  fetchContribSeries(name, seriesEl);
}

function closeContribModal(e) {
  if (e && e.target && e.target.id !== 'contrib-modal-overlay') return;
  var overlay = document.getElementById('contrib-modal-overlay');
  overlay.style.display = 'none';
  document.body.style.overflow = '';
}

/* ====================================================================
   FIX CLEAN URL: modal "Series Upload" sebelumnya memakai p.url MENTAH
   langsung dari Blogger API (host origin, path /YYYY/MM/slug.html),
   sehingga klik dari modal ini melewati Cloudflare Worker dan mendarat
   di URL asli, bukan clean-url. Helper di bawah membangun ulang slug
   dengan algoritma YANG SAMA PERSIS dengan worker-auto.js
   (extractSeriesLabel + buildSlugWithSeries), lalu dicocokkan (kalau
   bisa) ke endpoint /__popular-candidates milik Worker supaya hasilnya
   identik dengan mapping asli (termasuk kasus slug bentrok/-2, -3, dst).
   ==================================================================== */
var LO_CM_SERIES_EXCLUDE = ['Chapter','Comic','Project','Lock','Free','New','NSFW','End','Fix','novelread',
  'Series','Manga','Manhwa','Manhua','Ongoing','Completed','Dropped','Cooming Soon','Ecchi','Hentai','18+','pinned'];
var LO_CM_CHAPTER_REGEX = /^ch\.?\s*\d+/i;

function LO_cmExtractSeriesLabel(labels) {
  var candidates = (labels || []).filter(function(name) {
    if (LO_CM_SERIES_EXCLUDE.indexOf(name) !== -1) return false;
    if (LO_CM_CHAPTER_REGEX.test(name)) return false;
    return true;
  });
  return candidates.length ? candidates[0] : null;
}
function LO_cmSlugifySeriesId(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function LO_cmBuildSlugWithSeries(rawSlug, seriesLabel) {
  if (!seriesLabel) return rawSlug;
  var seriesSlug = LO_cmSlugifySeriesId(seriesLabel);
  if (!seriesSlug) return rawSlug;
  if (rawSlug.indexOf(seriesSlug) === 0) return rawSlug;
  return seriesSlug + '-' + rawSlug;
}
// Fallback: hitung sendiri clean-url-nya (dipakai kalau belum ketemu di /__popular-candidates)
function LO_cmBuildCleanLink(rawUrl, labels) {
  try {
    var u = new URL(rawUrl);
    var rawSlug = null;
    var m = u.pathname.match(/^\/(\d{4})\/(\d{2})\/([^\/]+)\.html$/);
    if (m) rawSlug = m[3];
    else {
      var pm = u.pathname.match(/^\/p\/([^\/]+)\.html$/);
      if (pm) rawSlug = pm[1];
    }
    if (!rawSlug) return location.origin + u.pathname;
    var seriesLabel = LO_cmExtractSeriesLabel(labels);
    var slug = LO_cmBuildSlugWithSeries(rawSlug, seriesLabel);
    return location.origin + '/' + slug;
  } catch (e) { return rawUrl; }
}
// Ambil mapping resmi dari Worker (sekali per page-load, di-cache).
var LO_cmPopularCandidatesPromise = null;
function LO_cmGetPopularCandidatesMap() {
  if (!LO_cmPopularCandidatesPromise) {
    LO_cmPopularCandidatesPromise = fetch('/__popular-candidates')
      .then(function(r){ return r.json(); })
      .then(function(data){
        var map = {};
        (data.items || []).forEach(function(it){
          if (it.title) map[it.title.trim()] = it.url;
        });
        return map;
      })
      .catch(function(){ return {}; });
  }
  return LO_cmPopularCandidatesPromise;
}

/* ====================================================================
   FIX "Series Upload" pada modal kontributor: sebelumnya fungsi ini
   cuma mencari post berlabel tipe utama (Manga/Manhwa/Manhua) yang
   DIUPLOAD LANGSUNG oleh kontributor tsb. Akibatnya kontributor yang
   cuma upload chapter (bukan post info series-nya sendiri) tidak
   pernah muncul di "Series Upload"-nya, walau dia tetap muncul di
   kotak "Anggota yang berkontribusi" pada post series (karena kotak
   itu memang query per-label, bukan per-author).

   Fix: series & semua chapternya dihubungkan lewat SATU label yang
   sama persis dengan nama series yang dipasang di
     tag script clwd.run('nama series') di HTML post series
   pada HTML post info series-nya (lihat instruksi user). Jadi:
   1) Cari semua post "master" (berlabel salah satu mainTypeLabels)
      lalu ambil nama series-nya langsung dari clwd.run(...) di
      content post itu (fallback: tebak dari label kalau clwd.run
      tidak ketemu di content yang diambil API).
   2) Untuk tiap series, cek SEMUA post (post info + seluruh chapter)
      yang berlabel nama series itu, kumpulkan semua author-nya.
   3) Kontributor ini dianggap "upload" series tsb kalau namanya ada
      di kumpulan author itu -- tidak peduli dia upload post info-nya
      atau cuma satu chapter saja.

   Hasil crawl di-cache per page-load (LO_cmGetSeriesData) supaya buka
   modal kontributor lain di halaman yang sama tidak query ulang dari
   nol -- cukup difilter ulang di sisi client.
   ==================================================================== */
var LO_cmSeriesDataPromise = null;

function LO_cmExtractClwdLabel(content) {
  if (!content) return null;
  var m = content.match(/clwd\.run\(\s*['"]([^'"]+)['"]\s*\)/);
  return m ? m[1].trim() : null;
}

function LO_cmSeriesImage(p) {
  var img = '';
  if (p.images && p.images[0] && p.images[0].url) {
    img = p.images[0].url.replace(/=s\d+(-c)?/, '=s300');
  } else if (p.content) {
    var m = p.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1]) img = m[1].replace(/=s\d+(-c)?/, '=s300');
  }
  if (!img) img = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" fill="%23374151"><rect width="200" height="280"/><text x="100" y="150" text-anchor="middle" fill="%236b7280" font-size="14">No Cover</text></svg>');
  return img;
}

/* ── Cache hasil crawl series di localStorage (10 menit) ──
   Fungsi ini crawl SELURUH series & chapter di blog (bukan cuma yang
   berhubungan dengan kontributor yang sedang dibuka modalnya) lewat
   Blogger API. Tanpa cache, tiap kali ada pengunjung buka modal
   kontributor di post manapun akan memicu crawl ulang dari nol --
   kalau pengunjungnya banyak & series/chapternya sudah banyak, ini
   bisa cepat menghabiskan kuota harian Blogger API. Dengan cache ini,
   pengunjung yang sama (browser yang sama) buka beberapa modal
   kontributor dalam 10 menit cukup crawl sekali. Cache ini juga
   dipakai bersama oleh halaman profil publik (key beda, tapi TTL
   sama) supaya makin jarang crawl ulang.
   ==================================================================== */
var LO_CM_SERIES_CACHE_KEY = 'lo_cm_series_cache_v1';
var LO_CM_SERIES_CACHE_TTL = 10 * 60 * 1000; // 10 menit

function LO_cmLoadSeriesCache() {
  try {
    var raw = localStorage.getItem(LO_CM_SERIES_CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.ts || (Date.now() - obj.ts) > LO_CM_SERIES_CACHE_TTL) return null;
    return obj.data || null;
  } catch (e) { return null; }
}
function LO_cmSaveSeriesCache(data) {
  try {
    localStorage.setItem(LO_CM_SERIES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
  } catch (e) { /* storage penuh/nonaktif -- abaikan, tetap jalan tanpa cache */ }
}

function LO_cmGetSeriesData() {
  if (LO_cmSeriesDataPromise) return LO_cmSeriesDataPromise;

  var cached = LO_cmLoadSeriesCache();
  if (cached) {
    LO_cmSeriesDataPromise = Promise.resolve(cached);
    return LO_cmSeriesDataPromise;
  }

  var API_KEY = 'AIzaSyC7KzzyDxOWAgulH1nSB5jbeukfPsP4Exk';
  var BLOG_ID = '7136353989302788145';
  var mainTypeLabels = ['Manga','Manhwa','Manhua','Novel','LN','WN','Doujin'];
  var seriesMasters = [];
  var seenMasterUrl = {};

  function fetchMasterPosts(label, pageToken, onDone) {
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID
      + '/posts?labels=' + encodeURIComponent(label)
      + '&maxResults=50'
      + '&fields=' + encodeURIComponent('items(title,url,images/url,content,labels),nextPageToken')
      + '&key=' + API_KEY;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = data.items || [];
        items.forEach(function(p){
          if (!p.url || seenMasterUrl[p.url]) return;
          seenMasterUrl[p.url] = true;
          var labels = p.labels || [];
          // Nama series persis dari clwd.run(...) di content post ini.
          // Fallback: tebak dari label kalau clwd.run tidak ketemu.
          var seriesKey = LO_cmExtractClwdLabel(p.content) || LO_cmExtractSeriesLabel(labels);
          if (!seriesKey) return;
          seriesMasters.push({
            title: (p.title || '').trim(),
            link: LO_cmBuildCleanLink(p.url, labels),
            image: LO_cmSeriesImage(p),
            seriesKey: seriesKey
          });
        });
        if (data.nextPageToken) {
          fetchMasterPosts(label, data.nextPageToken, onDone);
        } else {
          onDone();
        }
      })
      .catch(function(){ onDone(); });
  }

  function fetchAuthorsForSeries(seriesKey, pageToken, authorsSet, updatedRef, onDone) {
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID
      + '/posts?labels=' + encodeURIComponent(seriesKey)
      + '&maxResults=50'
      + '&fields=' + encodeURIComponent('items(author/displayName,updated),nextPageToken')
      + '&key=' + API_KEY;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = data.items || [];
        items.forEach(function(p){
          var n = ((p.author && p.author.displayName) || '').trim();
          if (n) authorsSet[n] = true;
          // Catat waktu update TERBARU di antara semua post (series + tiap
          // chapter) yang berlabel series ini — dipakai buat urutan "terakhir
          // diupdate" di grid Series Upload (bukan cuma tanggal post series-nya).
          var t = p.updated ? Date.parse(p.updated) : 0;
          if (t && t > updatedRef.value) updatedRef.value = t;
        });
        if (data.nextPageToken) {
          fetchAuthorsForSeries(seriesKey, data.nextPageToken, authorsSet, updatedRef, onDone);
        } else {
          onDone(authorsSet, updatedRef.value);
        }
      })
      .catch(function(){ onDone(authorsSet, updatedRef.value); });
  }

  LO_cmSeriesDataPromise = new Promise(function(resolveAll){
    var pendingMain = mainTypeLabels.length;
    mainTypeLabels.forEach(function(lbl){
      fetchMasterPosts(lbl, null, function(){
        pendingMain--;
        if (pendingMain <= 0) afterMasters();
      });
    });

    function afterMasters() {
      // Satu series = satu seriesKey unik (post pertama yang ketemu jadi "master").
      var uniqueMasters = {};
      seriesMasters.forEach(function(sm){
        if (!uniqueMasters[sm.seriesKey]) uniqueMasters[sm.seriesKey] = sm;
      });
      var keys = Object.keys(uniqueMasters);
      if (keys.length === 0) {
        resolveAll({ masters: [], labelAuthors: {}, labelUpdated: {} });
        return;
      }
      var labelAuthors = {};
      var labelUpdated = {};
      var pending = keys.length;
      keys.forEach(function(key){
        fetchAuthorsForSeries(key, null, {}, { value: 0 }, function(authorsSet, lastUpdated){
          labelAuthors[key] = authorsSet;
          labelUpdated[key] = lastUpdated || 0;
          pending--;
          if (pending <= 0) {
            resolveAll({
              masters: keys.map(function(k){ return uniqueMasters[k]; }),
              labelAuthors: labelAuthors,
              labelUpdated: labelUpdated
            });
          }
        });
      });
    }
  }).then(function(data){
    LO_cmSaveSeriesCache(data);
    return data;
  }).catch(function(){ return { masters: [], labelAuthors: {}, labelUpdated: {} }; });

  return LO_cmSeriesDataPromise;
}

function LO_cmRenderContribSeriesGrid(container, foundSeries) {
  if (foundSeries.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:1rem 0;color:#6b7280;font-size:0.8rem;">Belum ada series.</div>';
    return;
  }
  // Cocokkan tiap item ke mapping resmi Worker dulu (lebih akurat,
  // termasuk kasus slug bentrok yang dapat suffix -2/-3). Kalau
  // gagal/tidak ketemu, tetap pakai hasil hitungan lokal (fallback)
  // yang sudah dipasang sebagai s.link sejak awal.
  LO_cmGetPopularCandidatesMap().then(function(map){
    foundSeries.forEach(function(s){
      if (map[s.title]) s.link = map[s.title];
    });
  }).catch(function(){}).then(function(){
    var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">';
    foundSeries.forEach(function(s) {
      html += '<a href="' + s.link + '" style="display:block;text-decoration:none;border-radius:0.5rem;overflow:hidden;background:#374151;background:color-mix(in srgb, var(--cm-accent, #58a1c8) 22%, #1f2937);">'
        + '<div style="position:relative;padding-bottom:140%;overflow:hidden;">'
        + '<img src="' + s.image + '" alt="' + s.title.replace(/"/g, '&quot;') + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"/>'
        + '</div>'
        + '<div style="padding:0.35rem 0.4rem;font-size:0.65rem;color:#d1d5db;color:color-mix(in srgb, var(--cm-accent, #58a1c8) 55%, #e5e7eb);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + s.title + '</div>'
        + '</a>';
    });
    html += '</div>';
    container.innerHTML = html;
  });
}

function fetchContribSeries(authorName, container) {
  LO_cmGetSeriesData().then(function(data){
    var result = (data.masters || []).filter(function(m){
      var authorsSet = data.labelAuthors[m.seriesKey] || {};
      return !!authorsSet[authorName];
    });
    // Series yang chapternya (atau post series-nya) terakhir diupdate
    // ditaruh paling atas/kiri (grid diisi berurutan kiri-ke-kanan,
    // atas-ke-bawah), sesuai urutan array ini.
    result.forEach(function(m){
      m.updated = (data.labelUpdated && data.labelUpdated[m.seriesKey]) || 0;
    });
    result.sort(function(a, b){ return b.updated - a.updated; });
    LO_cmRenderContribSeriesGrid(container, result);
  }).catch(function(){
    LO_cmRenderContribSeriesGrid(container, []);
  });
}
