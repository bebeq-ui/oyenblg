/* langitoren: reviews.js (diekstrak dari tema, baris 5889) */
        //
        (function () {

          function waitForFirebase(cb) {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) cb();
            else setTimeout(function(){ waitForFirebase(cb); }, 100);
          }

          waitForFirebase(function () {
            var auth = firebase.auth();
            var db   = firebase.firestore();
            var FV   = firebase.firestore.FieldValue;

            var panel = document.getElementById('fb-comments-panel'); // pakai POST_ID yang sama dengan panel discussion
            if (!panel) return;
            var POST_ID = (panel.dataset.postId && panel.dataset.postId !== '0' && panel.dataset.postId !== '')
              ? panel.dataset.postId
              : (function(){
                  var s = document.getElementById('post-id');
                  if (s && s.dataset.postId && s.dataset.postId !== '0') return s.dataset.postId;
                  return window.location.pathname.replace(/^\/|\/$/g,'').replace(/\//g,'-') || 'post';
                })();

            var listEl    = document.getElementById('fb-reviews-list');
            var wrapperEl = document.getElementById('fb-review-form-wrapper');
            if (!listEl || !wrapperEl) return;

            var currentUser  = null;
            var myReviewData = null; // review milik user sendiri (untuk mode edit)
            var pendingStars = 0;
            var unsubscribe  = null;

            // ── Helpers (duplikat ringan dari modul komentar, supaya modul ini independen) ──
            function esc(s) {
              return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            }
            function timeAgo(ts) {
              if (!ts) return '';
              var sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
              if (sec < 60)    return 'baru saja';
              if (sec < 3600)  return Math.floor(sec/60)  + ' mnt lalu';
              if (sec < 86400) return Math.floor(sec/3600) + ' jam lalu';
              return Math.floor(sec/86400) + ' hari lalu';
            }
            function parseText(raw) {
              var s = esc(raw);
              s = s.replace(/(?<!src=")(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
              s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
              s = s.replace(/\*(.+?)\*/g, '<i>$1</i>');
              s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
              s = s.replace(/`(.+?)`/g, '<code>$1</code>');
              // ||spoiler|| — sebelumnya tidak ada di sini sehingga tampil sebagai teks biasa
              // (tidak tertutup) walau di form komentar sudah berfungsi normal.
              s = s.replace(/\|\|(.+?)\|\|/g, '<span class="fb-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
              s = s.replace(/\n/g, '<br>');
              return s;
            }
            function avatarHtml(photoURL, displayName, size, uid) {
              size = size || 'w-9 h-9';
              var uidAttr = uid ? ' data-uid-avatar-rv="' + uid + '" data-av-size="' + size + '"' : '';
              if (photoURL) {
                return '<img src="' + esc(photoURL) + '"' + uidAttr + ' class="' + size + ' rounded-full object-cover shrink-0" alt="" referrerpolicy="no-referrer">';
              }
              var letter = (displayName || 'A').charAt(0).toUpperCase();
              return '<div' + uidAttr + ' class="' + size + ' rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-100 shrink-0">' + esc(letter) + '</div>';
            }
            var _avatarCache = {};
            function getAvatarUrl(uid, fallbackPhotoURL) {
              if (_avatarCache[uid] !== undefined) return _avatarCache[uid];
              _avatarCache[uid] = fallbackPhotoURL || '';
              db.collection('users').doc(uid).get().then(function(doc) {
                var freshUrl = (doc.exists && doc.data().avatar) ? doc.data().avatar : (fallbackPhotoURL || '');
                _avatarCache[uid] = freshUrl;
                document.querySelectorAll('[data-uid-avatar-rv="' + uid + '"]').forEach(function(el) {
                  if (freshUrl) {
                    el.outerHTML = '<img src="' + esc(freshUrl) + '" data-uid-avatar-rv="' + uid + '" class="' + (el.getAttribute('data-av-size') || 'w-9 h-9') + ' rounded-full object-cover shrink-0" alt="" referrerpolicy="no-referrer">';
                  }
                });
              }).catch(function(){});
              return fallbackPhotoURL || '';
            }

            // ── Status Gembokers real-time (sama pola dengan modul komentar) ──
            var _subListeners = {};
            var _subStatus    = {};
            var _roleStatus   = {};
            function isUidSubscribed(userData) {
              if (!userData || !userData.subscription) return false;
              var endDate = userData.subscription.endDate;
              if (!endDate) return false;
              return new Date(endDate).getTime() > Date.now();
            }
            function applySubBadgeForUid(uid, isSub) {
              document.querySelectorAll('[data-sub-badge-rv][data-uid="' + uid + '"]').forEach(function(el) {
                el.style.display = isSub ? '' : 'none';
              });
            }
            // Outline transparan (bukan fill solid) supaya teks tetap kontras
            // di background gelap. Satu user bisa punya >1 role sekaligus,
            // jadi udata.roles berupa ARRAY dan badge-nya dirender berderet.
            var ROLE_BADGE_MAP = {
              translator: { label: 'Translator', cls: 'text-green-600 dark:text-green-400 border border-green-500/60 dark:border-green-400/50' },
              mod:        { label: 'Mod',         cls: 'text-blue-600 dark:text-blue-400 border border-blue-500/60 dark:border-blue-400/50' },
              dev:        { label: 'Dev',          cls: 'text-red-600 dark:text-red-400 border border-red-500/60 dark:border-red-400/50' }
            };
            function roleBadgeHtml(roles) {
              roles = Array.isArray(roles) ? roles : (roles ? [roles] : []);
              return roles.map(function(role) {
                var info = ROLE_BADGE_MAP[role];
                if (!info) return '';
                return '<span class="text-[0.6rem] font-semibold rounded-xl px-2 py-0.5 bg-transparent ' + info.cls + '">' + info.label + '</span>';
              }).join('');
            }
            function applyRoleBadgeForUid(uid, roles) {
              document.querySelectorAll('[data-role-badge-rv][data-uid="' + uid + '"]').forEach(function(el) {
                el.innerHTML = roleBadgeHtml(roles);
              });
            }
            function watchSubscriber(uid) {
              if (!uid || _subListeners[uid]) return;
              _subListeners[uid] = db.collection('users').doc(uid).onSnapshot(function(doc) {
                var udata = doc.exists ? doc.data() : null;
                var isSub = isUidSubscribed(udata);
                _subStatus[uid] = isSub;
                applySubBadgeForUid(uid, isSub);
                var roles = (udata && Array.isArray(udata.roles)) ? udata.roles : (udata && udata.role ? [udata.role] : []);
                _roleStatus[uid] = roles;
                applyRoleBadgeForUid(uid, roles);
              }, function(){});
            }
            function refreshAllSubBadges() {
              var seen = {};
              document.querySelectorAll('[data-sub-badge-rv],[data-role-badge-rv]').forEach(function(el) {
                var uid = el.getAttribute('data-uid');
                if (!uid || seen[uid]) return;
                seen[uid] = true;
                if (_subStatus[uid] !== undefined) applySubBadgeForUid(uid, _subStatus[uid]);
                if (_roleStatus[uid] !== undefined) applyRoleBadgeForUid(uid, _roleStatus[uid]);
                watchSubscriber(uid);
              });
            }

            // ── Render bintang statis (untuk tampilan review terkirim) ──
            function starsHtml(n) {
              var out = '<span class="fb-review-stars">';
              for (var i=1;i<=5;i++) {
                out += '<svg viewBox="0 0 20 20" fill="' + (i<=n ? '#fbbf24' : '#d1d5db') + '"><path d="M10 1l2.6 5.6 6.2.6-4.7 4.2 1.4 6.1L10 14.8 4.5 17.5l1.4-6.1L1.2 7.2l6.2-.6L10 1z"/></svg>';
              }
              return out + '</span>';
            }

            // ── Render satu review ──────────────────────────────────
            function renderReview(id, data) {
              var isMine    = currentUser && currentUser.uid === data.uid;
              var name      = data.displayName || 'Anonim';
              var lockIcon  = '<svg viewBox="0 0 24 24" style="width:9px;height:9px"><circle cx="12" cy="12" r="11" fill="#f59e0b"/><path d="M7.2 12.3l3.1 3.1 6.3-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
              var badge     = data.isAdmin
                ? '<span class="text-[0.6rem] font-semibold text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/40 rounded-xl px-2 py-0.5">Admin</span>'
                : '<span class="fb-badge-sub inline-flex items-center" data-sub-badge-rv data-uid="' + esc(data.uid || '') + '" style="display:none;background:transparent">' + lockIcon + '</span>';
              var roleBadgeSpan = '<span data-role-badge-rv data-uid="' + esc(data.uid || '') + '"></span>';
              var editedBadge = data.editedAt ? '<span class="text-[0.6rem] text-gray-400 italic">(diedit)</span>' : '';
              var editBtn   = isMine ? '<button onclick="fbEditReview()" class="text-xs text-gray-400 hover:text-blue-500 transition-colors">Edit</button>' : '';
              var deleteBtn = isMine ? '<button onclick="fbDeleteReview()" class="text-xs text-red-400 hover:text-red-600 transition-colors">Hapus</button>' : '';
              var reportBtn = !isMine ? '<button onclick="fbReportReview(\'' + id + '\')" class="text-xs text-gray-400 hover:text-red-500 transition-colors">Lapor</button>' : '';

              var profileUrl = data.uid ? ('/u?uid=' + encodeURIComponent(data.uid)) : ('/u?u=' + encodeURIComponent(name));
              return [
                '<div class="fb-review" data-id="' + id + '">',
                  '<div class="shrink-0 mt-0.5"><a href="' + profileUrl + '" title="Lihat profil ' + esc(name) + '">' + avatarHtml(data.uid ? getAvatarUrl(data.uid, data.photoURL) : data.photoURL, name, 'w-9 h-9', data.uid) + '</a></div>',
                  '<div class="flex-1 min-w-0">',
                    '<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-0.5">',
                      '<a href="' + profileUrl + '" class="font-semibold text-sm text-gray-900 dark:text-white hover:underline">' + esc(name) + '</a>',
                      roleBadgeSpan,
                      badge,
                      '<span class="text-[0.65rem] text-gray-400">' + timeAgo(data.timestamp) + '</span>',
                      editedBadge,
                    '</div>',
                    '<div class="mb-1">' + starsHtml(data.rating || 0) + '</div>',
                    (data.text ? '<div class="fb-comment-body text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">' + parseText(data.text) + '</div>' : ''),
                    '<div class="fb-comment-actions">', editBtn, deleteBtn, reportBtn, '</div>',
                  '</div>',
                '</div>'
              ].join('');
            }

            function renderAllReviews(docs) {
              var countEl = document.getElementById('fb-reviews-count');
              if (countEl) countEl.textContent = docs.length;

              myReviewData = null;
              docs.forEach(function(d){
                if (currentUser && d.id === currentUser.uid) myReviewData = d.data();
              });

              if (!docs.length) {
                listEl.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Belum ada review. Jadilah yang pertama! ⭐</p>';
              } else {
                // Terbaru di atas
                var sorted = docs.slice().sort(function(a,b){
                  var ta = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                  var tb = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                  return tb - ta;
                });
                listEl.innerHTML = sorted.map(function(d){ return renderReview(d.id, d.data()); }).join('');
                refreshAllSubBadges();
              }
              renderForm(); // re-render form supaya tombol berubah jadi "Edit review" jika sudah pernah review
            }

            // ── Form tulis/edit review ─────────────────────────────────
            function renderForm() {
              if (!currentUser) {
                wrapperEl.innerHTML = [
                  '<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 text-center border border-dashed border-gray-200 dark:border-gray-700">',
                    '<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">',
                      '<svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>',
                    '</div>',
                    '<p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Masuk untuk menulis review</p>',
                    '<p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Login dengan akun kamu untuk memberi review</p>',
                    '<button onclick="openLoginModal()" class="inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity">',
                      '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>',
                      'Masuk / Daftar',
                    '</button>',
                  '</div>'
                ].join('');
                return;
              }

              // Sudah pernah review dan TIDAK sedang dalam mode edit → tampilkan ringkasan + tombol edit
              if (myReviewData && !window._fbReviewEditing) {
                wrapperEl.innerHTML = [
                  '<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center justify-between gap-3">',
                    '<div class="flex items-center gap-2">',
                      starsHtml(myReviewData.rating || 0),
                      '<span class="text-xs text-gray-500 dark:text-gray-400">Kamu sudah memberi review</span>',
                    '</div>',
                    '<button onclick="fbEditReview()" class="text-xs font-semibold text-accent hover:underline shrink-0">Edit review</button>',
                  '</div>'
                ].join('');
                return;
              }

              pendingStars = myReviewData ? (myReviewData.rating || 0) : pendingStars;
              var existingText = myReviewData ? (myReviewData.text || '') : '';

              var starsPick = '';
              for (var i=1;i<=5;i++) {
                starsPick += '<svg class="fb-rv-star-pick" data-val="' + i + '" viewBox="0 0 20 20" fill="' + (i<=pendingStars ? '#fbbf24' : '#d1d5db') + '" onclick="fbPickStar(' + i + ')"><path d="M10 1l2.6 5.6 6.2.6-4.7 4.2 1.4 6.1L10 14.8 4.5 17.5l1.4-6.1L1.2 7.2l6.2-.6L10 1z"/></svg>';
              }

              wrapperEl.innerHTML = [
                '<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">',
                  '<p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">' + (myReviewData ? 'Edit review kamu' : 'Tulis review kamu') + '</p>',
                  '<div class="flex justify-center gap-1 mb-3" id="fb-rv-star-container">', starsPick, '</div>',
                  '<textarea id="fb-rv-text" rows="3" maxlength="2000" placeholder="Bagaimana menurutmu tentang judul ini? (opsional)" class="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 resize-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500">' + esc(existingText) + '</textarea>',
                  '<div class="flex items-center justify-end gap-2 mt-3">',
                    (myReviewData ? '<button onclick="fbCancelReviewEdit()" class="text-xs font-semibold text-gray-500 hover:underline px-3 py-1.5">Batal</button>' : ''),
                    '<button id="fb-rv-submit-btn" onclick="fbSubmitReview()" class="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity">Kirim Review</button>',
                  '</div>',
                '</div>'
              ].join('');
            }

            window.fbPickStar = function(n) {
              pendingStars = n;
              document.querySelectorAll('#fb-rv-star-container .fb-rv-star-pick').forEach(function(el){
                var v = parseInt(el.getAttribute('data-val'), 10);
                el.setAttribute('fill', v <= n ? '#fbbf24' : '#d1d5db');
              });
            };

            window.fbEditReview = function() {
              window._fbReviewEditing = true;
              renderForm();
            };

            window.fbCancelReviewEdit = function() {
              window._fbReviewEditing = false;
              pendingStars = 0;
              renderForm();
            };

            window.fbSubmitReview = function() {
              if (!currentUser) { openLoginModal(); return; }
              if (!pendingStars) { alert('Pilih jumlah bintang dulu ya.'); return; }
              var ta = document.getElementById('fb-rv-text');
              var text = ta ? ta.value.trim() : '';
              var btn = document.getElementById('fb-rv-submit-btn');
              if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

              var _siteUser2 = (typeof window.siteGetUser === 'function') ? window.siteGetUser() : null;
              var _uname = (_siteUser2 && _siteUser2.username) ? _siteUser2.username : (currentUser.displayName || 'Anonim');
              var _uavatar = (_siteUser2 && _siteUser2.avatar) ? _siteUser2.avatar : (currentUser.photoURL || '');
              var isEdit = !!myReviewData;

              var payload = {
                uid: currentUser.uid,
                displayName: _uname,
                photoURL: _uavatar,
                rating: pendingStars,
                text: text,
                timestamp: isEdit ? (myReviewData.timestamp || FV.serverTimestamp()) : FV.serverTimestamp()
              };
              if (isEdit) payload.editedAt = FV.serverTimestamp();

              db.collection('fb_reviews').doc(POST_ID).collection('items').doc(currentUser.uid).set(payload)
                .then(function() {
                  window._fbReviewEditing = false;
                  pendingStars = 0;
                })
                .catch(function(err) {
                  alert('Gagal kirim review: ' + (err.message || 'coba lagi'));
                  if (btn) { btn.disabled = false; btn.textContent = 'Kirim Review'; }
                });
            };

            window.fbDeleteReview = function() {
              if (!currentUser) return;
              if (!confirm('Hapus review kamu?')) return;
              db.collection('fb_reviews').doc(POST_ID).collection('items').doc(currentUser.uid).delete()
                .catch(function(err){ alert('Gagal menghapus: ' + (err.message || 'coba lagi')); });
            };

            window.fbReportReview = function(id) {
              if (!currentUser) { openLoginModal(); return; }
              if (!confirm('Laporkan review ini sebagai melanggar aturan?')) return;
              db.collection('fb_reports').add({
                postId:      POST_ID,
                commentId:   'review:' + id,
                reportedBy:  currentUser.uid,
                timestamp:   FV.serverTimestamp(),
                status:      'pending'
              }).then(function(){
                alert('Terima kasih, laporan kamu sudah kami terima dan akan ditinjau.');
              }).catch(function(err){
                alert('Gagal mengirim laporan: ' + (err.message || 'coba lagi'));
              });
            };

            // ── Load review real-time (satu listener: render list + skor gabungan) ──
            function startListening() {
              if (unsubscribe) unsubscribe();
              unsubscribe = db
                .collection('fb_reviews').doc(POST_ID).collection('items')
                .onSnapshot(function(snap){
                  renderAllReviews(snap.docs);
                  _lastRvCount = snap.docs.length;
                  _lastRvSum = 0;
                  snap.docs.forEach(function(d){ _lastRvSum += (d.data().rating || 0); });
                  applyCombinedAsideRating();
                }, function(){ listEl.innerHTML = '<p class="text-center text-sm text-red-400 py-4">Gagal memuat review.</p>'; });
            }
            startListening();

            auth.onAuthStateChanged(function(user) {
              currentUser = user;
              window._fbReviewEditing = false;
              renderForm();
            });

            // ── Skor gabungan: rating anonim (Realtime DB) + review user (Firestore) ──
            // Tidak mengubah data lama; hanya menghitung rata-rata gabungan untuk ditampilkan di aside.
            // _lastRvSum/_lastRvCount diisi oleh listener di atas; _lastAnonSum/_lastAnonCount
            // diisi oleh listener Realtime DB di bawah. Keduanya realtime & saling memicu render ulang.
            var _lastAnonSum = 0, _lastAnonCount = 0;
            var _lastRvSum   = 0, _lastRvCount   = 0;

            function applyCombinedAsideRating() {
              var asideRatingVal   = document.getElementById('aside-rating-val');
              var asideRatingCount = document.getElementById('aside-rating-count');
              if (!asideRatingVal && !asideRatingCount) return;
              var totalSum   = _lastAnonSum + _lastRvSum;
              var totalCount = _lastAnonCount + _lastRvCount;
              var avg = totalCount > 0 ? (totalSum / totalCount) : 0;
              if (asideRatingVal)   asideRatingVal.innerHTML = '&#9733; ' + (avg > 0 ? avg.toFixed(1) : '-');
              if (asideRatingCount) asideRatingCount.textContent = totalCount + ' votes';
            }

            // Pantau rating anonim Realtime DB realtime
            // (data review Firestore sudah dipantau di startListening() di atas)
            if (typeof dblikes !== 'undefined') {
              dblikes.ref('ratings/' + POST_ID).on('value', function(snap) {
                var d = snap.val();
                _lastAnonCount = d && d.total_raters ? d.total_raters : 0;
                _lastAnonSum   = d && d.rating_sum ? d.rating_sum : 0;
                applyCombinedAsideRating();
              });
            }

          }); // end waitForFirebase
        })();
        //
        
