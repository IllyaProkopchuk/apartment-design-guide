/* Сторінка кімнати: усе рендериться з data/rooms.json + rooms/<slug>/room.json + фото з bundle.js */
(function () {
  'use strict';
  var G = window.Guide, esc = G.esc;
  var ROOT = '../../';
  var slug = document.body.getAttribute('data-slug');
  var app = document.getElementById('app');

  G.loadGuide(ROOT, slug).then(render, function () { G.loadError(app, ROOT); });

  function empty(text) { return '<p class="empty">' + esc(text || 'Ще не визначено.') + '</p>'; }
  // Площа й габарити показуються лише коли відомі (не «уточнити»).
  function metaHTML(room) {
    var parts = [];
    if (typeof room.area === 'number') parts.push('<span>Площа: ' + esc(G.areaText(room)) + '</span>');
    if (room.dimensions && !/уточн/i.test(room.dimensions)) parts.push('<span>Габарити: ' + esc(room.dimensions) + '</span>');
    return parts.length ? '<div class="room-meta">' + parts.join('') + '</div>' : '';
  }
  function briefHTML(likes, dislikes) {
    if (!(likes || []).length && !(dislikes || []).length) return '';
    return '<div class="two-col brief"><div class="brief-like"><h3>✓ Що подобається</h3>' + list(likes, '—') + '</div>' +
      '<div class="brief-dislike"><h3>✕ Чого не хочемо</h3>' + list(dislikes, '—') + '</div></div>';
  }
  function list(items, emptyText) {
    if (items && !Array.isArray(items) && typeof items === 'object') {
      var keys = Object.keys(items);
      return keys.length ? keys.map(function (k) { return '<h4 class="zone-sub">' + esc(k) + '</h4>' + list(items[k], '—'); }).join('') : empty(emptyText);
    }
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
    ZONES = c.zones || [];
    document.title = room.name + ' · Візуальний гід квартири';

    var style = c.style || {};
    var mat = c.materials || {};
    var html = [];

    html.push('<header class="room-head"><h1>' + esc(room.name) + '</h1>' +
      metaHTML(room) + '</header>');

    // Головне коротко: 3–4 рядки, які можна прочитати за кілька секунд
    if ((c.summary || []).length) {
      html.push('<section class="room-summary" aria-label="Головне коротко"><h2>Головне коротко</h2><ul>' +
        c.summary.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>');
    }

    html.push('<div class="room-layout"><div class="room-body">');

    // 1. Стиль і настрій
    var hasStyle = (style.directions || []).length || style.mood || (style.likes || []).length || (style.dislikes || []).length || (style.sections || []).length;
    html.push(section(1, 'style', 'Стиль і настрій', !hasStyle ? empty() :
      ((style.directions || []).length ? '<ul class="chips">' + style.directions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      (style.mood ? '<p>' + esc(style.mood) + '</p>' : '') +
      briefHTML(style.likes, style.dislikes) +
      (style.sections || []).map(function (z) {
        return '<h3 class="zone-title">' + esc(z.title) + '</h3>' + (z.mood ? '<p>' + esc(z.mood) + '</p>' : '') + briefHTML(z.likes, z.dislikes);
      }).join('')));

    // 2. Палітра
    var pal = c.palette || [];
    html.push(section(2, 'palette', 'Палітра', pal.length
      ? '<ul class="swatches">' + pal.map(function (p) {
          return '<li class="swatch"><div class="swatch-chip" style="background:' + esc(p.hex) + '"></div><b>' + esc(p.name) + '</b><code>' + esc(p.hex) + '</code><span>' + esc(p.note || '') + '</span></li>';
        }).join('') + '</ul>'
      : empty('Ще не визначено. Орієнтир — загальна палітра квартири на головній.')));

    // 3. Матеріали
    var matRows = [['Підлога', mat.floor], ['Стіни', mat.walls], ['Стеля', mat.ceiling]].filter(function (m) { return m[1] && String(m[1]).trim(); });
    html.push(section(3, 'materials', 'Матеріали', matRows.length
      ? '<dl class="kv">' + matRows.map(function (m) { return '<dt>' + m[0] + '</dt><dd>' + esc(m[1]) + '</dd>'; }).join('') + '</dl>'
      : empty()));

    // 4. Меблі й світло
    html.push(section(4, 'furniture', 'Меблі й світло',
      '<div class="two-col"><div><h3>Меблі</h3>' + list(c.furniture) + '</div><div><h3>Світло</h3>' + list(c.lighting) + '</div></div>'));

    // 5. Референси та рендери
    html.push(section(5, 'refs', 'Референси та рендери', galleryHTML(d.photos[slug] || []) + rendersHTML(d.renders[slug] || [])));

    var idx = d.rooms.indexOf(room), n = d.rooms.length;
    var prev = d.rooms[(idx - 1 + n) % n], nextRoom = d.rooms[(idx + 1) % n];
    html.push('<nav class="room-pager no-print" aria-label="Інші кімнати">' +
      '<a class="pager-prev" href="' + esc(G.roomHref(ROOT, prev)) + '"><small>← Попередня</small><b>' + esc(prev.name) + '</b></a>' +
      '<a class="pager-next" href="' + esc(G.roomHref(ROOT, nextRoom)) + '"><small>Наступна →</small><b>' + esc(nextRoom.name) + '</b></a></nav>');

    html.push('</div>');

    // Бічна панель: міні-план і перелік кімнат
    html.push('<aside class="room-aside" aria-label="Інші кімнати"><div class="card sticky"><h2>Де це на плані</h2>' +
      G.planSVG(d.rooms, { root: ROOT, current: slug, compact: true, image: d.site.planImage }) +
      '<ul class="room-nav">' + d.rooms.map(function (r) {
        return '<li><a href="' + esc(G.roomHref(ROOT, r)) + '"' + (r.slug === slug ? ' aria-current="page"' : '') + '><span>' + esc(r.name) + '</span></a></li>';
      }).join('') + '</ul></div></aside>');

    html.push('</div>');
    app.innerHTML = html.join('');
    G.hideLoader();
    setupLightbox();
  }

  var GROUPS = [
    { key: 'like', title: 'Подобається' },
    { key: 'mixed', title: 'Є і плюси, і мінуси' },
    { key: 'dislike', title: 'Не подобається' },
    { key: 'neutral', title: 'Нейтральне' }
  ];

  // Підпис: рядок «+» (що подобається), потім рядок «−» (що ні).
  function captionHTML(p) {
    var likes = p.likes || [], dislikes = p.dislikes || [];
    if (!likes.length && !dislikes.length) return '<span class="cap">' + esc(p.caption) + '</span>';
    return (likes.length ? '<span class="cap-line cap-like"><span class="cap-icon" aria-label="подобається">+</span><span>' + esc(likes.join(', ')) + '</span></span>' : '') +
      (dislikes.length ? '<span class="cap-line cap-dislike"><span class="cap-icon" aria-label="не подобається">−</span><span>' + esc(dislikes.join(', ')) + '</span></span>' : '');
  }

  function plainCaption(p) {
    var t = [];
    if ((p.likes || []).length) t.push('+ ' + p.likes.join(', '));
    if ((p.dislikes || []).length) t.push('− ' + p.dislikes.join(', '));
    return t.length ? t.join('   ') : p.caption;
  }

  function figure(p, cls) {
    return '<li><figure class="ref ' + cls + '">' + (p.favorite ? '<span class="fav-badge" title="Фаворит">★ фаворит</span>' : '') + '<button type="button" class="ref-open" data-src="' + esc(ROOT + p.src) + '" data-caption="' + esc(plainCaption(p)) + '">' +
      '<img loading="lazy" src="' + esc(ROOT + p.src) + '" alt="' + esc(plainCaption(p)) + '"></button>' +
      (p.more && p.more.length ? '<div class="ref-more">' + p.more.map(function (m) {
        return '<button type="button" class="ref-open" data-src="' + esc(ROOT + m.src) + '" data-caption="' + esc(plainCaption(p)) + '">' +
          '<img loading="lazy" src="' + esc(ROOT + m.src) + '" alt="' + esc(plainCaption(p)) + ' (інший ракурс)"></button>';
      }).join('') + '</div>' : '') +
      '<figcaption>' + captionHTML(p) + (p.note ? '<span class="ref-note">' + esc(p.note) + '</span>' : '') + '</figcaption></figure></li>';
  }

  var ZONES = [];
  function galleryHTML(photos) {
    if (!photos.length) return empty('Референсів ще немає.');
    var zoned = photos.some(function (p) { return p.zone; });
    if (!zoned) return groupsHTML(photos);
    var order = ZONES.map(function (z) { return z.id; });
    photos.forEach(function (p) { if (order.indexOf(p.zone) < 0) order.push(p.zone); });
    return order.map(function (id) {
      var items = photos.filter(function (p) { return p.zone === id; });
      if (!items.length) return '';
      var z = ZONES.filter(function (x) { return x.id === id; })[0] || { title: id || 'Інше' };
      return '<div class="zone-block"><h3 class="zone-title">' + esc(z.title) + ' <span class="count">' + items.length + '</span></h3>' + groupsHTML(items) + '</div>';
    }).join('');
  }

  function groupsHTML(photos) {
    var favs = photos.filter(function (p) { return p.favorite; });
    var favHTML = favs.length ? '<div class="gallery-group gallery-group--fav"><h3><span class="fav-star" aria-hidden="true">★</span> Фаворити <span class="count">' + favs.length + '</span></h3>' +
      '<ul class="gallery">' + favs.map(function (p) { return figure(p, 'ref--' + p.group + ' ref--fav'); }).join('') + '</ul></div>' : '';
    return favHTML + GROUPS.map(function (g) {
      var items = photos.filter(function (p) { return p.group === g.key && !p.favorite; });
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
    var prevBtn = document.createElement('button'), nextBtn = document.createElement('button'), counter = document.createElement('div');
    prevBtn.type = nextBtn.type = 'button';
    prevBtn.className = 'lightbox-nav lightbox-prev'; prevBtn.setAttribute('aria-label', 'Попереднє фото'); prevBtn.textContent = '‹';
    nextBtn.className = 'lightbox-nav lightbox-next'; nextBtn.setAttribute('aria-label', 'Наступне фото'); nextBtn.textContent = '›';
    counter.className = 'lightbox-counter';
    dlg.appendChild(prevBtn); dlg.appendChild(nextBtn); dlg.appendChild(counter);

    var items = [], cur = 0, token = 0;
    // Нове фото, підпис і лічильник показуємо разом, лише коли фото вже завантажилось.
    function show(i) {
      if (!items.length) return;
      cur = (i + items.length) % items.length;
      var b = items[cur], src = b.getAttribute('data-src'), my = ++token;
      dlg.classList.add('is-loading');
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        if (my !== token) return;            // користувач уже перегорнув далі
        img.src = src;
        img.alt = cap.textContent = b.getAttribute('data-caption');
        counter.textContent = (cur + 1) + ' / ' + items.length;
        dlg.classList.remove('is-loading');
        preload(cur + 1); preload(cur - 1);
      };
      pre.src = src;
    }
    function preload(i) {
      if (!items.length) return;
      var b = items[(i + items.length) % items.length];
      new Image().src = b.getAttribute('data-src');
    }
    app.addEventListener('click', function (e) {
      var b = e.target.closest('.ref-open');
      if (!b) return;
      items = Array.prototype.slice.call(app.querySelectorAll('.ref-open'));
      show(items.indexOf(b));
      dlg.showModal();
    });
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); show(cur - 1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); show(cur + 1); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
    });
    // свайп на телефоні
    var x0 = null;
    dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
    });
    dlg.querySelector('.lightbox-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
})();
