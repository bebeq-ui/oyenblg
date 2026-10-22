/* langitoren: zeist-helpers.js (diekstrak dari tema, baris 1317) */
  //
// Helper functions for date and image
var timeString = function(t) {
  if(/([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/.test(t)) {
    const date = new Date(t);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // difference in seconds

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };

    for (let [unit, seconds] of Object.entries(intervals)) {
      const interval = Math.floor(diff / seconds);
      if (interval >= 1) {
        return interval + ' ' + unit + (interval > 1 ? 's' : '') + ' ago';
      }
    }
    return 'just now';
  }
  return false;
};
  
  var imageString = function(t) {
    var e = t.indexOf("<img"),
        i = t.indexOf('src="',e),
        n = t.indexOf('"',i+5),
        r = t.substr(i+5,n-i-5);
    return -1!=e && -1!=i && -1!=n && ""!=r ? r : 
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiO5PRfYiTV_tmS5bCNNxMWIqn1tIx1MFGGsvzbEPkYmE_oXiulp_VmbtnwibLPj_sKq-PWSsu6cKkhMi6oxyu45fNdIqSUs75h25U6C1SVPCYEAX2Ew2yQG9W45pRFHJJlOSHXgnjAw_Bs/w300-h225-p-k-no-nu/dagruel-no-image.png";
  };
  
  // Configuration for different post types
  // Batas tampilan Home: 3 halaman x 9 series. Sisanya lewat tombol "Lihat Semua".
  const HOME_MAX_SERIES = 27;
  // GANTI dengan URL halaman Pembaruan Terakhir milikmu:
  const ALL_URL = '/p/pembaruan-terakhir.html';

  const postConfig = {
    manga: {
      id: 'myManga',
      items: ['Manga','Manhwa','Manhua','WN','LN','Doujin'],
      subItems: ['Chapter']
    },
    novel: {
      id: 'myNovel',
      items: ['Novel','WN','LN'],
      subItems: ['Chapter']
    }
  };
  
  // Factory function to create post handlers
  function createPostHandler(type) {
    const config = postConfig[type];
    
    window[`${type}Post`] = {
      mainItemArr: [],
      subItemArr: [],
      mainItem: config.items,
      subItem: config.subItems,
      settingTitle: [{
        name: 'Chapter',
        news: 'Ch'
      }, {
        name: 'Volume',
        news: 'Vol'
      }, {
        name: 'Episode',
        news: 'Ep'
      }],
  
      compile: function(t) {
        const e = t.feed.entry;
        if(!e) return false;
        
        const i = document.getElementById(config.id);
        if(!i) return false;
        
        i.dataset.created = "Dagruel";
        this.mainItemArr = [];
        this.subItemArr = [];
          // Process entries
        e.forEach(({id, category, content, link, title, published, media$thumbnail, author}) => {
          var a = title.$t,
              rawLabels = category.map(t => t.term),
              s = rawLabels.filter(t => t !== "Project" && t !== "Lock" && t !== "NSFW"),
              u = link.find(t => "alternate" === t.rel).href,
              c = timeString(published.$t),
              l = content.$t && content.$t.length > 0 ? content.$t : "Nothing",
              m = media$thumbnail ? media$thumbnail.url.replace("s72","w175-rw-h235") : imageString(l),
              uploaderName = (author && author[0] && author[0].name && author[0].name.$t) ? author[0].name.$t : "";
  
          // Ekstrak Post ID dan Blog ID (Untuk fitur Likes)
          var postIdMatch = id && id.$t ? id.$t.match(/post-(\d+)/) : null;
          var postId = postIdMatch ? postIdMatch[1] : "";
          var blogIdMatch = id && id.$t ? id.$t.match(/blog-(\d+)/) : null;
          var blogId = blogIdMatch ? blogIdMatch[1] : window.LO_BLOG_ID || "";
          if (!window.LO_BLOG_ID && blogId) window.LO_BLOG_ID = blogId;
          if(this.mainItem.some(t => s.includes(t))) {
            this.mainItemArr.push({title:a, link:u, image:m, category:s, seriesPublishedRaw:published.$t, uploader:uploaderName, isNsfw: rawLabels.includes('NSFW'), postId: postId});
          }
  
          this.subItem.forEach(t => {
            if(s.includes(t)) {
              this.subItemArr.push({
                titleSub:a, 
                linkSub:u, 
                publishedSub:c,
                publishedRaw:published.$t,
                categorySub:s,
                rawLabels:rawLabels,
                uploaderSub:uploaderName,
                postIdSub:postId
              });
            }
          });
        });
  
        // Auto-bump: urutkan kartu series berdasarkan chapter TERBARU miliknya
        // (bukan tanggal publish/updated postingan series itu sendiri).
        // Jadi begitu ada chapter baru terbit untuk sebuah series, kartunya
        // otomatis naik ke atas tanpa perlu edit postingan Series secara manual.
        this.mainItemArr.forEach(item => {
          var latestTime = new Date(item.seriesPublishedRaw).getTime() || 0;
          var chapterIds = [];
          this.subItemArr.forEach(sub => {
            if(item.category.some(x => sub.categorySub.includes(x))) {
              var t2 = new Date(sub.publishedRaw).getTime();
              if(t2 > latestTime) latestTime = t2;
              if(sub.postIdSub && chapterIds.indexOf(sub.postIdSub) === -1) chapterIds.push(sub.postIdSub);
            }
          });
          item._latestTime = latestTime;
          item._chapterIds = chapterIds;
        });
        this.mainItemArr.sort((a,b) => b._latestTime - a._latestTime);
        this.mainItemArr = this.mainItemArr.slice(0, HOME_MAX_SERIES);

        // Urutkan chapter berdasarkan ANGKA chapter terbesar (bukan tanggal publish),
        // supaya baris Lock & baris umum selalu memakai chapter dengan nomor tertinggi
        // di masing-masing kategori. Kalau nomor tidak terbaca / sama, pakai tanggal publish.
        var _chNum = function(ti) {
          var m = (ti || '').match(/(?:Chapter|Ch)\.?\s*(\d+(?:\.\d+)?)/i) || (ti || '').match(/(?:Episode|Eps?|Volume|Vol)\.?\s*(\d+(?:\.\d+)?)/i) || (ti || '').match(/(\d+(?:\.\d+)?)(?!.*\d)/);
          return m ? parseFloat(m[1]) : -1;
        };
        this.subItemArr.forEach(function(x){ x._num = _chNum(x.titleSub); x._t = new Date(x.publishedRaw).getTime() || 0; });
        this.subItemArr.sort(function(a,b){ return (b._num - a._num) || (b._t - a._t); });
  
        // Render
        if(this.mainItemArr.length > 0) {
          const ITEMS_PER_PAGE = 9;
          const totalPg = Math.ceil(this.mainItemArr.length / ITEMS_PER_PAGE);
          var n = "";
          this.mainItemArr.forEach(({title:t, link:e, image:i, category:r, uploader:up, isNsfw:nsfw, postId: pid, _chapterIds: chapterIds}, _bi) => {
            var o = "", count = 0;
  
            // Language
            var lang = r.find(k => ["JP","ID","EN","KR","CN"].includes(k)) || "";
            if(lang) {
              var flagMap = {"ID":"🇮🇩","JP":"🇯🇵","KR":"🇰🇷","CN":"🇨🇳","EN":"🇬🇧"};
              var flag = flagMap[lang] ? '<span style="font-size:0.9em;margin-right:2px">' + flagMap[lang] + '</span>' : '';
              lang = '<span class="' + lang.toLowerCase() + '">' + flag + lang + '</span>';
            }
  
            // New label
            var extra = r.includes("New") ? "<span class='n'>New</span>" : "";
  
            // Type label
            var typ = "", label2 = r.find(i => 
              ["Manga","Manhua","Manhwa","Novel","WN","LN","Doujin","Game"].includes(i)
            );
            if(label2) {
              typ = `<span class='absolute rounded top-1 end-1 text-xs px-1.5 ${label2.toLowerCase()}'>${label2}</span>`;
            }
  
            // Status
            var stat = "", label4 = r.find(i => 
              ["Ongoing","Completed","Dropped","Hiatus"].includes(i)
            );
            if(label4) {
              stat = `<span class='absolute rounded bottom-1 start-1 text-xs px-1.5 ${label4.toLowerCase()}'>${label4}</span>`;
            }
  
            // Genre list (for vertical card layout)
            var genreMaster = ["Action","Adventure","Comedy","Demons","Drama","Ecchi","Fantasy","Game","Gore","Harem","Historical","Horror","Isekai","Josei","Magic","Martial Arts","Mecha","Military","Music","Mystery","Psychological","Romance","Romcom","School","School Life","Sci-Fi","Seinen","Shoujo","Shoujo Ai","Shounen","Shounen Ai","Slice of Life","Sports","Super Power","Supernatural","Survival","Thriller","Tragedy","Vampire"];
            var genreFound = r.filter(i => genreMaster.includes(i));
            var genreHtml = genreFound.length > 0 ? genreFound.slice(0,3).join(' · ') : "";
  
            // Process chapters
            // Ambil maksimal 1 chapter Lock terbaru + 1 chapter umum/Free terbaru.
            // subItemArr sudah berurutan dari yang paling baru (mengikuti urutan
            // feed Blogger orderby=published), jadi cukup ambil yang pertama
            // ketemu untuk masing-masing kategori.
            var lockedChapter = null, freeChapter = null;
            if(this.subItemArr.length > 0) {
              this.subItemArr.forEach(({titleSub:t, linkSub:e, publishedSub:i, publishedRaw:iRaw, categorySub:n, rawLabels:rl, uploaderSub:upSub}) => {
                if(lockedChapter && freeChapter) return;
                if(!r.some(x => n.includes(x))) return;

                var isLockedRaw = rl && rl.includes('Lock');
                var isFreeEv = rl && rl.includes('Free');
                var isPwEv = rl && rl.includes('pw');
                // Kategori untuk pemilihan: Lock-murni vs umum (termasuk Lock+Free & Lock+pw)
                // Lock+pw diperlakukan seperti chapter umum/Free di Home (tampil di bawah,
                // tanpa gembok/warna khusus), meski di chapter list postingan Series
                // (bagian lain) tetap tampil ungu.
                var bucket = (isLockedRaw && !isFreeEv && !isPwEv) ? 'locked' : 'free';

                if(bucket === 'locked' && lockedChapter) return;
                if(bucket === 'free' && freeChapter) return;

                var a = t;
                var episode = '';
                var season = '';
                var episodeMatch = a.match(/Ep(?:isode)? (\d+)/i);
                var seasonMatch = a.match(/S(?:eason)? (\d+)/i);

                if(episodeMatch) episode = 'Eps ' + episodeMatch[1] + ' ';
                if(seasonMatch) season = 'S' + seasonMatch[1] + ' ';

                this.settingTitle.forEach(({name:e2}) => {
                  if(a.includes(e2)) {
                    var ftl1 = t.split("Volume")[0],
                        ftl2 = ftl1.split("Chapter")[0];
                    a = t.replace(ftl2, "")
                         .replace("Volume", "Vol")
                         .replace("Season", "S")
                         .replace("Chapter", "Ch")
                         .replace(/[^0-9]+$/g, "") + 
                         ' ' + (season || '') + (episode || '');
                  }
                });

                let statusLabel = '';
                if(n.includes('End')) statusLabel = '<span class="end ms-1">End</span>';
                if(n.includes('Fix')) statusLabel = '<span class="fix ms-1">Fix</span>';

                // Blinking dot: show if published within 3 days
                let newDot = '';
                try {
                  var pubDate = new Date(iRaw || i);
                  var diffDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
                  if(!isNaN(diffDays) && diffDays <= 3) newDot = '<span class="new-dot"></span>';
                } catch(e2) {}

                var chapterData = {title:a, link:e, displayed:t, time:i, statusLabel:statusLabel, newDot:newDot, uploader:upSub||'', rawTime: new Date(iRaw||i).getTime()||0, isPw:isPwEv};

                if(bucket === 'locked') {
                  lockedChapter = chapterData;
                } else {
                  freeChapter = chapterData;
                }
              });
            }

            // Nama uploader yang ditampilkan = uploader dari chapter TERBARU
            // (bandingkan locked vs free, bukan dari postingan Series)
            var displayUploader = '';
            if(lockedChapter && freeChapter) {
              displayUploader = (lockedChapter.rawTime >= freeChapter.rawTime) ? lockedChapter.uploader : freeChapter.uploader;
            } else if(lockedChapter) {
              displayUploader = lockedChapter.uploader;
            } else if(freeChapter) {
              displayUploader = freeChapter.uploader;
            }

            // Render baris Lock (kalau ada)
            if(lockedChapter) {
              var lc = lockedChapter;
              var lcColor = lc.isPw ? '#a855f7' : '#eab308';
              var lcColorRgba = lc.isPw ? '168,85,247' : '234,179,8';
              var lcTimeColor = lc.isPw ? '#9333ea' : '#ca8a04';
              var lcIconSvg = lc.isPw
                ? `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='11' height='11' fill='none' stroke='${lcColor}' stroke-width='2.5' style='flex-shrink:0;margin-left:2px'><rect x='3' y='11' width='18' height='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/><circle cx='12' cy='15.5' r='1.5' fill='${lcColor}' stroke='none'/></svg>`
                : `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${lcColor}' style='width:11px;height:11px;flex-shrink:0;margin-left:2px'><path d='M12 1C8.676 1 6 3.676 6 7v1H4v14h16V8h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 110 4 2 2 0 010-4z'/></svg>`;
              // Chapter "Lock, pw": langsung navigasi, TIDAK cek login/subscribe (gate password ditangani di halaman chapter).
              var lcOnclick = lc.isPw
                ? `location.href='${lc.link}'`
                : `(function(){if(typeof window.handleLockedChapter==='function'){window.handleLockedChapter('${lc.link}','${lc.title}');}else{var l=(typeof window.siteIsLoggedIn==='function')?window.siteIsLoggedIn():false;if(l){location.href='${lc.link}';}else if(typeof window.openLockPopup==='function'){window.openLockPopup('${lc.title}');}else{location.href='${lc.link}';}}})()`;
              o += `<li class="char-locked flex justify-between items-center mb-1 px-2 py-1 rounded-lg cursor-pointer" style="background:rgba(${lcColorRgba},0.08);border-left:3px solid ${lcColor};border-top:1px solid rgba(${lcColorRgba},0.2);border-right:1px solid rgba(${lcColorRgba},0.1);border-bottom:1px solid rgba(${lcColorRgba},0.1);" onclick="${lcOnclick}">
                     <div class="chpName flex items-center gap-1 min-w-0 flex-1">
                       ${lc.newDot}<span style="color:${lcColor};font-weight:600;font-size:0.85em" class="truncate">${lc.title}</span>${lcIconSvg}${lc.statusLabel}
                     </div>
                     <time style="color:${lcTimeColor};font-size:0.72em">${lc.time}</time>
                   </li>`;
            }

            // Garis pembatas: hanya muncul kalau ADA pasangan Lock + Free
            if(lockedChapter && freeChapter) {
              o += `<li class="chp-divider" style="list-style:none;border-top:1px dashed rgba(148,163,184,0.4);margin:10px 2px 12px;"></li>`;
            }

            // Render baris umum/Free (kalau ada).
            // Kalau TIDAK ada baris Lock di atasnya, kita sisipkan placeholder
            // kosong (invisible) dengan tinggi yang sama persis seperti
            // (baris Lock + divider), supaya posisi baris umum tetap sejajar
            // secara visual dengan card lain yang punya 2 baris.
            if(freeChapter && !lockedChapter) {
              o += `<li class="chp-placeholder" style="visibility:hidden;height:38px;margin-bottom:4px;list-style:none;" aria-hidden="true"></li>`;
            }
            if(freeChapter) {
              o += `<li class="char flex justify-between items-center rounded-lg mb-1 bg-slate-100 text-gray-700 dark:text-gray-400 dark:bg-gray-700 px-1 hover:text-accent duration-150 hover:bg-slate-200 hover:dark:bg-gray-900">
                     <div class="chpName flex items-center min-w-0 flex-1">
                       ${freeChapter.newDot}<a href="${freeChapter.link}" title="${freeChapter.displayed}" class="truncate">${freeChapter.title}</a>${freeChapter.statusLabel}
                     </div>
                     <time class="text-gray-400 text-xs flex-shrink-0 ml-1">${freeChapter.time}</time>
                   </li>`;
            }
  
            n += `<div class="bookItem flex bg-white dark:bg-gray-800 rounded-lg shadow${nsfw ? " nsfw" : ""}" style="content-visibility:auto;contain-intrinsic-size:0 120px" data-pg="${Math.floor(_bi/ITEMS_PER_PAGE)+1}">
                   <a class="w-28 shrink-0 overflow-hidden" href="${e}" title="${t}">
                     <div class="pb-[135%] relative overflow-hidden rounded-lg">
                                              <img class="absolute inset-0" alt="" loading="lazy" src="${i}"/>
                       
                       <!-- LABEL LOVE TOTAL LIKES -->
                     <span class="absolute top-1 start-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] font-bold shadow-sm z-10 lo-like-badge" data-like-series="${pid}" data-like-chapters="${(chapterIds||[]).join(',')}">
                         <svg class="w-3 h-3" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                         <span class="like-count-val lo-like-count">0</span>
                       </span>
                       ${nsfw ? `<span class="absolute top-1 end-1 rounded text-[0.62rem] font-bold px-1.5 py-0.5 bg-red-600 text-white tracking-wide">NSFW</span>` : ""}
                       ${stat}
                     </div>
                   </a>
                   <div class="data px-3 py-1.5 grow min-w-0">
                     <div class="text-xs text-accent font-bold">${lang && extra ? lang + " / " + extra : lang || extra || ""}</div>
                     <h2 class="line-clamp-1">
                       <a href="${e}" title="${t}">${t}</a>
                     </h2>
                     <div class="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                       <span class="line-clamp-1 min-w-0">${label2 ? `<span class="font-semibold">${label2}</span>` : ""}${label2 && genreHtml ? " · " : ""}${genreHtml}</span>
                       ${displayUploader ? `<span class="shrink-0 text-[0.7rem] opacity-70" title="Uploader chapter terbaru" data-lo-uploader="${displayUploader.replace(/"/g,'&quot;')}">${displayUploader}</span>` : ""}
                     </div>
                     <ul class="subItem text-sm">${o}</ul>
                   </div>
                 </div>`;
          });
  
          // Pager nav placeholder (filled after innerHTML)
          if(totalPg > 1) n += '<nav class="bookPager col-span-full flex justify-center items-center flex-wrap gap-1.5 mt-4 pt-3 border-t dark:border-gray-700" id="' + config.id + '-pager"></nav>';

          i.innerHTML = n;
          i.insertAdjacentHTML('beforeend', '<div class="col-span-full flex justify-center mt-2 mb-2"><a href="' + ALL_URL + '" class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-accent text-white text-sm font-semibold">Lihat Semua</a></div>');

          // Ganti nama Blogger -> username Firebase (+ badge role) kalau ada mapping-nya
          if (typeof window.LO_scanUploaderSpans === 'function') window.LO_scanUploaderSpans(i);

          // Show only page 1, hide the rest
          Array.from(i.querySelectorAll('.bookItem')).forEach(function(el){
            el.style.display = el.dataset.pg === '1' ? '' : 'none';
          });

          // Build & register client-side pagination
          if(totalPg > 1) {
            var _cid = config.id;
            var _buildPg = function(cur) {
              var bc = 'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors cursor-pointer select-none ';
              var bA = bc + 'bg-accent text-white';
              var bN = bc + 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';
              var bDot = 'self-center text-gray-400 dark:text-gray-500 px-0.5 text-xs pointer-events-none';
              var h = '';
              // Prev (‹)
              if(cur > 1) h += '<span class="' + bN + '" onclick="' + _cid + '_goPage(' + (cur-1) + ')">&#8249;</span>';
              // Windowed page numbers (max 5 visible)
              var s = Math.max(1, cur-2), en = Math.min(totalPg, cur+2);
              if(en-s < 4){ if(s===1) en=Math.min(totalPg,s+4); else if(en===totalPg) s=Math.max(1,en-4); }
              if(s > 1){ h += '<span class="' + bN + '" onclick="' + _cid + '_goPage(1)">1</span>'; if(s>2) h += '<span class="' + bDot + '">&#8230;</span>'; }
              for(var p=s; p<=en; p++) h += '<span class="' + (p===cur?bA:bN) + '" onclick="' + _cid + '_goPage('+p+')">'+p+'</span>';
              if(en < totalPg){ if(en<totalPg-1) h += '<span class="' + bDot + '">&#8230;</span>'; h += '<span class="' + bN + '" onclick="' + _cid + '_goPage('+totalPg+')">'+totalPg+'</span>'; }
              // Next (›)
              if(cur < totalPg) h += '<span class="' + bN + '" onclick="' + _cid + '_goPage(' + (cur+1) + ')">&#8250;</span>';
              return h;
            };
            window[_cid + '_goPage'] = function(pg) {
              window[_cid + '_cur'] = pg;
              var cont = document.getElementById(_cid);
              if(!cont) return;
              Array.from(cont.querySelectorAll('.bookItem')).forEach(function(el){ el.style.display = parseInt(el.dataset.pg)===pg ? '' : 'none'; });
              var pEl = document.getElementById(_cid+'-pager');
              if(pEl) pEl.innerHTML = _buildPg(pg);
              // Scroll section into view smoothly
              var sec = cont.closest('[data-view]') || cont.closest('section') || cont.parentElement;
              if(sec && !window.__loNoScroll) sec.scrollIntoView({behavior:'smooth', block:'start'});
            };
                        var pEl0 = document.getElementById(config.id+'-pager');
            if(pEl0) pEl0.innerHTML = _buildPg(1);
          }
        }
        
        // Panggil Cloudflare Worker (BUKAN Firestore langsung), hasilnya di-cache
        // di localStorage beberapa menit supaya ganti halaman / banyak card
        // tidak memicu fetch berulang -> hemat kuota Worker & tetap ringan.
        if (typeof window.LO_fmtCompact === 'undefined') {
            window.LO_fmtCompact = function(n) {
                n = Number(n) || 0;
                if (n < 1000) return String(n);
                if (n < 1000000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'k';
                return (Math.floor(n / 100000) / 10).toFixed(1).replace(/\.0$/, '') + 'jt';
            };
        }
        if (typeof window.fetchSeriesLikes === 'undefined') {
            var LO_LIKES_CACHE_KEY = 'lo_likes_cache_v1';
            var LO_LIKES_TTL_MS = 3 * 60 * 1000;

            window.fetchSeriesLikes = function() {
                if (window.LO_LIKES_FETCHED) {
                    window.updateLikeBadges();
                    return;
                }

                try {
                    var cachedRaw = localStorage.getItem(LO_LIKES_CACHE_KEY);
                    if (cachedRaw) {
                        var cached = JSON.parse(cachedRaw);
                        if (cached && cached.t && (Date.now() - cached.t) < LO_LIKES_TTL_MS && cached.d) {
                            window.LO_LIKES_DATA = cached.d;
                            window.LO_LIKES_FETCHED = true;
                            window.updateLikeBadges();
                            return;
                        }
                    }
                } catch (e) { /* localStorage penuh/diblokir, lanjut fetch biasa */ }

                fetch('https://langitoren-likes.langitoren00.workers.dev/')
                    .then(res => res.json())
                    .then(data => {
                        window.LO_LIKES_DATA = data || {};
                        window.LO_LIKES_FETCHED = true;
                        try {
                            localStorage.setItem(LO_LIKES_CACHE_KEY, JSON.stringify({ t: Date.now(), d: window.LO_LIKES_DATA }));
                        } catch (e) { /* abaikan */ }
                        window.updateLikeBadges();
                    })
                    .catch(err => console.log('Gagal load likes:', err));
            };
            
            window.updateLikeBadges = function() {
                if (!window.LO_LIKES_DATA) return;
                document.querySelectorAll('[data-like-series]').forEach(function(el) {
                    var seriesId = el.getAttribute('data-like-series');
                    var totalLikes = 0;
                    var seriesRec = window.LO_LIKES_DATA[seriesId];

                    if (seriesRec && typeof seriesRec.total_series_like === 'number') {
                        // Sumber utama: counter permanen per-series, sudah akumulasi
                        // dari setiap like di chapter manapun sejak fitur ini aktif.
                        totalLikes = seriesRec.total_series_like;
                    } else {
                        // Fallback sementara (sebelum ada like baru / sebelum migrasi):
                        // jumlahkan like chapter yang kebetulan ikut termuat di
                        // batch feed direktori (bisa under-count untuk chapter lama
                        // yang tidak ikut ke-load, karena feed dibatasi 150 post terbaru).
                        var chapterIdsAttr = el.getAttribute('data-like-chapters') || '';
                        var chapterIds = chapterIdsAttr.split(',').filter(Boolean);
                        chapterIds.forEach(function(cid) {
                            var rec = window.LO_LIKES_DATA[cid];
                            if (rec && typeof rec.like === 'number') totalLikes += rec.like;
                        });
                    }

                    var countEl = el.querySelector('.like-count-val');
                    if (countEl) {
                        countEl.textContent = window.LO_fmtCompact(totalLikes);
                        countEl.setAttribute('title', totalLikes + ' likes');
                    }
                });
            };
        }
        if (typeof window.LO_likeBadgeHTML === 'undefined') {
            window.LO_likeBadgeHTML = function(pid, chapterIdsCsv) {
                if (!pid) return '';
                chapterIdsCsv = chapterIdsCsv || '';
                return '<span class="absolute top-1 start-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] font-bold shadow-sm z-10 lo-like-badge" data-like-series="' + pid + '" data-like-chapters="' + chapterIdsCsv + '">' +
                    '<svg class="w-3 h-3" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' +
                    '<span class="like-count-val lo-like-count">0</span></span>';
            };
        }
        setTimeout(window.fetchSeriesLikes, 800);
      },
  
      run: function(t, e) {
        // Tidak bergantung label Project.
        // Tahap 1: ambil chapter terbaru (label Chapter) + post series (label tipe), render cepat.
        // Tahap 2 (hydrate): series yang chapternya tidak ada di feed tahap 1 diambil
        // chapternya satu per satu lewat /-/Chapter/NamaSeries, lalu render ulang.
        var self = this, cid = config.id;
        var labels = ['Chapter'].concat(this.mainItem);
        var pending = labels.length, all = {};
        var EXC = ['Project','Lock','Free','pw','NSFW','Chapter','ID','JP','EN','KR','CN','New','Series','End','Fix',
          'Ongoing','Completed','Complete','Hiatus','Dropped','Tamat','Berjalan',
          'Manga','Manhwa','Manhua','WN','LN','Doujin','Novel','Game',
          'Action','Adventure','Comedy','Demons','Drama','Ecchi','Fantasy','Gore','Harem','Historical','Horror','Isekai','Josei','Magic','Martial Arts','Mecha','Military','Music','Mystery','Psychological','Romance','Romcom','School','School Life','Sci-Fi','Seinen','Shoujo','Shoujo Ai','Shounen','Shounen Ai','Slice of Life','Sports','Super Power','Supernatural','Survival','Thriller','Tragedy','Vampire'];
        function terms(en) { return (en.category || []).map(function(c){ return c.term; }); }
        function sorted() {
          return Object.keys(all).map(function(k){ return all[k]; })
            .sort(function(a,b){ return new Date(b.published.$t) - new Date(a.published.$t); });
        }
        function finish() {
          window[cid + '_cur'] = 1;
          self.compile({feed:{entry:sorted()}});
          hydrate();
        }
        function done() { if (--pending === 0) finish(); }

        function hydrate() {
          // Hanya series yang tampil di Home (maks HOME_MAX_SERIES) yang dicek chapternya.
          var missing = [];
          (self.mainItemArr || []).forEach(function(it){
            if (it._chapterIds && it._chapterIds.length) return;
            var cand = (it.category || []).filter(function(x){ return EXC.indexOf(x) === -1; });
            if (cand.length) missing.push(cand);
          });
          if (!missing.length) return;
          var queue = missing.slice(), active = 0, added = 0;
          function tryCand(cand, i, cb) {
            if (i >= cand.length) return cb();
            var url = '/feeds/posts/default/-/Chapter/' + encodeURIComponent(cand[i]) +
              '?alt=json&orderby=published&max-results=10&fields=' +
              encodeURIComponent('entry(id,title,link,published,category,author(name),media:thumbnail)');
            fetch(url).then(function(r){ return r.json(); }).then(function(d){
              var list = (d.feed && d.feed.entry) || [];
              if (!list.length) return tryCand(cand, i + 1, cb);
              list.forEach(function(en){
                if (!all[en.id.$t]) { en.content = {$t: ''}; all[en.id.$t] = en; added++; }
              });
              cb();
            }).catch(function(){ tryCand(cand, i + 1, cb); });
          }
          function next() {
            if (!queue.length) { if (active === 0) end(); return; }
            var cand = queue.shift(); active++;
            tryCand(cand, 0, function(){ active--; next(); });
          }
          function end() {
            if (!added) return;
            var cur = window[cid + '_cur'] || 1;
            window.__loNoScroll = true;
            self.compile({feed:{entry:sorted()}});
            if (cur > 1 && window[cid + '_goPage']) window[cid + '_goPage'](cur);
            window.__loNoScroll = false;
          }
          for (var w = 0; w < 5; w++) next();
        }

        labels.forEach(function(lb, i) {
          var cb = '__' + type + 'Feed' + i;
          window[cb] = function(d) {
            ((d.feed && d.feed.entry) || []).forEach(function(en){ all[en.id.$t] = en; });
            done();
          };
          var sc = document.createElement('script');
          var max = (lb === 'Chapter') ? e : 500;
          sc.src = '/feeds/posts/default/-/' + encodeURIComponent(lb) +
                   '?orderby=published&alt=json-in-script&max-results=' + max + '&callback=' + cb;
          sc.onerror = done;
          document.body.appendChild(sc);
        });
      }
    };
  
    return window[`${type}Post`];
  }
  
  // Create instances
  const mangaPost = createPostHandler('manga');
  const novelPost = createPostHandler('novel');
  //
