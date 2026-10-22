/* langitoren: navbar-modal.js (diekstrak dari tema, baris 10962) */
/**/ 
//sticky navbar
var new_scroll_position = 0;
var last_scroll_position;
var header = document.getElementById("navi");

window.addEventListener('scroll', function(e) {
  last_scroll_position = window.scrollY;

  // Scrolling down
  if (new_scroll_position < last_scroll_position && last_scroll_position > 80) {
    // header.removeClass('slideDown').addClass('slideUp');
    header.classList.remove("slideDown");
    header.classList.add("slideUp");

  // Scrolling up
  } else if (new_scroll_position > last_scroll_position) {
    // header.removeClass('slideUp').addClass('slideDown');
    header.classList.remove("slideUp");
    header.classList.add("slideDown");
  }

  new_scroll_position = last_scroll_position;
});

// Modal Novel Reader Controls v3
(function(){
var _raf=null,_scrolling=false;
var NR_FONTS={theme:'inherit',times:'"Times New Roman",Times,serif',garamond:'"EB Garamond","Times New Roman",serif','noto-serif':'"Noto Serif","Times New Roman",serif',roboto:'"Roboto",sans-serif',fredoka:'"Fredoka",sans-serif',dosis:'"Dosis",sans-serif',acme:'"Acme",sans-serif',patrick:'"Patrick Hand",cursive'};
var NR_THEMES={dark:{bg:'#0b1120',card:'#0f172a',text:'#e5e7eb',muted:'#a1a1aa',border:'#334155',link:'#60a5fa'},light:{bg:'#f8fafc',card:'#ffffff',text:'#0f172a',muted:'#475569',border:'#e2e8f0',link:'#2563eb'},sepia:{bg:'#f5e6cc',card:'#fff6e3',text:'#2b2115',muted:'#5b4b3a',border:'#e5d3b2',link:'#1d4ed8'},midnight:{bg:'#020617',card:'#0b1220',text:'#e2e8f0',muted:'#94a3b8',border:'#1f2a44',link:'#38bdf8'},babyblue:{bg:'#eaf4ff',card:'#f2f8ff',text:'#0f172a',muted:'#64748b',border:'#c7ddf5',link:'#2563eb'},babypink:{bg:'#fff1f5',card:'#fff5f8',text:'#2b1220',muted:'#8b5d6c',border:'#f3c6d3',link:'#db2777'},softcream:{bg:'#fff8ed',card:'#fdf4e6',text:'#2a2418',muted:'#7a6a52',border:'#efe1c6',link:'#b45309'}};
function nr(){return document.querySelector('.novel-reader');}
function getPref(){try{return JSON.parse(localStorage.getItem('novel_reader_pref_global')||'null');}catch(e){return null;}}
function savePref(p){try{localStorage.setItem('novel_reader_pref_global',JSON.stringify(p));}catch(e){}}
function applyPref(p){
  var r=nr();if(!r)return;
  var t=NR_THEMES[p.theme||'dark']||NR_THEMES.dark;
  r.style.setProperty('--nr-bg',t.bg);r.style.setProperty('--nr-card',t.card);r.style.setProperty('--nr-text',t.text);r.style.setProperty('--nr-muted',t.muted);r.style.setProperty('--nr-border',t.border);r.style.setProperty('--nr-link',t.link);
  r.style.setProperty('--nr-font',NR_FONTS[p.font||'theme']||'inherit');
  r.style.setProperty('--nr-size',(p.size||18)+'px');
  r.style.maxWidth=(p.width||900)+'px';
  var c=r.querySelector('.nr-content');
  if(c){c.style.lineHeight=p.line||1.6;c.querySelectorAll('p').forEach(function(el){el.style.marginBottom=(p.para||1.5)+'em';});}
}
function syncUI(){
  var p=getPref();if(!p)p={};
  var set=function(id,v){var el=document.getElementById(id);if(el)el.value=v;};
  var lbl=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  set('modal-nr-size-slider',p.size||18);lbl('modal-nr-size-label',(p.size||18)+'px');
  set('modal-nr-line-slider',p.line||1.6);lbl('modal-nr-line-label',parseFloat(p.line||1.6).toFixed(1));
  set('modal-nr-para-slider',p.para||1.5);lbl('modal-nr-para-label',parseFloat(p.para||1.5).toFixed(1)+'EM');
  set('modal-nr-width-slider',p.width||900);lbl('modal-nr-width-label',(p.width||900)+'PX');
  set('modal-nr-speed-slider',p.scrollSpeed||3);
  document.querySelectorAll('[data-modal-nr="font"]').forEach(function(b){b.classList.toggle('active',b.dataset.val===(p.font||'theme'));});
  document.querySelectorAll('[data-modal-nr="theme"]').forEach(function(b){b.classList.toggle('active',b.dataset.val===(p.theme||'dark'));});
}
function wireSlider(sliderId,labelId,fmt,key){
  var sl=document.getElementById(sliderId),lb=document.getElementById(labelId);
  if(!sl)return;
  sl.addEventListener('input',function(){var v=parseFloat(sl.value);if(lb)lb.textContent=fmt(v);var p=getPref()||{};p[key]=v;savePref(p);applyPref(p);});
}
function startScroll(spd){
  if(_scrolling)return;_scrolling=true;var px=spd*0.4;
  (function tick(){if(!_scrolling)return;window.scrollBy(0,px);if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2){stopScroll();return;}_raf=requestAnimationFrame(tick);})();
  var btn=document.getElementById('modal-nr-autoscroll-btn'),ic=document.getElementById('modal-nr-autoscroll-icon'),lb=document.getElementById('modal-nr-autoscroll-label');
  if(btn)btn.style.background='#ef4444';
  if(ic)ic.innerHTML='<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>';
  if(lb)lb.textContent='Hentikan Scroll';
}
function stopScroll(){
  _scrolling=false;cancelAnimationFrame(_raf);
  var btn=document.getElementById('modal-nr-autoscroll-btn'),ic=document.getElementById('modal-nr-autoscroll-icon'),lb=document.getElementById('modal-nr-autoscroll-label');
  if(btn)btn.style.background='var(--accent,#58a1c8)';
  if(ic)ic.innerHTML='<path d="M8 5v14l11-7z"/>';
  if(lb)lb.textContent='Mulai Scroll Otomatis';
}
function isNovelPost(){
  var tags=document.querySelectorAll('a[rel="tag"]');
  // Jika ada label Comic, bukan novel
  for(var i=0;i<tags.length;i++){if(tags[i].textContent.trim().toLowerCase()==='comic')return false;}
  for(var i=0;i<tags.length;i++){if(tags[i].textContent.trim().toLowerCase()==='novelread')return true;}
  return !!document.querySelector('.novel-reader,#reader.novel-mode');
}
function init(){
  wireSlider('modal-nr-size-slider','modal-nr-size-label',function(v){return v+'px';},'size');
  wireSlider('modal-nr-line-slider','modal-nr-line-label',function(v){return v.toFixed(1);},'line');
  wireSlider('modal-nr-para-slider','modal-nr-para-label',function(v){return v.toFixed(1)+'EM';},'para');
  wireSlider('modal-nr-width-slider','modal-nr-width-label',function(v){return v+'PX';},'width');
  document.querySelectorAll('[data-modal-nr="font"],[data-modal-nr="theme"]').forEach(function(b){
    b.addEventListener('click',function(){
      var g=b.dataset.modalNr,v=b.dataset.val,p=getPref()||{};p[g]=v;savePref(p);applyPref(p);
      document.querySelectorAll('[data-modal-nr="'+g+'"]').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
    });
  });
  var autoBtn=document.getElementById('modal-nr-autoscroll-btn'),spdSl=document.getElementById('modal-nr-speed-slider');
  if(autoBtn)autoBtn.addEventListener('click',function(){if(_scrolling)stopScroll();else startScroll(spdSl?parseFloat(spdSl.value):3);});
  if(spdSl)spdSl.addEventListener('input',function(){if(_scrolling){stopScroll();startScroll(parseFloat(spdSl.value));}var p=getPref()||{};p.scrollSpeed=parseFloat(spdSl.value);savePref(p);});
  var modal=document.getElementById('pDrXiK9YdI');
  syncUI();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else{init();setTimeout(init,800);}
})()
// scrollbar progress
const scrollProgress = () => {
  return {
    init() {
      window.addEventListener('scroll', () => {
        let winScroll = document.body.scrollTop || document.documentElement.scrollTop
        let height = document.documentElement.scrollHeight - document.documentElement.clientHeight
        this.percent = Math.round((winScroll / height) * 100)
      })
    },
    circumference: 30 * 2 * Math.PI,
    percent: 0,
  }
}

// Font resizer
$(document).ready(function () {
    var curFontSize= localStorage["FontSize"];
    if (curFontSize){
        //set to previously saved fontsize if available
         $('.data').css('font-size', curFontSize);
    }
    
    $(".increaseFont,.decreaseFont").click(function () {
        var type = $(this).val();
        curFontSize = $('.data').css('font-size'); 
       // if () {
        if (type == 'increase') {
            $('.data').css('font-size', parseInt(curFontSize) + 2 + "px");
        } else {
            $('.data').css('font-size', parseInt(curFontSize) - 2 + "px");
        }
        localStorage.setItem('FontSize', curFontSize);
    });
    
    var resetFont = $('.data').css('font-size'); 
    $(".reset").click(function () {
       	$('.data').css('font-size', resetFont);
    });
    
});
/*
document.addEventListener("DOMContentLoaded", function() {
    var passwordInput = document.getElementById("passwordInput");
    var submitButton = document.querySelector(".auth");
    var cCard = document.querySelector(".c-card");

    submitButton.addEventListener("click", function(event) {
      event.preventDefault();

      var enteredPassword = passwordInput.value;
      var storedPassword = localStorage.getItem("password");

      if (enteredPassword === storedPassword) {
        localStorage.setItem("authenticated", "true");
        cCard.classList.remove("c-card");
        cCard.classList.remove("wrong-password");
      } else {
        cCard.classList.add("wrong-password");
      }
    });

    var isAuthenticated = localStorage.getItem("authenticated");
    if (isAuthenticated === "true") {
      cCard.classList.remove("c-card");
    }
  });
localStorage.setItem("password", "1234");
*/
/**/
