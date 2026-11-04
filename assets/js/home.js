/* Головна сторінка */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var $ = function (id) { return document.getElementById(id); };


  G.loadGuide('').then(render, function () { G.loadError($('plan'), ''); });

  // Обкладинка: файл з room.json → "cover", інакше перше фото з групи «Подобається».
  function coverSrc(d, slug) {
    var list = d.photos[slug] || [], want = ((d.content || {})[slug] || {}).cover;
    if (want) {
      for (var i = 0; i < list.length; i++) {
        var all = [list[i]].concat(list[i].more || []);
        for (var j = 0; j < all.length; j++) if (all[j].file === want) return all[j].src;
      }
    }
    var liked = list.filter(function (p) { return p.group === 'like'; })[0] || list[0];
    return liked ? liked.src : null;
  }

  function render(d) {
    G.hideLoader();
    var ab = d.about || {};
    $('about-summary').innerHTML = (ab.summary || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    $('plan').innerHTML = G.planSVG(d.rooms, { root: '', image: d.site.planImage });
    if (d.site.planImage && d.site.planImage.caption) $('plan-caption').textContent = d.site.planImage.caption + '. Натисніть на кімнату, щоб відкрити її сторінку.';
    if (d.site.planPdf) $('plan-pdf').innerHTML = 'Планувальне рішення від дизайнера: <a href="' + esc(encodeURI(d.site.planPdf)) + '" target="_blank" rel="noopener">відкрити PDF</a>.';


    $('rooms').innerHTML = d.rooms.map(function (r) {
      var refs = (d.photos[r.slug] || []).length;
      var cover = coverSrc(d, r.slug);
      return '<li><a class="room-card' + (cover ? ' has-cover' : '') + '" href="' + esc(G.roomHref('', r)) + '">' +
        (cover ? '<img class="room-cover" loading="lazy" src="' + esc(cover) + '" alt="">' : '') +
        '<h3>' + esc(r.name) + '</h3>' +
        '<dl>' + (typeof r.area === 'number' ? '<dt>Площа</dt><dd>' + esc(G.areaText(r)) + '</dd>' : '') +
        '<dt>Референси</dt><dd>' + (refs ? refs : 'поки немає') + '</dd></dl></a></li>';
    }).join('');

    var pal = d.palette || {};
    $('palette-note').textContent = pal.note || '';
    $('palette').innerHTML = (pal.colors || []).map(function (c) {
      return '<li class="swatch"><div class="swatch-chip" style="background:' + esc(c.hex) + '"></div>' +
        '<b>' + esc(c.name) + '</b><code>' + esc(c.hex) + '</code><span>' + esc(c.role || '') + '</span></li>';
    }).join('');

    var t = d.taste || {};
    $('taste-intro').textContent = t.intro || '';
    $('formula').innerHTML = (t.formula || []).map(function (f) {
      return '<li><b>' + esc(f.title) + '</b><span>' + esc(f.text || '') + '</span></li>';
    }).join('');
    var st = t.styles || {};
    if (st.title) $('styles-title').textContent = st.title;
    $('styles-note').textContent = st.note || '';
    $('styles').innerHTML = (st.items || []).map(function (s) {
      return '<li><b lang="en">' + esc(s.name) + '</b><i>' + esc(s.uk || '') + '</i><span>' + esc(s.text || '') + '</span></li>';
    }).join('');
  }

})();
