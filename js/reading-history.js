/* langitoren: reading-history.js (diekstrak dari tema, baris 10289) */
/**/
/* ----
  Riwayat Baca — Series & Chapter History (login only, sync ke Firestore)
  Mengikuti pola sistem Bookmark di atas: IndexedDB lokal + Firestore per akun.
---- */

/* ---- IndexedDB Riwayat Baca ---- */
const HIST_DB = (() => {
  const DB_NAME = 'langitorenHistory', STORE_SERIES = 'series', STORE_CHAPTER = 'chapter', VER = 1;
  let _db = null;
  const open = () => new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open(DB_NAME, VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SERIES)) db.createObjectStore(STORE_SERIES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_CHAPTER)) db.createObjectStore(STORE_CHAPTER, { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e);
  });
  const ops = (store) => ({
    getAll: () => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    })),
    put: (item) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(item);
      tx.oncomplete = res; tx.onerror = rej;
    })),
    delete: (id) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = res; tx.onerror = rej;
    })),
    clear: () => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = res; tx.onerror = rej;
    })),
    putBulk: (items) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const st = tx.objectStore(store);
      items.forEach(i => st.put(i));
      tx.oncomplete = res; tx.onerror = rej;
    }))
  });
  return { series: ops(STORE_SERIES), chapter: ops(STORE_CHAPTER) };
})();

!function(d){
  // ── Helper umum ──────────────────────────────────────────────────────────
  const slugify = (s) => (s || '').toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

  const _getCtx = () => {
    try {
      const fb = window.siteGetFirebase && window.siteGetFirebase();
      const uid = window.siteGetUser && window.siteGetUser() && window.siteGetUser().uid;
      if (fb && fb.db && uid) return { db: fb.db, uid };
      console.log('[RiwayatBaca] _getCtx tidak lengkap — fb:', !!fb, 'db:', !!(fb&&fb.db), 'uid:', uid);
    } catch(e) { console.warn('[RiwayatBaca] _getCtx error:', e); }
    return null;
  };

  const _isLoggedIn = () => (typeof window.siteIsLoggedIn === 'function') ? window.siteIsLoggedIn() : false;

  // ── Firestore write/delete: koleksi user_history, sub-koleksi series & chapter ──
  const _fsWriteHist = (kind, item) => {
    const ctx = _getCtx();
    if (!ctx) { console.log('[RiwayatBaca] _fsWriteHist dibatalkan: konteks Firebase/uid belum siap'); return; }
    const data = {
      id: item.id, title: item.title || '', img: item.img || '', url: item.url || '',
      seriesUrl: item.seriesUrl || '', chapterTitle: item.chapterTitle || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    ctx.db.collection('user_history').doc(ctx.uid)
      .collection(kind).doc(item.id).set(data, { merge: true })
      .then(() => console.log('[RiwayatBaca] Firestore write OK:', kind, item.id))
      .catch(e => console.warn('[RiwayatBaca] Firestore write GAGAL:', kind, item.id, e));
  };

  // Pull dari Firestore → merge ke IndexedDB (dipanggil saat login)
  const _historyPull = async (uid) => {
    try {
      const fb = window.siteGetFirebase && window.siteGetFirebase();
      if (!fb || !fb.db) return;
      for (const kind of ['series', 'chapter']) {
        const store = HIST_DB[kind];
        const snap = await fb.db.collection('user_history').doc(uid).collection(kind).get();
        const remote = snap.empty ? [] : snap.docs.map(d => d.data());
        const local  = await store.getAll();
        const localIds = new Set(local.map(x => x.id));

        const toUpsert = [];
        for (const r of remote) {
          const loc = local.find(x => x.id === r.id);
          if (!loc) {
            toUpsert.push(r);
          } else {
            var rTime = r.updatedAt && r.updatedAt.toMillis ? r.updatedAt.toMillis() : 0;
            var lTime = loc.updatedAt || 0;
            if (rTime > lTime) toUpsert.push(Object.assign({}, r, { updatedAt: rTime }));
          }
        }
        if (toUpsert.length > 0) await store.putBulk(toUpsert);

        // Push item lokal yang belum ada di Firestore ke cloud
        const remoteIds = new Set(remote.map(r => r.id));
        const toPush = local.filter(x => !remoteIds.has(x.id));
        for (const item of toPush) _fsWriteHist(kind, item);
      }
      // Jika halaman riwayat-baca.html sedang dibuka, re-render
      if (typeof window.renderHistoryPage === 'function') window.renderHistoryPage();
    } catch(e) { console.warn('History Firestore pull:', e); }
  };
  window._historyPull = _historyPull;

  // ── Catat riwayat Series ─────────────────────────────────────────────────
  window.recordSeriesHistory = function(info) {
    if (!_isLoggedIn() || !info || !info.id) return;
    const item = { id: info.id, title: info.title || '', img: info.img || '', url: info.url || '', updatedAt: Date.now() };
    HIST_DB.series.put(item).catch(e => console.warn('recordSeriesHistory:', e));
    _fsWriteHist('series', item);
  };

  // ── Catat riwayat Chapter (1 entri ringkas per series) ──────────────────
  window.recordChapterHistory = function(info) {
    if (!_isLoggedIn() || !info || !info.seriesName) return;
    const seriesId = slugify(info.seriesName);
    const item = {
      id: seriesId,
      title: info.seriesName,
      img: info.img || '',
      url: info.url || '',
      seriesUrl: info.seriesUrl || '',
      chapterTitle: info.chapterTitle || '',
      updatedAt: Date.now()
    };
    HIST_DB.chapter.put(item).catch(e => console.warn('recordChapterHistory:', e));
    _fsWriteHist('chapter', item);
  };

  // ── Hapus 1 entri riwayat ────────────────────────────────────────────────
  window.removeSeriesHistory = function(id) {
    HIST_DB.series.delete(id).catch(e => console.warn('removeSeriesHistory:', e));
    const ctx = _getCtx();
    if (ctx) ctx.db.collection('user_history').doc(ctx.uid).collection('series').doc(id).delete().catch(function(){});
    if (typeof window.renderHistoryPage === 'function') window.renderHistoryPage();
  };
  window.removeChapterHistory = function(id) {
    HIST_DB.chapter.delete(id).catch(e => console.warn('removeChapterHistory:', e));
    const ctx = _getCtx();
    if (ctx) ctx.db.collection('user_history').doc(ctx.uid).collection('chapter').doc(id).delete().catch(function(){});
    if (typeof window.renderHistoryPage === 'function') window.renderHistoryPage();
  };

  // ── Hapus semua riwayat (per tab) ───────────────────────────────────────
  window.clearAllHistory = function(kind) {
    HIST_DB[kind].clear().catch(function(){});
    const ctx = _getCtx();
    if (ctx) {
      ctx.db.collection('user_history').doc(ctx.uid).collection(kind).get().then(function(snap){
        var batch = ctx.db.batch();
        snap.forEach(function(doc){ batch.delete(doc.ref); });
        return batch.commit();
      }).catch(function(){});
    }
    if (typeof window.renderHistoryPage === 'function') window.renderHistoryPage();
  };

  // Expose DB untuk halaman riwayat-baca.html
  window.LANGITOREN_HISTORY_DB = HIST_DB;

  // ── Auto-track: halaman Series ───────────────────────────────────────────
  const _autoTrackSeries = () => {
    const seriesEl = d.querySelector('[data-history-series]');
    if (!seriesEl) { console.log('[RiwayatBaca] bukan halaman series, skip auto-track series'); return; }
    const payload = {
      id: seriesEl.getAttribute('data-history-id') || slugify(seriesEl.getAttribute('data-history-title')),
      title: seriesEl.getAttribute('data-history-title') || '',
      img: seriesEl.getAttribute('data-history-img') || '',
      url: seriesEl.getAttribute('data-history-url') || window.location.href
    };
    console.log('[RiwayatBaca] tracking SERIES:', payload);
    window.recordSeriesHistory(payload);
  };

  // ── Auto-track: halaman Chapter ──────────────────────────────────────────
  const _autoTrackChapter = () => {
    const navEl = d.getElementById('nextPrevJSbottom');
    if (!navEl) { console.log('[RiwayatBaca] elemen #nextPrevJSbottom tidak ditemukan, skip auto-track chapter'); return; }
    const seriesName = navEl.getAttribute('data-label');
    if (!seriesName) { console.log('[RiwayatBaca] data-label kosong di #nextPrevJSbottom, skip auto-track chapter'); return; }
    const likeBtn = d.querySelector('.button_likes_hiru[data-web="hirulikes"]');
    const titleEl = d.querySelector('[data-history-chapter-title]');
    const chapterTitle = titleEl ? (titleEl.getAttribute('data-history-post-title') || '') : (document.title || '');
    const payload = {
      seriesName: seriesName,
      img: likeBtn ? (likeBtn.getAttribute('data-image') || '') : '',
      url: window.location.href,
      seriesUrl: navEl.getAttribute('data-series-url') || '',
      chapterTitle: chapterTitle.trim()
    };
    console.log('[RiwayatBaca] tracking CHAPTER:', payload);
    window.recordChapterHistory(payload);
  };

  const _runHistoryTrack = () => {
    if (!_isLoggedIn()) { console.log('[RiwayatBaca] user belum login, tracking dibatalkan'); return; }
    console.log('[RiwayatBaca] user login terdeteksi, mulai auto-track...');
    _autoTrackSeries();
    _autoTrackChapter();
  };

  // Tunggu Firebase Auth BENAR-BENAR selesai resolve (window._userReady === true)
  // sebelum memutuskan login/belum. Tanpa ini, _isLoggedIn() bisa salah baca "belum
  // login" karena auth.currentUser belum sempat terisi saat baru pertama load page,
  // padahal user sebenarnya sudah login (sesi tersimpan tapi belum selesai dimuat).
  let _histTries = 0;
  const _waitAuthThenTrack = () => {
    _histTries++;
    if (window._userReady === true) {
      _runHistoryTrack();
    } else if (_histTries < 60) {
      setTimeout(_waitAuthThenTrack, 200);
    } else {
      console.log('[RiwayatBaca] timeout menunggu auth resolve, tracking dibatalkan');
    }
    // Jika setelah ~12 detik auth tetap belum resolve, diam saja (jangan catat apa pun)
  };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function(){ setTimeout(_waitAuthThenTrack, 300); });
  } else {
    setTimeout(_waitAuthThenTrack, 300);
  }
}(document);
/**/
