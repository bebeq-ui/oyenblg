/* langitoren: next-prev.js (diekstrak dari tema, baris 10921) */
/**/ const npXbottom={arr:new Array,
  config:{
    max:150,
    start:1,
    labelMain:"Series",
	sortby: "title", //mode sorting 'title','date','default'. 
  },sort:t=>{let e=npXbottom.config.sortby||"title";return"title"===e?t.sort((t,e)=>{let l=t=>{let e=t.match(/[\d.]+/);return e?parseFloat(e[0]):0},r=l(t.title),i=l(e.title);return r===i?t.title.localeCompare(e.title):r-i}):"date"===e?t.sort((t,e)=>new Date(e.date)-new Date(t.date)):t.sort((t,e)=>t.title.localeCompare(e.title,void 0,{numeric:!0}))},compile:function(){let e=this.sort(this.arr).reverse(),t=this.config,a=(window||document).location.pathname,r=$('<ul id="clwd" class="grid gap-1" name="npx-list"></ul>'),n="",i="",l="";$.each(e,(o,s)=>{
    let dateHtml=s.date?`<span class="text-gray-500 dark:text-gray-400 text-xs">${s.date}</span>`:"";
    let uploaderHtml=s.authorName?`<span class="ch-uploader flex items-center gap-1 mt-0.5"><span class="ch-uploader-name text-gray-500 dark:text-gray-400 text-xs truncate max-w-[80px]">${s.authorName}</span></span>`:`<span class="ch-uploader flex items-center gap-1 mt-0.5"><span class="ch-uploader-name text-gray-500 dark:text-gray-400 text-xs truncate max-w-[80px]">...</span></span>`;
    let metaHtml=`<div class="flex flex-col items-end shrink-0">${dateHtml}${uploaderHtml}</div>`;
    let dataAuthorAttr=s.authorName?` data-author="${s.authorName.replace(/"/g,'&amp;quot;')}"`:'';
    if(s.cat.some(e=>t.labelMain==e)){n=$(`<a class="text-white bg-accent hover:bg-accent/80 focus:ring-2 focus:outline-none focus:ring-accent/30 font-medium px-4 text-center dark:focus:ring-accent/80 rounded-full py-1 flex items-center gap-1" type="button" rel="home" href="${s.url}"><span class="sr-only">All Chapter List</span><svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="m1.56 6.245 8 3.924a1 1 0 0 0 .88 0l8-3.924a1 1 0 0 0 0-1.8l-8-3.925a1 1 0 0 0-.88 0l-8 3.925a1 1 0 0 0 0 1.8Z"/><path d="M18 8.376a1 1 0 0 0-1 1v.163l-7 3.434-7-3.434v-.163a1 1 0 0 0-2 0v.786a1 1 0 0 0 .56.9l8 3.925a1 1 0 0 0 .88 0l8-3.925a1 1 0 0 0 .56-.9v-.786a1 1 0 0 0-1-1Z"/><path d="M17.993 13.191a1 1 0 0 0-1 1v.163l-7 3.435-7-3.435v-.163a1 1 0 1 0-2 0v.787a1 1 0 0 0 .56.9l8 3.925a1 1 0 0 0 .88 0l8-3.925a1 1 0 0 0 .56-.9v-.787a1 1 0 0 0-1-1Z"/></svg><span class="hidden md:inline-block">${t.home||"All Chapter"}</span></a>`);
    } else {
      var isChLocked=s.cat&&s.cat.includes('Lock');
      var isChPw=isChLocked&&s.cat&&s.cat.includes('pw');
      var lockLiStyle=isChPw?' style="background:rgba(168,85,247,0.08);border-left:3px solid #a855f7;border-top:1px solid rgba(168,85,247,0.2);border-right:1px solid rgba(168,85,247,0.1);border-bottom:1px solid rgba(168,85,247,0.1);"':(isChLocked?' style="background:rgba(234,179,8,0.08);border-left:3px solid #eab308;border-top:1px solid rgba(234,179,8,0.2);border-right:1px solid rgba(234,179,8,0.1);border-bottom:1px solid rgba(234,179,8,0.1);"':'');
      var lockAStyle=isChPw?' style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4);color:#9333ea;"':(isChLocked?' style="background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);color:#ca8a04;"':'');
      var lockAClass=isChLocked?'flex-1 min-w-0 px-2 py-1 rounded-full block truncate':'flex-1 min-w-0 px-2 py-1 rounded-full bg-gray-100 dark:visited:text-gray-500 visited:text-gray-400 text-black dark:text-gray-200 dark:bg-gray-700 block truncate';
      var lockIconHtml=isChPw?'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:4px;flex-shrink:0;vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>':(isChLocked?'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-right:4px;flex-shrink:0;vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>':'');
      r.append($(`<li class="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"${lockLiStyle} data-ch-url="${s.url}"${dataAuthorAttr}><a class="${lockAClass}"${lockAStyle} ${s.url.includes(a)?'selected="selected"':""} href="${s.url}">${lockIconHtml}${s.title}</a>${metaHtml}</li>`));
      if(s.url.includes(a)){
        if(e[o+1]){i=e[o+1].cat.some(e=>t.labelMain==e)?"":$(`<a class="text-gray-800 bg-gray-100 dark:bg-gray-700 border border-gray-300 hover:text-accent focus:ring-2 focus:outline-none focus:ring-gray-300 font-medium px-4 text-center dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:ring-gray-800 dark:text-gray-300 rounded-full py-1 flex items-center gap-1" type="button" rel="prev" href="${e[o+1].url}"><svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" fill-rule="evenodd"></path></svg><span class="sr-only">Previous</span><span class="hidden md:inline-block">${t.prev||"Prev"}</span></a>`)}
        if(e[o-1]){l=e[o-1].cat.some(e=>t.labelMain==e)?"":$(`<a class="text-gray-800 bg-gray-100 dark:bg-gray-700 border border-gray-300 hover:text-accent focus:ring-2 focus:outline-none focus:ring-gray-300 font-medium px-4 text-center dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:ring-gray-800 dark:text-gray-300 rounded-full py-1 flex items-center gap-1" type="button" rel="next" href="${e[o-1].url}"><span class="hidden md:inline-block">${t.next||"Next"}</span><span class="sr-only">Next</span><svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" fill-rule="evenodd"></path></svg></a>`)}
      }
    }
});let o=$('<div class="flex gap-2 justify-center items-center w-full"></div>');o.html(i).append(n).append(l),$("#nextPrevJSbottom").html(o),$("#m91YjOFga6").append(r);
    // Trigger API author fetch after render
    if(typeof chUploaderFetch === 'function') setTimeout(chUploaderFetch, 100);
  },jqCheck:()=>"function"==typeof jQuery,xhr:function(){const e=this,t=e.config;$.ajax({type:"get",url:`${t.site||""}/feeds/posts/default/-/${t.cat}`,data:{alt:"json","start-index":t.start,"max-results":t.max},dataType:"jsonp",success:a=>{"entry"in a.feed?($.each(a.feed.entry,(t,a)=>{let dateRaw=a.published?a.published.$t:"";let dateStr="";if(dateRaw){let d=new Date(dateRaw);let mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];dateStr=d.getDate()+" "+mn[d.getMonth()]+" "+d.getFullYear();}e.arr.push({title:a.title.$t,url:a.link.find(e=>"alternate"==e.rel).href,cat:a.category.map(e=>e.term),date:dateStr,authorName:(a.author&&a.author[0]&&a.author[0].name&&a.author[0].name.$t)||""})}),a.feed.entry.length>=t.max?(e.config.start+=e.config.max,e.xhr()):e.compile()):0!=e.arr.length&&e.compile()},error:()=>{$("#nextPrevJSbottom").html(`<p>${t.textError||"Error"}</p>`)}})},run:function(){return this.jqCheck()?0==$("#nextPrevJSbottom").length?"element tidak ada":(this.config.cat=$("#nextPrevJSbottom").data("label")||!1,0==this.config.cat?"Category Tidak ada":void this.xhr()):"jquery tidak ada"}};npXbottom.run();
// Save last-read chapter: runs on chapter pages when npXbottom nav is present
(function(){
  try {
    var navEl = document.getElementById('nextPrevJSbottom');
    if(!navEl) return;
    var seriesLabel = navEl.getAttribute('data-label');
    if(!seriesLabel) return;
    // Save current chapter URL keyed by series label
    localStorage.setItem('lastRead_lbl_' + seriesLabel, window.location.href);
  } catch(e) {}
})();
/**/
