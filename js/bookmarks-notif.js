/* langitoren: bookmarks-notif.js (diekstrak dari tema, baris 9569) */
/**/
/* ----
  Web Blog Bookmark With Browser Local Storage
  Created by: igniel.com
  Source code: https://www.igniel.com/2022/12/widget-bookmark-blog.html
---- */
const bookmarks = {
  maxWidget: 5,
  maxAll: 100,
  emptyText: 'Tidak ada bookmark',
  moreText: 'Lihat selengkapnya',
  currentText: 'Anda sedang melihat halaman bookmark',
  morePage: '/p/bookmark.html',
  deleteText: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3c-4.963 0-9 4.038-9 9s4.037 9 9 9s9-4.038 9-9s-4.037-9-9-9zm0 16c-3.859 0-7-3.14-7-7s3.141-7 7-7s7 3.14 7 7s-3.141 7-7 7zm.707-7l2.646-2.646a.502.502 0 0 0 0-.707a.502.502 0 0 0-.707 0L12 11.293L9.354 8.646a.5.5 0 0 0-.707.707L11.293 12l-2.646 2.646a.5.5 0 0 0 .707.708L12 12.707l2.646 2.646a.5.5 0 1 0 .708-.706L12.707 12z"></path></svg>'
};
/* ---- IndexedDB Bookmark Storage ---- */
const BM_DB = (() => {
  const DB_NAME = 'langitorenBM', STORE = 'bookmarks', VER = 1;
  let _db = null;
  const open = () => new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open(DB_NAME, VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e);
  });
  return {
    getAll: () => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    })),
    put: (item) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = res; tx.onerror = rej;
    })),
    delete: (id) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = rej;
    })),
    clear: () => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = res; tx.onerror = rej;
    })),
    putBulk: (items) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      items.forEach(i => st.put(i));
      tx.oncomplete = res; tx.onerror = rej;
    }))
  };
})();

/* ---- Notification & Bookmark System v3 ---- */
!function(d){
  let ignielbookmark = [];
  let fetchedUpdates = [], hasFetched = false;
  let notifReadMap = {};
  try { notifReadMap = JSON.parse(localStorage.getItem("ignielNotifRead")) || {}; } catch(e) {}

  // ── DOM refs (diambil setelah DOMContentLoaded) ─────────────────────────
  let badge = null, panel = null, bellBtn = null, markAllBtn = null;

  // ── Toast ────────────────────────────────────────────────────────────────
  let _toastEl = null, _toastTimer = null;
  const showToast = (msg, icon) => {
    if (!_toastEl) { _toastEl = d.createElement('div'); _toastEl.id = 'bm-toast'; d.body.appendChild(_toastEl); }
    clearTimeout(_toastTimer);
    _toastEl.innerHTML = '<span class="bm-toast-icon">' + (icon || '🔖') + '</span>' + msg;
    _toastEl.classList.add('show');
    _toastTimer = setTimeout(() => _toastEl.classList.remove('show'), 2200);
  };

  // ── Check state & sync visual ────────────────────────────────────────────
  const bmCek = () => {
    ignielbookmark.forEach(e => {
      const el = d.getElementById("bm-" + e.id);
      if (el) el.checked = true;
      const wrap = d.querySelector('.r-bookmark-wrap[data-bmid="' + e.id + '"]');
      if (wrap) wrap.classList.add('is-bookmarked');
    });
    d.querySelectorAll('.r-bookmark-wrap[data-bmid]').forEach(wrap => {
      const bmId = wrap.getAttribute('data-bmid');
      if (!ignielbookmark.find(b => b.id === bmId)) wrap.classList.remove('is-bookmarked');
    });
  };

  // ── Notif cache invalidation ──────────────────────────────────────────
  let _lastFetchTs = 0;
  const invalidateNotifCache = () => {
    try { localStorage.removeItem('ignielNotifCache'); } catch(e) {}
    hasFetched = false;
    fetchedUpdates = [];
  };

  // ── Firestore Sync Helper ────────────────────────────────────────────────
  const _getBmDb = () => {
    try {
      const fb = window.siteGetFirebase && window.siteGetFirebase();
      const uid = window.siteGetUser && window.siteGetUser() && window.siteGetUser().uid;
      if (fb && fb.db && uid) return { db: fb.db, uid };
    } catch(e) {}
    return null;
  };

  const _fsWrite = (item) => {
    const ctx = _getBmDb();
    if (!ctx) return;
    const data = {
      id: item.id, title: item.title || '', img: item.img || '',
      url: item.url || '', status: item.status || 'plan',
      type: item.type || '', seriesStatus: item.seriesStatus || '',
      addedAt: item.addedAt || firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    ctx.db.collection('user_bookmarks').doc(ctx.uid)
      .collection('bookmarks').doc(item.id).set(data, { merge: true })
      .catch(e => console.warn('BM Firestore write:', e));
  };

  const _fsDel = (id) => {
    const ctx = _getBmDb();
    if (!ctx) return;
    ctx.db.collection('user_bookmarks').doc(ctx.uid)
      .collection('bookmarks').doc(id).delete()
      .catch(e => console.warn('BM Firestore delete:', e));
  };

  // Pull dari Firestore → merge ke IndexedDB (dipanggil saat login)
  const _fsPull = async (uid) => {
    try {
      const fb = window.siteGetFirebase && window.siteGetFirebase();
      if (!fb || !fb.db) return;
      const snap = await fb.db.collection('user_bookmarks').doc(uid)
        .collection('bookmarks').get();

      const remote = snap.empty ? [] : snap.docs.map(d => d.data());
      const local  = await BM_DB.getAll();
      const remoteIds = new Set(remote.map(r => r.id));
      const localIds  = new Set(local.map(x => x.id));

      // 1. Tambah / update item dari Firestore ke local
      const toUpsert = [];
      for (const r of remote) {
        const loc = local.find(x => x.id === r.id);
        if (!loc) {
          // Item ada di Firestore tapi tidak di local: tambahkan
          toUpsert.push(r);
        } else if (loc.status !== r.status || loc.type !== r.type || loc.seriesStatus !== r.seriesStatus) {
          // Firestore selalu dianggap lebih baru
          loc.status = r.status;
          if (r.type) loc.type = r.type;
          if (r.seriesStatus) loc.seriesStatus = r.seriesStatus;
          loc.updatedAt = r.updatedAt || loc.updatedAt;
          toUpsert.push(loc);
        }
      }
      if (toUpsert.length > 0) await BM_DB.putBulk(toUpsert);

      // 2. Push item lokal yang belum ada di Firestore ke cloud
      const toPush = local.filter(x => !remoteIds.has(x.id));
      for (const item of toPush) {
        _fsWrite(item);
      }

      ignielbookmark = await BM_DB.getAll();
      updateBadge(); bmCek();
      // Bookmark baru saja disinkron dari cloud -> cache notif lama (yang dibuat
      // saat bookmark masih kosong) harus dibuang & di-fetch ulang
      if (ignielbookmark.length > 0) {
        invalidateNotifCache();
        setTimeout(() => { fetchUpdates(); }, 300);
      }

      // 3. Jika halaman bookmark.html sedang dibuka, re-render grid
      if (typeof window.render === 'function') {
        window.render();
      }
    } catch(e) { console.warn('BM Firestore pull:', e); }
  };

  // ── Add / Remove ─────────────────────────────────────────────────────────
  const bmAdd = (a) => {
    if (ignielbookmark.find(obj => obj.id === a.id)) return;
    const item = Object.assign({ status: 'plan', addedAt: Date.now() }, a);
    ignielbookmark.push(item);
    BM_DB.put(item).then(() => BM_DB.getAll()).then(items => {
      ignielbookmark = items; updateBadge(); bmCek(); invalidateNotifCache();
    }).catch(e => console.warn('bmAdd error:', e));
    _fsWrite(item);
    showToast('Ditambahkan ke Bookmark!', '🔖');
  };

  const bmRem = (id) => {
    ignielbookmark = ignielbookmark.filter(obj => obj.id !== id);
    const el = d.getElementById("bm-" + id);
    if (el) el.checked = false;
    BM_DB.delete(id).then(() => BM_DB.getAll()).then(items => {
      ignielbookmark = items; updateBadge(); bmCek(); invalidateNotifCache();
    }).catch(e => console.warn('bmRem error:', e));
    _fsDel(id);
    showToast('Dihapus dari Bookmark', '🗑️');
  };

  // ── Attach listeners: ignielBookmarkPost input ───────────────────────────
  const _attachedBmInputs = new WeakSet();
  const attachBmListeners = () => {
    d.querySelectorAll(".ignielBookmarkPost input").forEach(e => {
      if (_attachedBmInputs.has(e)) return;
      _attachedBmInputs.add(e);
      e.addEventListener("change", () => {
        const bmId = e.id.replace(/^bm-/, '');
        const label = e.parentNode.querySelector("label[data-url]");
        if (!label) return;
        const item = { id: bmId, img: label.getAttribute("data-img") || '', title: label.getAttribute("data-title") || '', url: label.getAttribute("data-url") || '', type: (label.getAttribute("data-bm-type") || '').toLowerCase().replace(/\s+/g,''), seriesStatus: (label.getAttribute("data-bm-status") || '').toLowerCase() };
        ignielbookmark.find(obj => obj.id === bmId) ? bmRem(bmId) : bmAdd(item);
      });
    });
  };

  // ── Attach listeners: r-bookmark-wrap ───────────────────────────────────
  const _attachedRbm = new WeakSet();
  const attachRbookmarkListeners = () => {
    d.querySelectorAll('.r-bookmark-wrap[data-bmid]').forEach(wrap => {
      if (_attachedRbm.has(wrap)) return;
      _attachedRbm.add(wrap);
      const bmId = wrap.getAttribute('data-bmid');
      if (ignielbookmark.find(b => b.id === bmId)) wrap.classList.add('is-bookmarked');
      wrap.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const exists = ignielbookmark.find(obj => obj.id === bmId);
        if (exists) { bmRem(bmId); wrap.classList.remove('is-bookmarked'); }
        else { bmAdd({ id: bmId, img: wrap.getAttribute('data-img') || '', title: wrap.getAttribute('data-title') || '', url: wrap.getAttribute('data-url') || '' }); wrap.classList.add('is-bookmarked'); }
      });
    });
  };

  // ── MutationObserver ─────────────────────────────────────────────────────
  const _bmObserver = new MutationObserver(() => { attachBmListeners(); attachRbookmarkListeners(); bmCek(); });
  _bmObserver.observe(d.body, { childList: true, subtree: true });

  // ── Expiry helper (3 hari dari tanggal post) ─────────────────────────────
  // Notif tipe 'info' (pengumuman admin) SENGAJA tidak pernah expired otomatis
  // — sesuai requirement, notif info hanya hilang kalau user tandai dibaca.
  const NOTIF_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari dalam ms
  const isExpired = (u) => u.type !== 'info' && u.updatedTs && (Date.now() - u.updatedTs) > NOTIF_EXPIRY_MS;

  // ── Escape HTML kecil untuk render notif info (judul/isi dari admin) ────
  const _escNotif = (s) => (s || '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Parse format kaya untuk isi pengumuman (dipakai di modal detail) ────
  // Mendukung: **tebal**, *miring*, ||spoiler||, [teks](url), [img:URL], dan
  // auto-link URL polos. Semua style inline (tidak bergantung CSS lain)
  // supaya tetap tampil benar di halaman manapun (modal dibuat via JS).
  const _parseAnnText = (raw) => {
    let s = _escNotif(raw);
    // Gambar: [img:https://...]
    s = s.replace(/\[img:((?:https?:\/\/)[^\]]+)\]/g, '<img src="$1" alt="" loading="lazy" style="max-width:100%;border-radius:.5rem;margin-top:.4rem;display:block">');
    // Link berlabel: [teks](url)
    s = s.replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow" style="color:var(--accent,#eab308);text-decoration:underline;word-break:break-all">$1</a>');
    // URL polos yang belum jadi bagian dari tag di atas → auto-link
    s = s.replace(/(?<!src="|href="|">)(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow" style="color:var(--accent,#eab308);text-decoration:underline;word-break:break-all">$1</a>');
    // **tebal**
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // *miring*
    s = s.replace(/\*(.+?)\*/g, '<i>$1</i>');
    // ||spoiler|| — inline style toggle, tidak butuh class CSS eksternal
    s = s.replace(/\|\|(.+?)\|\|/g, '<span data-open="0" onclick="var o=this.getAttribute(\'data-open\')===\'1\';this.style.color=o?\'#374151\':\'#f3f4f6\';this.setAttribute(\'data-open\',o?\'0\':\'1\')" style="background:#374151;color:#374151;border-radius:4px;padding:0 4px;cursor:pointer;user-select:none;transition:color .2s">$1</span>');
    // Newline
    s = s.replace(/\n/g, '<br>');
    return s;
  };

  // ── Versi ringkas (tanpa markup) untuk cuplikan 3-baris di list notif ────
  const _stripMd = (s) => (s || '').toString()
    .replace(/\[img:[^\]]+\]/g, '📷 gambar')
    .replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()]+)\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\|\|(.+?)\|\|/g, '[spoiler]');

  // ── Badge ────────────────────────────────────────────────────────────────
  const updateBadge = () => {
    if (!badge) badge = d.querySelector(".ignielBookmark .notif-badge");
    if (!badge) return;
    // Hanya hitung notif yang belum dibaca DAN belum expired
    const unread = fetchedUpdates.filter(u => !notifReadMap[u.url] && !isExpired(u)).length;
    badge.textContent = unread > 99 ? "99+" : unread;
    badge.style.display = unread > 0 ? "" : "none";
  };

  // ── Render panel ─────────────────────────────────────────────────────────
  const renderNotifPanel = () => {
    if (!panel) panel = d.getElementById("notif-panel-content");
    if (!panel) return;
    // Hanya tampilkan notif yang BELUM dibaca dan belum expired
    const unreadUpdates = fetchedUpdates.filter(u => !notifReadMap[u.url] && !isExpired(u));
    if (unreadUpdates.length === 0) {
      // Kalau tidak ada bookmark SAMA SEKALI dan belum pernah ada data notif
      // apapun yang kefetch (termasuk info), tampilkan pesan ajakan bookmark.
      // Selain itu (misal: semua notif — termasuk info — sudah dibaca), tampilkan
      // pesan "sudah dibaca" supaya notif info tetap bisa muncul walau user
      // tidak punya bookmark / belum login.
      if (ignielbookmark.length === 0 && fetchedUpdates.length === 0) {
        panel.innerHTML = '<div style="padding:1.5rem 1rem;text-align:center"><div style="font-size:2rem;margin-bottom:.5rem">🔖</div><p style="font-size:.875rem;color:#6b7280;margin:0">Belum ada bookmark.<br>Tambahkan series favorit kamu!</p></div>';
        return;
      }
      panel.innerHTML = '<div style="padding:1.5rem 1rem;text-align:center"><div style="font-size:2rem;margin-bottom:.5rem">✅</div><p style="font-size:.875rem;color:#6b7280;margin:0">Semua notifikasi sudah dibaca.</p></div>'
        + (ignielbookmark.length > 0 ? '<div style="padding:0 1rem .75rem;text-align:center"><a href="/p/bookmark.html" style="font-size:.75rem;color:var(--accent,#eab308)">Lihat semua bookmark →</a></div>' : '');
      return;
    }
    let html = '<ul style="list-style:none;margin:0;padding:0">';
    unreadUpdates.forEach(u => {
      const safeUrl = u.url.replace(/'/g, "\\'");
      if (u.type === 'info') {
        // ── Notif Info / Pengumuman Admin ──
        // Klik item → buka modal detail (bisa klik link/gambar di dalamnya),
        // BUKAN langsung ditandai dibaca & hilang seperti sebelumnya.
        html += '<li data-notif-url="' + u.url + '" onclick="ignielOpenAnnouncement(\'' + safeUrl + '\')" style="display:flex;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid rgba(75,85,99,.2);background:rgba(59,130,246,.07);transition:opacity .3s,max-height .35s,padding .3s;overflow:hidden;cursor:pointer;">'
          + '<div style="flex-shrink:0;font-size:1.35rem;line-height:1">📢</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.68rem;color:#3b82f6;font-weight:700;margin-bottom:.25rem;letter-spacing:.02em">Pengumuman</div>'
          + '<div style="font-size:.8rem;font-weight:600;color:inherit;line-height:1.4">' + _escNotif(u.title) + '</div>'
          + '<div style="font-size:.72rem;color:#9ca3af;margin-top:.2rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + _escNotif(_stripMd(u.message)) + '</div>'
          + '<div style="font-size:.65rem;color:#9ca3af;margin-top:.25rem">' + u.published + '</div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:center;gap:.4rem;flex-shrink:0">'
          + '<div style="width:7px;height:7px;background:#3b82f6;border-radius:50%;box-shadow:0 0 6px #3b82f6"></div>'
          + '<button onclick="event.stopPropagation();ignielMarkRead(\'' + safeUrl + '\')" title="Tandai dibaca (tanpa dibuka)" style="background:none;border:none;cursor:pointer;padding:2px;color:#9ca3af;line-height:1" aria-label="Tandai dibaca">×</button>'
          + '</div>'
          + '</li>';
        return;
      }
      html += '<li data-notif-url="' + u.url + '" style="display:flex;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid rgba(75,85,99,.2);background:rgba(234,179,8,.06);transition:opacity .3s,max-height .35s,padding .3s;overflow:hidden;">'
        + (u.img ? '<a href="' + u.url + '" onclick="ignielMarkRead(\'' + safeUrl + '\')" style="flex-shrink:0"><img src="' + u.img + '" alt="" style="width:44px;height:60px;object-fit:cover;border-radius:.375rem;box-shadow:0 2px 8px rgba(0,0,0,.25)"></a>' : '')
        + '<div style="flex:1;min-width:0">'
        + '<a href="' + u.url + '" onclick="ignielMarkRead(\'' + safeUrl + '\')" style="font-size:.8rem;font-weight:700;color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4">' + _escNotif(u.seriesTitle) + '</a>'
        + '<div style="font-size:.72rem;color:var(--accent,#eab308);font-weight:600;margin-top:.2rem;letter-spacing:.02em">' + _escNotif(u.chapterLabel || u.title) + '</div>'
        + '<div style="font-size:.68rem;color:#9ca3af;margin-top:.25rem">' + u.published + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:.4rem;flex-shrink:0">'
        + '<div style="width:7px;height:7px;background:var(--accent,#eab308);border-radius:50%;box-shadow:0 0 6px var(--accent,#eab308)"></div>'
        + '<button onclick="ignielMarkRead(\'' + safeUrl + '\')" title="Tandai dibaca" style="background:none;border:none;cursor:pointer;padding:2px;color:#9ca3af;line-height:1" aria-label="Tandai dibaca">×</button>'
        + '</div>'
        + '</li>';
    });
    html += '</ul>';
    if (ignielbookmark.length > 0) {
      html += '<div style="padding:.6rem 1rem;text-align:center;border-top:1px solid rgba(75,85,99,.2)"><a href="/p/bookmark.html" style="font-size:.75rem;font-weight:600;color:var(--accent,#eab308)">📚 Lihat semua bookmark →</a></div>';
    }
    panel.innerHTML = html;
  };

  // Tandai dibaca → animasi slide-out lalu hilang
  window.ignielMarkRead = (url) => {
    notifReadMap[url] = true;
    localStorage.setItem("ignielNotifRead", JSON.stringify(notifReadMap));
    // Update cache agar konsisten
    try {
      const cached = JSON.parse(localStorage.getItem('ignielNotifCache') || 'null');
      if (cached) { localStorage.setItem('ignielNotifCache', JSON.stringify(cached)); }
    } catch(e) {}
    updateBadge();
    // Animasi slide-out pada item yang diklik
    const li = d.querySelector('#notif-panel-content li[data-notif-url="' + CSS.escape(url) + '"]');
    if (li) {
      li.style.opacity = '0';
      li.style.maxHeight = li.offsetHeight + 'px';
      // Paksa reflow agar transition berjalan
      li.getBoundingClientRect();
      li.style.maxHeight = '0';
      li.style.padding = '0';
      li.style.borderBottomWidth = '0';
      setTimeout(() => {
        li.remove();
        // Jika panel kosong setelah item dihapus, tampilkan pesan "semua dibaca"
        const remaining = d.querySelectorAll('#notif-panel-content li[data-notif-url]');
        if (remaining.length === 0) renderNotifPanel();
      }, 350);
    }
  };

  // ── Modal detail pengumuman ───────────────────────────────────────────
  // Dibuat via JS (bukan lewat template widget) supaya otomatis tersedia
  // di semua halaman tanpa perlu ubah struktur header di banyak tempat.
  let _annModalEl = null;
  const _ensureAnnModal = () => {
    if (_annModalEl) return _annModalEl;
    const overlay = d.createElement('div');
    overlay.id = 'ignielAnnModal';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML =
      '<div class="bg-white dark:bg-gray-800 dark:text-gray-200" style="width:100%;max-width:28rem;max-height:85vh;border-radius:1rem;box-shadow:0 20px 50px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;padding:1rem 1.1rem;border-bottom:1px solid rgba(107,114,128,.25)">'
      + '<div style="min-width:0">'
      + '<div style="font-size:.68rem;color:#3b82f6;font-weight:700;letter-spacing:.02em;margin-bottom:.15rem">📢 Pengumuman</div>'
      + '<h3 id="ignielAnnTitle" style="font-size:1rem;font-weight:700;margin:0;line-height:1.35"></h3>'
      + '</div>'
      + '<button id="ignielAnnClose" aria-label="Tutup" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:1.3rem;line-height:1;color:#9ca3af">×</button>'
      + '</div>'
      + '<div id="ignielAnnBody" style="padding:1rem 1.1rem;overflow-y:auto;font-size:.875rem;line-height:1.6;word-break:break-word"></div>'
      + '<div style="padding:.7rem 1.1rem;border-top:1px solid rgba(107,114,128,.25);font-size:.68rem;color:#9ca3af" id="ignielAnnDate"></div>'
      + '</div>';
    d.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeAnnModal(); });
    overlay.querySelector('#ignielAnnClose').addEventListener('click', _closeAnnModal);
    _annModalEl = overlay;
    return overlay;
  };
  const _closeAnnModal = () => { if (_annModalEl) _annModalEl.style.display = 'none'; };

  // Buka detail pengumuman: render judul+isi dengan format lengkap (bold,
  // italic, spoiler, gambar, link — link/gambar bisa diklik), lalu tandai
  // dibaca supaya hilang dari daftar notifikasi setelah ditutup.
  window.ignielOpenAnnouncement = (url) => {
    const item = fetchedUpdates.find(u => u.url === url);
    if (!item) return;
    const modal = _ensureAnnModal();
    modal.querySelector('#ignielAnnTitle').textContent = item.title || 'Info';
    modal.querySelector('#ignielAnnBody').innerHTML = _parseAnnText(item.message || '');
    modal.querySelector('#ignielAnnDate').textContent = item.published || '';
    modal.style.display = 'flex';
    // Tutup dropdown notifikasi di belakang modal
    const wrap = d.getElementById('AIe2ZBzA7F');
    if (wrap) wrap.classList.add('hidden');
    window.ignielMarkRead(url);
  };

  const markAllRead = () => {
    fetchedUpdates.forEach(u => { notifReadMap[u.url] = true; });
    localStorage.setItem("ignielNotifRead", JSON.stringify(notifReadMap));
    updateBadge(); renderNotifPanel();
  };

  // ── Fetch updates: query per-series via Blogger Label Feed API ──────────
  // Setiap bookmark di-query ke /feeds/posts/default/-/{title} sehingga
  // matching 100% akurat tanpa bergantung pada format slug URL.
  const NOTIF_CACHE_KEY = 'ignielNotifCache';
  const NOTIF_CACHE_TTL = 2 * 60 * 1000; // 2 menit

  // ── Resolusi label asli series dari post ID ──────────────────────────────
  // BUG LAMA: kode ini dulu langsung menganggap `bm.title` (judul postingan
  // series yang tersimpan saat bookmark) SAMA PERSIS dengan nama Label
  // Blogger yang dipasang di postingan chapter. Padahal keduanya sering
  // berbeda (huruf besar/kecil, tanda baca, embel-embel di judul, dst),
  // sehingga query feed label tidak pernah menemukan chapter barunya —
  // walau chapter itu sudah dipublish. Fitur lain di template ini (daftar
  // kontributor & ch-uploader) sudah menghindari masalah ini dengan memakai
  // `clwd.settings.cat` (label asli yang di-set admin lewat clwd.run(...)
  // di konten post series) sebagai sumber label, bukan judul post.
  //
  // Bookmark bisa dipasang dari halaman manapun (bukan cuma halaman series),
  // jadi `clwd.settings.cat` tidak selalu tersedia saat itu. Sebagai
  // gantinya, di sini kita ambil label ASLI langsung dari data postingan
  // series itu sendiri lewat feed per-ID Blogger (`bm.id`), lalu pilih label
  // yang bukan label umum (Chapter/Project/Lock/dst) dan bukan label tipe
  // (Manga/Manhwa/dst) — persis logika yang sama seperti resolver
  // "auto series like" di bagian bawah template ini.
  const _mainTypeLabelsNotif = ['Manga','Manhwa','Manhua','WN','LN','Doujin','Novel'];
  const _excludeLabelsNotif = ['Project','Lock','Free','NSFW','Chapter','ID','New','Series','Ongoing','Completed','Complete','Hiatus','Dropped','Tamat','Berjalan'];

  // Cache supaya 1 series cuma di-resolve sekali per sesi (dipakai lintas
  // pemanggilan fetchSeriesFeed dalam 1x fetchUpdates).
  const _labelResolveCache = {};

  // ── Resolusi label ────────────────────────────────────────────────────
  // Label "clwd" itu BUKAN cuma argumen script clwd.run(...) di halaman
  // series — string yang sama juga dipasang LANGSUNG sebagai Label Blogger
  // asli baik di postingan series MAUPUN di setiap postingan chapter-nya.
  // Artinya kita tidak perlu fetch & scrape HTML halaman series sama sekali
  // (cara itu justru rawan salah: kalau halaman itu juga menampilkan
  // cuplikan/related-post series LAIN yang kebetulan sama-sama menyisipkan
  // clwd.run() miliknya sendiri, regex bisa nyantol ke punya series lain).
  // Cukup baca category/label ASLI dari post yang dibookmark sendiri —
  // baik itu halaman series maupun halaman chapter, sama-sama punya label
  // pendek itu — lalu saring label umum (mainType/status), dan validasi
  // tiap kandidat yang tersisa dengan mencocokkan slug URL supaya tidak
  // salah pilih label genre yang kebetulan juga dipakai series lain.
  const _resolveSeriesLabel = async (bm) => {
    if (_labelResolveCache[bm.id]) return _labelResolveCache[bm.id];
    if (!bm.id) return bm.title;

    const slugBase = (bm.url || '').replace(/\/$/, '').split('/').pop()
      .replace(/\.html?$/i, '').replace(/-c-\d[\d-]*$/i, '');

    try {
      const infoUrl = `${window.location.origin}/feeds/posts/default/${bm.id}?alt=json`;
      const infoRes = await fetch(infoUrl);
      const infoData = await infoRes.json();
      const entryObj = infoData.entry || {};

      // ── Sumber PALING AKURAT: nama series persis dari clwd.run('...') di
      // isi post series itu sendiri (sama seperti yang dipakai Chapter List).
      // Ini yang menentukan label chapter, jadi tidak perlu menebak dari label.
      const rawContent = (entryObj.content && entryObj.content.$t) || '';
      const clwdMatch = rawContent
        .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
        .match(/clwd\.run\(\s*['"]([^'"]+)['"]\s*\)/);
      if (clwdMatch && clwdMatch[1].trim()) {
        const lbl = clwdMatch[1].trim();
        _labelResolveCache[bm.id] = lbl;
        return lbl;
      }

      const cats = entryObj.category ? entryObj.category.map(c => c.term) : [];
      if (!cats.length) throw new Error('kategori kosong'); // jangan cache fallback judul
      const candidates = cats.filter(c => _excludeLabelsNotif.indexOf(c) === -1 && _mainTypeLabelsNotif.indexOf(c) === -1);

      // Kalau cuma tersisa SATU kandidat (kasus paling umum: label post cuma
      // [MainType, Status, label-series]), langsung pakai itu tanpa validasi
      // tambahan — tidak ada yang perlu dibandingkan.
      if (candidates.length === 1) { _labelResolveCache[bm.id] = candidates[0]; return candidates[0]; }

      // Kalau ada beberapa kandidat (mis. ada label genre tambahan), coba
      // satu-satu dan validasi lewat kecocokan slug URL — kandidat yang
      // fetch-nya menghasilkan entry dengan URL semirip bm.url dianggap
      // yang benar.
      for (const cand of candidates) {
        try {
          const testUrl = `${window.location.origin}/feeds/posts/default/-/${encodeURIComponent(cand)}?alt=json&max-results=10&fields=entry(link)`;
          const testRes = await fetch(testUrl);
          const testData = await testRes.json();
          const testEntries = (testData.feed && testData.feed.entry) || [];
          const matches = slugBase && testEntries.some(e => {
            const href = (e.link || []).find(l => l.rel === 'alternate')?.href || '';
            return href.indexOf(slugBase) !== -1;
          });
          if (matches) { _labelResolveCache[bm.id] = cand; return cand; }
        } catch (e2) { /* coba kandidat berikutnya */ }
      }

      // Tidak ada kandidat yang tervalidasi tapi setidaknya ada 1 kandidat
      // yang lolos filter umum — pakai yang pertama sebagai upaya terbaik.
      if (candidates.length > 0) { _labelResolveCache[bm.id] = candidates[0]; return candidates[0]; }
    } catch (e) { /* jatuh ke fallback judul di bawah */ }

    // ── Fallback terakhir: perilaku paling lama (judul post).
    return bm.title;
  };

  const fetchSeriesFeed = async (bm) => {
    const realLabel = await _resolveSeriesLabel(bm);
    const label = encodeURIComponent(realLabel);
    const url = `${window.location.origin}/feeds/posts/default/-/${label}?alt=json&max-results=10&orderby=updated`;
    const res = await fetch(url);
    const data = await res.json();
    const entries = (data.feed && data.feed.entry) || [];
    return entries.map(entry => {
      const postUrl = (entry.link || []).find(l => l.rel === 'alternate')?.href || '';
      const postTitle = entry.title?.$t || '';
      const postImg = entry['media$thumbnail']?.url?.replace(/\/s[0-9]+\//, '/s128/') || bm.img || '';
      const published = entry.published?.$t ? new Date(entry.published.$t).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) : '';
      const updatedTs = entry.updated?.$t ? new Date(entry.updated.$t).getTime() : 0;
      // Jangan masukkan URL yang sama dengan halaman series itu sendiri
      if (!postUrl || postUrl === bm.url) return null;
      // Judul post chapter di situs ini biasanya TIDAK menuliskan "Chapter X"
      // (cuma nama series lagi), jadi info chapter diambil dari akhiran slug
      // URL, contoh: ".../suamiku-yang-terhebat-c-1-2" -> "Chapter 1.2".
      // Kalau pola tidak cocok, fallback ke judul post apa adanya.
      const chMatch = postUrl.match(/-c-(\d+(?:-\d+)?)(?:\.html)?\/?(?:[?#].*)?$/i);
      const chapterLabel = chMatch ? ('Chapter ' + chMatch[1].replace('-', '.')) : postTitle;
      return { title: postTitle, chapterLabel, url: postUrl, img: postImg, seriesTitle: bm.title, published, updatedTs };
    }).filter(Boolean);
  };

  // ── Fetch notif Info/Pengumuman dari koleksi Firestore 'announcements' ──
  // Publik dibaca (login maupun tidak), sesuai firestore.rules. Dipanggil
  // bersamaan dengan fetch update bookmark supaya tampil di panel yang sama.
  const fetchAnnouncements = async () => {
    try {
      const fb = window.siteGetFirebase && window.siteGetFirebase();
      if (!fb || !fb.db) return [];
      const snap = await fb.db.collection('announcements')
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      return snap.docs.map(doc => {
        const data = doc.data() || {};
        // createdAt disimpan sbg angka (Date.now()) oleh dashboard admin, tapi
        // tetap dukung Firestore Timestamp (.toMillis) untuk jaga-jaga.
        const ts = typeof data.createdAt === 'number'
          ? data.createdAt
          : (data.createdAt && typeof data.createdAt.toMillis === 'function') ? data.createdAt.toMillis() : Date.now();
        return {
          type: 'info',
          url: 'announcement:' + doc.id,
          title: data.title || 'Info',
          message: data.message || '',
          published: new Date(ts).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}),
          updatedTs: ts
        };
      });
    } catch(e) { console.warn('Fetch announcements:', e); return []; }
  };

  const fetchUpdates = async () => {
    if (!panel) panel = d.getElementById("notif-panel-content");

    // Cek cache lokal dulu (mencakup update bookmark + notif info sekaligus)
    try {
      const cached = JSON.parse(localStorage.getItem(NOTIF_CACHE_KEY) || 'null');
      if (cached && cached.ts && (Date.now() - cached.ts) < NOTIF_CACHE_TTL && cached.data) {
        fetchedUpdates = cached.data;
        hasFetched = true; _lastFetchTs = cached.ts;
        updateBadge(); renderNotifPanel(); return;
      }
    } catch(e) {}

    if (panel) panel.innerHTML = '<div class="bookmark-loading"><svg viewBox="0 0 24 24"><path d="M2.45001 14.97C3.52001 18.41 6.40002 21.06 9.98002 21.79"/><path d="M2.04999 10.98C2.55999 5.93 6.81998 2 12 2C17.18 2 21.44 5.94 21.95 10.98"/><path d="M14.01 21.8C17.58 21.07 20.45 18.45 21.54 15.02"/></svg></div>';

    try {
      // Fetch update bookmark (kalau ada bookmark) secara parallel (max 6 sekaligus)
      let seriesUpdates = [];
      if (ignielbookmark.length > 0) {
        const chunks = [];
        for (let i = 0; i < ignielbookmark.length; i += 6) chunks.push(ignielbookmark.slice(i, i + 6));
        for (const chunk of chunks) {
          const results = await Promise.allSettled(chunk.map(b => fetchSeriesFeed(b)));
          results.forEach(r => { if (r.status === 'fulfilled') seriesUpdates.push(...r.value); });
        }
      }

      // Fetch notif info/pengumuman — SELALU, terlepas dari ada/tidaknya bookmark,
      // dan terlepas dari status login, supaya broadcast admin sampai ke semua orang.
      const announcementUpdates = await fetchAnnouncements();

      // Gabung, deduplicate by URL, sort terbaru dulu
      const seen = new Set();
      fetchedUpdates = [...announcementUpdates, ...seriesUpdates]
        .filter(u => { if (seen.has(u.url)) return false; seen.add(u.url); return true; })
        .sort((a, b) => b.updatedTs - a.updatedTs)
        .slice(0, 30);

      // Simpan cache
      try { localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: fetchedUpdates })); } catch(e) {}

      hasFetched = true; _lastFetchTs = Date.now();
      updateBadge(); renderNotifPanel();
    } catch(e) {
      if (panel) panel.innerHTML = '<p style="padding:1rem;text-align:center;font-size:.875rem;color:#ef4444">Gagal memuat notifikasi.</p>';
    }
  };

  // ── Init: migrasi localStorage -> IndexedDB, lalu pasang semua listener ─
  const initBookmarks = async () => {
    let lsData = [];
    try { lsData = JSON.parse(localStorage.getItem("ignielBookmark")) || []; } catch(e) {}
    if (lsData.length > 0) {
      const existing = await BM_DB.getAll();
      if (existing.length === 0) await BM_DB.putBulk(lsData);
      localStorage.removeItem("ignielBookmark");
    }
    ignielbookmark = await BM_DB.getAll();

    // Bersihkan notifReadMap dari key lama (> 7 hari) agar tidak membengkak
    try {
      const now = Date.now();
      let changed = false;
      Object.keys(notifReadMap).forEach(key => {
        // Key format bisa berupa URL — hapus jika tersimpan lebih dari 7 hari
        if (notifReadMap[key] === true) {
          // Tidak ada timestamp pada format lama, biarkan saja
        } else if (notifReadMap[key] && (now - notifReadMap[key]) > 7 * 24 * 60 * 60 * 1000) {
          delete notifReadMap[key]; changed = true;
        }
      });
      if (changed) localStorage.setItem("ignielNotifRead", JSON.stringify(notifReadMap));
    } catch(e) {}

    // Ambil DOM refs setelah DOM siap
    badge = d.querySelector(".ignielBookmark .notif-badge");
    panel = d.getElementById("notif-panel-content");
    bellBtn = d.querySelector(".ignielBookmark [data-dropdown-toggle]");
    markAllBtn = d.querySelector(".notif-mark-all");

    bmCek();
    attachBmListeners();
    attachRbookmarkListeners();

    // Pasang klik bell → fetch atau render
    if (bellBtn) {
      bellBtn.addEventListener("click", () => {
        if (!hasFetched || (Date.now() - _lastFetchTs) > NOTIF_CACHE_TTL) {
          try { localStorage.removeItem(NOTIF_CACHE_KEY); } catch(e) {}
          fetchUpdates();
        } else renderNotifPanel();
      });
    }
    if (markAllBtn) {
      markAllBtn.addEventListener("click", e => { e.stopPropagation(); markAllRead(); });
    }

    // Auto-fetch background setelah 2 detik — SELALU dijalankan (bukan hanya
    // kalau ada bookmark) supaya notif info/pengumuman admin tetap muncul
    // untuk user yang belum bookmark apapun atau belum login sekalipun.
    setTimeout(fetchUpdates, 2000);
  };

  const _runInit = () => initBookmarks().catch(e => console.warn('Bookmark init error:', e));
  if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', _runInit); } else { _runInit(); }

  // ── Scroll fallback ──────────────────────────────────────────────────────
  let _scrollThrottle = null;
  d.addEventListener('scroll', () => {
    if (_scrollThrottle) return;
    _scrollThrottle = setTimeout(() => { attachBmListeners(); attachRbookmarkListeners(); bmCek(); _scrollThrottle = null; }, 400);
  }, { passive: true });

  // Expose untuk halaman bookmark.html
  window.LANGITOREN_BM_DB = BM_DB;
  // Expose _fsPull agar bisa dipanggil dari onAuthStateChanged di theme header
  window._fsPull = _fsPull;
}(document);
/**/
