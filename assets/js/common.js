/* Спільний код для головної та сторінок кімнат. Без залежностей. */
(function () {
  'use strict';

  var STATUS = {
    'ідея':        { cls: 'idea',     label: 'ідея',        mark: '○', step: 0, hint: 'збираємо думки й референси' },
    'вибираємо':   { cls: 'choosing', label: 'вибираємо',   mark: '◆', step: 1, hint: 'порівнюємо варіанти' },
    'затверджено': { cls: 'approved', label: 'затверджено', mark: '●', step: 2, hint: 'рішення прийнято' }
  };
  var STATUS_ORDER = ['ідея', 'вибираємо', 'затверджено'];

  function status(value) {
    var key = String(value || '').trim().toLowerCase();
    return STATUS[key] || { cls: 'unknown', label: value || 'без статусу', mark: '?', step: -1, hint: 'невідомий статус — перевірте data/rooms.json' };
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusBadge(value) {
    var s = status(value);
    return '<span class="status status-' + s.cls + '" title="' + esc(s.hint) + '">' +
      '<span aria-hidden="true">' + s.mark + '</span> ' + esc(s.label) + '</span>';
  }

  function legendHTML() {
    return '<ul class="legend" aria-label="Статуси кімнат">' + STATUS_ORDER.map(function (k) {
      return '<li>' + statusBadge(k) + '<span>' + esc(STATUS[k].hint) + '</span></li>';
    }).join('') + '</ul>';
  }

  function areaText(room) {
    if (typeof room.area === 'number' && isFinite(room.area)) {
      return '~' + String(room.area).replace('.', ',') + ' м²';
    }
    return '~ уточнити';
  }

  function roomHref(root, room) {
    // Явний index.html: інакше при відкритті з диска браузер покаже список файлів.
    return root + 'rooms/' + encodeURIComponent(room.slug) + '/index.html';
  }

  /* ---------- схема плану ---------- */
  function planSVG(rooms, opts) {
    opts = opts || {};
    // Справжнє креслення (site.planImage) + клікабельні зони кімнат (rooms[].plan — масив полігонів
    // у пікселях креслення). opts.compact — міні-план без підписів, з підсвіченою поточною кімнатою.
    var root = opts.root || '';
    var current = opts.current || null;
    var img = opts.image;
    if (!img) return '<p class="empty">Креслення не налаштоване (site.json → planImage).</p>';
    var W = img.width, H = img.height;
    var out = ['<svg class="plan-svg' + (opts.compact ? ' is-compact' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="План квартири: оберіть кімнату">'];
    out.push('<image href="' + esc(root + img.src) + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid meet"/>');

    var labels = [];
    var ZONES = ['#B5583A', '#7E8C6A', '#7F98AE', '#8C3B3F', '#B08D57', '#5A3E2B', '#A4687A'];
    rooms.forEach(function (r, idx) {
      if (!r.plan || !r.plan.length) return;
      var s = status(r.status);
      var cls = 'plan-room status-' + s.cls + (current === r.slug ? ' is-current' : '') + (current && current !== r.slug ? ' is-dim' : '');
      out.push('<a class="' + cls + '" style="--zone:' + ZONES[idx % ZONES.length] + '" href="' + esc(roomHref(root, r)) + '" aria-label="' + esc(r.name) + '"' +
        (current === r.slug ? ' aria-current="page"' : '') + '>');
      out.push('<title>' + esc(r.name) + '</title>');
      r.plan.forEach(function (poly) {
        out.push('<polygon points="' + poly.map(function (p) { return p.join(','); }).join(' ') + '"/>');
      });
      out.push('</a>');
      if (!opts.compact && r.label) labels.push({ r: r, s: s, c: ZONES[idx % ZONES.length] });
    });

    // Підписи окремим шаром поверх зон, щоб не перекривалися сусідніми полігонами.
    labels.forEach(function (l) {
      var x = l.r.label[0], y = l.r.label[1];
      var name = l.r.name;
      var fs = 19, w = name.length * fs * 0.56 + 24, h = fs * 1.9;
      out.push('<a class="plan-label status-' + l.s.cls + '" style="--zone:' + l.c + '" href="' + esc(roomHref(root, l.r)) + '" tabindex="-1" aria-hidden="true">' +
        '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="10"/>' +
        '<text class="t-name" x="' + x + '" y="' + (y + fs * 0.35) + '" text-anchor="middle" font-size="' + fs + '">' + esc(name) + '</text></a>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- дані ---------- */
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  /**
   * Джерело правди — JSON у data/ та rooms/<slug>/room.json.
   * Через http(s) (GitHub Pages, локальний сервер) читаємо JSON напряму, тож зміна статусу
   * в data/rooms.json видна одразу. При відкритті з диска (file://) браузер не дає читати JSON,
   * тому використовуємо data/bundle.js, який генерує build.mjs. Фото й рендери — завжди з bundle.js.
   */
  function loadGuide(root, roomSlug) {
    var b = window.GUIDE_DATA || null;
    var d = b ? {
      site: b.site, rooms: b.rooms, palette: b.palette, taste: b.taste, about: b.about,
      content: b.content || {}, photos: b.photos || {}, renders: b.renders || {},
      generatedAt: b.generatedAt, source: 'bundle'
    } : null;

    if (!/^https?:$/.test(location.protocol)) {
      return d ? Promise.resolve(d) : Promise.reject(new Error('no-bundle'));
    }
    var jobs = [
      fetchJSON(root + 'data/site.json'),
      fetchJSON(root + 'data/rooms.json'),
      fetchJSON(root + 'data/palette.json'),
      fetchJSON(root + 'data/taste.json'),
      fetchJSON(root + 'data/about.json').catch(function () { return null; })
    ];
    if (roomSlug) jobs.push(fetchJSON(root + 'rooms/' + encodeURIComponent(roomSlug) + '/room.json').catch(function () { return null; }));
    return Promise.all(jobs).then(function (res) {
      d = d || { content: {}, photos: {}, renders: {} };
      d.site = res[0]; d.rooms = res[1].rooms; d.palette = res[2]; d.taste = res[3];
      if (res[4]) d.about = res[4];
      if (roomSlug && res[5]) d.content[roomSlug] = res[5];
      d.source = 'json';
      return d;
    }, function (err) {
      if (d) return d;
      throw err;
    });
  }

  /* ---------- лоадер «зараз, зараз» ---------- */
  var loaderStart = (window.performance && performance.now) ? performance.now() : Date.now();
  var LOADER_MIN_MS = 900;
  function hideLoader() {
    var el = document.getElementById('loader');
    if (!el || el.classList.contains('is-done')) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    setTimeout(function () {
      el.classList.add('is-done');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }, Math.max(0, LOADER_MIN_MS - (now - loaderStart)));
  }
  // Запобіжник: лоадер не висить довше 5 секунд, навіть якщо щось пішло не так.
  setTimeout(hideLoader, 5000);

  function loadError(target, root) {
    hideLoader();
    target.innerHTML = '<div class="error" role="alert"><strong>Не вдалося завантажити дані.</strong> ' +
      'Запустіть у папці проєкту <code>node build.mjs</code> і оновіть сторінку. ' +
      'Має зʼявитися файл <code>' + esc(root) + 'data/bundle.js</code>.</div>';
  }

  window.Guide = {
    STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, status: status, statusBadge: statusBadge,
    legendHTML: legendHTML, esc: esc, areaText: areaText, roomHref: roomHref, planSVG: planSVG,
    loadGuide: loadGuide, loadError: loadError, hideLoader: hideLoader
  };
})();
