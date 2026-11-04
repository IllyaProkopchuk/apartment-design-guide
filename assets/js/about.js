/* Сторінка «Про нас»: анкета з data/about.json */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var app = document.getElementById('app');

  G.loadGuide('../').then(render, function () { G.loadError(app, '../'); });

  function render(d) {
    var a = d.about;
    if (!a) { app.innerHTML = '<div class="error" role="alert">Немає data/about.json. Запустіть <code>node build.mjs</code>.</div>'; return; }
    var html = ['<header class="room-head"><h1>' + esc(a.title || 'Анкета про нас') + '</h1>' +
      (a.intro ? '<p class="lead">' + esc(a.intro) + '</p>' : '') +
      ((a.summary || []).length ? '<ul class="facts">' + a.summary.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      '</header>'];

    html.push('<nav class="about-toc no-print" aria-label="Розділи анкети"><ul>' + (a.sections || []).map(function (s) {
      return '<li><a href="#' + esc(s.id) + '">' + esc(s.title) + '</a></li>';
    }).join('') + '</ul></nav>');

    (a.sections || []).forEach(function (s) {
      html.push('<section class="about-section" id="' + esc(s.id) + '" aria-labelledby="' + esc(s.id) + '-h"><h2 id="' + esc(s.id) + '-h">' + esc(s.title) + '</h2>' +
        '<div class="about-grid">' + (s.groups || []).map(function (g) {
          return '<div class="about-card"><h3>' + esc(g.title) + '</h3><ul class="list">' +
            (g.items || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div></section>');
    });
    app.innerHTML = html.join('');
    G.hideLoader();
  }
})();
