/* langitoren: novel-autowrap.js (diekstrak dari tema, baris 11566) */
//
document.addEventListener('DOMContentLoaded', function () {

  // NOVEL AUTO-WRAP - jalan PERTAMA sebelum manga init
  // Trigger: label "novelread" di URL/meta ATAU div.is-novel di konten

  (function(){
    var readerEl = document.getElementById('reader');
    if(!readerEl) return;
    if(readerEl.querySelector('.novel-reader')) return;

    // Cek label novelread dari meta/link di halaman (Blogger embed label di <a rel="tag">)
    var hasNovelreadLabel = (function(){
      var tags = document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){
        if(tags[i].textContent.trim().toLowerCase() === 'novelread') return true;
      }
      // Cek juga dari body class atau data attr yang mungkin disisipkan Blogger
      var bodyLabels = document.body.getAttribute('data-labels') || '';
      if(bodyLabels.toLowerCase().indexOf('novelread') !== -1) return true;
      // Cek URL label (label search page)
      if(window.location.href.toLowerCase().indexOf('/label/novelread') !== -1) return true;
      return false;
    })();

    var hasIsNovelDiv = !!readerEl.querySelector('.is-novel');

    // Juga cek: postingan dengan class novel-mode (Lock tanpa Comic) otomatis jadi novel reader
    var hasNovelMode = readerEl.classList.contains('novel-mode');

    // Jika ada label Comic, JANGAN wrap sebagai novel reader
    var hasComicLabelNR = (function(){
      var tags = document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){
        if(tags[i].textContent.trim().toLowerCase() === 'comic') return true;
      }
      return false;
    })();

    if(!hasIsNovelDiv && !hasNovelreadLabel && !hasNovelMode) return;
    if(hasComicLabelNR) return; // label Comic → biarkan manga reader yang handle

    var uid = 'nr' + Math.random().toString(36).slice(2,9);
    var wrapper = document.createElement('div');
    wrapper.className = 'novel-reader';
    wrapper.setAttribute('data-nr-id', uid);
    wrapper.setAttribute('data-theme', 'dark');
    wrapper.setAttribute('data-font', 'theme');
    wrapper.setAttribute('data-size', '18');

    wrapper.innerHTML = '<div class="nr-content"></div>';

    var contentDiv = wrapper.querySelector('.nr-content');
    while(readerEl.firstChild){ contentDiv.appendChild(readerEl.firstChild); }
    readerEl.appendChild(wrapper);
  })();

  // SCROLL AUTO-HIDE for #navi, #reader-header, #nextPrevJSbottom

  var naviEl = document.getElementById('navi');
  var headerEl = document.getElementById('reader-header');
  var nextPrevEl = document.getElementById('nextPrevJSbottom');
  var lastScrollY = window.scrollY;
  var scrollThreshold = 60;
  var ticking = false;

  // reader-header is now static - no animation needed

  function updateNavVisibility() {
    var currentY = window.scrollY;
    var scrollingDown = currentY > lastScrollY;
    var diff = Math.abs(currentY - lastScrollY);

    if (diff < 5) { ticking = false; return; }

    if (scrollingDown && diff > scrollThreshold) {
      // Hide nav when scrolling down fast
      if (naviEl) { naviEl.classList.add('nav-hidden'); naviEl.classList.remove('nav-visible'); }
      if (nextPrevEl) { nextPrevEl.classList.add('nav-hidden'); nextPrevEl.classList.remove('nav-visible'); }
    } else if (!scrollingDown && diff > 10) {
      // Show nav when scrolling up
      if (naviEl) { naviEl.classList.add('nav-visible'); naviEl.classList.remove('nav-hidden'); }
      if (nextPrevEl) { nextPrevEl.classList.add('nav-visible'); nextPrevEl.classList.remove('nav-hidden'); }
    }

    lastScrollY = currentY;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(updateNavVisibility);
      ticking = true;
    }
  }, { passive: true });

  // Init visible
  if (naviEl) naviEl.classList.add('nav-visible');
  if (nextPrevEl) nextPrevEl.classList.add('nav-visible');

  // Hide bottom bar when comment/chapter drawer opens, show when closed
  var commentDrawer = document.getElementById('BIzIXe82RX');
  var chapterDrawer = document.getElementById('m91YjOFga6');
  function hideBottomBar() {
    if (nextPrevEl) { nextPrevEl.classList.add('nav-hidden'); nextPrevEl.classList.remove('nav-visible'); }
  }
  function showBottomBar() {
    if (nextPrevEl) { nextPrevEl.classList.add('nav-visible'); nextPrevEl.classList.remove('nav-hidden'); }
  }
  // Watch for drawer open/close via class changes
  var drawerObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.attributeName === 'class') {
        var el = m.target;
        var isOpen = el.classList.contains('transform-none') || !el.classList.contains('translate-x-full') && !el.classList.contains('-translate-x-full');
        if (isOpen) hideBottomBar(); else showBottomBar();
      }
    });
  });
  if (commentDrawer) drawerObserver.observe(commentDrawer, { attributes: true });
  if (chapterDrawer) drawerObserver.observe(chapterDrawer, { attributes: true });

  // INJECT COMMENT + LIKE BUTTON INTO NEXTPREV BAR
  // Order: prev | comment | home(book) | like | next

  setTimeout(function() {
    var likeWrapper = document.querySelector('.like-wrapper');
    var likeBtn = likeWrapper ? likeWrapper.querySelector('.button_likes_hiru') : null;
    var nextPrevBar = document.getElementById('nextPrevJSbottom');

    if (nextPrevBar) {
      // Wait a bit for npXbottom to render
      var injectBtns = function() {
        var innerDiv = nextPrevBar.querySelector('.flex.gap-2.justify-center');
        if (!innerDiv) {
          setTimeout(injectBtns, 300);
          return;
        }

        // Current structure: [prevBtn, homeBtn, nextBtn]
        // Target structure: [prevBtn, commentBtn, homeBtn, likeBtn, nextBtn]
        var prevBtn = innerDiv.children[0];  // prev
        var homeBtn = innerDiv.children[1];  // home/book
        var nextBtn = innerDiv.children[2];  // next

        // --- Create Comment Button ---
        var commentBtn = document.createElement('button');
        commentBtn.className = 'like-btn-inline bottom-comment-btn';
        commentBtn.setAttribute('aria-controls', 'BIzIXe82RX');
        commentBtn.setAttribute('data-drawer-placement', 'right');
        commentBtn.setAttribute('data-drawer-show', 'BIzIXe82RX');
        commentBtn.setAttribute('data-drawer-target', 'BIzIXe82RX');
        commentBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="bottom-comment-badge" id="bottomCommentBadge"></span>';
        commentBtn.style.cssText = 'display:flex;align-items:center;gap:4px;border-radius:30px;padding:6px 12px;border:none;cursor:pointer;font-size:13px;background:transparent;position:relative;';
        // Wire up comment drawer
        if (window.FlowbiteInstances || window.initFlowbite) {
          commentBtn.addEventListener('click', function() {
            var drawerEl = document.getElementById('BIzIXe82RX');
            if (drawerEl) {
              drawerEl.classList.toggle('translate-x-full');
            }
          });
        } else {
          commentBtn.addEventListener('click', function() {
            var drawerEl = document.getElementById('BIzIXe82RX');
            if (drawerEl) {
              var isOpen = !drawerEl.classList.contains('translate-x-full');
              drawerEl.classList.toggle('translate-x-full', isOpen);
            }
          });
        }

        // --- Badge dot jumlah komentar (mengikuti #fb-comments-count yang sudah berjalan) ---
        (function setupCommentBadge() {
          var badgeEl = commentBtn.querySelector('#bottomCommentBadge');
          if (!badgeEl) return;

          function applyCount(text) {
            var n = parseInt(text, 10);
            if (!isNaN(n) && n > 0) {
              badgeEl.textContent = n > 99 ? '99+' : String(n);
              badgeEl.classList.add('show');
            } else {
              badgeEl.textContent = '';
              badgeEl.classList.remove('show');
            }
          }

          function watchCountEl() {
            var countEl = document.getElementById('fb-comments-count');
            if (!countEl) {
              setTimeout(watchCountEl, 300);
              return;
            }
            applyCount(countEl.textContent);
            var mo = new MutationObserver(function () {
              applyCount(countEl.textContent);
            });
            mo.observe(countEl, { childList: true, characterData: true, subtree: true });
          }
          watchCountEl();
        })();

        // --- Create Like Button ---
        if (likeBtn) {
          var likeBtnInline = document.createElement('button');
          likeBtnInline.className = 'like-btn-inline button_likes_hiru';
          likeBtnInline.setAttribute('data-web', 'hirulikes');
          likeBtnInline.setAttribute('data-id', likeBtn.getAttribute('data-id'));
          likeBtnInline.setAttribute('data-image', likeBtn.getAttribute('data-image') || '');
          likeBtnInline.setAttribute('data-title', likeBtn.getAttribute('data-title') || '');
          likeBtnInline.setAttribute('data-url', likeBtn.getAttribute('data-url') || '');
          // Empty heart SVG by default
          likeBtnInline.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="heart-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span class="likeCount"></span>';

          // Mirror like count from original
          var originalCount = likeWrapper.querySelector('.likeCount');
          var newCount = likeBtnInline.querySelector('.likeCount');
          if (originalCount && newCount) {
            newCount.textContent = originalCount.textContent;
            var observer = new MutationObserver(function() {
              newCount.textContent = originalCount.textContent;
            });
            observer.observe(originalCount, { childList: true, characterData: true, subtree: true });
          }

          // Check if already liked
          var postId = likeBtn.getAttribute('data-id');
          var likedKey = 'hiruliked_' + postId;
          function updateLikeState(liked) {
            var heartSvg = likeBtnInline.querySelector('svg');
            var heartPath = heartSvg ? heartSvg.querySelector('path') : null;
            if (liked) {
              likeBtnInline.setAttribute('data-liked', 'true');
              if (heartSvg) { heartSvg.setAttribute('fill', '#e53e3e'); heartSvg.setAttribute('stroke', '#e53e3e'); }
            } else {
              likeBtnInline.removeAttribute('data-liked');
              if (heartSvg) { heartSvg.setAttribute('fill', 'none'); heartSvg.setAttribute('stroke', 'currentColor'); }
            }
          }
          // Check initial liked state from localStorage
          try {
            var liked = localStorage.getItem(likedKey) === '1';
            updateLikeState(liked);
          } catch(e) {}

          // Forward clicks to original button
          likeBtnInline.addEventListener('click', function(e) {
            e.preventDefault();
            likeBtn.click();
            try {
              var wasLiked = localStorage.getItem(likedKey) === '1';
              var nowLiked = !wasLiked;
              localStorage.setItem(likedKey, nowLiked ? '1' : '0');
              updateLikeState(nowLiked);
            } catch(err) {}
          });

          // Rebuild order: prevBtn | commentBtn | homeBtn | likeBtn | nextBtn
          innerDiv.innerHTML = '';
          if (prevBtn) innerDiv.appendChild(prevBtn);
          innerDiv.appendChild(commentBtn);
          if (homeBtn) innerDiv.appendChild(homeBtn);
          innerDiv.appendChild(likeBtnInline);
          if (nextBtn) innerDiv.appendChild(nextBtn);
        } else {
          // No like button - just add comment button: prevBtn | commentBtn | homeBtn | nextBtn
          innerDiv.innerHTML = '';
          if (prevBtn) innerDiv.appendChild(prevBtn);
          innerDiv.appendChild(commentBtn);
          if (homeBtn) innerDiv.appendChild(homeBtn);
          if (nextBtn) innerDiv.appendChild(nextBtn);
        }
      };
      injectBtns();
    }
  }, 1200);

  // MODAL Comic/Novel tab switching

  var mangaTab = document.getElementById('manga');
  var novelTab = document.getElementById('novel');
  var comicSection = document.getElementById('modal-comic-section');
  var novelSection = document.getElementById('modal-novel-section');

  function setModalTab(tab) {
    if (tab === 'comic') {
      comicSection && comicSection.classList.add('active');
      novelSection && novelSection.classList.remove('active');
      if (mangaTab) { mangaTab.classList.add('bg-accent'); mangaTab.style.background = ''; }
      if (novelTab) { novelTab.classList.remove('bg-accent'); novelTab.style.background = '#555'; }
    } else {
      novelSection && novelSection.classList.add('active');
      comicSection && comicSection.classList.remove('active');
      if (novelTab) { novelTab.classList.add('bg-accent'); novelTab.style.background = ''; }
      if (mangaTab) { mangaTab.classList.remove('bg-accent'); mangaTab.style.background = '#555'; }
    }
  }

  if (mangaTab && novelTab) {
    // Check if current post is novel or comic based on reader content
    var readerEl = document.getElementById('reader');
    // Novel jika: ada class novel-mode, atau ada .novel-reader, atau ada label novelread
    var hasNovelreadLabel = (function(){
      var tags = document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){
        if(tags[i].textContent.trim().toLowerCase() === 'novelread') return true;
      }
      return false;
    })();
    // Comic jika: ada label Comic di tag rel="tag"
    var hasComicLabel = (function(){
      var tags = document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){
        if(tags[i].textContent.trim().toLowerCase() === 'comic') return true;
      }
      return false;
    })();
    var isNovelPost = readerEl && !hasComicLabel && (
      (readerEl.classList.contains('novel-mode') && !document.querySelector('.manga-pages')) ||
      !!readerEl.querySelector('.novel-reader') ||
      hasNovelreadLabel
    );
    // Jika ada label Comic, selalu tampilkan tab Comic
    if (hasComicLabel) {
      setModalTab('comic');
    } else {
      setModalTab(isNovelPost ? 'novel' : 'comic');
    }

    mangaTab.addEventListener('click', function () { setModalTab('comic'); });
    novelTab.addEventListener('click', function () { setModalTab('novel'); });
  }

  // ── Helper tap-scroll yang dipakai bersama ──
  // Dipisah supaya bisa dipasang juga ke reader chapter Lock/R2
  // (yang sebelumnya tidak lewat initMangaReaderControls sama sekali).
  function bindReaderTapScroll(reader) {
    if (!reader || reader._tapScrollBound) return;
    reader._tapScrollBound = true;

    // Pakai anak langsung (bukan cuma <img>) supaya offsetLeft tetap
    // akurat baik untuk struktur lama (<img> langsung di dalam reader)
    // maupun struktur Lock/R2 (tiap halaman dibungkus <div>).
    var pages = Array.prototype.slice.call(reader.children);
    var currentIndex = 0;

    function scrollToIndex(idx) {
      if (!pages.length) return;
      if (idx < 0) idx = 0;
      if (idx > pages.length - 1) idx = pages.length - 1;
      currentIndex = idx;
      var target = pages[currentIndex];
      if (!target) return;
      var isRTLNow = reader.classList.contains('rtl-mode');
      if (isRTLNow) {
        var pos = target.offsetLeft - reader.clientWidth + target.clientWidth;
        reader.scrollTo({ left: pos, behavior: 'smooth' });
      } else {
        reader.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
      }
    }
    function goNext(){ scrollToIndex(currentIndex + 1); }
    function goPrev(){ scrollToIndex(currentIndex - 1); }

    reader.addEventListener('click', function (e) {
      if (!reader.classList.contains('horizontal')) {
        var vh = window.innerHeight;
        window.scrollBy({ top: e.clientY < vh * 0.5 ? -vh * 0.8 : vh * 0.8, behavior: 'smooth' });
        return;
      }
      var rect = reader.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var isRTLNow = reader.classList.contains('rtl-mode');
      if (x < rect.width * 0.4) {
        isRTLNow ? goNext() : goPrev();
      } else if (x > rect.width * 0.6) {
        isRTLNow ? goPrev() : goNext();
      }
    });

    reader.addEventListener('scroll', function () {
      if (!reader.classList.contains('horizontal')) return;
      var closest = 0;
      var diffMin = Infinity;
      pages.forEach(function (pg, i) {
        var diff = Math.abs(pg.offsetLeft - reader.scrollLeft);
        if (diff < diffMin) { diffMin = diff; closest = i; }
      });
      currentIndex = closest;
    });
  }

  // AUTO-DETECT & INIT MANGA READER (no generator needed!)
  // Wraps images from #reader > .manga-pages OR detects auto
  // Dibungkus fungsi agar bisa dipanggil ulang setelah konten Lock dimuat

  function initMangaReaderControls() {
  // Support both: <div class="manga-pages">...</div> (old generator style)
  // AND: images directly in the post body (auto-detect)
  var readerArticle = document.getElementById('reader');

  // Find all containers that might hold manga images
  var blocks = [];

  // Check for explicit .manga-pages containers
  var explicitContainers = readerArticle ? readerArticle.querySelectorAll('.manga-pages') : [];
  if (explicitContainers.length > 0) {
    blocks = Array.prototype.slice.call(explicitContainers);
  } else if (readerArticle) {
    // Auto-detect: skip jika postingan novel (ada class .is-novel, label novelread, atau novel-mode) DAN tidak ada label Comic
    var hasComicLabelInner = (function(){
      var tags = document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){
        if(tags[i].textContent.trim().toLowerCase() === 'comic') return true;
      }
      return false;
    })();
    var isNovelContent = !hasComicLabelInner && (readerArticle.querySelector('.is-novel') !== null ||
      readerArticle.classList.contains('novel-mode') ||
      (function(){
        var tags = document.querySelectorAll('a[rel="tag"]');
        for(var i=0;i<tags.length;i++){
          if(tags[i].textContent.trim().toLowerCase() === 'novelread') return true;
        }
        return false;
      })());
    var novelReaders = readerArticle.querySelectorAll('.novel-reader');
    if (novelReaders.length === 0 && !isNovelContent) {
      var directImgs = readerArticle.querySelectorAll('img');
      if (directImgs.length > 0) {
        blocks = [readerArticle];
      }
    }
  }

  Array.prototype.forEach.call(blocks, function (container, blockIndex) {
    var images = Array.prototype.slice.call(container.querySelectorAll('img'));
    if (!images.length) return;

    // Skip if already wrapped
    if (container.querySelector('.manga-reader')) return;

    // Bungkus semua img jadi reader
    var reader = document.createElement('div');
    reader.className = 'manga-reader';
    // Move images into reader div
    images.forEach(function (img) { reader.appendChild(img); });
    // If container is the reader article itself, clear and re-add
    if (container === readerArticle) {
      // Keep non-image children (like HFI style, etc.)
      var nonImgChildren = Array.prototype.slice.call(container.childNodes).filter(function(n) {
        return !(n.nodeName === 'IMG');
      });
      container.appendChild(reader);
    } else {
      container.innerHTML = '';
      container.appendChild(reader);
    }

    var imgs = Array.prototype.slice.call(reader.querySelectorAll('img'));
    var currentIndex = 0;
    var isRTL = false;
    var hasMargin = false; // default: tanpa margin (untuk user baru)

    // PERSIST SETTINGS

    var STORE_KEY = 'mangaReaderSettings:v1:Global';

    function loadSettings() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
      catch(e){ return {}; }
    }
    function saveSettings(s) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
      catch(e){}
    }
    function updateSaved(mode, dir, margin) {
      var s = loadSettings();
      s.mode = mode;
      s.dir  = dir;
      if (margin !== undefined) s.margin = margin;
      saveSettings(s);
    }

    // Scroll ke index tertentu

    function scrollToIndex(idx) {
      if (idx < 0) idx = 0;
      if (idx > imgs.length - 1) idx = imgs.length - 1;
      currentIndex = idx;
      var target = imgs[currentIndex];
      if (!target) return;
      if (isRTL) {
        var pos = target.offsetLeft - reader.clientWidth + target.clientWidth;
        reader.scrollTo({ left: pos, behavior: 'smooth' });
      } else {
        reader.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
      }
    }

    function goNext(){ scrollToIndex(currentIndex + 1); }
    function goPrev(){ scrollToIndex(currentIndex - 1); }

    reader.addEventListener('click', function (e) {
      if (!reader.classList.contains('horizontal')) {
        var vh = window.innerHeight;
        window.scrollBy({ top: e.clientY < vh * 0.5 ? -vh * 0.8 : vh * 0.8, behavior: 'smooth' });
        return;
      }
      var rect = reader.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x < rect.width * 0.4) {
        isRTL ? goNext() : goPrev();
      } else if (x > rect.width * 0.6) {
        isRTL ? goPrev() : goNext();
      }
    });

    reader.addEventListener('scroll', function () {
      if (!reader.classList.contains('horizontal')) return;
      var closest = 0;
      var diffMin = Infinity;
      imgs.forEach(function (img, i) {
        var diff = Math.abs(img.offsetLeft - reader.scrollLeft);
        if (diff < diffMin) { diffMin = diff; closest = i; }
      });
      currentIndex = closest;
    });

    // Apply margin style

    function applyMargin(on) {
      hasMargin = on;
      if (on) {
        imgs.forEach(function(img) {
          img.style.removeProperty('margin');
          img.style.removeProperty('padding');
          img.style.removeProperty('display');
        });
        var isHorizNow = reader.classList.contains('horizontal');
        reader.style.gap = isHorizNow ? '0' : '10px';
        reader.style.padding = isHorizNow ? '0' : '0 10px';
        reader.style.lineHeight = '';
        reader.classList.remove('no-margin');
      } else {
        imgs.forEach(function(img) {
          img.style.setProperty('margin', '0', 'important');
          img.style.setProperty('padding', '0', 'important');
          img.style.display = 'block';
        });
        reader.style.gap = '0';
        reader.style.padding = '0';
        reader.style.lineHeight = '0';
        reader.classList.add('no-margin');
      }
      if (modalMarginWith) modalMarginWith.classList.toggle('active', on);
      if (modalMarginWithout) modalMarginWithout.classList.toggle('active', !on);
    }

    // Apply state helpers

    function setHorizontal(on) {
      reader.classList.toggle('horizontal', !!on);
      var isHorizontal = reader.classList.contains('horizontal');

      // Update modal button labels and active state
      if (modalModeVertBtn) modalModeVertBtn.classList.toggle('active', !isHorizontal);
      if (modalModeHorizBtn) modalModeHorizBtn.classList.toggle('active', isHorizontal);

      // Show/hide dir buttons and margin toggle in modal
      var modalDirWrap = document.getElementById('modal-reader-dir-btns');
      var modalDirLabelEl = document.getElementById('modal-reader-dir-label');
      if (modalDirWrap) {
        modalDirWrap.style.display = isHorizontal ? 'flex' : 'none';
      }
      if (modalDirLabelEl) {
        modalDirLabelEl.style.display = isHorizontal ? '' : 'none';
      }
      var modalMarginWrap = document.getElementById('modal-margin-toggle');
      if (modalMarginWrap) {
        modalMarginWrap.style.display = isHorizontal ? 'none' : 'flex';
      }

      if (isHorizontal) {
        currentIndex = 0;
        scrollToIndex(0);
        if (modalMarginWrap) modalMarginWrap.style.display = 'none';

        // Paksa hapus padding/gap saat horizontal
        reader.style.padding = '0';
        reader.style.gap = '0';

        // Mode horizontal: reader scroll kiri-kanan, body bebas scroll vertikal
        reader.style.overflowY = 'visible';
        reader.style.overflowX = 'auto';
        setTimeout(function() {
          var rect = reader.getBoundingClientRect();
          if (rect.top < 0 || rect.top > 100) {
            reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        // Mode vertikal: kembalikan overflow normal
        reader.style.overflowY = '';
        reader.style.overflowX = '';
        // Kembalikan padding/gap sesuai setting margin
        reader.style.padding = hasMargin ? '0 10px' : '0';
        reader.style.gap = hasMargin ? '10px' : '0';
        if (modalMarginWrap) modalMarginWrap.style.display = 'flex';
      }
    }

    function setDir(dir) {
      isRTL = (dir === 'rtl');
      if (modalLTR) modalLTR.classList.toggle('active', !isRTL);
      if (modalRTL) modalRTL.classList.toggle('active', isRTL);
      reader.classList.toggle('rtl-mode', isRTL);
      currentIndex = 0;
      if (reader.classList.contains('horizontal')) scrollToIndex(0);
    }

    // Build modal Comic controls (only for first reader block)

    var modalModeVertBtn = null;
    var modalModeHorizBtn = null;
    var modalLTR = null;
    var modalRTL = null;
    var modalMarginWith = null;
    var modalMarginWithout = null;

    if (blockIndex === 0) {
      var modalModeBtns = document.getElementById('modal-reader-mode-btns');
      var modalDirBtns = document.getElementById('modal-reader-dir-btns');
      var modalMarginToggle = document.getElementById('modal-margin-toggle');

      if (modalModeBtns) {
        // Vertical button
        modalModeVertBtn = document.createElement('button');
        modalModeVertBtn.className = 'reader-toggle active';
        modalModeVertBtn.textContent = 'Mode Webtoon';
        modalModeBtns.appendChild(modalModeVertBtn);

        // Horizontal button
        modalModeHorizBtn = document.createElement('button');
        modalModeHorizBtn.className = 'reader-toggle';
        modalModeHorizBtn.textContent = 'Mode Manga';
        modalModeBtns.appendChild(modalModeHorizBtn);

        modalModeVertBtn.addEventListener('click', function () {
          if (!reader.classList.contains('horizontal')) return; // already vertical
          setHorizontal(false);
          updateSaved('vertical', isRTL ? 'rtl' : 'ltr', hasMargin);
        });

        modalModeHorizBtn.addEventListener('click', function () {
          if (reader.classList.contains('horizontal')) return; // already horizontal
          setHorizontal(true);
          var dirNow = (loadSettings().dir || (isRTL ? 'rtl' : 'ltr'));
          setDir(dirNow);
          updateSaved('horizontal', isRTL ? 'rtl' : 'ltr', hasMargin);
        });
      }

      // Margin toggle (vertikal mode only)
      if (modalMarginToggle) {
        var marginLabel = document.createElement('span');
        marginLabel.textContent = 'Margin:';
        marginLabel.style.fontSize = '13px';
        marginLabel.style.marginRight = '6px';
        modalMarginToggle.appendChild(marginLabel);

        modalMarginWith = document.createElement('button');
        modalMarginWith.className = 'reader-margin-btn' + (savedMargin ? ' active' : '');
        modalMarginWith.textContent = 'Dengan Margin';
        modalMarginToggle.appendChild(modalMarginWith);

        modalMarginWithout = document.createElement('button');
        modalMarginWithout.className = 'reader-margin-btn' + (!savedMargin ? ' active' : '');
        modalMarginWithout.textContent = 'Tanpa Margin';
        modalMarginToggle.appendChild(modalMarginWithout);
        // Pastikan margin toggle terlihat di mode vertikal (default)
        modalMarginToggle.style.display = 'flex';

        modalMarginWith.addEventListener('click', function() {
          applyMargin(true);
          updateSaved(reader.classList.contains('horizontal') ? 'horizontal' : 'vertical', isRTL ? 'rtl' : 'ltr', true);
        });
        modalMarginWithout.addEventListener('click', function() {
          applyMargin(false);
          updateSaved(reader.classList.contains('horizontal') ? 'horizontal' : 'vertical', isRTL ? 'rtl' : 'ltr', false);
        });
      }

      if (modalDirBtns) {
        modalDirBtns.style.display = 'none'; // hidden by default (vertical mode)

        modalLTR = document.createElement('button');
        modalLTR.className = 'reader-dir-btn active';
        modalLTR.textContent = 'LTR';

        modalRTL = document.createElement('button');
        modalRTL.className = 'reader-dir-btn';
        modalRTL.textContent = 'RTL';

        modalDirBtns.appendChild(modalLTR);
        modalDirBtns.appendChild(modalRTL);

        modalLTR.addEventListener('click', function () {
          if (!reader.classList.contains('horizontal')) return;
          setDir('ltr');
          updateSaved('horizontal', 'ltr', hasMargin);
        });
        modalRTL.addEventListener('click', function () {
          if (!reader.classList.contains('horizontal')) return;
          setDir('rtl');
          updateSaved('horizontal', 'rtl', hasMargin);
        });
      }
    }

    // APPLY SAVED SETTINGS ON LOAD

    var saved = loadSettings();
    var savedMode = saved.mode || 'vertical';
    var savedDir  = saved.dir  || 'ltr';
    var savedMargin = saved.margin !== undefined ? saved.margin : false; // user baru: tanpa margin

    setHorizontal(savedMode === 'horizontal');
    setDir(savedDir);
    applyMargin(savedMargin);
  });

  } // end initMangaReaderControls

  // ── Fungsi khusus untuk build tombol modal Comic ──────────────
  function buildComicModalControls() {
    var modalModeBtns   = document.getElementById('modal-reader-mode-btns');
    var modalDirBtns    = document.getElementById('modal-reader-dir-btns');
    var modalDirLabel   = document.getElementById('modal-reader-dir-label');
    var modalMarginWrap = document.getElementById('modal-margin-toggle');

    // Tombol modal cukup dibangun sekali; setting & tap-scroll tetap
    // diterapkan ulang di bagian bawah SETIAP kali fungsi ini dipanggil
    // (mis. tiap ganti chapter Lock/R2), supaya tidak reset ke Webtoon.
    var alreadyBuilt = !modalModeBtns || modalModeBtns.children.length > 0;

    var readerEl = document.getElementById('reader');

    function getMangaReader() {
      return readerEl ? readerEl.querySelector('.manga-reader') : null;
    }

    function loadSaved() {
      try { return JSON.parse(localStorage.getItem('mangaReaderSettings:v1:Global') || '{}'); } catch(e) { return {}; }
    }
    function saveSetting(key, val) {
      var s = loadSaved(); s[key] = val;
      try { localStorage.setItem('mangaReaderSettings:v1:Global', JSON.stringify(s)); } catch(e) {}
    }

    function setDirSectionVisible(visible) {
      var disp = visible ? 'flex' : 'none';
      if (modalDirBtns)  modalDirBtns.style.display  = disp;
      if (modalDirLabel) modalDirLabel.style.display  = visible ? '' : 'none';
    }

    var saved = loadSaved();
    var isHoriz = saved.mode === 'horizontal';
    var isRTL   = saved.dir  === 'rtl';
    var hasMargin = saved.margin === true; // default false untuk user baru

    if (!alreadyBuilt) {
    // Mode Tampilan: Vertikal / Horizontal
    var btnVert = document.createElement('button');
    btnVert.className = 'reader-toggle' + (isHoriz ? '' : ' active');
    btnVert.textContent = 'Mode Vertikal';
    modalModeBtns.appendChild(btnVert);

    var btnHoriz = document.createElement('button');
    btnHoriz.className = 'reader-toggle' + (isHoriz ? ' active' : '');
    btnHoriz.textContent = 'Mode Horizontal';
    modalModeBtns.appendChild(btnHoriz);

    btnVert.addEventListener('click', function() {
      var r = getMangaReader();
      if (r) { r.classList.remove('horizontal', 'rtl-mode'); }
      btnVert.classList.add('active'); btnHoriz.classList.remove('active');
      if (modalMarginWrap) modalMarginWrap.style.display = 'flex';
      setDirSectionVisible(false);
      saveSetting('mode', 'vertical');
    });

    btnHoriz.addEventListener('click', function() {
      var r = getMangaReader();
      if (r) {
        r.classList.add('horizontal');
        if (isRTL) r.classList.add('rtl-mode');
        if (typeof window.bindReaderTapScroll === 'function') window.bindReaderTapScroll(r);
      }
      btnHoriz.classList.add('active'); btnVert.classList.remove('active');
      if (modalMarginWrap) modalMarginWrap.style.display = 'none';
      setDirSectionVisible(true);
      saveSetting('mode', 'horizontal');
    });

    // Margin toggle (mode vertikal)
    if (modalMarginWrap) {
      var spanLabel = document.createElement('span');
      spanLabel.textContent = 'Margin:';
      spanLabel.style.cssText = 'font-size:13px;margin-right:6px;';
      modalMarginWrap.appendChild(spanLabel);

      var btnMarginOn = document.createElement('button');
      btnMarginOn.className = 'reader-margin-btn' + (hasMargin ? ' active' : '');
      btnMarginOn.textContent = 'Dengan Margin';
      modalMarginWrap.appendChild(btnMarginOn);

      var btnMarginOff = document.createElement('button');
      btnMarginOff.className = 'reader-margin-btn' + (hasMargin ? '' : ' active');
      btnMarginOff.textContent = 'Tanpa Margin';
      modalMarginWrap.appendChild(btnMarginOff);

      btnMarginOn.addEventListener('click', function() {
        var r = getMangaReader();
        if (r) {
          r.classList.remove('no-margin');
          r.style.gap = '10px';
          r.style.padding = '0 10px';
          r.style.lineHeight = '';
          r.querySelectorAll('img').forEach(function(img){
            img.style.removeProperty('margin');
            img.style.removeProperty('padding');
          });
        }
        btnMarginOn.classList.add('active'); btnMarginOff.classList.remove('active');
        saveSetting('margin', true);
      });
      btnMarginOff.addEventListener('click', function() {
        var r = getMangaReader();
        if (r) {
          r.classList.add('no-margin');
          r.style.gap = '0';
          r.style.padding = '0';
          r.style.lineHeight = '0';
          r.querySelectorAll('img').forEach(function(img){
            img.style.setProperty('margin', '0', 'important');
            img.style.setProperty('padding', '0', 'important');
          });
        }
        btnMarginOff.classList.add('active'); btnMarginOn.classList.remove('active');
        saveSetting('margin', false);
      });
    }

    // Arah Baca: LTR / RTL
    if (modalDirBtns) {
      var btnLTR = document.createElement('button');
      btnLTR.className = 'reader-dir-btn' + (isRTL ? '' : ' active');
      btnLTR.textContent = 'Kiri ke Kanan (LTR)';
      modalDirBtns.appendChild(btnLTR);

      var btnRTL = document.createElement('button');
      btnRTL.className = 'reader-dir-btn' + (isRTL ? ' active' : '');
      btnRTL.textContent = 'Kanan ke Kiri (RTL)';
      modalDirBtns.appendChild(btnRTL);

      btnLTR.addEventListener('click', function() {
        var r = getMangaReader();
        if (r) r.classList.remove('rtl-mode');
        btnLTR.classList.add('active'); btnRTL.classList.remove('active');
        isRTL = false;
        saveSetting('dir', 'ltr');
      });
      btnRTL.addEventListener('click', function() {
        var r = getMangaReader();
        if (r) r.classList.add('rtl-mode');
        btnRTL.classList.add('active'); btnLTR.classList.remove('active');
        isRTL = true;
        saveSetting('dir', 'rtl');
      });
    }
    } // end if (!alreadyBuilt)

    // Visibilitas Arah Baca & Margin mengikuti setting tersimpan —
    // dijalankan setiap kali, bukan hanya saat tombol pertama dibuat.
    setDirSectionVisible(isHoriz);
    if (modalMarginWrap) modalMarginWrap.style.display = isHoriz ? 'none' : 'flex';

    // Terapkan saved settings ke reader yang SEDANG aktif — dijalankan
    // SETIAP kali fungsi ini dipanggil (termasuk untuk chapter Lock/R2
    // berikutnya), supaya mode baca tersimpan tidak ke-reset ke Webtoon.
    var r = getMangaReader();
    if (r) {
      r.classList.toggle('horizontal', !!isHoriz);
      r.classList.toggle('rtl-mode', !!isRTL);
      if (!hasMargin) {
        r.classList.add('no-margin');
        r.style.gap = '0';
        r.style.padding = '0';
        r.style.lineHeight = '0';
        r.querySelectorAll('img').forEach(function(img){
          img.style.setProperty('margin', '0', 'important');
          img.style.setProperty('padding', '0', 'important');
        });
      } else {
        r.classList.remove('no-margin');
        r.style.gap = '10px';
        r.style.padding = '0 10px';
      }
      // Pasang fitur auto-tap-scroll (tap kiri/kanan) untuk chapter
      // Lock/R2 juga — sebelumnya hanya berjalan di chapter non-Lock.
      if (typeof window.bindReaderTapScroll === 'function') {
        window.bindReaderTapScroll(r);
      }
    }
  }

  // Expose globally agar bisa dipanggil ulang dari FASE 3
  window.initMangaReaderControls = initMangaReaderControls;
  window.buildComicModalControls = buildComicModalControls;
  window.bindReaderTapScroll = bindReaderTapScroll;

  // ── MANGA READER EXTRA CONTROLS ──
  (function initMRExtraControls() {
    var MR_KEY = 'mrExtraSettings:v1';
    function loadMRS() { try { return JSON.parse(localStorage.getItem(MR_KEY)||'{}'); } catch(e){ return {}; } }
    function saveMRS(k,v) { var s=loadMRS(); s[k]=v; try{ localStorage.setItem(MR_KEY,JSON.stringify(s)); }catch(e){} }

    function hasLabel(name){
      var tags=document.querySelectorAll('a[rel="tag"]');
      for(var i=0;i<tags.length;i++){ if(tags[i].textContent.trim().toLowerCase()===name.toLowerCase()) return true; }
      return false;
    }
    var IS_COMIC = hasLabel('comic');
    var IS_NOVEL = hasLabel('novelread');

    // ── Setup modal section & tab visibility ──
    function setupModalMode(){
      var tabMenu    = document.getElementById('modal-tab-menu');
      var comicSec   = document.getElementById('modal-comic-section');
      var novelSec   = document.getElementById('modal-novel-section');
      var modalTitle = document.getElementById('modal-mode-title');
      if(comicSec){ comicSec.classList.remove('active'); comicSec.style.display='none'; }
      if(novelSec){ novelSec.classList.remove('active'); novelSec.style.display='none'; }
      if(tabMenu)  tabMenu.style.display='none';
      if(IS_COMIC){
        if(modalTitle) modalTitle.textContent='Pengaturan Manga';
        if(comicSec){ comicSec.classList.add('active'); comicSec.style.display=''; }
      } else if(IS_NOVEL){
        if(modalTitle) modalTitle.textContent='Pengaturan Baca';
        if(novelSec){ novelSec.classList.add('active'); novelSec.style.display=''; }
      } else {
        if(modalTitle) modalTitle.textContent='Reading Mode';
        if(tabMenu) tabMenu.style.display='';
        if(comicSec){ comicSec.classList.add('active'); comicSec.style.display=''; }
      }
    }

    var modal=document.getElementById('pDrXiK9YdI');
    if(modal){
      new MutationObserver(function(muts){
        muts.forEach(function(m){
          if(m.attributeName==='class' && !modal.classList.contains('hidden')) setupModalMode();
        });
      }).observe(modal,{attributes:true});
    }
    setupModalMode();

    // ── Apply brightness ──
    function applyBright(v){
      var r=document.getElementById('reader'); if(!r) return;
      var mr=r.querySelector('.manga-reader')||r;
      var f='brightness('+v+'%)';
      mr.style.filter=f;
      mr.querySelectorAll('img').forEach(function(img){ img.style.filter=f; });
    }

    // ── Apply max width ke #reader wrapper ──
    function applyWidth(v){
      var r=document.getElementById('reader'); if(!r) return;
      r.style.maxWidth=(parseInt(v)>=1200)?'none':parseInt(v)+'px';
      r.style.margin='0 auto';
    }

    var s0=loadMRS();
    if(s0.brightness && s0.brightness!==100) applyBright(s0.brightness);
    if(s0.maxWidth && s0.maxWidth<1200) applyWidth(s0.maxWidth);

    // ── AUTO SCROLL — logika sama persis dengan novel reader yang sudah smooth ──
    var _scrolling=false, _raf=null;

    function scrollTick(){
      if(!_scrolling){ _raf=null; return; }
      var spd=parseFloat((document.getElementById('modal-mr-speed-slider')||{value:'3'}).value)||3;
      var px=spd*0.4;
      window.scrollBy(0, px);
      if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2){ mrStop(); return; }
      _raf=requestAnimationFrame(scrollTick);
    }

    function _updateBtn(){
      var btn=document.getElementById('modal-mr-autoscroll-btn');
      var ic =document.getElementById('modal-mr-autoscroll-icon');
      var lb =document.getElementById('modal-mr-autoscroll-label');
      if(!btn) return;
      if(_scrolling){
        btn.style.background='#ef4444';
        if(ic) ic.innerHTML='<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>';
        if(lb) lb.textContent='Stop Scroll Otomatis';
      } else {
        btn.style.background='var(--accent,#58a1c8)';
        if(ic) ic.innerHTML='<path d="M8 5v14l11-7z"/>';
        if(lb) lb.textContent='Mulai Scroll Otomatis';
      }
    }
    function mrStart(){
      if(_scrolling) return;
      _scrolling=true;
      _raf=requestAnimationFrame(scrollTick);
      _updateBtn();
    }
    function mrStop(){
      _scrolling=false;
      if(_raf){ cancelAnimationFrame(_raf); _raf=null; }
      _updateBtn();
    }

    // Pause saat user scroll manual
    // Jangan stop scroll saat user touch/klik di dalam modal — hanya stop saat scroll halaman ke atas
    window.addEventListener('wheel', function(e){ if(_scrolling && e.deltaY < 0) mrStop(); }, {passive:true});

    // ── Wire controls: pakai event delegation pada document agar tidak tergantung DOM modal ──
    // Auto scroll button — event delegation
    document.addEventListener('click', function(e){
      var btn = e.target.closest('#modal-mr-autoscroll-btn');
      if(btn){ if(_scrolling) mrStop(); else mrStart(); return; }

      // Top / Bottom
      if(e.target.closest('#modal-mr-goto-top')){ document.documentElement.scrollTop=0; document.body.scrollTop=0; return; }
      if(e.target.closest('#modal-mr-goto-bottom')){ var mx=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight; document.documentElement.scrollTop=mx; document.body.scrollTop=mx; return; }

      // Prev / Next page (scroll ke gambar sesuai index)
      if(e.target.closest('#modal-mr-page-prev') || e.target.closest('#modal-mr-page-next')){
        var imgs = Array.from(document.querySelectorAll('#reader img'));
        var total = imgs.length;
        var cur = parseInt((document.getElementById('modal-mr-page-cur')||{textContent:'1'}).textContent)||1;
        var next = e.target.closest('#modal-mr-page-prev') ? Math.max(1,cur-1) : Math.min(total,cur+1);
        if(imgs[next-1]) imgs[next-1].scrollIntoView({behavior:'smooth',block:'start'});
        var curEl=document.getElementById('modal-mr-page-cur');
        if(curEl) curEl.textContent=next;
        return;
      }
    });

    // Slider: brightness
    document.addEventListener('input', function(e){
      if(e.target.id==='modal-mr-bright-slider'){
        var v=parseInt(e.target.value);
        var lb=document.getElementById('modal-mr-bright-label');
        if(lb) lb.textContent=v+'%';
        saveMRS('brightness',v); applyBright(v);
      }
      if(e.target.id==='modal-mr-width-slider'){
        var v=parseInt(e.target.value);
        var lb=document.getElementById('modal-mr-width-label');
        if(lb) lb.textContent=v>=1200?'Tak Terbatas':v+'px';
        saveMRS('maxWidth',v); applyWidth(v);
      }
    });

    // Update PAGE info setiap kali modal dibuka
    function updatePageInfo(){
      var imgs=document.querySelectorAll('#reader img');
      var totalEl=document.getElementById('modal-mr-page-total');
      var curEl=document.getElementById('modal-mr-page-cur');
      var brightSlider=document.getElementById('modal-mr-bright-slider');
      var brightLabel=document.getElementById('modal-mr-bright-label');
      var widthSlider=document.getElementById('modal-mr-width-slider');
      var widthLabel=document.getElementById('modal-mr-width-label');
      var sv=loadMRS();

      if(totalEl) totalEl.textContent=imgs.length||'?';
      // Hitung halaman yang sedang terlihat
      if(curEl && imgs.length){
        var scrollMid=window.pageYOffset+window.innerHeight/2;
        var idx=1;
        imgs.forEach(function(img,i){
          var rect=img.getBoundingClientRect();
          var imgTop=rect.top+window.pageYOffset;
          if(imgTop<=scrollMid) idx=i+1;
        });
        curEl.textContent=idx;
      }
      // Sync slider values
      if(brightSlider){ brightSlider.value=sv.brightness||100; }
      if(brightLabel){ brightLabel.textContent=(sv.brightness||100)+'%'; }
      if(widthSlider){ var wv=sv.maxWidth||1200; widthSlider.value=wv; }
      if(widthLabel){ var wv=sv.maxWidth||1200; widthLabel.textContent=wv>=1200?'Tak Terbatas':wv+'px'; }
    }

    var modal=document.getElementById('pDrXiK9YdI');
    if(modal){
      new MutationObserver(function(muts){
        muts.forEach(function(m){
          if(m.attributeName==='class' && !modal.classList.contains('hidden')){
            setupModalMode();
            updatePageInfo();
          }
        });
      }).observe(modal,{attributes:true});
    }

    // Update page counter saat scroll
    window.addEventListener('scroll', function(){
      if(!document.getElementById('modal-mr-page-cur')) return;
      var imgs=Array.from(document.querySelectorAll('#reader img'));
      if(!imgs.length) return;
      var scrollMid=window.pageYOffset+window.innerHeight/2;
      var idx=1;
      imgs.forEach(function(img,i){
        var imgTop=img.getBoundingClientRect().top+window.pageYOffset;
        if(imgTop<=scrollMid) idx=i+1;
      });
      var curEl=document.getElementById('modal-mr-page-cur');
      if(curEl) curEl.textContent=idx;
    },{passive:true});
  })();

  // Panggil pertama kali saat DOMContentLoaded
  initMangaReaderControls();

});
//
