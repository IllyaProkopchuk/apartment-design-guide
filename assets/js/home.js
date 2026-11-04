/* Головна сторінка */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var $ = function (id) { return document.getElementById(id); };


  G.loadGuide('').then(render, function () { G.loadError($('plan'), ''); });

  function render(d) {
    var p = d.site.project || {};
    $('facts').innerHTML = ['area', 'floor', 'renovation', 'planning', 'scale']
      .filter(function (k) { return p[k]; })
      .map(function (k) { return '<li>' + esc(p[k]) + '</li>'; }).join('');

    $('plan').innerHTML = G.planSVG(d.rooms, { root: '', image: d.site.planImage });
    if (d.site.planImage && d.site.planImage.caption) $('plan-caption').textContent = d.site.planImage.caption + '. Кольором позначено кімнати та їхній статус. Натисніть на кімнату, щоб відкрити її сторінку.';
    $('legend').innerHTML = G.legendHTML();
    if (d.site.planPdf) $('plan-pdf').innerHTML = 'Планувальне рішення від дизайнера: <a href="' + esc(encodeURI(d.site.planPdf)) + '" target="_blank" rel="noopener">відкрити PDF</a>.';

    var approved = d.rooms.filter(function (r) { return G.status(r.status).step === 2; }).length;
    $('progress').textContent = 'Затверджено: ' + approved + ' з ' + d.rooms.length;

    $('rooms').innerHTML = d.rooms.map(function (r) {
      var refs = (d.photos[r.slug] || []).length;
      return '<li><a class="room-card" href="' + esc(G.roomHref('', r)) + '">' +
        '<h3>' + esc(r.name) + '</h3>' + G.statusBadge(r.status) +
        '<dl><dt>Площа</dt><dd>' + esc(G.areaText(r)) + '</dd>' +
        '<dt>Габарити</dt><dd>' + esc(r.dimensions || 'уточнити') + '</dd>' +
        '<dt>Референси</dt><dd>' + (refs ? refs : 'поки немає') + '</dd></dl></a></li>';
    }).join('');

    var pal = d.palette || {};
    $('palette-status').innerHTML = pal.status ? G.statusBadge(pal.status) : '';
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

    if (d.generatedAt) $('generated').textContent = 'Збірка: ' + new Date(d.generatedAt).toLocaleDateString('uk-UA') + '.';
  }

})();
