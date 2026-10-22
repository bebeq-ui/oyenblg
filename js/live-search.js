/* langitoren: live-search.js (diekstrak dari tema, baris 11231) */
//
  const _liveSearch = {
    filterLabel: "Series",
    minChars: 1,
    historyKey: "ls_history",
    historyMax: 10
  };
  (function (e) {
    if ("function" != typeof e || "object" != typeof _liveSearch) return !1;

    /* ===== Riwayat pencarian (localStorage, per user/browser) ===== */
    var getHistory = function () {
      try { return JSON.parse(localStorage.getItem(_liveSearch.historyKey)) || []; }
      catch (err) { return []; }
    };
    var saveHistory = function (term) {
      term = (term || '').trim();
      if (!term) return;
      var list = getHistory().filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); });
      list.unshift(term);
      if (list.length > _liveSearch.historyMax) list = list.slice(0, _liveSearch.historyMax);
      try { localStorage.setItem(_liveSearch.historyKey, JSON.stringify(list)); } catch (err) {}
    };
    var clearHistory = function () {
      try { localStorage.removeItem(_liveSearch.historyKey); } catch (err) {}
    };

    var position = function () {
      var box = e('.cari-isi'), panel = e('.live-search-item'), rect = box[0].getBoundingClientRect();
      panel.css({ left: rect.left + 'px', top: rect.bottom + 'px', width: rect.width + 'px' });
    };
    var onDocClick = function (ev) {
      e(ev.target).closest('.cari-isi').length || closePanel();
    };
    var closePanel = function () {
      0 != e('.live-search-item').length && e('.live-search-item').remove();
      e(window).off('resize', position);
      e(window).off('scroll', position);
      e(document).off('click', onDocClick);
    };
    var renderPanel = function (html) {
      0 != e('.live-search-item').length && closePanel();
      var wrap = e('<div class="live-search-item"></div>');
      wrap.html(html);
      e('body').append(wrap);
      position();
      e(window).on('resize', position);
      e(window).on('scroll', position);
      e(document).on('click', onDocClick);
      return !0;
    };
    var esc = function (s) {
      return (s || '').toString().replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    /* Genre asli saja (whitelist), sesuai daftar genre di widget Advance Search.
       Menghindari label alfabet/status/judul yang ikut kebawa jika hanya diambil dari semua category. */
    var GENRE_WHITELIST = ["Action","BL","Brothership","Comedy","Drama","Fantasy","Isekai","Magic","Mystery","NSFW","Oneshot","Police","Psychological","Romance","School life","Seinen","Shoujo","Shounen","Shounen-ai","Showbiz","Silent manga","Supernatural","Thriller","Yaoi","Youth","regresi"];
    var getGenreLabel = function (entry) {
      var genres = (entry.category || [])
        .map(function (c) { return c.term; })
        .filter(function (t) { return GENRE_WHITELIST.indexOf(t) !== -1; });
      return genres.join(', ');
    };
    var renderSuggestions = function () {
      var history = getHistory();
      var html = '<div class="live-search-sections">';
      html += '<div class="ls-section">';
      html += '<div class="ls-section-head"><span>Riwayat Pencarian</span>' + (history.length ? '<button type="button" class="ls-clear-history">Hapus</button>' : '') + '</div>';
      html += history.length
        ? '<div class="ls-chips">' + history.map(function (t) { return '<a class="ls-chip" href="/search?q=' + encodeURIComponent(t) + '">' + esc(t) + '</a>'; }).join('') + '</div>'
        : '<p class="ls-empty">Belum ada riwayat pencarian.</p>';
      html += '</div></div>';
      renderPanel(html);
      e('.ls-clear-history').on('click', function () { clearHistory(); renderSuggestions(); });
    };

    var input = e('.cari-input');
    if (0 != input.length) {
      var debounceTimer;
      input.on('focus', function () {
        if (0 == e(this).val().length) renderSuggestions();
      });
      input.on('keyup', function () {
        var self = this, len = e(self).val().length;
        if (0 != len && len >= (_liveSearch.minChars || 1)) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            var query = e(self).val();
            if (query.length < (_liveSearch.minChars || 1)) { return !1; }
            renderPanel('<center class="pinzx"><i class="fa fa-sync fa-spin"></i></center>');
            e.ajax({
              type: 'get',
              url: (_liveSearch.site || '') + '/feeds/posts/default',
              data: {
                alt: 'json',
                q: (_liveSearch.filterLabel ? ('label:' + _liveSearch.filterLabel + ' ') : '') + '"' + query + '"',
                'max-results': 25
              },
              dataType: 'jsonp',
              success: function (data) {
                if ('entry' in data.feed) {
                  var html = '';
                  e.each(data.feed.entry, function (i, entry) {
                    var title = entry.title.$t,
                        href = entry.link.find(function (l) { return 'alternate' == l.rel; }).href,
                        genre = getGenreLabel(entry);
                    html += '<li><a href="' + href + '"><div class="autotitle">' + title + '</div>' + (genre ? '<span class="live-meta">' + esc(genre) + '</span>' : '') + '</a></li>';
                  });
                  renderPanel('<ul>' + html + '</ul>');
                } else {
                  renderPanel('<p><center>"' + esc(query) + '" Tidak di temukan</center></p>');
                }
              },
              error: function () { return renderPanel('<p><center>Error</center></p>'); }
            });
          }, 500);
        } else if (0 == len) {
          clearTimeout(debounceTimer);
          renderSuggestions();
        }
      });
    }

    /* Simpan riwayat saat form di-submit (tekan Enter / klik ikon search) */
    e('#header-search-form, #search-navbar').closest('form').on('submit', function () {
      var q = e(this).find('input[name="q"]').val();
      saveHistory(q);
    });

    /* Tambal hasil /search yang terlewat oleh pencarian native Blogger,
       supaya jumlahnya konsisten dengan dropdown */
    var TYPE_LIST = ["Manga","Manhua","Manhwa","Doujin","Novel","Web Novel","Light Novel","One-Shot","WN","LN"];
    var STATUS_LIST = ["Ongoing","Completed","Cancelled","Hiatus","Dropped","Coming Soon"];
    var placeholderImg = "https://placehold.co/128x182?text=No+Image";
    var timeAgo = function (iso) {
      var diff = (Date.now() - new Date(iso).getTime()) / 1000;
      var units = [[31536000,'year'],[2592000,'month'],[86400,'day'],[3600,'hour'],[60,'minute']];
      for (var i = 0; i < units.length; i++) {
        var v = Math.floor(diff / units[i][0]);
        if (v >= 1) return v + ' ' + units[i][1] + (v > 1 ? 's' : '') + ' ago';
      }
      return 'just now';
    };
    var fillMissingResults = function () {
      var container = document.getElementById('native-search-results');
      if (!container) return;
      var query = container.getAttribute('data-query') || '';
      if (!query) return;
      var existing = [];
      container.querySelectorAll('a[href]').forEach(function (a) { existing.push(a.href); });
      e.ajax({
        type: 'get',
        url: '/feeds/posts/default',
        data: { alt: 'json', q: 'label:Series "' + query + '"', 'max-results': 25 },
        dataType: 'jsonp',
        success: function (data) {
          if (!('entry' in data.feed)) return;
          e.each(data.feed.entry, function (i, entry) {
            var href = entry.link.find(function (l) { return 'alternate' == l.rel; }).href;
            if (existing.indexOf(href) !== -1) return;
            var title = entry.title.$t,
                terms = (entry.category || []).map(function (c) { return c.term; }),
                type = terms.filter(function (t) { return TYPE_LIST.indexOf(t) !== -1; }).join(' '),
                typeBadge = terms.filter(function (t) { return TYPE_LIST.indexOf(t) !== -1; })[0] || '',
                genre = terms.filter(function (t) { return GENRE_WHITELIST.indexOf(t) !== -1; }).join(' '),
                status = terms.filter(function (t) { return STATUS_LIST.indexOf(t) !== -1; })[0] || '',
                postId = (entry.id.$t.match(/post-(\d+)/) || [])[1] || '',
                summary = entry.summary ? entry.summary.$t.replace(/<[^>]*>/g, '').trim().slice(0, 150) : '',
                updated = entry.updated ? entry.updated.$t : '',
                img = ('media$thumbnail' in entry) ? entry.media$thumbnail.url.replace(/\/s\d+(-c)?\//, '/s300-c/').replace(/=s\d+(-c)?$/, '=s300-c') : placeholderImg;
            var card = '<section class="bg-white dark:bg-gray-800 rounded-lg grid gap-4 shadow order-first">' +
              '<div class="px-4 pt-4 grid grid-cols-[90px_1fr] gap-4">' +
                '<img class="rounded-lg shadow-lg thumb" style="width:90px;height:180px;object-fit:cover" src="' + img + '" alt="' + esc(title) + '"/>' +
                '<div><div class="flex items-center justify-between">' +
                  (status ? '<span class="text-xs font-medium mr-2 px-2.5 py-0.5 rounded" data-status="' + esc(status) + '">' + esc(status) + '</span>' : '<span/>') +
                  '<div class="cursor-pointer ignielBookmarkPost ms-auto" title="Bookmarked"><input id="bm-' + postId + '" type="checkbox"/><label aria-label="Bookmark" data-img="' + esc(img) + '" data-title="' + esc(title) + '" data-bm-type="' + esc(typeBadge) + '" data-bm-status="' + esc(status) + '" data-url="' + esc(href) + '" for="bm-' + postId + '"><svg class="bm-icon w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></label></div>' +
                '</div><h2 class="my-2 text-lg line-clamp-1 text-gray-900 dark:text-gray-200">' + esc(title) + '</h2>' +
                (summary ? '<p class="line-clamp-3 text-gray-500 text-xs">' + esc(summary) + '…</p>' : '') +
                '</div>' +
              '</div>' +
              '<div class="col-span-full p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"><aside class="text-xs leading-5">' +
                '<dl class="flex gap-2"><dt class="text-gray-400 dark:text-gray-500">Type:</dt><dd>' + esc(type) + '</dd></dl>' +
                '<dl class="flex gap-2"><dt class="text-gray-400 dark:text-gray-500">Chapter:</dt><dd></dd></dl>' +
                '<dl class="flex gap-2"><dt class="text-gray-400 dark:text-gray-500">Genre:</dt><dd>' + esc(genre) + '</dd></dl>' +
                '<dl class="flex gap-2 items-center"><dt class="text-gray-400 dark:text-gray-500">Rating:</dt><dd><span class="aside-rating-display" data-postid="' + postId + '" style="color:#FBBF24;font-weight:600">&#9733; -</span></dd></dl>' +
                (updated ? '<dl class="flex gap-2"><dt class="text-gray-400 dark:text-gray-500">Update:</dt><dd>' + timeAgo(updated) + '</dd></dl>' : '') +
              '</aside>' +
              '<a class="mt-3 py-2 px-12 text-md font-medium text-gray-100 focus:outline-none hover:opacity-80 bg-accent rounded-full focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 flex" href="' + href + '">Read More</a>' +
              '</div></section>';
            container.insertAdjacentHTML('beforeend', card);
          });
        }
      });
    };
    e(fillMissingResults);

  })(jQuery);
//
