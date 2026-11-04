/* Головна сторінка */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var $ = function (id) { return document.getElementById(id); };

  setupTabs();
  setupDrawing();

  G.loadGuide('').then(render, function () { G.loadError($('plan'), ''); });

  function render(d) {
    var p = d.site.project || {};
    $('facts').innerHTML = ['area', 'floor', 'renovation', 'planning', 'scale']
      .filter(function (k) { return p[k]; })
      .map(function (k) { return '<li>' + esc(p[k]) + '</li>'; }).join('');

    $('plan').innerHTML = G.planSVG(d.rooms, { root: '' });
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

  function setupTabs() {
    var tabs = [$('tab-schema'), $('tab-drawing')];
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = (i + 1) % 2; select(n); tabs[n].focus(); }
      });
    });
    function select(i) {
      tabs.forEach(function (t, j) {
        t.setAttribute('aria-selected', String(i === j));
        t.tabIndex = i === j ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = i !== j;
      });
    }
    select(0);
  }

  function setupDrawing() {
    // Шукаємо креслення: спершу SVG, потім PNG, потім JPG. Працює і з диска, і на GitHub Pages.
    var img = $('plan-img'), empty = $('plan-empty');
    var candidates = ['plan/plan.svg', 'plan/plan.png', 'plan/plan.jpg'];
    var i = 0;
    img.onload = function () { img.hidden = false; empty.hidden = true; };
    img.onerror = function () { i += 1; if (i < candidates.length) img.src = candidates[i]; };
    img.src = candidates[0];
  }
})();
