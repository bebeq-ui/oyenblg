/* langitoren: music-widget.js (diekstrak dari tema, baris 15254) */
//
(function(){

var PLAYLISTS=[
  {
    id:'banwoldang',
    title:'\uBC18\uC6D4\uB2F9',
    emoji:'\uD83C\uDFEE',
    tracks:[
      {title:'\uB2E8\uBA85',                    src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803579/1.%EB%8B%A8%EB%AA%85_%EB%B0%98%EC%9B%94%EB%8B%B9%EC%9D%98_%EA%B8%B0%EB%AC%98%ED%95%9C_%EC%9D%B4%EC%95%BC%EA%B8%B0_vef6gu.mp3'},
      {title:'\uC0C1\uC0AC\uD654',               src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803579/2.%EC%83%81%EC%82%AC%ED%99%94-%EB%B0%98%EC%9B%94%EB%8B%B9%EC%9D%98_%EA%B8%B0%EB%AC%98%ED%95%9C_%EC%9D%B4%EC%95%BC%EA%B8%B0_bdjh1c.mp3'},
      {title:'\uD48D\uB839\uAC00',               src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803582/3.%ED%92%8D%EB%A0%B9%EA%B0%80-%EB%B0%98%EC%9B%94%EB%8B%B9%EC%9D%98_%EA%B8%B0%EB%AC%98%ED%95%9C_%EC%9D%B4%EC%95%BC%EA%B8%B0.com_eiubqa.mp3'},
      {title:'\uBBF8\uB828\uD55C \uACE0\uBC31\uC5F0\uC2B5', src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803575/4.%E1%84%87%E1%85%A1%E1%86%AB%E1%84%8B%E1%85%AF%E1%86%AF%E1%84%83%E1%85%A1%E1%86%BC%E1%84%8B%E1%85%B4_%E1%84%80%E1%85%B5%E1%84%86%E1%85%AD%E1%84%92%E1%85%A1%E1%86%AB_%E1%84%8B%E1%85%B5%E1%84%8B%E1%85%A3%E1%84%80%E1%85%B5_-_%E1%84%86%E1%85%B5%E1%84%85%E1%85%A7%E1%86%AB%E1%84%92%E1%85%A1%E1%86%AB_%E1%84%80%E1%85%A9%E1%84%87%E1%85%A2%E1%86%A8%E1%84%8B%E1%85%A7%E1%86%AB%E1%84%89%E1%85%B3%E1%86%B8_zeonqy.mp3'},
      {title:'\uB124\uAC00 \uC788\uC5B4\uC11C \uD589\uBCF5\uD574', src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803579/5.%EB%84%A4%EA%B0%80_%EC%9E%88%EC%96%B4%EC%84%9C_%ED%96%89%EB%B3%B5%ED%95%B4_Happy_to_Have_You_-_cv.%EA%B9%80%EB%AA%85%EC%A4%80_%EC%84%B1%EC%98%88%EC%9B%90_hxj62b.mp3'},
      {title:'\uAC00\uB137',                     src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803582/6.%EC%84%A4%EB%A0%88%EC%9E%84_-_%EA%B0%80%EB%84%B7_-_%EC%B5%9C%EC%A2%85%EB%B9%88_q4flcb.mp3'},
      {title:'\uBC9A\uAF43\uC758\uBE44',          src:'https://res.cloudinary.com/dlorej4sr/video/upload/v1773803584/7.%EB%B2%9A%EA%BD%83%EC%9D%98%EB%B9%84_-_%EC%84%A4%EB%A0%88%EC%9E%84_%EC%9A%94%EC%9D%B4_%ED%83%80%EB%9D%BC%EB%A7%9B%EC%8A%A4_-_%EA%B9%80%EC%84%B8%EC%A7%84_cgk9z7.mp3'}
    ]
  }
];

var KEY='mhub_blogger_v2';
var S={plId:null,idx:0,playing:false,progress:0,volume:75,shuffle:false,repeat:false,hinted:false};
function lS(){try{var r=localStorage.getItem(KEY);if(r)S=Object.assign(S,JSON.parse(r));}catch(e){}}
function sS(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
lS();

var CUR=null,metaReady=false,_pendingPlay=false;
function gPl(id){return PLAYLISTS.find(function(p){return p.id===id;})||null;}

var AUD=new Audio();
AUD.volume=S.volume/100;
var dT=null,dF=S.progress;

AUD.addEventListener('loadedmetadata',function(){
  metaReady=true;
  if(S.progress>0&&AUD.duration&&isFinite(AUD.duration))
    AUD.currentTime=(S.progress/100)*AUD.duration;
  rProg();
});
AUD.addEventListener('canplay',function(){
  if(S.playing&&_pendingPlay){_pendingPlay=false;AUD.play().catch(function(){sDem();});}
});
AUD.addEventListener('timeupdate',function(){
  if(!AUD.duration||!isFinite(AUD.duration))return;
  S.progress=(AUD.currentTime/AUD.duration)*100;
  dF=S.progress;rProg();sS();
});
AUD.addEventListener('ended',function(){adv(1);});
AUD.addEventListener('error',function(){
  document.getElementById('mwErr').classList.add('on');sDem();
});

function fmt(s){
  if(!isFinite(s)||isNaN(s)||s<0)return'0:00';
  s=Math.floor(s);
  return Math.floor(s/60)+':'+(''+(s%60)).padStart(2,'0');
}
function lTrk(i,ap){
  if(!CUR||!CUR.tracks[i])return;
  document.getElementById('mwErr').classList.remove('on');
  stpD();AUD.pause();metaReady=false;
  AUD.src=CUR.tracks[i].src||'';AUD.load();
  dF=S.progress;_pendingPlay=ap;
  rNow();rProg();
}
function sDem(){
  stpD();
  dT=setInterval(function(){
    if(!CUR)return;
    dF+=0.4;
    if(dF>=100){dF=0;adv(1);return;}
    S.progress=dF;rProg();sS();
  },1000);
}
function stpD(){clearInterval(dT);dT=null;}
function play(){
  S.playing=true;
  AUD.play().catch(function(){sDem();});
  document.getElementById('mw-icon').classList.add('playing');
  document.getElementById('mwNowIco').classList.add('spin');
  rPBtn();sS();
}
function pause(){
  S.playing=false;AUD.pause();stpD();_pendingPlay=false;
  document.getElementById('mw-icon').classList.remove('playing');
  document.getElementById('mwNowIco').classList.remove('spin');
  rPBtn();sS();
}
function adv(d){
  S.progress=0;dF=0;
  var n=CUR.tracks.length;
  if(S.repeat){}
  else if(S.shuffle){var r;do{r=Math.floor(Math.random()*n);}while(r===S.idx&&n>1);S.idx=r;}
  else{S.idx=(S.idx+d+n)%n;}
  lTrk(S.idx,S.playing);rTracks();rProg();sS();
}
function oPl(pl){
  var sw=(S.plId!==pl.id);
  CUR=pl;
  if(sw){S.plId=pl.id;S.idx=0;S.progress=0;S.playing=false;dF=0;}
  lTrk(S.idx,false);rProg();rTracks();rPls();
  showPane('Tk');
  if(S.playing)play();sS();
}
function rNow(){
  if(!CUR)return;
  var t=CUR.tracks[S.idx];
  document.getElementById('mwNowIco').textContent=CUR.emoji||'\uD83C\uDFB5';
  document.getElementById('mwNowPl').textContent=CUR.title||'';
  document.getElementById('mwNowTitle').textContent=t.title||'\u2014';
}
function rProg(){
  var p=Math.max(0,Math.min(100,S.progress));
  document.getElementById('mwProg').value=Math.round(p);
  var dur=(AUD&&isFinite(AUD.duration)&&AUD.duration>0)?AUD.duration:0;
  document.getElementById('mwDur').textContent=dur?fmt(dur):'0:00';
  document.getElementById('mwCur').textContent=dur?fmt((p/100)*dur):'0:00';
}
function rPBtn(){
  document.getElementById('mwPlayIco').innerHTML=S.playing
    ?'<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
    :'<path d="M8 5v14l11-7z"/>';
}
function rPls(){
  var el=document.getElementById('mwPanePl');
  el.innerHTML='';
  PLAYLISTS.forEach(function(pl){
    var on=(S.plId===pl.id);
    var d=document.createElement('div');
    d.className='mw-pl'+(on?' on':'');
    d.innerHTML=
      '<div class="mw-pl-ico">'+ex(pl.emoji||'\uD83C\uDFB5')+'</div>'+
      '<div class="mw-pl-info">'+
        '<div class="mw-pl-name">'+ex(pl.title)+'</div>'+
        '<div class="mw-pl-cnt">'+pl.tracks.length+' lagu</div>'+
      '</div>'+
      '<div class="mw-pl-right">'+
        (on&&S.playing
          ?'<div class="mw-dot"></div>'
          :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
        )+
      '</div>';
    d.addEventListener('click',function(){oPl(pl);});
    el.appendChild(d);
  });
}
function rTracks(){
  var el=document.getElementById('mwPaneTk');
  el.innerHTML='';
  if(!CUR){el.innerHTML='<div class="mw-empty">Pilih playlist dulu</div>';return;}
  CUR.tracks.forEach(function(t,i){
    var d=document.createElement('div');
    d.className='mw-tk'+(i===S.idx?' on':'');
    d.innerHTML=
      '<span class="mw-tk-num">'+(i+1)+'</span>'+
      '<span class="mw-tk-title">'+ex(t.title||'\u2014')+'</span>';
    d.addEventListener('click',function(){
      S.idx=i;S.progress=0;dF=0;
      lTrk(i,true);S.playing=true;play();rTracks();rProg();
    });
    el.appendChild(d);
  });
  var a=el.querySelector('.on');
  if(a)a.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function showPane(name){
  document.querySelectorAll('.mw-tab').forEach(function(t){t.classList.toggle('on',t.dataset.pane===name);});
  document.querySelectorAll('.mw-pane').forEach(function(p){p.classList.toggle('on',p.id==='mwPane'+name);});
}
function openModal(){document.getElementById('mw-overlay').classList.add('open');rPls();}
function closeModal(){document.getElementById('mw-overlay').classList.remove('open');}

document.getElementById('mw-btn').addEventListener('click',openModal);
document.getElementById('mwClose').addEventListener('click',closeModal);
document.getElementById('mw-overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
document.getElementById('mwPlay').addEventListener('click',function(){if(S.playing)pause();else if(CUR)play();});
document.getElementById('mwPrev').addEventListener('click',function(){if(CUR)adv(-1);});
document.getElementById('mwNext').addEventListener('click',function(){if(CUR)adv(1);});
document.getElementById('mwShuffle').addEventListener('click',function(){S.shuffle=!S.shuffle;this.classList.toggle('on',S.shuffle);sS();});
document.getElementById('mwRepeat').addEventListener('click',function(){S.repeat=!S.repeat;this.classList.toggle('on',S.repeat);sS();});
document.getElementById('mwProg').addEventListener('input',function(){
  S.progress=parseInt(this.value);dF=S.progress;
  if(AUD.duration&&isFinite(AUD.duration))AUD.currentTime=(S.progress/100)*AUD.duration;
  rProg();
});
document.querySelectorAll('.mw-tab').forEach(function(t){
  t.addEventListener('click',function(){showPane(this.dataset.pane);});
});

/* ===== PEEK TAB ===== */
document.getElementById('mw-peek').addEventListener('click',function(){
  document.getElementById('mw-btn').classList.remove('mw-hidden');
  this.classList.remove('mw-visible');
});

/* ===== AUTO HIDE/SHOW SAAT SCROLL ===== */
(function(){
  var btn=document.getElementById('mw-btn');
  var peek=document.getElementById('mw-peek');
  var lastY=window.pageYOffset||document.documentElement.scrollTop;
  var ticking=false;
  window.addEventListener('scroll',function(){
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){
      var curY=window.pageYOffset||document.documentElement.scrollTop;
      var diff=curY-lastY;
      if(diff>40){
        btn.classList.add('mw-hidden');
        peek.classList.add('mw-visible');
        lastY=curY;
      }
      if(diff<-10||curY<80){
        btn.classList.remove('mw-hidden');
        peek.classList.remove('mw-visible');
        lastY=curY;
      }
      ticking=false;
    });
  },{passive:true});
})();

function ex(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

document.getElementById('mwShuffle').classList.toggle('on',S.shuffle);
document.getElementById('mwRepeat').classList.toggle('on',S.repeat);

if(!S.hinted){S.hinted=true;sS();}

if(S.plId){
  var pl=gPl(S.plId);
  if(pl){
    CUR=pl;dF=S.progress;AUD.volume=S.volume/100;_pendingPlay=S.playing;
    AUD.src=CUR.tracks[S.idx].src||'';AUD.load();
    rNow();rPBtn();rProg();
    if(S.playing){
      document.getElementById('mw-icon').classList.add('playing');
      document.getElementById('mwNowIco').classList.add('spin');
    }
  }
}

})();
//
