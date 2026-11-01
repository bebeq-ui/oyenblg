/* langitoren: video-player.js (anime player: Drive proxy + multi-subtitle CC)
   Dimuat di halaman post. Aktif hanya jika ada <div id="video-reader">; key dibaca dari #video-src (isi post) atau data-vkey.
   Debug: tambahkan ?vpdebug=1 di URL halaman episode.
   Update: edit file ini di GitHub lalu purge https://purge.jsdelivr.net/gh/bebeq-ui/oyenblg@main/js/video-player.js */
(function(){
  var root=document.getElementById('video-reader');
  if(!root) return;
  if(!document.getElementById('vp-style')){var st=document.createElement('style');st.id='vp-style';st.textContent=String.raw`/* ===== Anime video player ===== */
.vp{position:relative;width:100%;max-width:1100px;margin:12px auto;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;user-select:none;-webkit-user-select:none;font-family:inherit;color:#fff}
.vp:fullscreen{max-width:none;border-radius:0;margin:0;aspect-ratio:auto;width:100vw;height:100vh}
.vp video{width:100%;height:100%;display:block;background:#000;object-fit:contain}
.vp video::cue{background:rgba(0,0,0,.65);color:#fff;font-size:1.05em;line-height:1.3}
.vp-msg{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;background:rgba(0,0,0,.72);font-size:14px;z-index:6}
.vp-msg.show{display:flex}
.vp-spin{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:4px solid rgba(255,255,255,.25);border-top-color:var(--accent,#58a1c8);border-radius:50%;animation:vpspin .8s linear infinite;display:none;z-index:4;pointer-events:none}
.vp.loading .vp-spin{display:block}
@keyframes vpspin{to{transform:rotate(360deg)}}
.vp-big{position:absolute;left:50%;top:50%;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;background:var(--accent,#58a1c8);border:0;color:#fff;font-size:28px;cursor:pointer;z-index:5;display:flex;align-items:center;justify-content:center;opacity:.95}
.vp.playing .vp-big,.vp.loading .vp-big{display:none}
.vp-ctl{position:absolute;left:0;right:0;bottom:0;padding:26px 10px 8px;background:linear-gradient(transparent,rgba(0,0,0,.85));z-index:5;transition:opacity .25s}
.vp.hide-ui .vp-ctl{opacity:0;pointer-events:none}
.vp.hide-ui{cursor:none}
.vp-bar{position:relative;height:16px;cursor:pointer;touch-action:none}
.vp-bar i{position:absolute;left:0;right:0;top:6px;height:4px;border-radius:2px;background:rgba(255,255,255,.28)}
.vp-bar .vp-buf{right:auto;background:rgba(255,255,255,.4)}
.vp-bar .vp-played{right:auto;background:var(--accent,#58a1c8)}
.vp-bar b{position:absolute;top:2px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;transform:scale(0);transition:transform .15s}
.vp-bar:hover b,.vp.seeking .vp-bar b{transform:scale(1)}
.vp-tip{position:absolute;bottom:20px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.85);font-size:12px;transform:translateX(-50%);display:none;pointer-events:none}
.vp-bar:hover .vp-tip{display:block}
.vp-row{display:flex;align-items:center;gap:2px;flex-wrap:nowrap}
.vp-row button{background:none;border:0;color:#fff;cursor:pointer;min-width:34px;height:34px;padding:0 6px;border-radius:6px;font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
.vp-row button:hover{background:rgba(255,255,255,.18)}
.vp-row button.on{color:var(--accent,#58a1c8)}
.vp-time{font-size:12px;opacity:.9;padding:0 8px;white-space:nowrap}
.vp-sp{flex:1}
.vp-vol{width:70px;accent-color:var(--accent,#58a1c8)}
.vp-menu{position:absolute;right:10px;bottom:62px;min-width:150px;max-height:60%;overflow:auto;background:rgba(18,18,18,.96);border-radius:8px;padding:6px;display:none;z-index:7;font-size:13px}
.vp-menu.show{display:block}
.vp-menu h6{margin:2px 8px 6px;font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.05em}
.vp-menu button{display:flex;width:100%;text-align:left;background:none;border:0;color:#fff;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;gap:8px}
.vp-menu button:hover{background:rgba(255,255,255,.12)}
.vp-menu button.sel{color:var(--accent,#58a1c8);font-weight:600}
.vp-menu button.sel:before{content:"\2713";}
.vp-menu button:not(.sel):before{content:"";display:inline-block;width:.9em}
.vp-skip{position:absolute;right:12px;bottom:78px;z-index:5;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;display:none}
.vp.playing:not(.hide-ui) .vp-skip{display:block}
@media(max-width:600px){.vp-vol{display:none}.vp-time{padding:0 4px;font-size:11px}.vp-row button{min-width:30px;padding:0 4px}.vp{border-radius:0}}

.vp-fb{position:absolute;top:50%;width:90px;height:90px;margin-top:-45px;border-radius:50%;background:rgba(255,255,255,.22);display:none;align-items:center;justify-content:center;font-size:14px;font-weight:600;text-align:center;line-height:1.2;z-index:6;pointer-events:none}
.vp-fb.l{left:12%}.vp-fb.r{right:12%}
.vp-fb.show{display:flex;animation:vpfb .6s ease forwards}
@keyframes vpfb{0%{opacity:0;transform:scale(.8)}20%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.05)}}
.vp-2x{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);padding:4px 12px;border-radius:99px;font-size:12px;z-index:6;display:none;pointer-events:none}
.vp.hold2x .vp-2x{display:block}

.vp-note{position:absolute;left:8px;right:8px;bottom:64px;z-index:7;display:none;background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:6px 10px;font-size:12px;line-height:1.35}
.vp-hud{position:absolute;left:4px;top:4px;z-index:8;display:none;background:rgba(0,0,0,.7);color:#7dff9c;font:11px/1.3 monospace;padding:3px 6px;border-radius:4px;pointer-events:none;max-width:95%;word-break:break-all}
`;document.head.appendChild(st);}
  var API='https://oyenwibhuk.langitoren00.workers.dev';
  var KEY_RE=/anime\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*\.mp4/i;
  function findKey(){
    var srcs=[];
    var b=document.getElementById('video-src');
    if(b) srcs.push(b.textContent||'');
    srcs.push(root.getAttribute('data-vkey')||'');
    for(var i=0;i<srcs.length;i++){
      var t=srcs[i].replace(/[ ​]/g,' ').replace(/&nbsp;/g,' ');
      var m=t.match(KEY_RE);
      if(m) return m[0];
    }
    return (srcs[0]||srcs[1]||'').replace(/\s+/g,' ').trim().slice(0,60);
  }
  var key=findKey();
  var LS={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};

  root.innerHTML='<div class="vp-note"></div><div class="vp-hud"></div><div class="vp-fb l"></div><div class="vp-fb r"></div><div class="vp-2x">2x &#9654;&#9654;</div><div class="vp-msg"></div><div class="vp-spin"></div><button class="vp-big" type="button" aria-label="Play">&#9654;</button>'+
  '<button class="vp-skip" type="button">Skip +85s &#9654;&#9654;</button>'+
  '<div class="vp-menu" data-m="cc"></div><div class="vp-menu" data-m="spd"></div>'+
  '<div class="vp-ctl"><div class="vp-bar"><i></i><i class="vp-buf"></i><i class="vp-played"></i><b></b><span class="vp-tip">0:00</span></div>'+
  '<div class="vp-row"><button class="vp-pp" type="button" aria-label="Play/Pause">&#9654;</button>'+
  '<button class="vp-back" type="button" title="-10s">&#8634;10</button><button class="vp-fwd" type="button" title="+10s">10&#8635;</button>'+
  '<button class="vp-mute" type="button" aria-label="Mute">&#128266;</button><input class="vp-vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">'+
  '<span class="vp-time">0:00 / 0:00</span><span class="vp-sp"></span>'+
  '<button class="vp-next" type="button" style="display:none" title="Episode berikutnya">&#9197;</button>'+
  '<button class="vp-cc" type="button" title="Subtitle (C)">CC</button><button class="vp-spd" type="button" title="Kecepatan">1x</button>'+
  '<button class="vp-pip" type="button" title="Picture in Picture">&#10064;</button><button class="vp-fs" type="button" title="Fullscreen (F)">&#9974;</button></div></div>';

  function $(s){return root.querySelector(s)}
  var note=$('.vp-note'),hud=$('.vp-hud');
  var msg=$('.vp-msg'),big=$('.vp-big'),bar=$('.vp-bar'),buf=$('.vp-buf'),played=$('.vp-played'),knob=$('.vp-bar b'),tip=$('.vp-tip'),
      pp=$('.vp-pp'),mute=$('.vp-mute'),vol=$('.vp-vol'),timeEl=$('.vp-time'),nextBtn=$('.vp-next'),ccBtn=$('.vp-cc'),spdBtn=$('.vp-spd'),
      ccMenu=$('[data-m=cc]'),spdMenu=$('[data-m=spd]'),skipBtn=$('.vp-skip');
  var v=document.createElement('video');
  v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.preload='metadata';v.crossOrigin='anonymous';
  v.disablePictureInPicture=false;
  v.setAttribute('controlsList','nodownload');
  v.addEventListener('contextmenu',function(e){e.preventDefault()});
  root.insertBefore(v,root.firstChild);

  function fmt(t){if(!isFinite(t)||t<0)t=0;var h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60);
    return (h?h+':'+(m<10?'0':'')+m:m)+':'+(s<10?'0':'')+s;}
  function showMsg(t){msg.textContent=t;msg.classList.add('show');root.classList.remove('loading')}
  function hideMsg(){msg.classList.remove('show')}

  if(!/^anime\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*\.mp4$/i.test(key)){showMsg('Video belum tersedia (key tidak valid'+(key?': '+key:' - isi postingan kosong')+').');return;}

  var wd=null,stallT=null;
  function setNote(t){note.textContent=t||'';note.style.display=t?'block':'none'}
  function probe(toMsg){
    if(!tok.url) return;
    var ctl=window.AbortController?new AbortController():null;
    fetch(tok.url,{headers:{Range:'bytes=0-1'},cache:'no-store',signal:ctl?ctl.signal:undefined}).then(function(r){
      var ct=r.headers.get('content-type')||'',st=r.status;
      if(ctl&&(st===206||st===200)) ctl.abort();
      var out;
      if(st===206||st===200) out='Server video merespons ('+st+', '+ct+') tapi data tidak mengalir. Coba koneksi lain atau cek ukuran/format file.';
      else out='Server video menolak: HTTP '+st;
      if(st!==206&&st!==200&&/json/.test(ct)){ return r.json().then(function(j){out+=' ('+(j&&j.reason||'?')+')';done(out)},function(){done(out)}); }
      done(out);
    }).catch(function(e){ if(e&&e.name==='AbortError')return; done('Tidak bisa menghubungi server video: '+(e&&e.message||'error')); });
    function done(t){ if(toMsg){msg.textContent=msg.textContent+' ['+t+']'} else setNote(t); }
  }
  var tok={exp:0,subs:[],url:''},fetching=null,retries=0,resumeAt=0,wasPlaying=false;
  function getToken(){
    if(fetching) return fetching;
    fetching=fetch(API+'/video/token?key='+encodeURIComponent(key),{cache:'no-store'})
      .then(function(r){return r.json().then(function(j){return {s:r.status,j:j}})})
      .then(function(o){
        fetching=null;
        if(!o.j||!o.j.ok){
          var e=new Error(o.j&&o.j.reason||'error');e.status=o.s;throw e;
        }
        tok=o.j;return tok;
      },function(e){fetching=null;throw e;});
    return fetching;
  }
  function fresh(){return tok.url&&Date.now()<tok.exp-120000}

  var subPref=LS.get('vp_sub');
  function buildTracks(){
    Array.prototype.slice.call(v.querySelectorAll('track')).forEach(function(t){t.remove()});
    var chosen=null;
    (tok.subs||[]).forEach(function(s){
      var t=document.createElement('track');
      t.kind='subtitles';t.label=s.label;t.srclang=s.lang;t.src=s.url;t.setAttribute('data-lang',s.lang);
      v.appendChild(t);
      if(subPref===s.lang) chosen=s.lang;
    });
    if(subPref===null&&tok.subs&&tok.subs.length) chosen=tok.subs[0].lang;
    setTimeout(function(){applySub(chosen)},0);
    ccBtn.style.display=(tok.subs&&tok.subs.length)?'':'none';
  }
  var curSub=null;
  function applySub(lang){
    curSub=lang||null;
    for(var i=0;i<v.textTracks.length;i++){
      var t=v.textTracks[i];
      t.mode=(lang&&t.language===lang)?'showing':'disabled';
    }
    ccBtn.classList.toggle('on',!!lang);
    renderCC();
  }
  function renderCC(){
    var h='<h6>Subtitle</h6><button type="button" data-l=""'+(curSub?'':' class="sel"')+'>Off</button>';
    (tok.subs||[]).forEach(function(s){
      h+='<button type="button" data-l="'+s.lang+'"'+(curSub===s.lang?' class="sel"':'')+'></button>';
    });
    ccMenu.innerHTML=h;
    var bs=ccMenu.querySelectorAll('button');
    for(var i=1;i<bs.length;i++) bs[i].textContent=tok.subs[i-1].label;
  }
  ccMenu.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    var l=b.getAttribute('data-l');subPref=l||'off';LS.set('vp_sub',l||'off');
    applySub(l);closeMenus();
  });
  var SPEEDS=[0.5,0.75,1,1.25,1.5,1.75,2];
  function renderSpd(){
    var h='<h6>Kecepatan</h6>';
    SPEEDS.forEach(function(s){h+='<button type="button" data-s="'+s+'"'+(v.playbackRate===s?' class="sel"':'')+'>'+(s===1?'Normal':s+'x')+'</button>'});
    spdMenu.innerHTML=h;spdBtn.textContent=(v.playbackRate)+'x';
  }
  spdMenu.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    v.playbackRate=parseFloat(b.getAttribute('data-s'));LS.set('vp_spd',String(v.playbackRate));renderSpd();closeMenus();
  });
  function closeMenus(){ccMenu.classList.remove('show');spdMenu.classList.remove('show')}
  ccBtn.addEventListener('click',function(e){e.stopPropagation();var o=ccMenu.classList.contains('show');closeMenus();if(!o)ccMenu.classList.add('show')});
  spdBtn.addEventListener('click',function(e){e.stopPropagation();var o=spdMenu.classList.contains('show');closeMenus();if(!o){renderSpd();spdMenu.classList.add('show')}});
  document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.vp-menu'))closeMenus()});

  function load(startAt,autoplay){
    root.classList.add('loading');hideMsg();
    return getToken().then(function(){
      resumeAt=startAt||0;wasPlaying=!!autoplay;
      v.src=tok.url;
      buildTracks();
      v.load();
      clearTimeout(wd);
      wd=setTimeout(function(){if(v.readyState===0&&!v.error)showMsg('Video lama merespons. Periksa koneksi, atau coba muat ulang halaman.')},25000);
    }).catch(function(e){
      if(e.status===404) showMsg('Video belum tersedia.');
      else if(e.status===403) showMsg('Akses ditolak. Buka lewat situs resmi.');
      else if(e.status===429) showMsg('Terlalu banyak permintaan. Coba lagi sebentar.');
      else showMsg('Gagal memuat video. Periksa koneksi lalu muat ulang halaman.');
    });
  }

  v.addEventListener('loadedmetadata',function(){
    var s=resumeAt;
    if(!s){var sv=parseFloat(LS.get('vp_pos_'+key));if(sv>5&&v.duration&&sv<v.duration-30)s=sv;}
    if(s&&isFinite(s)) try{v.currentTime=s}catch(e){}
    var sp=parseFloat(LS.get('vp_spd'));if(sp&&SPEEDS.indexOf(sp)!==-1)v.playbackRate=sp;
    var vo=parseFloat(LS.get('vp_vol'));if(isFinite(vo)){v.volume=Math.min(1,Math.max(0,vo));vol.value=v.volume}
    renderSpd();retries=0;
    if(!wasPlaying)root.classList.remove('loading');
    if(wasPlaying){v.play().catch(function(){});wasPlaying=false}
    updTime();
  });
  v.addEventListener('waiting',function(){if(!v.paused)root.classList.add('loading')});
  v.addEventListener('loadeddata',function(){if(v.paused)root.classList.remove('loading')});
  v.addEventListener('canplay',function(){root.classList.remove('loading')});
  v.addEventListener('playing',function(){clearTimeout(stallT);setNote('');root.classList.remove('loading');root.classList.add('playing');pp.innerHTML='&#10074;&#10074;';kick()});
  v.addEventListener('pause',function(){root.classList.remove('playing');pp.innerHTML='&#9654;';root.classList.remove('hide-ui');savePos()});
  v.addEventListener('ended',function(){
    LS.del('vp_pos_'+key);
    var n=nextUrl();
    if(n&&LS.get('vp_auto')!=='0'){location.href=n}
  });
  v.addEventListener('error',function(){
    // token kedaluwarsa / koneksi putus -> ambil token baru lalu lanjutkan dari posisi terakhir
    if(retries>=3){
      var c=v.error?v.error.code:0;
      showMsg('Video tidak bisa diputar (kode '+c+'). Mungkin kuota Drive habis atau format tidak didukung (gunakan MP4 H.264/AAC).');
      probe(true);return}
    retries++;
    var at=v.currentTime||resumeAt||0,was=!v.paused||wasPlaying;
    tok.exp=0;
    setTimeout(function(){load(at,was)},600*retries);
  });
  function ensureFresh(){
    if(fresh()) return;
    var at=v.currentTime,was=!v.paused;
    load(at,was);
  }
  v.addEventListener('play',ensureFresh);
  v.addEventListener('play',function(){
    clearTimeout(stallT);
    stallT=setTimeout(function(){ if(!v.paused&&v.readyState<3){setNote('Memuat video terasa lama… memeriksa server');probe(false)} },12000);
  });
  v.addEventListener('seeking',ensureFresh);

  function updTime(){
    var d=v.duration||0,c=v.currentTime||0,p=d?c/d*100:0;
    played.style.width=p+'%';knob.style.left=p+'%';
    timeEl.textContent=fmt(c)+' / '+fmt(d);
    try{var b=v.buffered;if(b.length){var e=0;for(var i=0;i<b.length;i++){if(b.start(i)<=c+0.5&&b.end(i)>=c)e=b.end(i)}buf.style.width=(d?e/d*100:0)+'%'}}catch(_){}
  }
  var lastSave=0;
  function savePos(){if(v.duration&&v.currentTime>5)LS.set('vp_pos_'+key,String(Math.floor(v.currentTime)))}
  v.addEventListener('timeupdate',function(){updTime();var n=Date.now();if(n-lastSave>5000){lastSave=n;savePos()}});
  v.addEventListener('progress',updTime);
  v.addEventListener('durationchange',updTime);
  window.addEventListener('pagehide',savePos);

  function toggle(){if(v.paused){v.play().catch(function(){})}else v.pause()}
  function seekBy(s){v.currentTime=Math.max(0,Math.min(v.duration||1e9,v.currentTime+s))}
  pp.addEventListener('click',toggle);big.addEventListener('click',toggle);
  $('.vp-back').addEventListener('click',function(){seekBy(-10)});
  $('.vp-fwd').addEventListener('click',function(){seekBy(10)});
  skipBtn.addEventListener('click',function(){seekBy(85)});
  mute.addEventListener('click',function(){v.muted=!v.muted});
  v.addEventListener('volumechange',function(){mute.innerHTML=(v.muted||v.volume===0)?'&#128263;':'&#128266;';vol.value=v.muted?0:v.volume;LS.set('vp_vol',String(v.volume))});
  vol.addEventListener('input',function(){v.muted=false;v.volume=parseFloat(vol.value)});
  var pipBtn=$('.vp-pip');
  var hasStdPip=!!document.pictureInPictureEnabled&&!v.disablePictureInPicture;
  var hasWebkitPip=typeof v.webkitSetPresentationMode==='function';
  if(!hasStdPip&&!hasWebkitPip) pipBtn.style.display='none';
  pipBtn.addEventListener('click',function(){
    try{
      if(hasStdPip){
        if(document.pictureInPictureElement) document.exitPictureInPicture().catch(function(){});
        else v.requestPictureInPicture().catch(function(){});
      }else if(hasWebkitPip){
        v.webkitSetPresentationMode(v.webkitPresentationMode==='picture-in-picture'?'inline':'picture-in-picture');
      }
    }catch(e){}
  });
  function fs(){
    var d=document;
    if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}
    else if(root.requestFullscreen){root.requestFullscreen().catch(function(){})}
    else if(root.webkitRequestFullscreen){root.webkitRequestFullscreen()}
    else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}
  }
  $('.vp-fs').addEventListener('click',fs);
  // ── Gestur: desktop klik = play/pause, dblclick = fullscreen.
  //    Layar sentuh: tap = tampil/sembunyi kontrol, ketuk 2x kiri/kanan = -/+10s,
  //    ketuk 2x tengah = play/pause, tahan = 2x sementara.
  var lastPtr='mouse',lastTap=0,lastTapX=0,tapTimer=null,holdTimer=null,held=false,prevRate=1,downX=0,downY=0,moved=false;
  var fbL=$('.vp-fb.l'),fbR=$('.vp-fb.r');
  function flash(el,txt){el.textContent=txt;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
  function endHold(){clearTimeout(holdTimer);if(held){v.playbackRate=prevRate;root.classList.remove('hold2x');renderSpd();}}
  v.addEventListener('pointerdown',function(e){
    lastPtr=e.pointerType||'mouse';
    if(lastPtr!=='touch')return;
    held=false;moved=false;downX=e.clientX;downY=e.clientY;
    clearTimeout(holdTimer);
    holdTimer=setTimeout(function(){
      if(v.paused||moved)return;
      held=true;prevRate=v.playbackRate;v.playbackRate=2;root.classList.add('hold2x');
    },450);
  });
  v.addEventListener('pointermove',function(e){
    if(lastPtr==='touch'&&(Math.abs(e.clientX-downX)>12||Math.abs(e.clientY-downY)>12)){moved=true;clearTimeout(holdTimer)}
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function(n){v.addEventListener(n,function(){endHold()})});
  v.addEventListener('contextmenu',function(e){e.preventDefault()});
  v.addEventListener('dblclick',function(){if(lastPtr!=='touch')fs()});
  v.addEventListener('click',function(e){
    closeMenus();
    if(lastPtr!=='touch'){toggle();return}
    if(held){held=false;return}
    var now=Date.now(),r=v.getBoundingClientRect(),rel=(e.clientX-r.left)/r.width;
    if(now-lastTap<320){
      clearTimeout(tapTimer);lastTap=0;
      if(rel<0.35){seekBy(-10);flash(fbL,'-10s')}
      else if(rel>0.65){seekBy(10);flash(fbR,'+10s')}
      else toggle();
      kick();
    }else{
      lastTap=now;
      tapTimer=setTimeout(function(){
        if(v.paused){toggle();return}
        root.classList.toggle('hide-ui');if(!root.classList.contains('hide-ui'))kick();
      },320);
    }
  });

  // Seekbar
  var dragging=false;
  function posFromEvent(e){var r=bar.getBoundingClientRect();return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))}
  bar.addEventListener('pointerdown',function(e){dragging=true;root.classList.add('seeking');try{bar.setPointerCapture(e.pointerId)}catch(_){}scrub(e)});
  bar.addEventListener('pointermove',function(e){
    var p=posFromEvent(e);tip.style.left=(p*100)+'%';tip.textContent=fmt(p*(v.duration||0));
    if(dragging)scrub(e);
  });
  bar.addEventListener('pointerup',function(){dragging=false;root.classList.remove('seeking')});
  bar.addEventListener('pointercancel',function(){dragging=false;root.classList.remove('seeking')});
  function scrub(e){if(!v.duration)return;var p=posFromEvent(e);v.currentTime=p*v.duration;played.style.width=(p*100)+'%';knob.style.left=(p*100)+'%'}

  // Auto-hide kontrol
  var hideT=null;
  function kick(){
    root.classList.remove('hide-ui');clearTimeout(hideT);
    hideT=setTimeout(function(){if(!v.paused&&!ccMenu.classList.contains('show')&&!spdMenu.classList.contains('show'))root.classList.add('hide-ui')},3000);
  }
  root.addEventListener('mousemove',kick);

  // Keyboard
  document.addEventListener('keydown',function(e){
    var t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)&&!t.classList.contains('vp-vol'))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    var k=e.key,used=true;
    if(k===' '||k==='k')toggle();
    else if(k==='ArrowLeft')seekBy(-5);else if(k==='ArrowRight')seekBy(5);
    else if(k==='j')seekBy(-10);else if(k==='l')seekBy(10);
    else if(k==='ArrowUp'){v.muted=false;v.volume=Math.min(1,v.volume+0.05)}
    else if(k==='ArrowDown')v.volume=Math.max(0,v.volume-0.05);
    else if(k==='f')fs();else if(k==='m')v.muted=!v.muted;
    else if(k==='c'){var l=curSub?null:((tok.subs&&tok.subs[0])?(subPref&&subPref!=='off'?subPref:tok.subs[0].lang):null);subPref=l||'off';LS.set('vp_sub',subPref);applySub(l)}
    else used=false;
    if(used){e.preventDefault();kick()}
  });

  // Episode berikutnya (diambil dari nav next-prev theme)
  function nextUrl(){
    var nav=document.querySelectorAll('#nextPrevJSbottom a, .nextprevJs_navigasi a');
    for(var i=0;i<nav.length;i++){
      var a=nav[i],h=a.getAttribute('href');if(!h||h==='#')continue;
      var rel=(a.getAttribute('rel')||'').toLowerCase(),txt=((a.textContent||'')+' '+(a.className||'')+' '+(a.getAttribute('aria-label')||'')).toLowerCase();
      if(rel==='next'||/(^|\s)(next|selanjutnya|berikut|newer)/.test(txt)||/›|»|▶/.test(a.textContent||'')) return a.href;
    }
    return null;
  }
  function checkNext(){var n=nextUrl();nextBtn.style.display=n?'':'none'}
  nextBtn.addEventListener('click',function(){var n=nextUrl();if(n)location.href=n});
  var navEl=document.getElementById('nextPrevJSbottom');
  if(navEl&&window.MutationObserver) new MutationObserver(checkNext).observe(navEl,{childList:true,subtree:true,attributes:true});
  setInterval(checkNext,3000);checkNext();

    // ── Media Session: kontrol di notifikasi / layar kunci / PiP
  (function(){
    if(!('mediaSession' in navigator)) return;
    var ms=navigator.mediaSession,lastPos=0;
    function meta(){
      var title=(document.querySelector('h1.post-title,h1')||{}).textContent||document.title;
      var og=document.querySelector('meta[property="og:image"]');
      try{ms.metadata=new MediaMetadata({title:(title||'').trim().slice(0,120),artist:document.title.split(' - ').pop().slice(0,60),artwork:og&&og.content?[{src:og.content,sizes:'512x512'}]:[]})}catch(e){}
    }
    function set(a,f){try{ms.setActionHandler(a,f)}catch(e){}}
    meta();
    set('play',function(){v.play()});
    set('pause',function(){v.pause()});
    set('seekbackward',function(d){seekBy(-((d&&d.seekOffset)||10))});
    set('seekforward',function(d){seekBy((d&&d.seekOffset)||10)});
    set('seekto',function(d){if(d&&isFinite(d.seekTime))v.currentTime=d.seekTime});
    set('nexttrack',function(){var n=nextUrl();if(n)location.href=n});
    set('enterpictureinpicture',function(){if(hasStdPip&&!document.pictureInPictureElement)v.requestPictureInPicture().catch(function(){})});
    v.addEventListener('playing',function(){meta();ms.playbackState='playing'});
    v.addEventListener('pause',function(){ms.playbackState='paused'});
    v.addEventListener('timeupdate',function(){
      var n=Date.now();if(n-lastPos<1000||!v.duration||!ms.setPositionState)return;lastPos=n;
      try{ms.setPositionState({duration:v.duration,playbackRate:v.playbackRate||1,position:Math.min(v.currentTime,v.duration)})}catch(e){}
    });
  })();

  if(/[?&]vpdebug=1/.test(location.search)){
    hud.style.display='block';var lastEv='';
    ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','playing','waiting','stalled','suspend','abort','error','seeking','seeked','ended'].forEach(function(n){v.addEventListener(n,function(){lastEv=n})});
    setInterval(function(){
      var b='';try{for(var i=0;i<v.buffered.length;i++)b+=v.buffered.start(i).toFixed(0)+'-'+v.buffered.end(i).toFixed(0)+' '}catch(e){}
      hud.textContent='rs='+v.readyState+' ns='+v.networkState+' t='+v.currentTime.toFixed(1)+'/'+(v.duration||0).toFixed(0)+' buf='+b+' err='+(v.error?v.error.code:'-')+' ev='+lastEv+' rt='+retries;
    },500);
  }

  load(0,false);
})();
