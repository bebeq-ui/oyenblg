/* langitoren: chatbox.js (diekstrak dari tema, baris 8724) */
(function(){
  "use strict";

  var state = {
    replyTo: null, unsub: null, pendingImgFile: null,
    // ── Cache profil realtime per uid + listener aktifnya, supaya avatar/
    //    username di chatbox ikut update tanpa refresh saat user ganti
    //    profil (bukan cuma snapshot yang tersimpan di pesan lama) ──
    userCache: {}, userUnsubs: {}
  };

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // ── Format teks pesan chat: **bold**, *italic*, ~~coret~~, `code`, ||spoiler||,
  //    [img:URL] untuk gambar/gif, dan auto-link URL biasa (sama seperti komentar) ──
  function parseChatText(raw){
    var s = esc(raw);
    s = s.replace(/\[img:((?:https?:\/\/|data:)[^\]]+)\]/g, '<img class="cbx-img" src="$1" alt="gambar" loading="lazy">');
    s = s.replace(/(?<!src=")(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/\*(.+?)\*/g, '<i>$1</i>');
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
    s = s.replace(/`(.+?)`/g, '<code>$1</code>');
    s = s.replace(/\|\|(.+?)\|\|/g, '<span class="cbx-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function timeAgo(ts){
    if(!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if(diff < 60) return 'baru saja';
    if(diff < 3600) return Math.floor(diff/60) + 'm';
    if(diff < 86400) return Math.floor(diff/3600) + 'j';
    return d.toLocaleDateString('id-ID', {day:'2-digit', month:'short'});
  }

  // Skema warna disamakan dengan badge role di komentar/review/uploader
  // (LO_UPLOADER_ROLE_MAP & roleBadgeHtml di widget lain): outline tipis,
  // bukan chip solid, supaya konsisten di seluruh situs & mengikuti tema.
  function roleBadge(role){
    var map = {
      translator: ['Translator', 'text-green-600 dark:text-green-400 border border-green-500/60 dark:border-green-400/50'],
      mod:        ['Mod',        'text-blue-600 dark:text-blue-400 border border-blue-500/60 dark:border-blue-400/50'],
      dev:        ['Dev',        'text-red-600 dark:text-red-400 border border-red-500/60 dark:border-red-400/50']
    };
    var m = map[role];
    if(m) return '<span class="text-[10px] px-1.5 py-0.5 rounded-full '+m[1]+'">'+m[0]+'</span>';
    return '';
  }

  // Ikon badge premium (Gembokers): centang putih di atas lingkaran kuning,
  // sama persis dengan badge Gembokers di widget komentar/review.
  var CBX_SUB_ICON = '<svg class="w-full h-full" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f59e0b"/><path d="M7.2 12.3l3.1 3.1 6.3-6.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ── Avatar: pakai foto profil kalau ada, kalau tidak tampilkan huruf
  //    pertama dari nama (bukan gambar placeholder statis) ──
  function cbxAvatarHtml(photoURL, displayName, uid, sizeClass){
    sizeClass = sizeClass || 'w-8 h-8';
    var uidAttr = uid ? ' data-uid-avatar="' + esc(uid) + '"' : '';
    if(photoURL){
      return '<img src="' + esc(photoURL) + '"' + uidAttr + ' class="cbx-avatar ' + sizeClass + ' rounded-full object-cover shrink-0 mt-0.5" alt="" loading="lazy" referrerpolicy="no-referrer"/>';
    }
    var letter = (displayName || 'A').trim().charAt(0).toUpperCase() || 'A';
    return '<div' + uidAttr + ' class="cbx-avatar ' + sizeClass + ' rounded-full shrink-0 mt-0.5 bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-100">' + esc(letter) + '</div>';
  }

  // ── Timpa displayName/photoURL/role pesan dgn data terbaru dari cache
  //    realtime (users/{uid}), fallback ke snapshot yang tersimpan di
  //    pesan itu sendiri kalau profil user belum pernah/tidak ke-load ──
  function applyUserOverride(m){
    var u = m.uid && state.userCache[m.uid];
    if(!u) return m;
    var out = {};
    for(var k in m){ out[k] = m[k]; }
    if(u.displayName) out.displayName = u.displayName;
    if(u.avatar) out.photoURL = u.avatar;
    out.role = (u.roles && u.roles.length) ? u.roles[0] : undefined;
    out.isSub = !!u.isSub;
    return out;
  }

  // ── Pasang listener onSnapshot ke users/{uid} utk tiap pengirim pesan
  //    yang lagi tampil di layar, lepas listener utk uid yang sudah tidak
  //    tampil (mis. setelah refresh/pesan lama ke-scroll keluar limit 50) ──
  function syncUserListeners(uids){
    var fb = window.siteGetFirebase && window.siteGetFirebase();
    if(!fb || !fb.db) return;

    var uidSet = {};
    uids.forEach(function(uid){ if(uid) uidSet[uid] = true; });

    Object.keys(state.userUnsubs).forEach(function(uid){
      if(!uidSet[uid]){
        state.userUnsubs[uid]();
        delete state.userUnsubs[uid];
      }
    });

    Object.keys(uidSet).forEach(function(uid){
      if(state.userUnsubs[uid]) return; // sudah ada listener utk uid ini
      state.userUnsubs[uid] = fb.db.collection('users').doc(uid).onSnapshot(function(snap){
        if(!snap.exists) return;
        var d = snap.data();
        var isSub = false;
        if(d.subscription && d.subscription.endDate){
          isSub = new Date(d.subscription.endDate).getTime() > Date.now();
        }
        state.userCache[uid] = {
          displayName: d.displayName || d.username || null,
          avatar: d.avatar || null,
          roles: d.roles || [],
          isSub: isSub
        };
        patchUserInDom(uid);
      }, function(err){ console.error('cbx user listener error:', err); });
    });
  }

  // ── Update avatar/nama/badge role/badge premium langsung di DOM tanpa
  //    render ulang seluruh daftar pesan (jadi scroll posisi pembaca
  //    tidak ke-reset) ──
  function patchUserInDom(uid){
    var u = state.userCache[uid];
    if(!u) return;
    var wrap = document.getElementById('cbxMessages');
    if(!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-msg-uid="' + uid + '"]'), function(el){
      var avatarEl = el.querySelector('.cbx-avatar');
      if(avatarEl){
        var sizeClass = Array.prototype.filter.call(avatarEl.classList, function(c){
          return c.indexOf('w-') === 0 || c.indexOf('h-') === 0;
        }).join(' ') || 'w-8 h-8';
        if(u.avatar){
          if(avatarEl.tagName === 'IMG'){
            avatarEl.src = u.avatar;
          } else {
            avatarEl.outerHTML = cbxAvatarHtml(u.avatar, u.displayName, uid, sizeClass);
          }
        } else if(u.displayName && avatarEl.tagName !== 'IMG'){
          avatarEl.textContent = u.displayName.trim().charAt(0).toUpperCase() || 'A';
        }
      }
      if(u.displayName){
        var nameEl = el.querySelector('.cbx-name');
        if(nameEl) nameEl.textContent = u.displayName;
      }
      var badgeEl = el.querySelector('.cbx-role-badge');
      if(badgeEl) badgeEl.innerHTML = roleBadge(u.roles && u.roles.length ? u.roles[0] : undefined);
      var subEl = el.querySelector('.cbx-badge-sub');
      if(subEl) subEl.style.display = u.isSub ? '' : 'none';
    });
  }

  function deleteBtnHtml(m){
    return '<button type="button" class="cbx-delete-btn text-[11px] text-gray-400 hover:text-red-500 mt-0.5" '
      + 'data-id="' + esc(m.id) + '" title="Hapus">Hapus</button>';
  }

  function renderErrorReport(m, isOwner){
    return '<div class="flex gap-2.5" data-msg-id="' + esc(m.id) + '" data-msg-uid="' + esc(m.uid || '') + '">'
      + '<div class="w-8 h-8 rounded-full shrink-0 mt-0.5 bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-500 text-sm">\u26a0\uFE0F</div>'
      + '<div class="flex-1 min-w-0">'
        + '<div class="flex items-center gap-1.5 flex-wrap">'
          + '<span class="text-xs font-semibold text-gray-800 dark:text-gray-100 cbx-name">' + esc(m.displayName || 'Reader') + '</span>'
          + '<span class="cbx-role-badge">' + roleBadge(m.role) + '</span>'
          + '<span class="cbx-badge-sub inline-flex items-center justify-center w-3.5 h-3.5 shrink-0" style="display:' + (m.isSub ? '' : 'none') + '">' + CBX_SUB_ICON + '</span>'
          + '<span class="text-[10px] text-gray-400">' + timeAgo(m.timestamp) + '</span>'
        + '</div>'
        + '<div class="text-xs text-red-500 dark:text-red-400 font-medium mt-0.5">Melaporkan error pada:</div>'
        + '<a href="' + esc(m.postUrl || '#') + '" class="block text-sm font-semibold text-accent hover:underline break-words">' + esc(m.postTitle || 'Postingan') + '</a>'
        + (m.text ? '<div class="text-sm text-gray-700 dark:text-gray-200 break-words mt-0.5">' + esc(m.text) + '</div>' : '')
        + '<div class="flex items-center gap-3">'
          + '<button type="button" class="cbx-reply-btn text-[11px] text-gray-400 hover:text-accent mt-0.5" '
            + 'data-id="' + esc(m.id) + '" data-uid="' + esc(m.uid || '') + '" data-author="' + esc(m.displayName || 'Reader') + '" '
            + 'data-text="' + esc(('Error: ' + (m.postTitle || 'Postingan') + (m.text ? ' \u2014 ' + m.text : '')).slice(0,140)) + '">\u21a9 Reply</button>'
          + (isOwner ? deleteBtnHtml(m) : '')
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function renderChatMessage(m, isOwner){
    var replyHtml = '';
    if(m.parentId){
      replyHtml = '<div class="mb-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-xs text-gray-500 dark:text-gray-400 border-l-2 border-accent">'
        + '<span class="font-semibold text-gray-600 dark:text-gray-300">Reply ke ' + esc(m.parentAuthor||'') + '</span>'
        + '<div class="truncate">' + esc(m.parentText||'') + '</div></div>';
    }
    return '<div class="flex gap-2.5" data-msg-id="' + esc(m.id) + '" data-msg-uid="' + esc(m.uid || '') + '">'
      + cbxAvatarHtml(m.photoURL, m.displayName, m.uid, 'w-8 h-8')
      + '<div class="flex-1 min-w-0">'
        + '<div class="flex items-center gap-1.5 flex-wrap">'
          + '<span class="text-xs font-semibold text-gray-800 dark:text-gray-100 cbx-name">' + esc(m.displayName || 'Reader') + '</span>'
          + '<span class="cbx-role-badge">' + roleBadge(m.role) + '</span>'
          + '<span class="cbx-badge-sub inline-flex items-center justify-center w-3.5 h-3.5 shrink-0" style="display:' + (m.isSub ? '' : 'none') + '">' + CBX_SUB_ICON + '</span>'
          + '<span class="text-[10px] text-gray-400">' + timeAgo(m.timestamp) + '</span>'
        + '</div>'
        + replyHtml
        + '<div class="cbx-msg-body text-sm text-gray-700 dark:text-gray-200 break-words">' + parseChatText(m.text || '') + '</div>'
        + '<div class="flex items-center gap-3">'
          + '<button type="button" class="cbx-reply-btn text-[11px] text-gray-400 hover:text-accent mt-0.5" '
            + 'data-id="' + esc(m.id) + '" data-uid="' + esc(m.uid || '') + '" data-author="' + esc(m.displayName || 'Reader') + '" data-text="' + esc((m.text||'').slice(0,140)) + '">\u21a9 Reply</button>'
          + (isOwner ? deleteBtnHtml(m) : '')
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function renderMessages(docs){
    var wrap = document.getElementById('cbxMessages');
    if(!docs.length){
      wrap.innerHTML = '<p class="text-center text-xs text-gray-400 py-6">Belum ada pesan. Jadilah yang pertama chat!</p>';
      return;
    }

    var fb = window.siteGetFirebase && window.siteGetFirebase();
    var currentUid = (fb && fb.auth && fb.auth.currentUser) ? fb.auth.currentUser.uid : null;

    wrap.innerHTML = docs.map(function(m){
      var isOwner = !!currentUid && m.uid === currentUid;
      // Pakai profil terbaru dari cache realtime (users/{uid}) kalau sudah
      // pernah ke-load, supaya avatar/username lama di pesan otomatis
      // ikut ganti tanpa perlu refresh halaman.
      var mView = applyUserOverride(m);
      return mView.type === 'error_report' ? renderErrorReport(mView, isOwner) : renderChatMessage(mView, isOwner);
    }).join('');

    // Pasang/lepas listener realtime users/{uid} sesuai pengirim pesan yang
    // sedang tampil, supaya kalau salah satu dari mereka ganti avatar/
    // username/role saat chatbox terbuka, tampilan langsung ikut berubah.
    syncUserListeners(docs.map(function(m){ return m.uid; }));

    Array.prototype.forEach.call(wrap.querySelectorAll('.cbx-reply-btn'), function(btn){
      btn.addEventListener('click', function(){
        setReplyTo({ id: btn.getAttribute('data-id'), uid: btn.getAttribute('data-uid') || '', author: btn.getAttribute('data-author'), text: btn.getAttribute('data-text') });
      });
    });

    Array.prototype.forEach.call(wrap.querySelectorAll('.cbx-delete-btn'), function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        if(!confirm('Hapus pesan ini?')) return;
        var fb2 = window.siteGetFirebase && window.siteGetFirebase();
        if(!fb2 || !fb2.db) return;
        btn.disabled = true;
        fb2.db.collection('chatbox_messages').doc(id).delete().catch(function(err){
          console.error('gagal hapus pesan:', err);
          alert('Gagal menghapus pesan. Coba lagi.');
          btn.disabled = false;
        });
      });
    });

    wrap.scrollTop = wrap.scrollHeight;
  }

  function setReplyTo(r){
    state.replyTo = r;
    var bar = document.getElementById('cbxReplyBar');
    if(!r){ bar.classList.add('hidden'); bar.classList.remove('flex'); bar.innerHTML=''; return; }
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    bar.innerHTML = '<div class="min-w-0"><span class="font-semibold text-gray-600 dark:text-gray-300">Reply ke ' + esc(r.author) + '</span>'
      + '<div class="truncate text-gray-400">' + esc(r.text) + '</div></div>'
      + '<button type="button" id="cbxCancelReply" class="shrink-0 text-gray-400 hover:text-red-500">\u2715</button>';
    document.getElementById('cbxCancelReply').addEventListener('click', function(){ setReplyTo(null); });
    var input = document.getElementById('cbxInput');
    if(input) input.focus();
  }

  function subscribe(){
    var fb = window.siteGetFirebase && window.siteGetFirebase();
    if(!fb || !fb.db) return;
    if(state.unsub){ state.unsub(); state.unsub = null; }

    var wrap = document.getElementById('cbxMessages');
    wrap.innerHTML = '<p class="text-center text-xs text-gray-400 py-6">Memuat pesan...</p>';

    state.unsub = fb.db.collection('chatbox_messages')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(function(snap){
        var docs = [];
        snap.forEach(function(doc){
          var d = doc.data(); d.id = doc.id; docs.push(d);
        });
        docs.reverse();
        renderMessages(docs);
      }, function(err){
        wrap.innerHTML = '<p class="text-center text-xs text-red-400 py-6">Gagal memuat chatbox.</p>';
        console.error('chatbox onSnapshot error:', err);
      });
  }

  function updateAuthUI(){
    var isLoggedIn = (typeof window.siteIsLoggedIn === 'function') ? window.siteIsLoggedIn() : false;
    var locked = document.getElementById('cbxLocked');
    var form = document.getElementById('cbxForm');
    if(isLoggedIn){
      locked.classList.add('hidden');
      form.classList.remove('hidden');
      form.classList.add('flex');
    } else {
      locked.classList.remove('hidden');
      form.classList.add('hidden');
      form.classList.remove('flex');
      setReplyTo(null);
    }
  }

  // ── Upload gambar/gif chatbox ke Cloudinary (sama layanan dengan gambar komentar) ──
  function uploadChatImg(file){
    return new Promise(function(resolve, reject){
      var maxSz = file.type === 'image/gif' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
      if(file.size > maxSz){ reject(new Error(file.type === 'image/gif' ? 'GIF maks 5MB' : 'Gambar maks 2MB')); return; }
      var fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'avatar');
      fd.append('folder', 'chatbox');
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/dlorej4sr/image/upload');
      xhr.onload = function(){
        if(xhr.status === 200){ resolve(JSON.parse(xhr.responseText).secure_url); }
        else { reject(new Error('Upload gagal: ' + xhr.status)); }
      };
      xhr.onerror = function(){ reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  window.cbxHandleImg = function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    var maxSize = file.type === 'image/gif' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if(file.size > maxSize){ alert(file.type === 'image/gif' ? 'GIF maks 5MB' : 'Gambar maks 2MB'); return; }
    state.pendingImgFile = file;
    var reader = new FileReader();
    reader.onload = function(ev){
      var prev = document.getElementById('cbxImgPreview');
      var img  = document.getElementById('cbxImgPreviewImg');
      if(prev && img){ img.src = ev.target.result; prev.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  window.cbxRemoveImg = function(){
    state.pendingImgFile = null;
    var prev = document.getElementById('cbxImgPreview');
    if(prev) prev.style.display = 'none';
  };

  // ── Toolbar format: bungkus teks terpilih di textarea dengan penanda markdown ──
  window.cbxTbInsert = function(before, after){
    var ta = document.getElementById('cbxInput');
    if(!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd;
    var sel = ta.value.substring(s,e) || 'teks';
    ta.value = ta.value.substring(0,s) + before + sel + after + ta.value.substring(e);
    ta.selectionStart = s + before.length;
    ta.selectionEnd   = s + before.length + sel.length;
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };

  function sendMessage(text){
    var fb = window.siteGetFirebase && window.siteGetFirebase();
    var user = window.siteGetUser && window.siteGetUser();
    if(!fb || !fb.db || !fb.auth.currentUser || !user) return;

    var imgPromise = state.pendingImgFile
      ? uploadChatImg(state.pendingImgFile).then(function(url){ return '[img:' + url + ']'; })
      : Promise.resolve(null);

    var submitBtn = document.querySelector('#cbxForm button[type="submit"]');
    if(submitBtn) submitBtn.disabled = true;

    imgPromise.then(function(imgTag){
      var finalText = text || '';
      if(imgTag) finalText = finalText ? finalText + '\n' + imgTag : imgTag;
      if(!finalText){ if(submitBtn) submitBtn.disabled = false; return; }

      var payload = {
        uid: fb.auth.currentUser.uid,
        displayName: user.displayName || user.username || (user.email||'').split('@')[0] || 'Reader',
        photoURL: user.avatar || '',
        type: 'message',
        text: finalText,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      if(user.roles && user.roles.length){ payload.role = user.roles[0]; }
      var replySnapshot = state.replyTo; // simpan referensi sebelum setReplyTo(null) di bawah
      if(replySnapshot){
        payload.parentId = replySnapshot.id;
        payload.parentAuthor = replySnapshot.author;
        payload.parentText = replySnapshot.text;
      }

      return fb.db.collection('chatbox_messages').add(payload)
        .then(function(newDocRef){
          // ── Balasan chatbox: kirim notif inbox ke pemilik pesan induk,
          //    format field sama persis dengan notif balasan komentar
          //    (comment_notifs/{uid}/items) supaya otomatis muncul di
          //    halaman /p/inbox.html tanpa perlu ubah renderer-nya. ──
          if(replySnapshot && replySnapshot.uid && replySnapshot.uid !== payload.uid){
            fb.db.collection('comment_notifs').doc(replySnapshot.uid).collection('notifs').add({
              type:       'chat_reply',
              fromUid:    payload.uid,
              fromName:   payload.displayName,
              fromAvatar: payload.photoURL,
              postId:     '',
              postTitle:  'Chatbox',
              postUrl:    window.location.origin + '/',
              commentId:  newDocRef.id,
              text:       finalText.substring(0,200),
              timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
              read:       false
            }).catch(function(err){ console.error('gagal kirim notif reply chatbox:', err); });
          }
          setReplyTo(null); cbxRemoveImg();
        });
    }).catch(function(err){
      console.error('gagal kirim pesan chatbox:', err);
      alert(err && err.message ? err.message : 'Gagal mengirim pesan. Coba lagi.');
    }).then(function(){
      if(submitBtn) submitBtn.disabled = false;
    });
  }

  function init(){
    subscribe();
    updateAuthUI();

    document.getElementById('cbxRefreshBtn').addEventListener('click', function(){
      subscribe();
    });
    document.getElementById('cbxLocked').addEventListener('click', function(){
      if(typeof window.openLoginModal === 'function') window.openLoginModal();
    });
    document.getElementById('cbxForm').addEventListener('submit', function(e){
      e.preventDefault();
      var input = document.getElementById('cbxInput');
      var text = (input.value || '').trim();
      if(!text && !state.pendingImgFile) return;
      sendMessage(text);
      input.value = '';
      input.style.height = 'auto';
    });

    // Textarea auto-grow mengikuti isi pesan (maks diatur lewat CSS max-height)
    var cbxInputEl = document.getElementById('cbxInput');
    if(cbxInputEl){
      cbxInputEl.addEventListener('input', function(){
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
      // Enter = baris baru (perilaku default textarea). Ctrl/Cmd+Enter = kirim cepat.
      cbxInputEl.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
          e.preventDefault();
          document.getElementById('cbxForm').requestSubmit
            ? document.getElementById('cbxForm').requestSubmit()
            : document.getElementById('cbxForm').dispatchEvent(new Event('submit', {cancelable:true}));
        }
      });
    }

    var fb = window.siteGetFirebase();
    if(fb && fb.auth){
      fb.auth.onAuthStateChanged(function(){ updateAuthUI(); });
    }
  }

  function waitFirebase(){
    if(window.siteGetFirebase){ init(); }
    else { setTimeout(waitFirebase, 200); }
  }
  waitFirebase();
})();
