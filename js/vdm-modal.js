/* langitoren: vdm-modal.js (diekstrak dari tema, baris 13508) */
/**/
  (function(){
    var WORKER_URL = 'https://oyenwibhuk.langitoren00.workers.dev';

    // ── Tunggu Firebase auth siap (pakai fungsi waitForAuth yang sudah ada) ──
    function waitForAuth(cb) {
      if (typeof window.siteGetFirebase !== 'function') {
        var tries = 0;
        var t = setInterval(function() {
          tries++;
          if (typeof window.siteGetFirebase === 'function') { clearInterval(t); waitForAuth(cb); }
          else if (tries > 50) { clearInterval(t); cb(null); }
        }, 100);
        return;
      }
      var fb = window.siteGetFirebase();
      if (!fb || !fb.auth) { cb(null); return; }
      if (fb.auth.currentUser !== null) { cb(fb.auth.currentUser); return; }
      var unsub = fb.auth.onAuthStateChanged(function(user) { unsub(); cb(user); });
      setTimeout(function() { try { unsub(); } catch(e){} cb(fb.auth.currentUser); }, 10000);
    }

    // ── Tampilkan modal dengan state loading ──────────────────
    function showModal(title, cover) {
      document.getElementById('vdmCover').src = cover;
      document.getElementById('vdmTitle').textContent = title;
      var bg = document.getElementById('vdmHeaderBg');
      if (bg) bg.style.backgroundImage = cover ? 'url(' + cover + ')' : 'none';
      document.getElementById('vdmLinks').innerHTML =
        '<div style="text-align:center;padding:0.5rem 0">' +
        '<svg style="width:28px;height:28px;animation:spin 1s linear infinite;color:#6b7280;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<p style="font-size:0.8rem;color:#9ca3af;margin-top:0.5rem">Memverifikasi akses...</p>' +
        '</div>';
      var modal = document.getElementById('volDownloadModal');
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function setModalLinks(hasPdf, hasEpub, volKey) {
      var linksEl = document.getElementById('vdmLinks');
      linksEl.innerHTML = '';

      function makeDlBtn(format, cls, label) {
        var btn = document.createElement('button');
        btn.className = 'vdm-btn ' + cls;
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 20q-2.275 0-3.888-1.575T1 14.575q0-1.95 1.175-3.475T5.25 9.15q.575-2.025 2.138-3.4T11 4.075v8.075L9.4 10.6L8 12l4 4l4-4l-1.4-1.4l-1.6 1.55V4.075q2.575.35 4.288 2.313T19 11q1.725.2 2.863 1.488T23 15.5q0 1.875-1.313 3.188T18.5 20h-12Z"/></svg> ' + label;
        btn.addEventListener('click', function() {
          triggerDownload(volKey, format, btn);
        });
        linksEl.appendChild(btn);
      }

      if (hasPdf)  makeDlBtn('pdf',  'pdf',  'Download PDF');
      if (hasEpub) makeDlBtn('epub', 'epub', 'Download EPUB');
      if (!hasPdf && !hasEpub) {
        linksEl.innerHTML = '<p style="text-align:center;color:#9ca3af;font-size:0.8rem">File belum tersedia.</p>';
      }
    }

    function setModalError(msg) {
      document.getElementById('vdmLinks').innerHTML =
        '<p style="text-align:center;color:#ef4444;font-size:0.8rem">&#9888; ' + msg + '</p>';
    }

    // ── Fetch file dari worker /download lalu trigger download ──
    
    function triggerDownload(volKey, format, btn) {
      var origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<svg style="width:16px;height:16px;animation:spin 1s linear infinite;display:inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Memproses...';

      waitForAuth(function(user) {
        if (!user) {
          btn.disabled = false; btn.innerHTML = origHtml;
          closeVolDownload();
          if (typeof window.openLockPopup === 'function') window.openLockPopup('Download Volume');
          return;
        }
        
        user.getIdToken(false).then(function(idToken) {
          var r2Key = volKey + '.' + format;
          var dlUrl = WORKER_URL + '/download'
            + '?key='   + encodeURIComponent(r2Key)
            + '&token=' + encodeURIComponent(idToken);

          // Kembalikan tombol ke state awal
          btn.disabled = false; 
          btn.innerHTML = origHtml;
          
          // Tutup modal agar UI terlihat bersih saat proses download dimulai
          closeVolDownload();

          // TRIGGER DOWNLOAD BAWAAN BROWSER
          var a = document.createElement('a');
          a.href = dlUrl;
          a.target = '_blank'; 
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

        }).catch(function(err) {
          btn.disabled = false; btn.innerHTML = origHtml;
          setModalError('Gagal memproses token: ' + err.message);
        });
      });
    }


    // ── Entry point: klik figure ──────────────────────────────
    window.openVolDownload = function(figEl) {
      var title  = figEl.querySelector('.name')  ? figEl.querySelector('.name').textContent.trim() : 'Volume';
      var cover  = figEl.querySelector('img')    ? figEl.querySelector('img').src : '';
      var volKey = figEl.getAttribute('data-vol-key') || '';
      var hasPdf  = figEl.getAttribute('data-has-pdf')  === '1';
      var hasEpub = figEl.getAttribute('data-has-epub') === '1';

      if (!volKey) { return; }

      // Cek login dulu sebelum buka modal
      var isLoggedIn = (typeof window.siteIsLoggedIn === 'function') ? window.siteIsLoggedIn() : false;
      if (!isLoggedIn) {
        if (typeof window.openLockPopup === 'function') window.openLockPopup(title);
        return;
      }

      // Cek subscribe — pakai siteWaitSubscribed untuk hindari race condition
      if (typeof window.siteWaitSubscribed === 'function') {
        window.siteWaitSubscribed(function(isSubscribed) {
          if (!isSubscribed) {
            if (typeof window.openLockSubPopup === 'function') window.openLockSubPopup(title);
            return;
          }
          // Lolos gate — tampilkan modal dengan tombol download
          showModal(title, cover);
          setModalLinks(hasPdf, hasEpub, volKey);
        }, 5000);
      } else {
        var isSubscribed = (typeof window.siteIsSubscribed === 'function') ? window.siteIsSubscribed() : false;
        if (!isSubscribed) {
          if (typeof window.openLockSubPopup === 'function') window.openLockSubPopup(title);
          return;
        }
        showModal(title, cover);
        setModalLinks(hasPdf, hasEpub, volKey);
      }
    };

    window.closeVolDownload = function() {
      var modal = document.getElementById('volDownloadModal');
      if (modal) modal.classList.remove('open');
      document.body.style.overflow = '';
    };

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeVolDownload();
    });

    // Animasi spin untuk loading
    var spinStyle = document.createElement('style');
    spinStyle.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(spinStyle);
  })();
  /**/
