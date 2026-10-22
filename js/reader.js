/* langitoren: reader.js (diekstrak dari tema, baris 13675) */
/**/
  (function () {

    var WORKER_URL = 'https://oyenwibhuk.langitoren00.workers.dev';

    var readerEl = document.getElementById('reader');
    var _lockedAttr = readerEl ? readerEl.getAttribute('data-locked') : null;
    // data-locked="true"  → perlu subscribe
    // data-locked="free"  → cukup login (Lock + Free event)
    // tidak ada / lainnya → konten bebas, skip
    if (!readerEl || (_lockedAttr !== 'true' && _lockedAttr !== 'free' && _lockedAttr !== 'pw')) return;

    // Apakah ini Free event? (Lock + label Free)
    var isFreeEvent = (_lockedAttr === 'free');
    // Apakah ini pw event? (Lock + label pw -> akses via password Telegram, tanpa login)
    var isPwEvent = (_lockedAttr === 'pw');

    // Daftarkan fungsi reload agar bisa dipanggil oleh onSnapshot
    // saat subscription user tiba-tiba aktif (setelah bayar)
    window._reloadLockedContent = function() {
      var reader = document.getElementById('reader');
      if (!reader) return;
      // Jangan reload kalau konten sedang/sudah dimuat -> penyebab progress bar mengulang dari 1
      if (reader.getAttribute('data-lo-state') !== 'gate') return;
      showSubActivatedToast();
      // Delay 1 detik supaya token Firebase sempat diperbarui
      setTimeout(function() {
        reader.innerHTML = '';
        initLockedReader(reader, r2key, isNovel);
      }, 1000);
    };

    // Deteksi tipe konten:
    // - Ada class 'novel-mode' → post novel (Lock tanpa Comic)
    // - Tidak ada 'novel-mode' → post manga/comic (Lock + Comic)
    var isNovel = readerEl.classList.contains('novel-mode');

    
    var r2key = (function () {
      
      var dataR2key = readerEl.getAttribute('data-r2key') || '';
      
      var snippetMatch = dataR2key.match(/r2key:([\w\/\-]+)/);
      if (snippetMatch) return snippetMatch[1];

      var isNovelType = isNovel;

      var postUrl = readerEl.getAttribute('data-post-url') || window.location.href;
      var urlSlug = urlToR2Key(postUrl, isNovelType);
      if (urlSlug) return urlSlug;

      var title = readerEl.getAttribute('data-post-title') || document.title || '';
      return titleToR2Key(title, isNovelType);
    })();

    
    function urlToR2Key(url, isNovel) {
      try {
        var type     = isNovel ? 'novel' : 'manga';
        // Ambil bagian filename dari URL, buang .html
        var pathname = new URL(url).pathname;
        var parts    = pathname.split('/').filter(Boolean);
        var filename = parts[parts.length - 1]
          .replace(/\.html?$/i, '')
          .replace(/[^a-z0-9\-]+/gi, '-')
          .toLowerCase();
        if (!filename) return null;
        var key = type + '/' + filename;
        // Return object {full, short} sama — URL sudah final
        return { full: key, short: key };
      } catch (e) {
        return null;
      }
    }

    initLockedReader(readerEl, r2key, isNovel);

    function titleToR2Key(title, isNovel) {
      var type  = isNovel ? 'novel' : 'manga';
      var lower = title.toLowerCase();
      // Pisah di "chapter N"
      var chMatch = lower.match(/chapter[\s\-]*(\d+)/i);
      var chSpecial = /prolog(?:ue)?/i.test(lower) ? 'prolog' : (/side[\s-]?story/i.test(lower) ? 'side-story' : null);
      var chapter = chMatch ? 'ch-' + chMatch[1] : (chSpecial ? 'ch-' + chSpecial : 'ch-1');
      var seriesPart = lower
        .replace(/chapter[\s\-]*\d+.*/i, '')
        .trim();
      // Full slug — semua kata
      var fullSlug = seriesPart
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      // Short slug — 3 kata pertama
      var shortSlug = seriesPart
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join('-')
        .replace(/[^a-z0-9\-]+/g, '')
        .replace(/^-+|-+$/g, '');
      return {
        full:  type + '/' + fullSlug  + '/' + chapter,
        short: type + '/' + shortSlug + '/' + chapter,
      };
    }

    
    function initLockedReader(el, r2keys, isNovel) {
      // Anti-ganda: kalau sudah loading/loaded, JANGAN render ulang (penyebab bar balik ke 1 & layar berkedip)
      var _st = el.getAttribute('data-lo-state');
      if (_st === 'loading' || _st === 'loaded') return;
      showSkeleton(el, isNovel);
      el.setAttribute('data-lo-state', 'loading');

      if (isPwEvent) {
        initPwReader(el, r2keys, isNovel);
        return;
      }

      waitForAuth(function (user) {
        if (!user) { showGate(el); return; }

        user.getIdToken(false).then(function (idToken) {

          if (isFreeEvent) {
            // ── FREE EVENT: cukup login, pakai endpoint /content/free ──
            var tryFetchFree = isNovel ? fetchNovelFree : fetchMangaFree;
            if (typeof r2keys === 'string') {
              tryFetchFree(el, r2keys, idToken);
              return;
            }
            tryFetchFree(el, r2keys.full, idToken, function onNotFound() {
              tryFetchFree(el, r2keys.short, idToken, function onNotFound2() {
                showError(el,
                  'Konten tidak ditemukan.<br>' +
                  '<small style="color:#6b7280">Coba: ' + r2keys.full + '<br>atau: ' + r2keys.short + '</small>'
                );
              });
            });
            return;
          }

         
          if (typeof r2keys === 'string') {
            isNovel ? fetchNovel(el, r2keys, idToken)
                    : fetchManga(el, r2keys, idToken);
            return;
          }
          var tryFetch = isNovel ? fetchNovel : fetchManga;
          tryFetch(el, r2keys.full, idToken, function onNotFound() {
            tryFetch(el, r2keys.short, idToken, function onNotFound2() {
              showError(el,
                'Konten tidak ditemukan.<br>' +
                '<small style="color:#6b7280">Coba: ' + r2keys.full + '<br>atau: ' + r2keys.short + '</small>'
              );
            });
          });
        }).catch(function (err) {
          showError(el, 'Gagal mendapatkan token: ' + err.message);
        });
      });
    }

    
    var _imgQueueFree        = [];
    var _imgLoadingCountFree = 0;
    var _IMG_MAX_FREE        = 5;

    function _imgEnqueueFree(img, key, token) {
      if (_imgLoadingCountFree < _IMG_MAX_FREE) {
        _imgLoadingCountFree++;
        _doFetchImageFree(img, key, token);
      } else {
        _imgQueueFree.push({ img: img, key: key, token: token });
      }
    }

    function _imgDoneFree() {
      _imgLoadingCountFree--;
      _imgDoneCount++;
      _updateProgressBar();
      if (_imgQueueFree.length > 0) {
        var next = _imgQueueFree.shift();
        _imgLoadingCountFree++;
        _doFetchImageFree(next.img, next.key, next.token);
      }
    }

    function _doFetchImageFree(imgEl, key, idToken) {
      fetch(WORKER_URL + '/content/free?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(idToken))
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function(blob) {
          var blobUrl = URL.createObjectURL(blob);
          imgEl.src = blobUrl;
          imgEl.onload = function() {
            if (imgEl.parentNode) imgEl.parentNode.style.minHeight = '';
            if (imgEl._skelEl) { imgEl._skelEl.style.display = 'none'; }
            if (imgEl._numEl)  { imgEl._numEl.style.display  = 'none'; }
            imgEl.style.opacity = '1';
            _imgDoneFree();
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
          };
          imgEl.onerror = function() {
            if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
            URL.revokeObjectURL(blobUrl);
            _imgDoneFree();
          };
        })
        .catch(function() {
          imgEl.style.cssText = 'width:100%;display:block;min-height:200px;background:#1f2937;';
          if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
          _imgDoneFree();
        });
    }

    function fetchMangaFree(el, r2key, idToken, onNotFound) {
      fetch(WORKER_URL + '/content/free/list?folder=' + encodeURIComponent(r2key) + '&token=' + encodeURIComponent(idToken))
      .then(function(res) {
        if (!res.ok) {
          if (res.status === 401) { showGate(el); return null; }
          if (res.status === 404) { if (typeof onNotFound === 'function') { onNotFound(); return null; } }
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function(data) {
        if (!data) return;
        if (!data.ok) {
          if (data.reason === 'missing_token' || data.reason === 'invalid_token') { showGate(el); return; }
          if (typeof onNotFound === 'function') { onNotFound(); return; }
          showError(el, 'File tidak ditemukan: ' + r2key);
          return;
        }
        if (!data.pages || !data.pages.length) {
          if (typeof onNotFound === 'function') { onNotFound(); return; }
          showError(el, 'Tidak ada gambar di folder: ' + r2key);
          return;
        }

        _imgQueueFree        = [];
        _imgLoadingCountFree = 0;
        el.innerHTML = '';
        var wrapper = document.createElement('div');
        wrapper.className = 'manga-reader';
        el.appendChild(wrapper);

        // Progress bar global untuk free chapter
        _initProgressBar(el, data.pages.length);

        setTimeout(function() {
          if (typeof window.buildComicModalControls === 'function') window.buildComicModalControls();
        }, 400);

        var observer = ('IntersectionObserver' in window)
          ? new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                var img = entry.target;
                _imgEnqueueFree(img, img._r2key, idToken);
              });
            }, { rootMargin: '600px 0px' })
          : null;

        data.pages.forEach(function(page, i) {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'position:relative;width:100%;min-height:70vh;background:#1f2937;margin-bottom:0;scroll-snap-align:start;flex-shrink:0;box-sizing:border-box;';

          var skel = document.createElement('div');
          skel.className = 'r2-page-skel';
          wrap.appendChild(skel);

          var num = document.createElement('span');
          num.textContent = (i + 1) + ' / ' + data.pages.length;
          num.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#6b7280;font-size:13px;pointer-events:none;z-index:1;';
          wrap.appendChild(num);
          var img = document.createElement('img');
          img.alt = 'Halaman ' + (i + 1);
          img.style.cssText = 'width:100%;height:auto;display:block;position:relative;z-index:1;max-width:100%;opacity:0;transition:opacity .25s;';
          img.className = 'ch-page';
          img._r2key = page.key;
          img._skelEl = skel;
          img._numEl  = num;
          if (i < 2) {
            _imgEnqueueFree(img, page.key, idToken);
          } else if (observer) {
            observer.observe(img);
          } else {
            _imgEnqueueFree(img, page.key, idToken);
          }
          wrap.appendChild(img);
          wrapper.appendChild(wrap);
        });
      })
      .catch(function(err) { showError(el, 'Error memuat daftar halaman: ' + err.message); });
    }

    function fetchNovelFree(el, r2key, idToken, onNotFound) {
      var key = r2key.endsWith('text.json') ? r2key : r2key + '/text.json';
      fetch(WORKER_URL + '/content/free?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(idToken))
        .then(function(res) {
          if (!res.ok) {
            if (res.status === 401) { showGate(el); return null; }
            if (res.status === 404) { if (typeof onNotFound === 'function') { onNotFound(); return null; } }
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function(data) {
          if (!data) return;
          if (data.reason === 'missing_token' || data.reason === 'invalid_token') { showGate(el); return; }
          renderNovel(el, data);
        })
        .catch(function(err) { showError(el, 'Gagal memuat teks: ' + err.message); });
    }

    var TELEGRAM_BOT_USERNAME_FALLBACK = 'langitoren_sukses_bot';

    function getPwSessionId() {
      try {
        var s = localStorage.getItem('lo_pw_sid');
        if (!s) {
          s = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : ('sid-' + Date.now() + '-' + Math.random().toString(36).slice(2));
          localStorage.setItem('lo_pw_sid', s);
        }
        return s;
      } catch (e) {
        return 'sid-' + Date.now();
      }
    }

    var PW_SESSION_CACHE_KEY = 'lo_pw_session_tok';

    function getPwToken() {
      try {
        var raw = sessionStorage.getItem(PW_SESSION_CACHE_KEY);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (obj && obj.token && obj.expiresAt > Date.now()) return obj;
      } catch (e) {}
      return null;
    }

    function setPwToken(token, expiresAt) {
      try {
        sessionStorage.setItem(PW_SESSION_CACHE_KEY, JSON.stringify({ token: token, expiresAt: expiresAt }));
      } catch (e) {}
    }

    function clearPwToken() {
      try { sessionStorage.removeItem(PW_SESSION_CACHE_KEY); } catch (e) {}
    }

    function initPwReader(el, r2keys, isNovel) {
      var folder = (typeof r2keys === 'string') ? r2keys : r2keys.full;

      function proceedPwFlow() {
        var cached = getPwToken();
        if (cached) {
          // Token sesi masih aktif (<5 menit sejak verifikasi terakhir) ->
          // chapter "Lock, pw" lain otomatis kebuka juga, tanpa minta password lagi.
          isNovel ? fetchNovelPw(el, folder, cached.token)
                  : fetchMangaPw(el, folder, cached.token);
          return;
        }
        showGatePw(el, folder, isNovel);
      }

      // Kalau user sudah LOGIN & SUBSCRIBE aktif -> buka langsung lewat jalur
      // normal (/content, sama seperti chapter Lock biasa), TIDAK perlu password sama sekali.
      // Kalau BELUM LOGIN -> tampilkan popup login dulu (mirip Lock,Free), gate
      // password baru muncul setelah user login.
      waitForAuth(function (user) {
        if (!user) {
          if (typeof window.openLockPopup === 'function') {
            window.openLockPopup(el.getAttribute('data-post-title') || 'Chapter ini');
          } else {
            showGatePw(el, folder, isNovel);
          }
          return;
        }

        var afterSubCheck = function (isSubscribed) {
          if (!isSubscribed) { proceedPwFlow(); return; }

          user.getIdToken(false).then(function (idToken) {
            if (typeof r2keys === 'string') {
              isNovel ? fetchNovel(el, r2keys, idToken) : fetchManga(el, r2keys, idToken);
              return;
            }
            var tryFetch = isNovel ? fetchNovel : fetchManga;
            tryFetch(el, r2keys.full, idToken, function onNotFound() {
              tryFetch(el, r2keys.short, idToken, function onNotFound2() { proceedPwFlow(); });
            });
          }).catch(function () { proceedPwFlow(); });
        };

        if (typeof window.siteWaitSubscribed === 'function') {
          window.siteWaitSubscribed(afterSubCheck, 5000);
        } else {
          afterSubCheck(typeof window.siteIsSubscribed === 'function' ? window.siteIsSubscribed() : false);
        }
      });
    }

    var _imgQueuePw        = [];
    var _imgLoadingCountPw = 0;
    var _IMG_MAX_PW        = 5;

    function _imgEnqueuePw(img, key, token, folder, el, isNovel) {
      if (_imgLoadingCountPw < _IMG_MAX_PW) {
        _imgLoadingCountPw++;
        _doFetchImagePw(img, key, token, folder, el, isNovel);
      } else {
        _imgQueuePw.push({ img: img, key: key, token: token, folder: folder, el: el, isNovel: isNovel });
      }
    }

    function _imgDonePw() {
      _imgLoadingCountPw--;
      _imgDoneCount++;
      _updateProgressBar();
      if (_imgQueuePw.length > 0) {
        var next = _imgQueuePw.shift();
        _imgLoadingCountPw++;
        _doFetchImagePw(next.img, next.key, next.token, next.folder, next.el, next.isNovel);
      }
    }

    function _doFetchImagePw(imgEl, key, token, folder, el, isNovel) {
      fetch(WORKER_URL + '/content/pw?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(token))
        .then(function(res) {
          if (res.status === 401) {
            clearPwToken();
            if (el) showGatePw(el, folder, isNovel, 'Sesi password sudah habis. Silakan minta password baru.');
            throw new Error('unauthorized');
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function(blob) {
          var blobUrl = URL.createObjectURL(blob);
          imgEl.src = blobUrl;
          imgEl.onload = function() {
            if (imgEl.parentNode) imgEl.parentNode.style.minHeight = '';
            if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
            if (imgEl._numEl)  imgEl._numEl.style.display  = 'none';
            imgEl.style.opacity = '1';
            _imgDonePw();
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
          };
          imgEl.onerror = function() {
            if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
            URL.revokeObjectURL(blobUrl);
            _imgDonePw();
          };
        })
        .catch(function() {
          imgEl.style.cssText = 'width:100%;display:block;min-height:200px;background:#1f2937;';
          if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
          _imgDonePw();
        });
    }

    function fetchMangaPw(el, folder, token) {
      fetch(WORKER_URL + '/content/pw/list?folder=' + encodeURIComponent(folder) + '&token=' + encodeURIComponent(token))
        .then(function(res) {
          if (res.status === 401) {
            clearPwToken();
            showGatePw(el, folder, false, 'Sesi password sudah habis. Silakan minta password baru.');
            return null;
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          if (!data) return;
          if (!data.ok) {
            showError(el, 'Gagal memuat halaman: ' + (data.reason || 'unknown'));
            return;
          }
          if (!data.pages || !data.pages.length) {
            showError(el, 'Tidak ada gambar di folder: ' + folder);
            return;
          }

          _imgQueuePw        = [];
          _imgLoadingCountPw = 0;
          el.innerHTML = '';
          var wrapper = document.createElement('div');
          wrapper.className = 'manga-reader';
          el.appendChild(wrapper);

          _initProgressBar(el, data.pages.length);
          setTimeout(function() {
            if (typeof window.buildComicModalControls === 'function') window.buildComicModalControls();
          }, 400);

          var observer = ('IntersectionObserver' in window)
            ? new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                  if (!entry.isIntersecting) return;
                  observer.unobserve(entry.target);
                  var img = entry.target;
                  _imgEnqueuePw(img, img._r2key, token, folder, el, false);
                });
              }, { rootMargin: '600px 0px' })
            : null;

          data.pages.forEach(function(page, i) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'position:relative;width:100%;min-height:70vh;background:#1f2937;margin-bottom:0;scroll-snap-align:start;flex-shrink:0;box-sizing:border-box;';

            var skel = document.createElement('div');
            skel.className = 'r2-page-skel';
            wrap.appendChild(skel);

            var num = document.createElement('span');
            num.textContent = (i + 1) + ' / ' + data.pages.length;
            num.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#6b7280;font-size:13px;pointer-events:none;z-index:1;';
            wrap.appendChild(num);

            var img = document.createElement('img');
            img.alt = 'Halaman ' + (i + 1);
            img.style.cssText = 'width:100%;height:auto;display:block;position:relative;z-index:1;max-width:100%;opacity:0;transition:opacity .25s;';
            img.className = 'ch-page';
            img._r2key = page.key;
            img._skelEl = skel;
            img._numEl  = num;
            if (i < 2) {
              _imgEnqueuePw(img, page.key, token, folder, el, false);
            } else if (observer) {
              observer.observe(img);
            } else {
              _imgEnqueuePw(img, page.key, token, folder, el, false);
            }
            wrap.appendChild(img);
            wrapper.appendChild(wrap);
          });
        })
        .catch(function(err) { showError(el, 'Error memuat daftar halaman: ' + err.message); });
    }

    function fetchNovelPw(el, folder, token) {
      var key = folder.endsWith('text.json') ? folder : folder + '/text.json';
      fetch(WORKER_URL + '/content/pw?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(token))
        .then(function(res) {
          if (res.status === 401) {
            clearPwToken();
            showGatePw(el, folder, true, 'Sesi password sudah habis. Silakan minta password baru.');
            return null;
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          if (!data) return;
          if (!data.ok) { showError(el, 'Gagal memuat teks: ' + (data.reason || 'unknown')); return; }
          renderNovel(el, data);
        })
        .catch(function(err) { showError(el, 'Gagal memuat teks: ' + err.message); });
    }

    var _pwCountdownTimer = null;

    function showGatePw(el, folder, isNovel, noticeMsg) {
      if (el && el.setAttribute) el.setAttribute('data-lo-state', 'gate');
      if (_pwCountdownTimer) { clearInterval(_pwCountdownTimer); _pwCountdownTimer = null; }

      el.innerHTML =
        '<div style="text-align:center;padding:2rem 1rem;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.25);border-radius:12px;pointer-events:auto;">' +
          '<svg style="width:40px;height:40px;color:#8b5cf6;margin:0 auto 0.75rem;display:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M12 1C8.676 1 6 3.676 6 7v1H4v14h16V8h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 110 4 2 2 0 010-4z"/>' +
          '</svg>' +
          '<p style="font-weight:600;margin-bottom:0.5rem;color:#8b5cf6">Chapter ini digembok dengan Password</p>' +
          '<p style="font-size:0.85rem;color:#9ca3af;margin-bottom:0.75rem">Ambil password lewat bot Telegram kami. Password acak, berlaku <b>10 menit</b> sejak dikirim.</p>' +
          '<div style="font-size:0.78rem;color:#c4b5fd;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:1rem;text-align:left;line-height:1.5;">' +
            '💡 Mau buka chapter ini <b>tanpa password</b>? ' +
            '<a href="/p/profil.html" style="color:#a855f7;font-weight:600;text-decoration:underline;pointer-events:auto;">Support Langitoren</a> ' +
            'dan langsung akses semua chapter terkunci kapan saja.<br/>' +
          '</div>' +
          (noticeMsg ? '<p style="font-size:0.8rem;color:#f59e0b;margin-bottom:1rem">' + noticeMsg + '</p>' : '') +
          '<button id="pwGetBtn" style="background:#0088cc;color:#fff;border:none;border-radius:8px;padding:0.6rem 1.2rem;font-size:0.9rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;pointer-events:auto;">' +
            '<svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-2 1.93c-.23.23-.42.42-.82.42z"/></svg>' +
            'Info Password' +
          '</button>' +
          '<p id="pwCountdownLabel" style="font-size:0.75rem;color:#6b7280;margin-top:0.5rem;min-height:1em;"></p>' +
          '<div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">' +
            '<input id="pwGateInput" type="text" inputmode="numeric" maxlength="6" placeholder="Masukkan password" ' +
              'style="border:1px solid #4b5563;background:#111827;color:#fff;border-radius:8px;padding:0.55rem 0.8rem;font-size:0.9rem;width:160px;text-align:center;letter-spacing:2px;pointer-events:auto;"/>' +
            '<button id="pwSubmitBtn" title="Masukkan Password" aria-label="Masukkan Password" style="background:#8b5cf6;color:#fff;border:none;border-radius:8px;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;flex-shrink:0;">' +
              '<svg style="width:19px;height:19px" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
            '</button>' +
          '</div>' +
          '<p id="pwStatusMsg" style="font-size:0.8rem;color:#ef4444;margin-top:0.6rem;min-height:1em;"></p>' +
        '</div>';

      var getBtn      = document.getElementById('pwGetBtn');
      var submitBtn    = document.getElementById('pwSubmitBtn');
      var input        = document.getElementById('pwGateInput');
      var statusMsg    = document.getElementById('pwStatusMsg');
      var countdownLbl = document.getElementById('pwCountdownLabel');

      getBtn.addEventListener('click', function() {
 
        var sessionId = getPwSessionId();
        window.open('https://t.me/' + TELEGRAM_BOT_USERNAME_FALLBACK + '?start=' + sessionId, '_blank');

        // Countdown lokal 10 menit (hanya indikator UX, validasi asli di server)
        var remaining = 600;
        if (_pwCountdownTimer) clearInterval(_pwCountdownTimer);
        countdownLbl.textContent = 'Password berlaku sampai 10:00 lagi...';
        _pwCountdownTimer = setInterval(function() {
          remaining--;
          if (remaining <= 0) {
            clearInterval(_pwCountdownTimer);
            countdownLbl.textContent = 'Password sudah kadaluarsa. Klik "Info Password" lagi.';
            return;
          }
          var m = Math.floor(remaining / 60);
          var s = remaining % 60;
          countdownLbl.textContent = 'Password berlaku ' + m + ':' + (s < 10 ? '0' : '') + s + ' lagi...';
        }, 1000);
      });

      submitBtn.addEventListener('click', function() {
        var password = (input.value || '').trim();
        if (!password) { statusMsg.textContent = 'Masukkan password dulu.'; return; }

        submitBtn.disabled = true;
        statusMsg.style.color = '#9ca3af';
        statusMsg.textContent = 'Memverifikasi...';

        var sessionId = getPwSessionId();

        fetch(WORKER_URL + '/content/pw-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, password: password })
        })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            submitBtn.disabled = false;
            if (!data || !data.ok) {
              statusMsg.style.color = '#ef4444';
              statusMsg.textContent = 'Password salah atau sudah kadaluarsa.';
              return;
            }
            setPwToken(data.token, data.expiresAt);
            if (_pwCountdownTimer) { clearInterval(_pwCountdownTimer); _pwCountdownTimer = null; }
            showSkeleton(el, isNovel);
            isNovel ? fetchNovelPw(el, folder, data.token)
                    : fetchMangaPw(el, folder, data.token);
          })
          .catch(function() {
            submitBtn.disabled = false;
            statusMsg.style.color = '#ef4444';
            statusMsg.textContent = 'Gagal menghubungi server.';
          });
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitBtn.click();
      });
    }

    // ─────────────────────────────────────────────────────────
    function waitForAuth(cb) {
      // Pakai onAuthStateChanged supaya tidak ada race condition
      // currentUser bisa null saat Firebase belum selesai inisialisasi
      if (typeof window.siteGetFirebase !== 'function') {
        // siteGetFirebase belum ada — polling sampai ada (maks 5 detik)
        var attempts = 0;
        var t = setInterval(function() {
          attempts++;
          if (typeof window.siteGetFirebase === 'function') {
            clearInterval(t);
            waitForAuth(cb);
          } else if (attempts > 50) {
            clearInterval(t);
            cb(null);
          }
        }, 100);
        return;
      }
      var fb = window.siteGetFirebase();
      if (!fb || !fb.auth) { cb(null); return; }

      // Jika sudah ada user (auth sudah resolved sebelumnya), langsung pakai
      if (fb.auth.currentUser !== null) {
        cb(fb.auth.currentUser);
        return;
      }
      // Belum resolve — tunggu event onAuthStateChanged sekali
      var unsub = fb.auth.onAuthStateChanged(function(user) {
        unsub(); // unsubscribe setelah terpanggil pertama kali
        cb(user);
      });
      // Safety timeout 10 detik — jangan sampai nunggu selamanya
      setTimeout(function() {
        try { unsub(); } catch(e) {}
        if (fb.auth.currentUser !== null) {
          cb(fb.auth.currentUser);
        } else {
          cb(null);
        }
      }, 10000);
    }

    
    var IDB_NAME    = 'langitoren_img_cache';
    var IDB_STORE   = 'images';
    var IDB_VERSION = 2; // v2: simpan Blob langsung, bukan base64
    var CACHE_TTL   = 2 * 24 * 60 * 60 * 1000; // 2 hari dalam ms
    var _idbReady   = null; // Promise<IDBDatabase>

    function openIDB() {
      if (_idbReady) return _idbReady;
      _idbReady = new Promise(function(resolve, reject) {
        if (!window.indexedDB) { resolve(null); return; } // fallback jika tidak support
        var req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          // Hapus store lama jika ada (migrasi v1→v2: base64 → Blob)
          if (db.objectStoreNames.contains(IDB_STORE)) {
            db.deleteObjectStore(IDB_STORE);
          }
          // Buat ulang store bersih untuk v2
          var store = db.createObjectStore(IDB_STORE, { keyPath: 'cacheKey' });
          store.createIndex('uid',     'uid',     { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        };
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror   = function()  { resolve(null); }; // gagal → skip cache, fetch normal
      });
      return _idbReady;
    }

    function idbGet(uid, r2key) {
      return openIDB().then(function(db) {
        if (!db) return null;
        return new Promise(function(resolve) {
          var cacheKey = uid + '::' + r2key;
          var tx  = db.transaction(IDB_STORE, 'readonly');
          var req = tx.objectStore(IDB_STORE).get(cacheKey);
          req.onsuccess = function() {
            var rec = req.result;
            if (!rec) { resolve(null); return; }
            if (Date.now() > rec.expires) {
              idbDelete(uid, r2key);
              resolve(null);
              return;
            }
            // v2: Blob tersimpan langsung → createObjectURL instan (zero-copy, no base64)
            if (rec.blob) {
              try { resolve(URL.createObjectURL(rec.blob)); }
              catch(e) { resolve(null); }
              return;
            }
            resolve(null);
          };
          req.onerror = function() { resolve(null); };
        });
      });
    }

    // Simpan satu gambar ke cache sebagai Blob (v2) — tidak ada FileReader, tidak ada base64
    function idbSet(uid, r2key, blob) {
      return openIDB().then(function(db) {
        if (!db || !blob) return;
        var cacheKey = uid + '::' + r2key;
        var tx  = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({
          cacheKey: cacheKey,
          uid:      uid,
          r2key:    r2key,
          blob:     blob,         // simpan Blob langsung — hemat ~33% storage + lebih cepat
          expires:  Date.now() + CACHE_TTL,
          saved:    Date.now()
        });
      });
    }

    // Hapus satu gambar dari cache
    function idbDelete(uid, r2key) {
      return openIDB().then(function(db) {
        if (!db) return;
        var cacheKey = uid + '::' + r2key;
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(cacheKey);
      });
    }

    // ── Hapus SEMUA cache milik uid tertentu ─────────────────────
    // Dipanggil saat subscription habis terdeteksi (onSnapshot)
    function idbClearUser(uid) {
      return openIDB().then(function(db) {
        if (!db) return;
        return new Promise(function(resolve) {
          var tx    = db.transaction(IDB_STORE, 'readwrite');
          var store = tx.objectStore(IDB_STORE);
          var index = store.index('uid');
          var req   = index.openCursor(IDBKeyRange.only(uid));
          req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) { cursor.delete(); cursor.continue(); }
          };
          tx.oncomplete = function() { resolve(); };
          tx.onerror    = function() { resolve(); };
        });
      });
    }

    function idbPurgeExpired() {
      openIDB().then(function(db) {
        if (!db) return;
        var tx    = db.transaction(IDB_STORE, 'readwrite');
        var store = tx.objectStore(IDB_STORE);
        var index = store.index('expires');
        var range = IDBKeyRange.upperBound(Date.now()); // semua yang sudah lewat
        var req   = index.openCursor(range);
        req.onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
        };
      });
    }
    window._onSubExpired = function(uid) {
      if (uid) {
        idbClearUser(uid).then(function() {
          console.log('[Cache] Cache user ' + uid + ' dihapus karena subscription habis');
        });
      }
    };

    
    var _imgQueue        = [];
    var _imgLoadingCount = 0;
    var _IMG_MAX         = 10; // maks gambar diunduh bersamaan
    var _imgTotal        = 0;
    var _imgDoneCount    = 0;

    // ── Progress bar global
    function _initProgressBar(el, total) {
      _imgTotal     = total;
      _imgDoneCount = 0;
      var existing = document.getElementById('r2-dl-progress');
      if (existing) existing.remove();
      if (!total) return;

      var styleId = 'r2-progress-style';
      if (!document.getElementById(styleId)) {
        var s = document.createElement('style');
        s.id = styleId;
        s.textContent = [
          '@keyframes r2BarPulse{0%,100%{opacity:1}50%{opacity:.6}}',
          '#r2-dl-progress{position:sticky;top:var(--r2-navbar-h,0px);z-index:30;width:100%;padding:6px 10px;',
          'background:rgba(17,24,39,.92);backdrop-filter:blur(6px);',
          'display:flex;align-items:center;gap:8px;box-sizing:border-box;}',
          '#r2-dl-progress .r2p-bar-wrap{flex:1;height:6px;background:#374151;border-radius:99px;overflow:hidden;}',
          '#r2-dl-progress .r2p-bar{height:100%;width:0%;background:linear-gradient(90deg,#38bdf8,#818cf8);',
          'border-radius:99px;transition:width .3s ease;animation:r2BarPulse 1.8s ease infinite;}',
          '#r2-dl-progress .r2p-label{font-size:11px;color:#9ca3af;white-space:nowrap;min-width:60px;text-align:right;}',
          '#r2-dl-progress.r2p-done .r2p-bar{background:#4ade80;animation:none;}',
          '#r2-dl-progress.r2p-done .r2p-label{color:#4ade80;}',
          '.r2-page-skel{position:absolute;inset:0;background:linear-gradient(90deg,#1f2937 25%,#374151 50%,#1f2937 75%);',
          'background-size:200% 100%;animation:r2SkelAnim 1.5s infinite;pointer-events:none;z-index:0;}',
          '@keyframes r2SkelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}'
        ].join('');
        document.head.appendChild(s);
      }

      var bar = document.createElement('div');
      bar.id = 'r2-dl-progress';
      bar.innerHTML = '<div class="r2p-bar-wrap"><div class="r2p-bar" id="r2p-fill"></div></div>' +
                      '<span class="r2p-label" id="r2p-label">0 / ' + total + '</span>';

      // Ukur tinggi navbar chapter (mobile, fixed di top) supaya progress bar
      // menempel TEPAT DI BAWAHNYA, bukan bertindihan dengan navbar.
      // Navbar terdiri dari: progress-scroll bar (h-1) + #reader-header + #navi.
      function _measureNavbarHeight() {
        var h = 0;
        var navWrap = document.querySelector('[data-history-chapter-title]');
        if (navWrap && getComputedStyle(navWrap).display !== 'none') {
          h = navWrap.getBoundingClientRect().height;
        }
        return h;
      }
      var navH = _measureNavbarHeight();
      bar.style.setProperty('--r2-navbar-h', navH + 'px');
      document.documentElement.style.setProperty('--r2-navbar-h', navH + 'px');

      // Re-ukur saat resize/orientation change (navbar bisa berubah tinggi)
      if (!window._r2NavbarResizeBound) {
        window._r2NavbarResizeBound = true;
        window.addEventListener('resize', function() {
          var b = document.getElementById('r2-dl-progress');
          if (!b) return;
          var newH = _measureNavbarHeight();
          document.documentElement.style.setProperty('--r2-navbar-h', newH + 'px');
        });
      }

      // Sisipkan sebelum reader / tepat di atas el
      if (el && el.parentNode) {
        el.parentNode.insertBefore(bar, el);
      } else {
        document.body.prepend(bar);
      }
    }

    function _updateProgressBar() {
      var fill  = document.getElementById('r2p-fill');
      var label = document.getElementById('r2p-label');
      if (!fill || !label || !_imgTotal) return;
      var pct = Math.round((_imgDoneCount / _imgTotal) * 100);
      fill.style.width = pct + '%';
      label.textContent = _imgDoneCount + ' / ' + _imgTotal;
      if (_imgDoneCount >= _imgTotal) {
        var bar = document.getElementById('r2-dl-progress');
        if (bar) {
          bar.classList.add('r2p-done');
          label.textContent = '✓ Selesai';
          setTimeout(function() {
            if (bar.parentNode) bar.style.transition = 'opacity .5s';
            bar.style.opacity = '0';
            setTimeout(function() { if (bar.parentNode) bar.remove(); }, 500);
          }, 1800);
        }
      }
    }

    function _imgEnqueue(img, key, token, uid) {
      if (_imgLoadingCount < _IMG_MAX) {
        _imgLoadingCount++;
        _doFetchImage(img, key, token, uid);
      } else {
        _imgQueue.push({ img: img, key: key, token: token, uid: uid });
      }
    }

    function _imgDone() {
      _imgLoadingCount--;
      _imgDoneCount++;
      _updateProgressBar();
      if (_imgQueue.length > 0) {
        var next = _imgQueue.shift();
        _imgLoadingCount++;
        _doFetchImage(next.img, next.key, next.token, next.uid);
      }
    }

    
    function fetchManga(el, r2key, idToken, onNotFound) {
      var r2keyFolder = r2key;

      // Timeout eksplisit — kalau Worker hang/lambat, jangan diam di skeleton selamanya
      var _listAbort = new AbortController();
      var _listTimeoutId = setTimeout(function() { _listAbort.abort(); }, 20000);

      fetch(WORKER_URL + '/content/list?folder=' + encodeURIComponent(r2keyFolder) + '&token=' + encodeURIComponent(idToken), { signal: _listAbort.signal })
      .then(function(res) {
        clearTimeout(_listTimeoutId);
        // Worker mengembalikan 403 sebagai JSON dengan reason, bukan HTTP 403
        // tapi kita tangkap keduanya untuk keamanan
        if (!res.ok) {
          if (res.status === 403) { showGateSubscription(el); return null; }
          if (res.status === 404) {
            if (typeof onNotFound === 'function') { onNotFound(); return null; }
          }
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function(data) {
        if (!data) return;
        if (!data.ok) {
          if (data.reason === 'no_active_subscription') { showGateSubscription(el); return; }
          if (typeof onNotFound === 'function') { onNotFound(); return; }
          showError(el, 'File tidak ditemukan di R2: ' + r2keyFolder);
          return;
        }
        if (!data.pages || !data.pages.length) {
          if (typeof onNotFound === 'function') { onNotFound(); return; }
          showError(el, 'Tidak ada gambar di folder ini: ' + r2keyFolder);
          return;
        }

        // Ambil UID untuk cache key
        var uid = '';
        try {
          var fb = window.siteGetFirebase && window.siteGetFirebase();
          uid = (fb && fb.auth && fb.auth.currentUser) ? fb.auth.currentUser.uid : '';
        } catch(e) {}

        // Reset queue setiap kali chapter baru dimuat — PROGRESS BAR dikelola oleh _initProgressBar
        _imgQueue        = [];
        _imgLoadingCount = 0;

        // Tahan tinggi skeleton selama transisi supaya halaman tidak kolaps/berkedip hitam
        var _prevH = el.offsetHeight;
        if (_prevH) el.style.minHeight = _prevH + 'px';
        el.setAttribute('data-lo-state', 'loaded');

        var progWrap = document.createElement('span'); // dummy, tidak dipakai
        progWrap.id = 'ch-img-progress-DISABLED';
        var wrapper = document.createElement('div');
        wrapper.className = 'manga-reader';
        // Ganti isi reader sekaligus (atomik) — tidak ada frame kosong di antara
        if (el.replaceChildren) el.replaceChildren(wrapper); else { el.innerHTML = ''; el.appendChild(wrapper); }
        // Lepas penahan tinggi setelah halaman pertama tampil
        setTimeout(function() { el.style.minHeight = ''; }, 1500);

        // Inisialisasi progress bar global untuk chapter ini
        _initProgressBar(el, data.pages.length);

        // Build tombol Comic modal setelah wrapper Lock siap
        setTimeout(function() {
          if (typeof window.buildComicModalControls === 'function') {
            window.buildComicModalControls();
          }
        }, 400);

        // IntersectionObserver — gambar masuk viewport baru di-fetch
        var observer = ('IntersectionObserver' in window)
          ? new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                var img = entry.target;
                _imgEnqueue(img, img._r2key, idToken, uid);
              });
            }, { rootMargin: '1500px 0px' }) // prefetch 1500px sebelum masuk viewport
          : null;

        _updateProgressBar(); // inisialisasi tampilan 0/N

        data.pages.forEach(function(page, i) {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'position:relative;width:100%;min-height:70vh;background:#1f2937;margin-bottom:0;scroll-snap-align:start;flex-shrink:0;box-sizing:border-box;';

          // Skeleton shimmer per gambar
          var skeleton = document.createElement('div');
          skeleton.className = 'ch-img-skeleton';
          wrap.appendChild(skeleton);

          var num = document.createElement('span');
          num.textContent = (i + 1) + ' / ' + data.pages.length;
          num.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#6b7280;font-size:13px;pointer-events:none;z-index:1;';
          wrap.appendChild(num);

          var img = document.createElement('img');
          img.alt = 'Halaman ' + (i + 1);
          img.style.cssText = 'width:100%;height:auto;display:block;position:relative;z-index:2;max-width:100%;opacity:0;transition:opacity 0.3s ease;';
          img.className = 'ch-page';
          img._r2key = page.key;
          img._onLoaded = (function(sk, nm, im) { return function() {
            sk.style.display = 'none';
            nm.style.display = 'none';
            im.style.opacity = '1';
            // progress tracking ditangani oleh _imgDone() → _updateProgressBar()
          }; })(skeleton, num, img);

          if (i < 8) {
            _imgEnqueue(img, page.key, idToken, uid);
          } else if (observer) {
            observer.observe(img);
          } else {
            _imgEnqueue(img, page.key, idToken, uid);
          }

          wrap.appendChild(img);
          wrapper.appendChild(wrap);
        });
      })
      .catch(function(err) {
        clearTimeout(_listTimeoutId);
        var msg = (err && err.name === 'AbortError')
          ? 'Koneksi terlalu lambat memuat daftar halaman.'
          : 'Error memuat daftar halaman: ' + (err && err.message ? err.message : 'unknown');
        showError(el,
          msg + '<br><button onclick="location.reload()" style="margin-top:8px;background:#374151;color:#e5e7eb;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">↺ Coba Lagi</button>'
        );
      });
    }

    // ─────────────────────────────────────────────────────────
    function _doFetchImage(imgEl, key, idToken, uid) {
      idbGet(uid, key).then(function(cached) {

        if (cached) {
          // Cache HIT — blob URL dari IDB, langsung tampil tanpa decode base64
          imgEl.src = cached;
          imgEl.onload = function() {
            if (imgEl.parentNode) imgEl.parentNode.style.minHeight = '';
            if (imgEl._skelEl) { imgEl._skelEl.style.display = 'none'; }
            if (imgEl._numEl)  { imgEl._numEl.style.display  = 'none'; }
            imgEl.style.opacity = '1';
            if (typeof imgEl._onLoaded === 'function') imgEl._onLoaded();
            _imgDone();
            // Revoke blob URL setelah render — hindari memory leak
            setTimeout(function() { URL.revokeObjectURL(cached); }, 60000);
          };
          imgEl.onerror = function() {
            if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
            URL.revokeObjectURL(cached);
            idbDelete(uid, key); // cache corrupt → hapus, supaya next visit re-fetch
            _imgDone();
          };
          return;
        }

        var _imgAbort = new AbortController();
        var _imgTimeoutId = setTimeout(function() { _imgAbort.abort(); }, 20000);
        fetch(WORKER_URL + '/content?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(idToken), { signal: _imgAbort.signal })
          .then(function(res) {
            clearTimeout(_imgTimeoutId);
            if (!res.ok) {
              if (res.status === 403) {
                if (uid) idbClearUser(uid);
                showGateSubscription(imgEl.closest('#reader') || document.getElementById('reader'));
                _imgDone();
                return null;
              }
              throw new Error('HTTP ' + res.status);
            }
            return res.blob(); // blob jauh lebih cepat dari arrayBuffer untuk tampilan
          })
          .then(function(blob) {
            if (!blob) return;

            // Tampil segera via blob URL — zero-copy, tidak ada konversi di main thread
            var blobUrl = URL.createObjectURL(blob);
            imgEl.src = blobUrl;
            imgEl.onload = function() {
              if (imgEl.parentNode) imgEl.parentNode.style.minHeight = '';
              if (imgEl._skelEl) { imgEl._skelEl.style.display = 'none'; }
              if (imgEl._numEl)  { imgEl._numEl.style.display  = 'none'; }
              imgEl.style.opacity = '1';
              if (typeof imgEl._onLoaded === 'function') imgEl._onLoaded();
              _imgDone();

              // Simpan Blob langsung ke IDB — tidak perlu FileReader, tidak ada konversi base64
              if (uid) idbSet(uid, key, blob);
              // Revoke blob URL setelah gambar sudah di-paint browser
              setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
            };
            imgEl.onerror = function() {
              if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
              URL.revokeObjectURL(blobUrl);
              _imgDone();
            };
          })
          .catch(function(err) {
            clearTimeout(_imgTimeoutId);
            // Gagal load — tampilkan placeholder retry, JANGAN reset mode
            imgEl.alt = '';
            imgEl.style.cssText = 'width:100%;display:block;min-height:200px;background:#1f2937;';
            if (imgEl.parentNode) {
              imgEl.parentNode.style.minHeight = '200px';
              // Tambah tombol retry kecil
              var retryBtn = imgEl.parentNode.querySelector('.retry-btn');
              if (!retryBtn) {
                retryBtn = document.createElement('button');
                retryBtn.className = 'retry-btn';
                retryBtn.textContent = '↺ Tap untuk coba lagi';
                retryBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#374151;color:#9ca3af;border:none;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;z-index:2;';
                retryBtn.addEventListener('click', function() {
                  retryBtn.remove();
                  _doFetchImage(imgEl, key, idToken, uid);
                });
                imgEl.parentNode.appendChild(retryBtn);
              }
            }
            _imgDone();
          });
      }).catch(function() {
        // IndexedDB error → tetap fetch normal
        _doFetchImage_noCache(imgEl, key, idToken, uid);
      });
    }

    // Fallback jika IndexedDB error total
    function _doFetchImage_noCache(imgEl, key, idToken, uid) {
      fetch(WORKER_URL + '/content?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(idToken))
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function(blob) {
          var blobUrl = URL.createObjectURL(blob);
          imgEl.src = blobUrl;
          imgEl.onload = function() {
            if (imgEl.parentNode) imgEl.parentNode.style.minHeight = '';
            if (imgEl._skelEl) { imgEl._skelEl.style.display = 'none'; }
            if (imgEl._numEl)  { imgEl._numEl.style.display  = 'none'; }
            imgEl.style.opacity = '1';
            _imgDone();
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
          };
          imgEl.onerror = function() {
            if (imgEl._skelEl) imgEl._skelEl.style.display = 'none';
            URL.revokeObjectURL(blobUrl);
            _imgDone();
          };
        })
        .catch(function(err) {
          imgEl.alt = '';
          imgEl.style.cssText = 'width:100%;display:block;min-height:200px;background:#1f2937;';
          if (imgEl.parentNode) {
            var retryBtn = imgEl.parentNode.querySelector('.retry-btn');
            if (!retryBtn) {
              retryBtn = document.createElement('button');
              retryBtn.className = 'retry-btn';
              retryBtn.textContent = '↺ Tap untuk coba lagi';
              retryBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#374151;color:#9ca3af;border:none;border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;z-index:2;';
              retryBtn.addEventListener('click', function() {
                retryBtn.remove();
                _doFetchImage_noCache(imgEl, key, idToken, uid);
              });
              imgEl.parentNode.appendChild(retryBtn);
            }
          }
          _imgDone();
        });
    }

    // Alias untuk kompatibilitas
    function doFetchImage(imgEl, key, idToken, uid) { _doFetchImage(imgEl, key, idToken, uid || ''); }
    function fetchImageBlob(key, idToken, imgEl) { _doFetchImage(imgEl, key, idToken, ''); }

    function fetchNovel(el, r2key, idToken, onNotFound) {
      var key = r2key.endsWith('text.json') ? r2key : r2key + '/text.json';

      fetch(WORKER_URL + '/content?key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(idToken))
        .then(function (res) {
          if (!res.ok) {
            if (res.status === 404) {
              if (typeof onNotFound === 'function') { onNotFound(); return null; }
            }
            if (res.status === 403) {
              showGateSubscription(el);
              return null;
            }
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          if (!data) return;
          renderNovel(el, data);
        })
        .catch(function (err) {
          showError(el, 'Gagal memuat teks: ' + err.message);
        });
    }

    function renderNovel(el, data) {
      var paragraphs = data.paragraphs || [];
      if (typeof data === 'string') {
        // Fallback plain text
        paragraphs = data.split(/\n\n+/).filter(Boolean);
      }
      el.innerHTML = '';
      var wrapper = document.createElement('div');
      wrapper.className = 'novel-reader is-novel';
      var content = document.createElement('div');
      content.className = 'nr-content';
      paragraphs.forEach(function (p) {
        var para = document.createElement('p');
        para.textContent = p;
        content.appendChild(para);
      });
      wrapper.appendChild(content);
      el.appendChild(wrapper);
    }

  
    function showSkeleton(el, isNovel) {
      if (el && el.setAttribute) el.setAttribute('data-lo-state', 'loading');
      var count = isNovel ? 1 : 5;
      var html  = '';
      for (var i = 0; i < count; i++) {
        html += '<div style="width:100%;background:linear-gradient(90deg,#1f2937 25%,#374151 50%,#1f2937 75%);background-size:200% 100%;animation:1.5s infinite skelAnim;border-radius:4px;margin:8px 0;height:' + (isNovel ? '400px' : '600px') + '"></div>';
      }
      var styleId = 'skel-style';
      if (!document.getElementById(styleId)) {
        var s = document.createElement('style');
        s.id  = styleId;
        s.textContent = '@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}';
        document.head.appendChild(s);
      }
      el.innerHTML = html;
    }

    function showGate(el) {
      if (el && el.setAttribute) el.setAttribute('data-lo-state', 'gate');
      // Gate login — pakai modal yang sudah ada di tema
      var title = el ? (el.getAttribute('data-post-title') || '') : '';
      if (typeof window.openLockPopup === 'function') {
        try {
          window.openLockPopup(title);
        } catch (e) {
          showError(el, 'Gagal membuka popup login. Silakan refresh halaman.');
          return;
        }
        // Fallback: jika setelah popup dipanggil ternyata tidak ada modal
        // yang benar-benar tampil (misal elemen modal belum siap), jangan
        // diamkan reader di skeleton selamanya — tunjukkan pesan + tombol.
        setTimeout(function() {
          var anyModalVisible = Array.prototype.some.call(
            document.querySelectorAll('[id*="lock" i], [id*="Lock"]'),
            function(m) {
              var st = window.getComputedStyle(m);
              return st.display !== 'none' && st.visibility !== 'hidden';
            }
          );
          if (!anyModalVisible && el) {
            showError(el,
              'Silakan login untuk membaca chapter ini.<br>' +
              '<button onclick="location.reload()" style="margin-top:8px;background:#374151;color:#e5e7eb;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">↺ Muat Ulang Halaman</button>'
            );
          }
        }, 800);
      } else {
        showError(el,
          'Silakan login untuk membaca chapter ini.<br>' +
          '<button onclick="location.reload()" style="margin-top:8px;background:#374151;color:#e5e7eb;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">↺ Muat Ulang Halaman</button>'
        );
      }
    }

    function showGateSubscription(el) {
      if (el && el.setAttribute) el.setAttribute('data-lo-state', 'gate');
      // Gate subscription — pakai modal subscribe yang sudah ada di tema
      var title = el ? (el.getAttribute('data-post-title') || '') : '';
      if (typeof window.openLockSubPopup === 'function') {
        window.openLockSubPopup(title);
      } else if (typeof window.openLockPopup === 'function') {
        window.openLockPopup(title);
      }
    }

    // Toast notif saat subscription aktif terdeteksi realtime
    function showSubActivatedToast() {
      var t = document.createElement('div');
      t.style.cssText = 'position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);' +
        'background:linear-gradient(90deg,#4ade80,#22d3ee);color:#0a0a0f;' +
        'padding:0.65rem 1.4rem;border-radius:99px;font-size:0.85rem;font-weight:700;' +
        'z-index:99999;box-shadow:0 4px 20px rgba(74,222,128,0.4);' +
        'animation:toastIn 0.3s ease;white-space:nowrap;';
      t.textContent = '✅ Terima kasih! Memuat konten...';
      var styleEl = document.getElementById('toast-anim-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'toast-anim-style';
        styleEl.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(styleEl);
      }
      document.body.appendChild(t);
      setTimeout(function() { t.remove(); }, 3500);
    }

    function showError(el, msg) {
      if (el && el.setAttribute) el.setAttribute('data-lo-state', 'gate');
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:#f87171;font-size:0.85rem;">' +
        '⚠ ' + msg + '</div>';
    }

  })();
  /**/
