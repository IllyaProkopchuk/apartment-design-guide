/* Сторінка кімнати: усе рендериться з data/rooms.json + rooms/<slug>/room.json + фото з bundle.js */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var ROOT = '../../';
  var slug = document.body.getAttribute('data-slug');
  var app = document.getElementById('app');

  G.loadGuide(ROOT, slug).then(render, function () { G.loadError(app, ROOT); });

  function empty(text) { return '<p class="empty">' + esc(text || 'Ще не визначено.') + '</p>'; }
  function txt(v) { return v && String(v).trim() ? esc(v) : '<span class="empty">уточнити</span>'; }
  function list(items, emptyText) {
    items = (items || []).filter(Boolean);
    return items.length ? '<ul class="list">' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : empty(emptyText);
  }
  function section(n, id, title, body, extra) {
    return '<section class="room-section" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="section-head"><h2 id="' + id + '-h"><span class="section-num">' + n + '</span>' + esc(title) + '</h2>' + (extra || '') + '</div>' +
      body + '</section>';
  }

  function render(d) {
    var room = d.rooms.filter(function (r) { return r.slug === slug; })[0];
    if (!room) {
      app.innerHTML = '<div class="error" role="alert">Кімнату «' + esc(slug) + '» не знайдено в data/rooms.json.</div>';
      return;
    }
    var c = d.content[slug] || {};
    document.title = room.name + ' · Візуальний гід квартири';

    var style = c.style || {};
    var mat = c.materials || {};
    var html = [];

    html.push('<header class="room-head"><h1>' + esc(room.name) + '</h1>' +
      '<div class="room-meta">' + G.statusBadge(room.status) +
      '<span>Площа: ' + esc(G.areaText(room)) + '</span>' +
      '<span>Габарити: ' + esc(room.dimensions || 'уточнити') + '</span></div>' +
      '<p class="muted small">Площі приблизні (±10%), точні розміри — у DWG дизайнера.</p></header>');

    html.push('<div class="room-layout"><div class="room-body">');

    // 1. Стиль і настрій
    var hasStyle = (style.directions || []).length || style.mood || (style.likes || []).length || (style.dislikes || []).length;
    html.push(section(1, 'style', 'Стиль і настрій', !hasStyle ? empty() :
      ((style.directions || []).length ? '<ul class="chips">' + style.directions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      (style.mood ? '<p>' + esc(style.mood) + '</p>' : '') +
      ((style.likes || []).length || (style.dislikes || []).length
        ? '<div class="two-col brief"><div class="brief-like"><h3>✓ Що подобається</h3>' + list(style.likes, '—') + '</div>' +
          '<div class="brief-dislike"><h3>✕ Чого не хочемо</h3>' + list(style.dislikes, '—') + '</div></div>'
        : '')));

    // 2. Палітра
    var pal = c.palette || [];
    html.push(section(2, 'palette', 'Палітра', pal.length
      ? '<ul class="swatches">' + pal.map(function (p) {
          return '<li class="swatch"><div class="swatch-chip" style="background:' + esc(p.hex) + '"></div><b>' + esc(p.name) + '</b><code>' + esc(p.hex) + '</code><span>' + esc(p.note || '') + '</span></li>';
        }).join('') + '</ul>'
      : empty('Ще не визначено. Орієнтир — загальна палітра квартири на головній.')));

    // 3. Матеріали
    html.push(section(3, 'materials', 'Матеріали',
      '<dl class="kv"><dt>Підлога</dt><dd>' + txt(mat.floor) + '</dd><dt>Стіни</dt><dd>' + txt(mat.walls) + '</dd><dt>Стеля</dt><dd>' + txt(mat.ceiling) + '</dd></dl>'));

    // 4. Меблі й світло
    html.push(section(4, 'furniture', 'Меблі й світло',
      '<div class="two-col"><div><h3>Меблі</h3>' + list(c.furniture) + '</div><div><h3>Світло</h3>' + list(c.lighting) + '</div></div>'));

    // 5. Референси та рендери
    html.push(section(5, 'refs', 'Референси та рендери', galleryHTML(d.photos[slug] || []) + rendersHTML(d.renders[slug] || [])));

    html.push('</div>');

    // Бічна панель: міні-план і перелік кімнат
    html.push('<aside class="room-aside" aria-label="Інші кімнати"><div class="card sticky"><h2>Де це на плані</h2>' +
      G.planSVG(d.rooms, { root: ROOT, current: slug, compact: true, image: d.site.planImage }) +
      '<ul class="room-nav">' + d.rooms.map(function (r) {
        return '<li><a href="' + esc(G.roomHref(ROOT, r)) + '"' + (r.slug === slug ? ' aria-current="page"' : '') + '><span>' + esc(r.name) + '</span>' + G.statusBadge(r.status) + '</a></li>';
      }).join('') + '</ul></div></aside>');

    html.push('</div>');
    app.innerHTML = html.join('');
    setupLightbox();
  }

  var GROUPS = [
    { key: 'like', title: 'Подобається' },
    { key: 'mixed', title: 'Є і плюси, і мінуси' },
    { key: 'dislike', title: 'Не подобається' },
    { key: 'neutral', title: 'Нейтральне' }
  ];

  // Підпис показуємо дослівно (це наш коментар), частини підсвічені за тоном.
  function captionHTML(p) {
    return '<span class="cap">' + p.segments.map(function (s) {
      var icon = s.tone === 'like' ? '<span class="seg-icon" aria-hidden="true">+</span>'
        : s.tone === 'dislike' ? '<span class="seg-icon" aria-hidden="true">−</span>' : '';
      var sr = s.tone === 'like' ? '<span class="sr">подобається: </span>'
        : s.tone === 'dislike' ? '<span class="sr">не подобається: </span>' : '';
      return '<span class="seg seg--' + s.tone + '">' + icon + sr + esc(s.text) + '</span>';
    }).join(' ') + '</span>';
  }

  var REF_LEGEND = '<p class="ref-legend small muted">Підписи — наші коментарі до фото, дослівно. ' +
    '<span class="seg seg--like"><span class="seg-icon" aria-hidden="true">+</span>подобається</span> ' +
    '<span class="seg seg--dislike"><span class="seg-icon" aria-hidden="true">−</span>не подобається</span></p>';

  function figure(p, cls) {
    return '<li><figure class="ref ' + cls + '"><button type="button" class="ref-open" data-src="' + esc(ROOT + p.src) + '" data-caption="' + esc(p.caption) + '">' +
      '<img loading="lazy" src="' + esc(ROOT + p.src) + '" alt="' + esc(p.caption) + '"></button>' +
      '<figcaption>' + captionHTML(p) + (p.note ? '<span class="ref-note">' + esc(p.note) + '</span>' : '') + '</figcaption></figure></li>';
  }

  function galleryHTML(photos) {
    if (!photos.length) return empty('Референсів ще немає.');
    return REF_LEGEND + GROUPS.map(function (g) {
      var items = photos.filter(function (p) { return p.group === g.key; });
      if (!items.length) return '';
      return '<div class="gallery-group"><h3>' + esc(g.title) + ' <span class="count">' + items.length + '</span></h3>' +
        '<ul class="gallery">' + items.map(function (p) { return figure(p, 'ref--' + g.key); }).join('') + '</ul></div>';
    }).join('');
  }

  function rendersHTML(renders) {
    if (!renders.length) return '';
    return '<div class="gallery-group"><h3>Рендери <span class="count">' + renders.length + '</span></h3><ul class="gallery">' +
      renders.map(function (p) { return figure(p, ''); }).join('') + '</ul></div>';
  }

  function setupLightbox() {
    var dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
    app.addEventListener('click', function (e) {
      var b = e.target.closest('.ref-open');
      if (!b) return;
      img.src = b.getAttribute('data-src');
      img.alt = cap.textContent = b.getAttribute('data-caption');
      dlg.showModal();
    });
    dlg.querySelector('.lightbox-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
})();
