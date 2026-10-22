/* langitoren: comments.js (diekstrak dari tema, baris 5109) */
        //
        // Toggle ringkasan rating anonim (tidak perlu Firebase, jalan langsung)
        window.fbToggleAnonRating = function(btn) {
          var detail  = document.getElementById('fb-anon-rating-detail');
          var chevron = document.getElementById('fb-anon-rating-chevron');
          if (!detail) return;
          var hidden = detail.classList.contains('hidden');
          detail.classList.toggle('hidden', !hidden);
          if (chevron) chevron.style.transform = hidden ? 'rotate(180deg)' : '';
        };
        (function () {

          function waitForFirebase(cb) {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) cb();
            else setTimeout(function(){ waitForFirebase(cb); }, 100);
          }

          waitForFirebase(function () {

            var auth = firebase.auth();
            var db   = firebase.firestore();
            var FV   = firebase.firestore.FieldValue; // Simpan di sini agar aman di dalam Promise

            // Ambil POST_ID
            var panel = document.getElementById('fb-comments-panel');
            if (!panel) return;
            var POST_ID = (panel.dataset.postId && panel.dataset.postId !== '0' && panel.dataset.postId !== '')
              ? panel.dataset.postId
              : (function(){
                  var s = document.getElementById('post-id');
                  if (s && s.dataset.postId && s.dataset.postId !== '0') return s.dataset.postId;
                  return window.location.pathname.replace(/^\/|\/$/g,'').replace(/\//g,'-') || 'post';
                })();

            var listEl    = document.getElementById('fb-comments-list');
            var wrapperEl = document.getElementById('fb-comment-form-wrapper');
            var currentUser = null;
            var replyToId   = null;
            var unsubscribe = null;
            var pendingImgBase64 = null; // data URL untuk preview
            var pendingImgFile = null;     // File object untuk upload ke Cloudinary

            // ── Helpers ───────────────────────────────────────────────
            function timeAgo(ts) {
              if (!ts) return '';
              var sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
              if (sec < 60)    return 'baru saja';
              if (sec < 3600)  return Math.floor(sec/60)  + ' mnt lalu';
              if (sec < 86400) return Math.floor(sec/3600) + ' jam lalu';
              return Math.floor(sec/86400) + ' hari lalu';
            }

            function esc(s) {
              return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            }

            // ── Parse format teks → HTML ──────────────────────────────
            // Mendukung: **bold**, *italic*, ~~coret~~, `code`, [teks](url), ||spoiler||
            // dan tag gambar khusus: [img:URL] — mendukung JPG, PNG, GIF, WEBP
            function parseText(raw) {
              var s = esc(raw);
              // Gambar: [img:https://...] atau [img:data:...] — tampilkan sebagai <img>
              s = s.replace(/\[img:((?:https?:\/\/|data:)[^\]]+)\]/g, '<img class="fb-img" src="$1" alt="gambar" loading="lazy">');
              // URL biasa (yang bukan sudah di dalam [img:...]) → link
              s = s.replace(/(?<!src=")(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
              // **bold**
              s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
              // *italic*
              s = s.replace(/\*(.+?)\*/g, '<i>$1</i>');
              // ~~coret~~
              s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
              // `code`
              s = s.replace(/`(.+?)`/g, '<code>$1</code>');
              // ||spoiler||
              s = s.replace(/\|\|(.+?)\|\|/g, '<span class="fb-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
              // Newline
              s = s.replace(/\n/g, '<br>');
              return s;
            }

            // ── Avatar HTML ───────────────────────────────────────────
            function avatarHtml(photoURL, displayName, size, uid) {
              size = size || 'w-9 h-9';
              var uidAttr = uid ? ' data-uid-avatar="' + uid + '" data-av-size="' + size + '"' : '';
              if (photoURL) {
                return '<img src="' + esc(photoURL) + '"' + uidAttr + ' class="' + size + ' rounded-full object-cover shrink-0" alt="" referrerpolicy="no-referrer">';
              }
              var letter = (displayName || 'A').charAt(0).toUpperCase();
              return '<div' + uidAttr + ' class="' + size + ' rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-100 shrink-0">' + esc(letter) + '</div>';
            }

            // ── Avatar cache: uid → photoURL terbaru ─────────────────
            var _avatarCache = {};

            function getAvatarUrl(uid, fallbackPhotoURL) {
              if (_avatarCache[uid] !== undefined) return _avatarCache[uid];
              // Sementara pakai fallback, lalu fetch async & update DOM
              _avatarCache[uid] = fallbackPhotoURL || '';
              db.collection('users').doc(uid).get().then(function(doc) {
                var freshUrl = (doc.exists && doc.data().avatar) ? doc.data().avatar : (fallbackPhotoURL || '');
                _avatarCache[uid] = freshUrl;
                // Update semua avatar di DOM untuk uid ini
                document.querySelectorAll('[data-uid-avatar="' + uid + '"]').forEach(function(el) {
                  if (freshUrl) {
                    el.outerHTML = '<img src="' + esc(freshUrl) + '" data-uid-avatar="' + uid + '" class="' + (el.getAttribute('data-av-size') || 'w-9 h-9') + ' rounded-full object-cover shrink-0" alt="" referrerpolicy="no-referrer">';
                  }
                });
              }).catch(function() { /* gagal fetch, tetap pakai fallback */ });
              return fallbackPhotoURL || '';
            }

            // ── Status Gembokers real-time per uid ────────────────────
            // Label "Gembokers" TIDAK lagi diambil dari field statis yang disimpan
            // di dokumen komentar (itu hanya snapshot kondisi saat komentar dikirim).
            // Sebaliknya, kita pasang listener live ke users/{uid} untuk tiap penulis
            // komentar yang sedang tampil, lalu cek subscription.endDate > sekarang.
            // Begitu masa premium seorang user habis (atau Gembokers diperpanjang),
            // semua badge miliknya di halaman ini ikut update tanpa reload.
            var _subListeners = {}; // uid -> unsubscribe fn
            var _subStatus    = {}; // uid -> boolean
            var _roleStatus   = {}; // uid -> 'translator'|'mod'|'dev'|undefined

            function isUidSubscribed(userData) {
              if (!userData || !userData.subscription) return false;
              var endDate = userData.subscription.endDate;
              if (!endDate) return false;
              return new Date(endDate).getTime() > Date.now();
            }

            function applySubBadgeForUid(uid, isSub) {
              document.querySelectorAll('[data-sub-badge][data-uid="' + uid + '"]').forEach(function(el) {
                el.style.display = isSub ? '' : 'none';
              });
            }

            // ── Role badge (Translator/Mod/Dev) ────────────────────────
            // Sama seperti Gembokers, role bisa berubah kapan saja lewat Admin
            // Dashboard, jadi badge-nya dipasang live via listener users/{uid}.
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
              document.querySelectorAll('[data-role-badge][data-uid="' + uid + '"]').forEach(function(el) {
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
              }, function() { /* abaikan error listener individual */ });
            }

            // Pasang listener untuk setiap uid unik yang badge-nya muncul di DOM saat ini,
            // dan langsung apply status yang sudah diketahui (kalau ada).
            function refreshAllSubBadges() {
              var nodes = document.querySelectorAll('[data-sub-badge],[data-role-badge]');
              var seen = {};
              nodes.forEach(function(el) {
                var uid = el.getAttribute('data-uid');
                if (!uid || seen[uid]) return;
                seen[uid] = true;
                if (_subStatus[uid] !== undefined) applySubBadgeForUid(uid, _subStatus[uid]);
                if (_roleStatus[uid] !== undefined) applyRoleBadgeForUid(uid, _roleStatus[uid]);
                watchSubscriber(uid);
              });
            }

            // ── Render satu komentar ──────────────────────────────────
            function renderComment(id, data, depth) {
              depth = depth || 0;
              var isMine    = currentUser && currentUser.uid === data.uid;
              var likeCount = data.likes || 0;
              var likedByMe = currentUser && (data.likedBy||[]).indexOf(currentUser.uid) !== -1;
              var name      = data.displayName || 'Anonim';
              // Indentasi bertingkat: max 4 level indent agar tidak terlalu sempit di mobile
              var indentPx  = Math.min(depth, 4) * 20;
              var indent    = depth > 0 ? 'style="margin-left:' + indentPx + 'px" ' : '';
              // Badge: Admin tetap statis, Gembokers di-render kosong dulu lalu diisi live oleh
              // watchSubscriberBadge() berdasarkan status subscription user SAAT INI (bukan snapshot lama).
              // Tidak ada badge untuk user biasa (label "Member" dihapus).
              var lockIcon  = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f59e0b"/><path d="M7.2 12.3l3.1 3.1 6.3-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
              var badge     = data.isAdmin
                ? '<span class="text-[0.6rem] font-semibold text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/40 rounded-xl px-2 py-0.5">Admin</span>'
                : '<span class="fb-badge-sub" data-sub-badge data-uid="' + esc(data.uid || '') + '" style="display:none">' + lockIcon + '</span>';
              var roleBadgeSpan = '<span data-role-badge data-uid="' + esc(data.uid || '') + '"></span>';
              var editedBadge = data.editedAt ? '<span class="text-[0.6rem] text-gray-400 italic">(diedit)</span>' : '';
              var likeClass = 'flex items-center gap-1 text-xs transition-colors ' + (likedByMe ? 'text-accent font-semibold' : 'text-gray-400 hover:text-accent');
              var likeFill  = likedByMe ? 'currentColor' : 'none';
              var replyBtn  = '<button onclick="fbSetReply(\'' + id + '\',\'' + esc(name).replace(/'/g,"\\'") + '\')" class="text-xs text-gray-400 hover:text-accent transition-colors">Balas</button>';
              var reportBtn = !isMine ? '<button onclick="fbReportComment(\'' + id + '\')" class="fb-report-btn text-xs text-gray-400 hover:text-red-500 transition-colors">Lapor</button>' : '';
              var editBtn   = isMine ? '<button onclick="fbEditComment(\'' + id + '\')" class="text-xs text-gray-400 hover:text-blue-500 transition-colors">Edit</button>' : '';
              var deleteBtn = isMine ? '<button onclick="fbDeleteComment(\'' + id + '\')" class="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto">Hapus</button>' : '';
              var rowClass  = depth > 0 ? 'fb-comment fb-is-reply flex gap-2.5' : 'fb-comment flex gap-2.5';

              var profileUrl = data.uid ? ('/u?uid=' + encodeURIComponent(data.uid)) : ('/u?u=' + encodeURIComponent(name));
              return [
                '<div class="' + rowClass + '" ' + indent + 'data-id="' + id + '">',
                  '<div class="shrink-0 mt-0.5"><a href="' + profileUrl + '" title="Lihat profil ' + esc(name) + '">' + avatarHtml(data.uid ? getAvatarUrl(data.uid, data.photoURL) : data.photoURL, name, depth > 0 ? 'w-7 h-7' : 'w-9 h-9', data.uid) + '</a></div>',
                  '<div class="flex-1 min-w-0">',
                    '<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-0.5">',
                      '<a href="' + profileUrl + '" class="font-semibold text-sm text-gray-900 dark:text-white hover:underline">' + esc(name) + '</a>',
                      roleBadgeSpan,
                      badge,
                      '<span class="text-[0.65rem] text-gray-400">' + timeAgo(data.timestamp) + '</span>',
                      editedBadge,
                    '</div>',
                    '<div class="fb-comment-body text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">' + parseText(data.text || '') + '</div>',
                    '<div class="fb-comment-actions">',
                      '<button onclick="fbToggleLike(\'' + id + '\',' + likedByMe + ')" class="' + likeClass + '">',
                        '<svg class="w-3.5 h-3.5" fill="' + likeFill + '" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"/></svg>',
                        '<span>' + likeCount + '</span>',
                      '</button>',
                      replyBtn,
                      reportBtn,
                      editBtn,
                      deleteBtn,
                    '</div>',
                  '</div>',
                '</div>'
              ].join('');
            }

            // ── Render semua komentar (rekursif, unlimited depth) ─────
            // Balasan (depth>0) dibungkus dalam wrapper yang bisa di-collapse,
            // dengan tombol "Lihat N balasan" di bawah komentar induk (root).
            function renderAllComments(docs) {
              var countEl = document.getElementById('fb-comments-count');
              if (countEl) countEl.textContent = docs.length;

              if (!docs.length) {
                listEl.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Belum ada komentar. Jadilah yang pertama! 💬</p>';
                return;
              }
              // Buat map id → {id, data} untuk lookup cepat
              var docMap = {};
              docs.forEach(function(d){ docMap[d.id] = { id: d.id, data: d.data() }; });

              // Hitung total balasan (semua descendant) dari sebuah root, untuk label tombol toggle
              function countDescendants(id) {
                var children = docs.filter(function(d){ return d.data().parentId === id; });
                var total = children.length;
                children.forEach(function(c){ total += countDescendants(c.id); });
                return total;
              }

              // Fungsi rekursif render node + semua anaknya secara DFS
              // Balasan selalu diurutkan lama → baru (alur percakapan), terlepas dari sort root.
              function renderNode(id, depth) {
                var node = docMap[id];
                if (!node) return '';
                var html = renderComment(id, node.data, depth);
                var children = docs
                  .filter(function(d){ return d.data().parentId === id; })
                  .sort(function(a,b){
                    var ta = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                    var tb = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                    return ta - tb;
                  });
                children.forEach(function(c){ html += renderNode(c.id, depth + 1); });
                return html;
              }

              // Render hanya root comments (parentId === null/undefined)
              // Urutan root mengikuti pilihan tab sort: top (terpopuler/likes), new (terbaru), old (terlama)
              var roots = docs.filter(function(d){ return !d.data().parentId; });
              roots.sort(function(a,b){
                var ta = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                var tb = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                if (_currentSort === 'new') return tb - ta;
                if (_currentSort === 'old') return ta - tb;
                // 'top' (terpopuler): urutkan by jumlah like terbanyak, lalu fallback waktu terbaru
                var la = a.data().likes || 0, lb = b.data().likes || 0;
                if (lb !== la) return lb - la;
                return tb - ta;
              });

              var html = '';
              roots.forEach(function(r){
                html += renderComment(r.id, r.data(), 0);
                var replyCount = countDescendants(r.id);
                if (replyCount > 0) {
                  var repliesHtml = '';
                  docs
                    .filter(function(d){ return d.data().parentId === r.id; })
                    .sort(function(a,b){
                      var ta = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                      var tb = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                      return ta - tb;
                    })
                    .forEach(function(c){ repliesHtml += renderNode(c.id, 1); });
                  html += '<button class="fb-toggle-replies" style="margin-left:44px" onclick="fbToggleReplies(this)">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
                            '<span>Lihat ' + replyCount + ' balasan</span>' +
                          '</button>' +
                          '<div class="fb-replies-wrap fb-collapsed" style="margin-left:24px">' + repliesHtml + '</div>';
                }
              });
              listEl.innerHTML = html;
              refreshAllSubBadges();
            }

            // ── Sort tabs: Terpopuler / Terbaru / Terlama ──────────────
            var _currentSort = 'top';
            var _lastDocs = [];
            window.fbSetSort = function(sortKey, btn) {
              _currentSort = sortKey;
              document.querySelectorAll('.fb-sort-btn').forEach(function(b){ b.classList.remove('fb-sort-active'); });
              if (btn) btn.classList.add('fb-sort-active');
              renderAllComments(_lastDocs);
            };

            // ── Toggle tampil/sembunyi balasan ─────────────────────────
            window.fbToggleReplies = function(btn) {
              var wrap = btn.nextElementSibling;
              if (!wrap) return;
              var collapsed = wrap.classList.contains('fb-collapsed');
              wrap.classList.toggle('fb-collapsed', !collapsed);
              btn.classList.toggle('fb-open', collapsed);
              var label = btn.querySelector('span');
              var n = (wrap.querySelectorAll('.fb-comment').length);
              if (label) label.textContent = (collapsed ? 'Sembunyikan' : 'Lihat ') + (collapsed ? '' : n + ' ') + (collapsed ? 'balasan' : 'balasan');
            }

            // ── Toolbar insert helper ─────────────────────────────────
            function tbInsert(before, after) {
              var ta = document.getElementById('fb-comment-input');
              if (!ta) return;
              var s = ta.selectionStart, e = ta.selectionEnd;
              var sel = ta.value.substring(s, e) || 'teks';
              ta.value = ta.value.substring(0,s) + before + sel + after + ta.value.substring(e);
              ta.selectionStart = s + before.length;
              ta.selectionEnd   = s + before.length + sel.length;
              ta.focus();
              ta.dispatchEvent(new Event('input'));
            }

            // ── Render form ───────────────────────────────────────────
            function renderForm() {
              if (!currentUser) {
                wrapperEl.innerHTML = [
                  '<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 text-center border border-dashed border-gray-200 dark:border-gray-700">',
                    '<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">',
                      '<svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>',
                    '</div>',
                    '<p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Masuk untuk berkomentar</p>',
                    '<p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Login dengan akun kamu untuk ikut diskusi</p>',
                    '<button onclick="openLoginModal()" class="inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity">',
                      '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>',
                      'Masuk / Daftar',
                    '</button>',
                  '</div>'
                ].join('');
                return;
              }

              // Ambil avatar dari Firestore (_user.avatar) bukan Firebase Auth photoURL yang kosong
              var _siteUser = (typeof window.siteGetUser === 'function') ? window.siteGetUser() : null;
              var _avatarSrc = (_siteUser && _siteUser.avatar) ? _siteUser.avatar : (currentUser.photoURL || '');
              var _displayName = (_siteUser && _siteUser.username) ? _siteUser.username : (currentUser.displayName || 'Anonim');
              var av = avatarHtml(_avatarSrc, _displayName, 'w-9 h-9');

              wrapperEl.innerHTML = [
                '<div class="bg-white dark:bg-gray-800 rounded-xl shadow p-3">',

                  // Info balas
                  '<div id="fb-reply-info" class="hidden items-center gap-2 text-xs text-accent mb-2 bg-accent/10 rounded-lg px-3 py-1.5">',
                    '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>',
                    '<span id="fb-reply-label" class="flex-1"></span>',
                    '<button onclick="fbCancelReply()" class="text-gray-400 hover:text-red-400">',
                      '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
                    '</button>',
                  '</div>',

                  // Form utama
                  '<div class="flex gap-3 items-start">',
                    av,
                    '<div class="flex-1 min-w-0">',

                      // Toolbar
                      '<div class="fb-toolbar">',
                        // Bold
                        '<button type="button" class="fb-tb-btn" title="Bold" onclick="tbInsert(\'**\',\'**\')"><b>B</b></button>',
                        // Italic
                        '<button type="button" class="fb-tb-btn" title="Italic" onclick="tbInsert(\'*\',\'*\')"><i>I</i></button>',
                        // Strikethrough
                        '<button type="button" class="fb-tb-btn" title="Coret" onclick="tbInsert(\'~~\',\'~~\')"><s>S</s></button>',
                        // Code
                        '<button type="button" class="fb-tb-btn" title="Kode" onclick="tbInsert(\'`\',\'`\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></button>',
                        // Spoiler
                        '<button type="button" class="fb-tb-btn" title="Spoiler" onclick="tbInsert(\'||\',\'||\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button>',
                        '<div class="fb-tb-sep"></div>',
                        // Upload gambar
                        '<button type="button" class="fb-tb-btn" title="Kirim Gambar" onclick="document.getElementById(\'fb-img-input\').click()">',
                          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
                        '</button>',
                        // URL/Link
                        '<button type="button" class="fb-tb-btn" title="Link" onclick="fbInsertLink()">',
                          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
                        '</button>',
                      '</div>',

                      // Input file gambar (hidden)
                      '<input type="file" id="fb-img-input" accept="image/*,.gif" class="hidden" onchange="fbHandleImg(event)">',

                      // Textarea
                      '<textarea id="fb-comment-input" rows="3" placeholder="Tulis komentar... (pilih teks lalu klik toolbar untuk format)" maxlength="10000" class="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 resize-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-colors" style="border-radius:0 0 8px 8px"></textarea>',

                      // Preview gambar
                      '<div id="fb-img-preview">',
                        '<img id="fb-img-preview-img" src="" alt="">',
                        '<button class="rm-img" onclick="fbRemoveImg()" title="Hapus gambar">\u2715</button>',
                      '</div>',

                      // Footer: counter + kirim
                      '<div class="flex items-center justify-between mt-2">',
                        '<span class="text-[0.65rem] text-gray-400" id="fb-char-count">0 / 10000</span>',
                        '<button id="fb-submit-btn" onclick="fbSubmitComment()" class="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity">',
                          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>',
                          'Kirim',
                        '</button>',
                      '</div>',

                    '</div>',
                  '</div>',
                '</div>'
              ].join('');

              // Counter karakter
              var ta = document.getElementById('fb-comment-input');
              var ct = document.getElementById('fb-char-count');
              if (ta && ct) {
                ta.addEventListener('input', function(){ ct.textContent = ta.value.length + ' / 10000'; });
              }
            }

            // ── Load komentar real-time ───────────────────────────────
            function startListening() {
              if (unsubscribe) unsubscribe();
              unsubscribe = db
                .collection('fb_comments').doc(POST_ID).collection('items')
                .orderBy('timestamp','asc')
                .onSnapshot(function(snap){ _lastDocs = snap.docs; renderAllComments(snap.docs); },
                            function(){ listEl.innerHTML = '<p class="text-center text-sm text-red-400 py-4">Gagal memuat komentar.</p>'; });
            }

            // Mulai langsung tanpa tunggu auth
            startListening();

            // Update form saat status login berubah
            auth.onAuthStateChanged(function(user) {
              currentUser = user;
              renderForm();
            });

            // ── Kirim komentar ────────────────────────────────────────
            // ── Helper: upload gambar komentar ke Cloudinary ─────────
            function uploadCommentImg(file) {
              return new Promise(function(resolve, reject) {
                var maxSz = file.type === 'image/gif' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
                if (file.size > maxSz) { reject(new Error(file.type === 'image/gif' ? 'GIF maks 5MB' : 'Gambar maks 2MB')); return; }
                var fd = new FormData();
                fd.append('file', file);
                fd.append('upload_preset', 'avatar'); // pakai preset yang sama dengan avatar
                fd.append('folder', 'comments');
                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://api.cloudinary.com/v1_1/dlorej4sr/image/upload');
                xhr.onload = function() {
                  if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText).secure_url);
                  } else {
                    reject(new Error('Upload gagal: ' + xhr.status));
                  }
                };
                xhr.onerror = function() { reject(new Error('Network error')); };
                xhr.send(fd);
              });
            }

            window.fbSubmitComment = function() {
              if (!currentUser) { openLoginModal(); return; }
              var ta  = document.getElementById('fb-comment-input');
              var btn = document.getElementById('fb-submit-btn');
              var text = ta ? ta.value.trim() : '';

              // Validasi: harus ada teks atau gambar
              if (!text && !pendingImgFile && !pendingImgBase64) { if (ta) ta.focus(); return; }

              // Ambil info user dari Firestore (bukan Firebase Auth yang mungkin kosong)
              var _siteUser2 = (typeof window.siteGetUser === 'function') ? window.siteGetUser() : null;
              var _uname = (_siteUser2 && _siteUser2.username) ? _siteUser2.username : (currentUser.displayName || 'Anonim');
              var _uavatar = (_siteUser2 && _siteUser2.avatar) ? _siteUser2.avatar : (currentUser.photoURL || '');

              // Disable tombol
              if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

              // Jika ada file gambar pending, upload ke Cloudinary dulu
              var imgPromise = pendingImgFile
                ? uploadCommentImg(pendingImgFile).then(function(url) { return '[img:' + url + ']'; })
                : Promise.resolve(null);

              imgPromise.then(function(imgTag) {
                var finalText = text;
                if (imgTag) finalText = finalText ? finalText + '\n' + imgTag : imgTag;
                if (!finalText) { if (btn) { btn.disabled = false; btn.textContent = 'Kirim'; } return; }

                var _replyParentId = replyToId || null;
                return db.collection('fb_comments').doc(POST_ID).collection('items').add({
                  uid:          currentUser.uid,
                  displayName:  _uname,
                  photoURL:     _uavatar,
                  text:         finalText,
                  timestamp:    FV.serverTimestamp(),
                  parentId:     _replyParentId,
                  likes:        0,
                  likedBy:      []
                }).then(function(newDocRef) {
                  var postTitle = document.title || '';
                  var postUrl   = window.location.href;

                  if (_replyParentId) {
                    // ── Balasan komentar: notif ke pemilik komentar induk (jika bukan diri sendiri) ──
                    db.collection('fb_comments').doc(POST_ID).collection('items').doc(_replyParentId).get()
                      .then(function(parentDoc) {
                        if (parentDoc.exists) {
                          var pData = parentDoc.data();
                          if (pData.uid && pData.uid !== currentUser.uid) {
                            db.collection('comment_notifs').doc(pData.uid).collection('notifs').add({
                              type:      'reply',
                              fromUid:   currentUser.uid,
                              fromName:  _uname,
                              fromAvatar:_uavatar,
                              postId:    POST_ID,
                              postTitle: postTitle,
                              postUrl:   postUrl,
                              commentId: newDocRef.id,
                              text:      finalText.substring(0, 200),
                              timestamp: FV.serverTimestamp(),
                              read:      false
                            });
                          }
                        }
                      }).catch(function(){});
                  } else {
                    // ── Komentar baru di postingan: notif ke pemilik/uploader postingan ──
                    // Nama akun Blogger yang mem-post disimpan di data-post-author, lalu
                    // dipetakan ke uid Firebase lewat koleksi 'uploader_map' (sama seperti
                    // resolver nama uploader di tempat lain pada tema ini).
                    var bloggerAuthorName = (panel.dataset.postAuthor || '').trim();
                    var mapKey = bloggerAuthorName.toLowerCase();
                    if (mapKey) {
                      db.collection('uploader_map').doc(mapKey).get()
                        .then(function(mapDoc) {
                          if (mapDoc.exists && mapDoc.data().uid) {
                            var ownerUid = mapDoc.data().uid;
                            if (ownerUid !== currentUser.uid) {
                              db.collection('comment_notifs').doc(ownerUid).collection('notifs').add({
                                type:      'post_comment',
                                fromUid:   currentUser.uid,
                                fromName:  _uname,
                                fromAvatar:_uavatar,
                                postId:    POST_ID,
                                postTitle: postTitle,
                                postUrl:   postUrl,
                                commentId: newDocRef.id,
                                text:      finalText.substring(0, 200),
                                timestamp: FV.serverTimestamp(),
                                read:      false
                              });
                            }
                          }
                        }).catch(function(){});
                    }
                  }
                });
              }).then(function() {
                if (ta) ta.value = '';
                var ct = document.getElementById('fb-char-count');
                if (ct) ct.textContent = '0 / 10000';
                pendingImgFile = null;
                pendingImgBase64 = null;
                var prev = document.getElementById('fb-img-preview');
                if (prev) prev.style.display = 'none';
                fbCancelReply();
                if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> Kirim'; }
              }).catch(function(err) {
                alert('Gagal kirim: ' + (err.message || 'coba lagi'));
                if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> Kirim'; }
              });
            };

            // ── Hapus komentar ────────────────────────────────────────
            window.fbDeleteComment = function(id) {
              if (!currentUser) return;
              if (!confirm('Hapus komentar ini?')) return;
              db.collection('fb_comments').doc(POST_ID).collection('items').doc(id).delete();
            };

            // ── Edit komentar ─────────────────────────────────────────
            window.fbEditComment = function(id) {
              if (!currentUser) return;
              var commentEl = listEl.querySelector('[data-id="' + id + '"]');
              if (!commentEl) return;
              var bodyEl = commentEl.querySelector('.fb-comment-body');
              if (!bodyEl) return;
              db.collection('fb_comments').doc(POST_ID).collection('items').doc(id).get()
                .then(function(doc) {
                  if (!doc.exists) return;
                  var rawText = doc.data().text || '';
                  var escaped = rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                  bodyEl.outerHTML = [
                    '<div class="fb-edit-area">',
                      '<textarea id="fb-edit-input-' + id + '" rows="3" maxlength="10000"',
                        ' class="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-accent rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none text-gray-800 dark:text-gray-200 transition-colors mt-1 mb-2">' + escaped + '</textarea>',
                      '<div class="flex gap-2 mb-2">',
                        '<button onclick="fbSaveEdit(\'' + id + '\')" class="text-xs bg-accent text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity">Simpan</button>',
                        '<button onclick="fbCancelEdit(\'' + id + '\')" class="text-xs text-gray-400 hover:text-gray-600 transition-colors">Batal</button>',
                      '</div>',
                    '</div>'
                  ].join('');
                  var ta = document.getElementById('fb-edit-input-' + id);
                  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
                })
                .catch(function(err) { alert('Gagal memuat komentar: ' + err.message); });
            };

            window.fbSaveEdit = function(id) {
              var ta = document.getElementById('fb-edit-input-' + id);
              if (!ta) return;
              var newText = ta.value.trim();
              if (!newText) { alert('Komentar tidak boleh kosong.'); ta.focus(); return; }
              db.collection('fb_comments').doc(POST_ID).collection('items').doc(id)
                .update({ text: newText, editedAt: FV.serverTimestamp() })
                .catch(function(err) { alert('Gagal menyimpan: ' + err.message); });
            };

            window.fbCancelEdit = function(id) {
              var commentEl = listEl.querySelector('[data-id="' + id + '"]');
              if (!commentEl) return;
              db.collection('fb_comments').doc(POST_ID).collection('items').doc(id).get()
                .then(function(doc) {
                  if (!doc.exists) return;
                  var editArea = commentEl.querySelector('.fb-edit-area');
                  if (editArea) {
                    editArea.outerHTML = '<div class="fb-comment-body text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">' + parseText(doc.data().text || '') + '</div>';
                  }
                });
            };

            // ── Like / Unlike ─────────────────────────────────────────
            window.fbToggleLike = function(id, liked) {
              if (!currentUser) { openLoginModal(); return; }
              var ref = db.collection('fb_comments').doc(POST_ID).collection('items').doc(id);
              liked
                ? ref.update({ likes: FV.increment(-1), likedBy: FV.arrayRemove(currentUser.uid) })
                : ref.update({ likes: FV.increment(1),  likedBy: FV.arrayUnion(currentUser.uid)  });
            };

            // ── Reply ─────────────────────────────────────────────────
            window.fbSetReply = function(id, name) {
              replyToId = id;
              var info = document.getElementById('fb-reply-info');
              var lbl  = document.getElementById('fb-reply-label');
              if (info) { info.classList.remove('hidden'); info.classList.add('flex'); }
              if (lbl)  { lbl.textContent = 'Membalas ' + name; }
              var ta = document.getElementById('fb-comment-input');
              if (ta) ta.focus();
            };

            window.fbCancelReply = function() {
              replyToId = null;
              var info = document.getElementById('fb-reply-info');
              if (info) { info.classList.add('hidden'); info.classList.remove('flex'); }
            };

            // ── Lapor komentar ───────────────────────────────────────
            window.fbReportComment = function(id) {
              if (!currentUser) { openLoginModal(); return; }
              if (!confirm('Laporkan komentar ini sebagai melanggar aturan?')) return;
              db.collection('fb_reports').add({
                postId:      POST_ID,
                commentId:   id,
                reportedBy:  currentUser.uid,
                timestamp:   FV.serverTimestamp(),
                status:      'pending'
              }).then(function() {
                alert('Terima kasih, laporan kamu sudah kami terima dan akan ditinjau.');
              }).catch(function(err) {
                alert('Gagal mengirim laporan: ' + (err.message || 'coba lagi'));
              });
            };

            // ── Toolbar helpers (global) ──────────────────────────────
            window.tbInsert = function(before, after) {
              var ta = document.getElementById('fb-comment-input');
              if (!ta) return;
              var s = ta.selectionStart, e = ta.selectionEnd;
              var sel = ta.value.substring(s,e) || 'teks';
              ta.value = ta.value.substring(0,s) + before + sel + after + ta.value.substring(e);
              ta.selectionStart = s + before.length;
              ta.selectionEnd   = s + before.length + sel.length;
              ta.focus();
              ta.dispatchEvent(new Event('input'));
            };

            window.fbInsertLink = function() {
              var url = prompt('Masukkan URL:');
              if (!url) return;
              if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
              var ta = document.getElementById('fb-comment-input');
              if (!ta) return;
              var s = ta.selectionStart, e = ta.selectionEnd;
              var sel = ta.value.substring(s,e) || url;
              var ins = '[' + sel + '](' + url + ')';
              ta.value = ta.value.substring(0,s) + ins + ta.value.substring(e);
              ta.focus();
              ta.dispatchEvent(new Event('input'));
            };

            // ── Gambar ────────────────────────────────────────────────
            window.fbHandleImg = function(e) {
              var file = e.target.files && e.target.files[0];
              if (!file) return;
              var maxSize = file.type === 'image/gif' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
              if (file.size > maxSize) { alert(file.type === 'image/gif' ? 'GIF maks 5MB' : 'Gambar maks 2MB'); return; }
              pendingImgFile = file; // Simpan File object untuk upload ke Cloudinary
              var reader = new FileReader();
              reader.onload = function(ev) {
                pendingImgBase64 = ev.target.result; // hanya untuk preview lokal
                var prev = document.getElementById('fb-img-preview');
                var img  = document.getElementById('fb-img-preview-img');
                if (prev && img) { img.src = pendingImgBase64; prev.style.display = 'block'; }
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            };

            window.fbRemoveImg = function() {
              pendingImgBase64 = null;
              pendingImgFile = null;
              var prev = document.getElementById('fb-img-preview');
              if (prev) prev.style.display = 'none';
            };

          }); // end waitForFirebase
        })();
        //
        
