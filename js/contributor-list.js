/* langitoren: contributor-list.js (diekstrak dari tema, baris 6813) */
(function(){
  var API_KEY_CONTRIB = 'AIzaSyC7KzzyDxOWAgulH1nSB5jbeukfPsP4Exk';
  var BLOG_ID_CONTRIB = '7136353989302788145';

  // Render satu kartu kontributor (klik buka modal)
  function renderContrib(a) {
    var avatarUrl = (a.image && a.image.url)
      ? a.image.url.replace(/=s\d+(-c)?/, '=s80-c')
      : '';
    var avatarHires = (a.image && a.image.url)
      ? a.image.url.replace(/=s\d+(-c)?/, '=s0')
      : '';
    var name = a.displayName || 'Unknown';
    var safeName = name.replace(/"/g,'&quot;');
    // Nama & avatar kontributor: kartu ini masih dititlekan dari akun Blogger
    // (name, avatarUrl) sebagai fallback, tapi span nama dan <img> avatar diberi
    // atribut data-lo-uploader / data-lo-uploader-avatar supaya LO_scanUploaderSpans()
    // dan LO_scanUploaderAvatars() bisa menggantinya ke username + foto profil akun
    // Firebase kalau uploader ini sudah dipetakan admin lewat koleksi 'uploader_map'.
    // Kalau tidak ada mapping (atau akun Firebase-nya belum punya avatar), tampilan
    // Blogger di bawah ini tetap dipakai apa adanya.
    return '<div onclick="openContribModal(\x27' + encodeURIComponent(name) + '\x27,\x27' + encodeURIComponent(avatarHires) + '\x27)" class="flex items-center gap-2 group mb-1.5 cursor-pointer" title="' + name + '">'
      + '<span class="block w-8 h-8 rounded-full flex-shrink-0 relative overflow-hidden" style="padding:2px;background:linear-gradient(135deg,var(--accent,#58a1c8),var(--accent-dark,#2d7aaa));box-shadow:0 0 0 2px var(--accent,#58a1c8)">'
      + '<span class="w-full h-full rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold absolute inset-0">' + name.charAt(0).toUpperCase() + '</span>'
      + '<img src="' + (avatarUrl || '') + '" alt="' + name + '" data-lo-uploader-avatar="' + safeName + '" class="w-full h-full rounded-full object-cover absolute inset-0" loading="lazy" style="display:' + (avatarUrl ? 'block' : 'none') + '" onerror="this.style.display=\x27none\x27"/>'
      + '</span>'
      + '<span class="text-gray-700 dark:text-gray-300 text-xs font-medium group-hover:text-accent transition-colors" data-lo-uploader="' + safeName + '">' + name + '</span>'
      + '</div>';
  }

  function fetchContribByLabel(label, pageToken, seen, box) {
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID_CONTRIB
      + '/posts?labels=' + encodeURIComponent(label)
      + '&maxResults=50'
      + '&fields=items(author/displayName,author/url,author/image/url),nextPageToken'
      + '&key=' + API_KEY_CONTRIB;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = data.items || [];
        items.forEach(function(p){
          var a = p.author || {};
          var name = (a.displayName || '').trim();
          if (!name || seen[name]) return;
          seen[name] = a;
          box.insertAdjacentHTML('beforeend', renderContrib(a));
        });
        // Hapus placeholder loading jika sudah ada isi
        var placeholder = box.querySelector('.contrib-placeholder');
        if (placeholder && Object.keys(seen).length > 0) placeholder.remove();
        // Ganti nama Blogger -> username Firebase (+ badge role) kalau ada mapping-nya
        if (typeof window.LO_scanUploaderSpans === 'function') window.LO_scanUploaderSpans(box);
        // Ganti avatar Blogger -> foto profil akun Firebase kalau ada & tersedia
        if (typeof window.LO_scanUploaderAvatars === 'function') window.LO_scanUploaderAvatars(box);

        if (data.nextPageToken) {
          fetchContribByLabel(label, data.nextPageToken, seen, box);
        } else if (Object.keys(seen).length === 0 && !box.querySelector('[data-lo-uploader]')) {
          box.innerHTML = '<span class="text-gray-400 dark:text-gray-500 text-xs">-</span>';
        }
      })
      .catch(function(){
        if (Object.keys(seen).length === 0 && !box.querySelector('[data-lo-uploader]')) {
          box.innerHTML = '<span class="text-gray-400 dark:text-gray-500 text-xs">-</span>';
        }
      });
  }

  function loadContributors() {
    var box = document.getElementById('aside-contributor-list');
    if (!box) return;

    // Deteksi label dari clwd (lebih akurat) atau meta tag
    var label = '';
    if (typeof clwd !== 'undefined' && clwd.settings && clwd.settings.cat) {
      label = clwd.settings.cat;
    } else {
      var labelMeta = document.querySelector('meta[property="article:tag"]');
      if (labelMeta) label = labelMeta.getAttribute('content').split(',')[0].trim();
    }

    if (!label) {
      if (!box.querySelector('[data-lo-uploader]')) {
        box.innerHTML = '<span class="text-gray-400 dark:text-gray-500 text-xs">-</span>';
      }
      return;
    }

    // Tambahkan class ke placeholder agar bisa dihapus nanti
    var ph = box.querySelector('.flex.items-center');
    if (ph) ph.classList.add('contrib-placeholder');

    // Jangan duplikasi nama yang sudah ditulis oleh auto-fill (dari data feed clwd)
    var seenInit = {};
    box.querySelectorAll('[data-lo-uploader]').forEach(function(el){
      var n = el.getAttribute('data-lo-uploader');
      if (n) seenInit[n] = true;
    });

    fetchContribByLabel(label, null, seenInit, box);
  }

  // Tunggu clwd siap (bisa lebih lambat dari DOMContentLoaded)
  function tryLoadContrib(attempt) {
    var box = document.getElementById('aside-contributor-list');
    if (!box) return;
    // clwd biasanya inject settings setelah beberapa ratus ms
    var hasClwd = typeof clwd !== 'undefined' && clwd.settings && clwd.settings.cat;
    var hasMeta = !!document.querySelector('meta[property="article:tag"]');
    if (hasClwd || hasMeta) {
      loadContributors();
    } else if (attempt < 10) {
      setTimeout(function(){ tryLoadContrib(attempt + 1); }, 400);
    } else {
      loadContributors(); // fallback tetap jalankan
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ tryLoadContrib(0); }, 500); });
  } else {
    setTimeout(function(){ tryLoadContrib(0); }, 500);
  }
})();
