// STAR RATING SYSTEM v1.0 - Firebase Realtime Database
// Compatible dengan like button system yang sudah ada
// Path Firebase: /ratings/{postId}/
// Anti-spam: Cookie 365 hari (anonymous tetap bisa rating)

(function() {
  'use strict';
  var COOKIE_PREFIX = 'hirurating_';
  function getCookie(name) {
    var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function renderBars(container, dist, total) {
    if (!container) return;
    container.innerHTML = '';
    for (var i = 5; i >= 1; i--) {
      var count = (dist && dist[i]) ? dist[i] : 0;
      var pct = total > 0 ? Math.round((count / total) * 100) : 0;
      var row = document.createElement('div');
      row.className = 'flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400';
      row.innerHTML = '<span class="w-3 text-right">' + i + '</span>'
        + '<span style="color:#FBBF24">★</span>'
        + '<div style="flex:1;background:#E5E7EB;border-radius:3px;height:5px;min-width:55px">'
        +   '<div style="background:#FBBF24;height:5px;border-radius:3px;width:' + pct + '%;transition:width 0.4s"></div>'
        + '</div>'
        + '<span style="width:24px">' + pct + '%</span>';
      container.appendChild(row);
    }
  }
  function initWidget(widget) {
    var postId = widget.getAttribute('data-postid');
    if (!postId) return;
    var stars = widget.querySelectorAll('.star-item');
    var avgEl = widget.querySelector('#avgRatingDisplay');
    var totalEl = widget.querySelector('#totalRatersDisplay');
    var msgEl = widget.querySelector('#ratingStatusMsg');
    var barsEl = widget.querySelector('#ratingBars');
    var cookieKey = COOKIE_PREFIX + postId;
    var alreadyRated = getCookie(cookieKey) === 'y';
    var ratingRef = dblikes.ref('ratings/' + postId);
    var hovered = false;
    var currentAvg = 0;

    function setStarColors(val) {
      stars.forEach(function(s) {
        var sv = parseInt(s.getAttribute('data-value'));
        s.style.color = sv <= val ? '#FBBF24' : '#9CA3AF';
        s.style.transform = sv <= val ? 'scale(1.15)' : 'scale(1)';
      });
    }

    ratingRef.on('value', function(snap) {
      var data = snap.val();
      var total = 0, sum = 0, dist = {};
      if (data) {
        total = data.total_raters || 0;
        sum = data.rating_sum || 0;
        dist = data.distribution || {};
      }
      currentAvg = total > 0 ? sum / total : 0;
      if (avgEl) avgEl.textContent = currentAvg > 0 ? currentAvg.toFixed(1) : '-';
      if (totalEl) totalEl.textContent = total;
      if (!hovered) setStarColors(Math.round(currentAvg));
      renderBars(barsEl, dist, total);
    });

    if (alreadyRated) {
      if (msgEl) { msgEl.textContent = '✓ Kamu sudah memberi rating'; msgEl.style.color = '#10B981'; }
      stars.forEach(function(s) { s.style.cursor = 'default'; s.style.pointerEvents = 'none'; });
      return;
    }

    stars.forEach(function(s) {
      s.addEventListener('mouseenter', function() {
        hovered = true;
        setStarColors(parseInt(s.getAttribute('data-value')));
      });
      s.addEventListener('mouseleave', function() {
        hovered = false;
        setStarColors(Math.round(currentAvg));
      });
      s.addEventListener('click', function() {
        var val = parseInt(s.getAttribute('data-value'));
        stars.forEach(function(st) { st.style.pointerEvents = 'none'; st.style.cursor = 'default'; });
        if (msgEl) { msgEl.textContent = '⏳ Menyimpan...'; msgEl.style.color = '#6B7280'; }
        ratingRef.transaction(function(cur) {
          if (!cur) {
            var d = {}; d[val] = 1;
            return { rating_sum: val, total_raters: 1, distribution: d };
          }
          var nd = cur.distribution || {};
          nd[val] = (nd[val] || 0) + 1;
          return { rating_sum: (cur.rating_sum || 0) + val, total_raters: (cur.total_raters || 0) + 1, distribution: nd };
        }, function(err, committed) {
          if (!err && committed) {
            setCookie(cookieKey, 'y', 365);
            if (msgEl) { msgEl.textContent = '✓ Terima kasih! Rating tersimpan.'; msgEl.style.color = '#10B981'; }
          } else {
            if (msgEl) { msgEl.textContent = '✗ Gagal, coba lagi.'; msgEl.style.color = '#EF4444'; }
            stars.forEach(function(st) { st.style.pointerEvents = 'auto'; st.style.cursor = 'pointer'; });
          }
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.star-rating-widget').forEach(initWidget);
    // Isi aside-rating-display di card feed (homepage/label page)
    document.querySelectorAll('.aside-rating-display[data-postid]').forEach(function(el) {
      var pid = el.getAttribute('data-postid');
      if (!pid) return;
      dblikes.ref('ratings/' + pid).once('value', function(snap) {
        var d = snap.val();
        var total = d && d.total_raters ? d.total_raters : 0;
        var avg = total > 0 ? (d.rating_sum / total) : 0;
        el.innerHTML = '★ ' + (avg > 0 ? avg.toFixed(1) : '-') + '<span style="color:#9CA3AF;font-weight:400;font-size:0.85em"> (' + total + ')</span>';
      });
    });
  });
})();