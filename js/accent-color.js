/* langitoren: accent-color.js (diekstrak dari tema, baris 2087) */
/* ═══ WARNA AKSEN SITUS (site-wide, per-user) ═══
   Sumber utama: Firestore users/{uid}.themeColor (diedit di Halaman Profil).
   Di-cache ke localStorage supaya tiap halaman langsung dapat warnanya tanpa
   nunggu/nembak Firestore berulang-ulang. Default tetap biru jika belum login
   atau belum pernah set warna. Berlaku sama di mode terang dan gelap karena
   semua target CSS di sini sudah punya varian `.dark ...` masing-masing. */
(function(){
  var DEFAULT_ACCENT='#58a1c8',LS_KEY='site-accent';

  function hexToRgb(hex){
    hex=(hex||'').replace('#','');
    if(hex.length===3)hex=hex.split('').map(function(c){return c+c;}).join('');
    var n=parseInt(hex,16);
    return isNaN(n)?null:{r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }
  function shade(rgb,amt){ /* amt: -1..1, negatif = gelapkan, positif = terangkan */
    var f=amt<0?0:255,p=Math.abs(amt);
    return{r:(f-rgb.r)*p+rgb.r,g:(f-rgb.g)*p+rgb.g,b:(f-rgb.b)*p+rgb.b};
  }
  function rgbToHex(rgb){
    return '#'+[rgb.r,rgb.g,rgb.b].map(function(v){return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');}).join('');
  }
  function rgba(rgb,a){return 'rgba('+Math.round(rgb.r)+','+Math.round(rgb.g)+','+Math.round(rgb.b)+','+a+')';}

  window.siteApplyAccent=function(hex){
    hex=hex||DEFAULT_ACCENT;
    var rgb=hexToRgb(hex);if(!rgb)return;
    var hover=rgbToHex(shade(rgb,-.18));
    var s30=rgba(rgb,.3),s50=rgba(rgb,.5),s80=rgba(rgb,.8),s85=rgba(rgb,.85);
    /* Permukaan gelap untuk header/footer saat dark mode: sedikit ada rona aksen,
       tapi tetap gelap (bukan warna terang penuh) */
    var navDark=rgbToHex(shade(rgb,-.85));
    /* Kontras ikon header: pilih putih atau gelap tergantung terang/gelapnya aksen,
       supaya ikon (hamburger, notif, titik tiga) selalu jelas di atas warna apa pun */
    var luminance=(0.299*rgb.r+0.587*rgb.g+0.114*rgb.b)/255;
    var onAccent=luminance>0.6?'#111827':'#ffffff';
    /* Teks berwarna aksen (judul post, tab aktif, dsb) TIDAK ditaruh di atas
       aksen penuh, tapi di atas background halaman (terang atau gelap). Jadi
       kontrasnya harus mengikuti mode halaman, bukan cuma warna aksen mentah:
       mode terang → selalu digelapkan (walau aksennya putih/pastel),
       mode gelap → selalu diterangkan (walau aksennya gelap/navy). */
    var textLight=rgbToHex(shade(rgb,-.6));
    var textDark=rgbToHex(shade(rgb,.6));
    /* Warna pastel lembut (10% aksen di atas putih) dipakai utk background body/halaman
       & transisi bawah gradient banner series, supaya menyatu dgn background halaman */
    var bodyBgLightRgb=shade(rgb,.9),bodyBgLight=rgbToHex(bodyBgLightRgb);
    /* Kotak abu-abu (Genre, Rating, Update, Synopsis, dll): dulu putih polos (silau),
       sekarang tint sangat tipis (4% aksen) — sedikit lebih terang dari body, bukan putih murni */
    var tintLight=rgbToHex(shade(rgb,.96)),tintDark=rgba(rgb,.16);
    /* Varian terang aksen, dipakai untuk ujung gradient (ganti to-blue-500 lama) */
    var accentLight=rgbToHex(shade(rgb,.35));
    /* --accent & --accent-dark dipakai banyak elemen (reader, avatar kontributor kecil)
       yg sudah pakai var(--accent,...) supaya ikut aksen tanpa perlu di-hardcode biru */
    document.documentElement.style.setProperty('--accent',hex);
    document.documentElement.style.setProperty('--accent-dark',hover);
    var css=''
      +'.bg-accent{background-color:'+hex+' !important}'
      +'.dark .dark\\:bg-accent{background-color:'+hex+' !important}'
      /* Header dan footer: terang = aksen penuh, gelap = permukaan gelap (bukan clobber dark:bg-gray-950) */
      +'html:not(.dark) nav.bg-accent,html:not(.dark) footer.bg-accent{background-color:'+hex+' !important}'
      +'html.dark nav.bg-accent,html.dark footer.bg-accent{background-color:'+navDark+' !important}'
      /* Judul blog di header (span.text-white bawaan theme) ditaruh di atas
         nav.bg-accent yg jadi warna aksen PENUH di mode terang. Kalau aksennya
         terang/putih, teks putih jadi nyaris hilang — jadi ikutin onAccent
         (hitam/putih otomatis sesuai kontras) di mode terang. Mode gelap nav
         sudah jadi permukaan gelap (navDark), jadi teks putih bawaan tetap oke. */
      +'html:not(.dark) .self-center.text-2xl.font-semibold.whitespace-nowrap{color:'+onAccent+' !important}'
      /* Tombol solid bg-accent (Sign in, Masuk/Daftar, Simpan, dll) juga selalu
         pakai teks putih hardcoded, padahal bg-nya = aksen penuh di kedua mode. */
      +'.bg-accent.text-white{color:'+onAccent+' !important}'
      +'html:not(.dark) .text-accent,html:not(.dark) .group:hover .group-hover\\:text-accent,html:not(.dark) .hover\\:text-accent:hover{color:'+textLight+' !important}'
      +'html.dark .text-accent,html.dark .group:hover .group-hover\\:text-accent,html.dark .hover\\:text-accent:hover{color:'+textDark+' !important}'
      +'.border-accent{border-color:'+hex+' !important}'
      +'.from-accent{--tw-gradient-from:'+hex+' var(--tw-gradient-from-position) !important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to) !important}'
      +'.to-accent-light{--tw-gradient-to:'+accentLight+' var(--tw-gradient-to-position) !important}'
      +'.bg-accent\\/30{background-color:'+s30+' !important}'
      +'.bg-accent\\/50,.hover\\:bg-accent\\/50:hover{background-color:'+s50+' !important}'
      +'.hover\\:bg-accent\\/80:hover{background-color:'+s80+' !important}'
      +'.hover\\:bg-accent:hover,.dark .dark\\:hover\\:bg-accent:hover{background-color:'+hover+' !important}'
      +'.focus\\:border-accent:focus,.dark .dark\\:focus\\:border-accent:focus{border-color:'+hex+' !important}'
      +'.focus\\:ring-accent:focus,.dark .dark\\:focus\\:ring-accent:focus{--tw-ring-color:'+hex+' !important}'
      +'.focus\\:ring-accent\\/30:focus{--tw-ring-color:'+s30+' !important}'
      +'.dark .dark\\:focus\\:ring-accent\\/80:focus{--tw-ring-color:'+s80+' !important}'
      +'.aria-selected\\:bg-accent[aria-selected=true],.dark .dark\\:aria-selected\\:bg-accent[aria-selected=true]{background-color:'+hex+' !important}'
      /* Background body/halaman: dulu abu-abu polos (#f3f4f6), sekarang tint pastel ikut aksen.
         Berlaku di semua halaman theme karena script ini jalan di setiap page load. */
      +'html:not(.dark) body{background-color:'+bodyBgLight+' !important}'
      /* Gradient bawah banner halaman series: dulu ikut warna aksen penuh, sekarang disamakan
         dgn warna background body supaya menyatu/blend, bukan lagi warna aksen kontras */
      +'html:not(.dark){--header-bg-color:'+Math.round(bodyBgLightRgb.r)+','+Math.round(bodyBgLightRgb.g)+','+Math.round(bodyBgLightRgb.b)+' !important}'
      /* Ikon header (hamburger, notif, titik tiga, dice) selalu kontras di mode terang; mode gelap dibiarkan (sudah punya warna sendiri) */
      +'html:not(.dark) #nav button[data-collapse-toggle],html:not(.dark) #nav button[data-collapse-toggle] svg{color:'+onAccent+' !important}'
      +'html:not(.dark) #HKot6oXO0M,html:not(.dark) #HKot6oXO0M svg{color:'+onAccent+' !important}'
      +'html:not(.dark) #dropdownDefaultButton,html:not(.dark) #dropdownDefaultButton svg{color:'+onAccent+' !important}'
      +'html:not(.dark) .ranpost,html:not(.dark) .ranpost svg{color:'+onAccent+' !important}'
      /* Kotak abu-abu (Genre pill, Rating, Update, Synopsis, Kontributor, pill Advance Search) ikut aksen */
      +'.xa-tint{background-color:'+tintLight+' !important}'
      +'.dark .xa-tint{background-color:'+tintDark+' !important}'
      /* Popular Posts: kartu abu-abu/putih jadi ikut aksen */
      +'html:not(.dark){--pop-card-bg:'+tintLight+' !important}'
      +'html.dark{--pop-card-bg:'+tintDark+' !important}'
      /* Judul postingan (listing card & halaman post/chapter) ikut warna aksen */
      +'html:not(.dark) .post-title,html:not(.dark) .entry-title{color:'+textLight+' !important}'
      +'html.dark .post-title,html.dark .entry-title{color:'+textDark+' !important}'
      /* Modal Anggota Berkontribusi: background & ring avatar SENGAJA tidak lagi
         dipaksa !important di sini. Sekarang keduanya diatur oleh openContribModal()
         supaya ikut warna aksen PEMILIK AKUN yang sedang dibuka (bukan aksen situs
         milik pengunjung), lihat fungsi openContribModal di bagian modal kontributor. */
      +'html:not(.dark) #contrib-modal-name{color:#1f2937 !important}'
      +'html:not(.dark) #contrib-modal-box > button{background:rgba(0,0,0,.06) !important;color:#374151 !important}'
      +'.cm-spinner{border-top-color:'+hex+' !important}'
      /* auth landing (halaman profil) */
      +'.xal-tab.active{color:'+textLight+' !important;border-bottom-color:'+hex+' !important}'
      +'.dark .xal-tab.active{color:'+textDark+' !important;border-bottom-color:'+hex+' !important}'
      +'.xal-forgot a,.xal-switch a{color:'+textLight+' !important}'
      +'.dark .xal-forgot a,.dark .xal-switch a{color:'+textDark+' !important}'
      +'.xal-btn{background:'+hex+' !important}.xal-btn:hover,.dark .xal-btn:hover{background:'+hover+' !important}'
      +'.xal-input:focus,.dark .xal-input:focus{border-color:'+hex+' !important;box-shadow:0 0 0 3px '+s30+' !important}'
      /* Tombol scroll ke atas: warnanya ikut aksen, ikon otomatis gelap/terang tergantung
         terang/gelapnya warna aksen (pakai onAccent yg sama dgn ikon header) */
      +'#scrollTopBtn{background:'+hex+' !important}'
      +'#scrollTopBtn:hover{background:'+hover+' !important}'
      +'#scrollTopBtn svg{stroke:'+onAccent+' !important}'
      /* Widget salam "Selamat Pagi/Siang/Sore/Malam": dulu warna biru statis & background
         abu-abu, sekarang ikut aksen situs; background sedikit lebih terang dari body (bukan putih polos) */
      +'html:not(.dark) .sw{background:'+tintLight+' !important}'
      +'html:not(.dark) .sw-greet{color:'+textLight+' !important}'
      +'html.dark .sw-greet{color:'+textDark+' !important}'
      +'html:not(.dark) .sw-name{color:'+textLight+' !important}'
      +'html.dark .sw-name{color:'+textDark+' !important}'
      +'html:not(.dark) .sw-count span{color:'+textLight+' !important}'
      +'html.dark .sw-count span{color:'+textDark+' !important}'
      +'.sw-top img{border-color:'+hex+' !important}'
      +'html:not(.dark) .sw-more{background:'+s30+' !important;border-color:'+s50+' !important;color:'+textLight+' !important}'
      +'html.dark .sw-more{background:'+s30+' !important;border-color:'+s50+' !important;color:'+textDark+' !important}';
    var tag=document.getElementById('site-accent-override');
    if(!tag){tag=document.createElement('style');tag.id='site-accent-override';document.head.appendChild(tag);}
    tag.textContent=css;
  };

  /* Terapkan cache instan (hindari flash warna default) */
  var cached=null;
  try{cached=localStorage.getItem(LS_KEY);}catch(e){}
  if(cached)window.siteApplyAccent(cached);

  /* Sinkron dari Firestore: 1x per perubahan status login, bukan tiap render */
  function syncFromFirestore(){
    var fb=window.siteGetFirebase();
    fb.auth.onAuthStateChanged(function(user){
      if(!user){
        try{localStorage.removeItem(LS_KEY);}catch(e){}
        window.siteApplyAccent(DEFAULT_ACCENT);
        return;
      }
      fb.db.collection('users').doc(user.uid).get({source:'server'}).then(function(d){
        var color=(d.exists&&d.data().themeColor)||DEFAULT_ACCENT;
        try{localStorage.setItem(LS_KEY,color);}catch(e){}
        window.siteApplyAccent(color);
      }).catch(function(){});
    });
  }
  (function waitFB(n){
    n=n||0;
    if(window.siteGetFirebase)syncFromFirestore();
    else if(n<40)setTimeout(function(){waitFB(n+1);},150);
  })();
})();
