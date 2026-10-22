/* langitoren: series-feed.js (diekstrak dari tema, baris 1086) */
/**/
const clwd={
    arr:new Array,
    compile:function(){
        const t=this;
        if(t.d1p&&!t.d1Merged){t.d1Merged=!0;return void t.d1p.then(function(){t.d1Items&&t.d1Items.length&&(t.arr=t.d1Items.concat(t.arr)),t.compile()})}
        // Buang postingan info Series dari daftar, TIDAK PEDULI di posisi
        // mana dia muncul di hasil feed. Sebelumnya logic ini cuma cek
        // t.arr[0] lalu digeser ke belakang kalau tidak cocok pola chapter
        // - itu HANYA berhasil kalau postingan Series kebetulan jadi yang
        // paling baru tanggal publish-nya (makanya harus manual diubah ke
        // "Otomatis" tiap update chapter supaya rapi). Sekarang postingan
        // Series dikenali dari judulnya yang TIDAK cocok pola manapun
        // (Chapter/Volume/Episode/Ch./Prologue/Oneshot/Side Story), lalu
        // dibuang dari array apapun urutan publishnya.
        t.arr = t.arr.filter(a => t.settings.title.some(o => a.title.includes(o.in)));
        const e=t.arr.length;
        let n="<ul>",
        s='<div class="lastend grid grid-cols-2 gap-1">';
        
        jQuery.each(t.arr,function(i,a){
            let l=a.title;
            let labelHtml = '';
            
            // Add label indicators if present
            if(a.labels) {
                if(a.labels.includes('End')) {
                    labelHtml += '<span class="end ms-2">End</span>';
                }
                if(a.labels.includes('Fix')) {
                    labelHtml += '<span class="fix ms-2">Fix</span>';
                }
            }

                var isLocked = a.labels && a.labels.includes('Lock');
                var isFree   = a.labels && a.labels.includes('Free');
                var isPw     = isLocked && a.labels && a.labels.includes('pw');
                var thumbHtml = a.thumbnail
                  ? (isPw
                      ? `<div class="relative flex-shrink-0" style="width:120px;height:70px"><img class="ch-thumb w-full h-full object-cover" src="${a.thumbnail}" loading="lazy" style="filter:brightness(0.6)"/><div class="absolute inset-0 flex items-center justify-center" style="background:rgba(0,0,0,0.5)"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="15.5" r="1.5"/></svg></div></div>`
                      : (isLocked && !isFree
                          ? `<div class="relative flex-shrink-0" style="width:120px;height:70px"><img class="ch-thumb w-full h-full object-cover" src="${a.thumbnail}" loading="lazy"/><div class="absolute inset-0 flex items-center justify-center" style="background:rgba(0,0,0,0.55)"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div></div>`
                          : `<img class="ch-thumb" src="${a.thumbnail}" loading="lazy"/>`))
                  : '';
            jQuery.each(t.settings.title,function(t,e){
                if(l.includes(e.in)){var after=l.split(e.in)[1];var chNumMatch=after.match(/^[\s]*([\d]+(?:[.\-][\d]+)?)(.*)/);if(chNumMatch){var chNum=chNumMatch[1];var rest=chNumMatch[2].replace(/^\s*[-:]\s*/,"").trim();if(rest&&/^[\d]+$/.test(rest.replace(/\s/g,""))){l=e.out+" "+chNum;}else{l=rest.length>0?e.out+" "+chNum+" : "+rest:e.out+" "+chNum;}}else{var titleAfter=after.replace(/^\s*[-:]\s*|\s+$/g,"").trim();l=titleAfter.length>0?e.out+" "+titleAfter:e.out;}}
            });
            {
            // Badge NEW: chapter diupdate dalam 24 jam terakhir (dari ZeistManga)
            var isNew = (function(){ try { var d=new Date(a.updated||a.published||''); return !isNaN(d)&&(Date.now()-d)<86400000; } catch(e){ return false; } })();
            var newBadge = isNew ? '<span class=\"ms-1 px-1 rounded bg-green-500 text-[0.5rem] text-white font-bold animate-pulse shadow\">NEW</span>' : '';
            var lockItemStyle = isPw
              ? 'style="background:rgba(168,85,247,0.08);border-left:3px solid #a855f7;border-top:1px solid rgba(168,85,247,0.2);border-right:1px solid rgba(168,85,247,0.1);border-bottom:1px solid rgba(168,85,247,0.1);"'
              : isFree
                ? 'style="background:rgba(34,197,94,0.08);border-left:3px solid #22c55e;border-top:1px solid rgba(34,197,94,0.2);border-right:1px solid rgba(34,197,94,0.1);border-bottom:1px solid rgba(34,197,94,0.1);"'
                : isLocked
                  ? 'style="background:rgba(234,179,8,0.08);border-left:3px solid #eab308;border-top:1px solid rgba(234,179,8,0.2);border-right:1px solid rgba(234,179,8,0.1);border-bottom:1px solid rgba(234,179,8,0.1);"'
                  : '';
            var lockIcon = isPw
              ? '<span class="vcn mx-2 flex-shrink-0" style="color:#a855f7"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg></span>'
              : isFree
                ? '<span class="vcn mx-2 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><g fill="currentColor" style="color:#22c55e"><path d="M232 56v144a16 16 0 0 1-16 16H40a16 16 0 0 1-16-16V56a16 16 0 0 1 16-16h176a16 16 0 0 1 16 16Z" opacity=".2"/><path d="m205.66 85.66l-96 96a8 8 0 0 1-11.32 0l-40-40a8 8 0 0 1 11.32-11.32L104 164.69l90.34-90.35a8 8 0 0 1 11.32 11.32Z"/></g></svg></span>'
                : isLocked
                  ? '<span class="vcn mx-2 flex-shrink-0" style="color:#eab308"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
                  : '<span class="vcn mx-2 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><g fill="currentColor"><path d="M232 56v144a16 16 0 0 1-16 16H40a16 16 0 0 1-16-16V56a16 16 0 0 1 16-16h176a16 16 0 0 1 16 16Z" opacity=".2"/><path d="m205.66 85.66l-96 96a8 8 0 0 1-11.32 0l-40-40a8 8 0 0 1 11.32-11.32L104 164.69l90.34-90.35a8 8 0 0 1 11.32 11.32Z"/></g></svg></span>';
            var chTextColor = isPw ? 'style="color:#9333ea"' : isFree ? 'style="color:#16a34a"' : isLocked ? 'style="color:#ca8a04"' : '';
            n+=`<li class="relative" data-ch-url="${a.link}" data-author="${(a.authorName||'').replace(/"/g,'&quot;')}" ${lockItemStyle}><a class="eph-num my-1 flex items-center py-0 px-0 overflow-hidden transition-all focus:ring-2 focus:ring-accent duration-300 ${(isLocked&&!isFree)?'':'bg-white dark:bg-gray-800/50 '}hover:bg-gray-300 dark:hover:bg-gray-700" href="${a.link}">${thumbHtml}${lockIcon}<span class="chapternum flex-1 py-1.5 min-w-0 overflow-hidden" ${chTextColor}><span class="block truncate">${l}</span>${labelHtml}${newBadge}</span><div class="flex flex-col items-end shrink-0 px-2"><span class="chapterdate text-gray-400 dark:text-gray-600 text-sm">${a.published}</span><span class="ch-uploader flex items-center gap-1 mt-0.5"><span class="ch-uploader-name text-gray-500 dark:text-gray-400 text-xs truncate max-w-[80px]" data-lo-uploader="${(a.authorName||'').replace(/"/g,'&quot;')}">${a.authorName||'...'}</span>
</span></div></a></li>`
            }
        }),
        s+="</div>",
        n+="</ul>",
                document.getElementById("clwd").innerHTML=`${s+n}`;
        // Catatan: pengisian box "Anggota yang berkontribusi" (avatar + badge)
        // sepenuhnya ditangani oleh script #aside-contributor-list.
        // Di sini cukup trigger fetch nama uploader per-baris chapter.
        setTimeout(function(){
            if(typeof window.chUploaderFetch==='function') window.chUploaderFetch(t.settings.cat||"");
        }, 200);

    },
    get:function(t){
        const e=this;
        t.ajax({
            url:`/feeds/posts/default/-/${this.settings.cat}?alt=json-in-script&start-index=${this.settings.start}&max-results=${this.settings.max}&fields=entry(title,link,updated,category,author,media:thumbnail)`,
            type:"get",
            dataType:"jsonp",
            success:function(n){
                "entry"in n.feed?(n.feed.entry.forEach(n=>{
                    e.arr.push({
                        title:n.title.$t,
                        link:n.link.find(t=>"alternate"==t.rel).href,
                        updated:n.updated.$t,
                        published:"function"==typeof timeAgo?timeAgo(new Date(n.updated.$t)):e.timeStirng(n.updated.$t),
                        labels:n.category?n.category.map(cat=>cat.term):[],
                        authorName:(n.author&&n.author[0]&&n.author[0].name&&n.author[0].name.$t)||"",
                        authorAvatar:(function(){
                          if(!n.author||!n.author[0])return"";
                          var img=n.author[0]["gd$image"];
                          if(img&&img.src&&img.src.indexOf("http")===0)return img.src.replace(/\/s\d+-c\//, "/s40-c/");
                          return"";
                        })(),
                        thumbnail:(function(){
                          // Priority 1: media$thumbnail (Blogger's built-in featured image)
                          if(n["media$thumbnail"]&&n["media$thumbnail"].url){
                            return n["media$thumbnail"].url.replace(/\/s\d+(-c)?\//, "/s400/").replace(/=s\d+(-c)?$/, "=s400");
                          }
                          // Priority 2: parse first img src from content/summary
                          var c=(n.content&&n.content.$t)||(n.summary&&n.summary.$t)||"";
                          var p=c.split('src="');if(p.length<2)return"";var u=p[1].split('"')[0];return u.indexOf("http")===0?u:"";
                        })()
                    })
                }),
                n.feed.entry.length>=e.settings.max?(e.settings.start+=e.settings.max,e.run(e.settings.cat)):e.compile()):(0!=e.arr.length||e.d1p)&&e.compile()
            },
            error:function(t){
                console.log(t)
            }
        })
    },
    run:function(t){
        this.settings.cat=t,
        window.clwdD1&&clwdD1.prefetch(this,t),
        "function"==typeof jQuery&&document.getElementById("clwd")?this.get(jQuery):console.log("Output Nothing")
    },
    settings:{
        max:60,
        start:1,
        title:[
            {in:"Episode",out:"Ep."},
            {in:"Chapter",out:"Chapter"},
            {in:"Volume",out:"Vol."},
            {in:"Ch.",out:"Ch."},
            {in:"Ch ",out:"Ch."},
            {in:"Prologue",out:"Prologue"},
            {in:"Prolog",out:"Prolog"},
            {in:"Oneshot",out:"Oneshot"},
            {in:"One Shot",out:"Oneshot"},
            {in:"One-Shot",out:"Oneshot"},
            {in:"Side Story",out:"Side Story"}
        ],
        judul:"Chapter List"
    },
    timeStirng:function(t){
        if(/([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/.test(t)){
            var e=t,
            n=e.substring(0,4),
            s=e.substring(5,7),
            i=e.substring(8,10),
            a=new Array;
            return a[1]="Jan",a[2]="Feb",a[3]="Mar",a[4]="Apr",a[5]="May",a[6]="Jun",a[7]="Jul",a[8]="Aug",a[9]="Sep",a[10]="Oct",a[11]="Nov",a[12]="Dec",i+" "+a[parseInt(s,10)]+" "+n
        }
        return!1
    }
};

// ── clwdD1: daftar chapter untuk series buatan sistem upload (data dari D1) ──
// Series lama tetap memakai clwd.run(...). Ganti GANTI-INI dengan URL Worker upload.
window.clwdD1 = {
  api: 'https://langitoren-upload.langitoren00.workers.dev', 
  readUrl: '/p/read.html',                                  

  // nama tampilan uploader dari Firestore (users/{uid}), maks 30 uid unik
  names: function (items) {
    var uids = [], seen = {};
    items.forEach(function (c) { if (c.uploader_uid && !seen[c.uploader_uid]) { seen[c.uploader_uid] = 1; uids.push(c.uploader_uid); } });
    uids = uids.slice(0, 30);
    return new Promise(function (resolve) {
      var tries = 0;
      (function wait() {
        var fb = window.siteGetFirebase && window.siteGetFirebase();
        if (fb && fb.db) {
          var out = {};
          Promise.all(uids.map(function (uid) {
            return fb.db.collection('users').doc(uid).get().then(function (d) {
              var v = d.exists ? d.data() : null;
              out[uid] = (v && (v.displayName || v.username)) || '';
            }).catch(function () {});
          })).then(function () { resolve(out); });
        } else if (++tries > 15) { resolve({}); }
        else { setTimeout(wait, 100); }
      })();
    });
  },

  // Chapter D1 -> bentuk data yang sama dengan feed Blogger (terbaru dulu)
  items: function (id) {
    var self = this;
    if (!id || self.api.indexOf('GANTI-INI') !== -1) return Promise.resolve([]);
    return fetch(self.api + '/series/chapters?series=' + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        // Chapter yang sudah punya post Blogger (c.url) tampil lewat feed Blogger; di sini hanya yang masih antre.
        var queued = (j.ok ? j.items : []).filter(function (c) { return !c.url; });
        if (!queued.length) return [];
        return self.names(queued).then(function (names) {
          return queued.slice().sort(function (a, b) { return b.number - a.number; }).map(function (c) {
            var iso = new Date(c.created_at).toISOString(), num = String(c.number);
            return {
              title: 'Chapter ' + num + (c.title ? ' - ' + c.title : ''),
              link: self.readUrl + '?s=' + encodeURIComponent(id) + '&c=' + encodeURIComponent(num),
              updated: iso,
              published: typeof timeAgo === 'function' ? timeAgo(new Date(iso)) : clwd.timeStirng(iso),
              labels: [],
              authorName: names[c.uploader_uid] || '',
              authorAvatar: '',
              thumbnail: ''
            };
          });
        });
      })
      .catch(function () { return []; });
  },

  // Dipanggil clwd.run: ambil chapter D1 paralel dengan feed Blogger (series lama yang sudah diimpor)
  prefetch: function (obj, id) {
    if (obj.d1p) return;
    obj.d1p = this.items(id).then(function (arr) { obj.d1Items = arr; });
  },

  // Kompatibilitas: post Series lama yang memanggil clwdD1.run(id) -> pakai clwd.run (otomatis menggabungkan antrean)
  run: function (id) { clwd.run(id); }
};

/**/
