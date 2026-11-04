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
    var root = opts.root || '';
    var current = opts.current || null;
    var W = 1000, H = 620;
    var out = ['<svg class="plan-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Схема квартири: оберіть кімнату">'];
    out.push('<rect class="plan-outline" x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="6"/>');

    rooms.forEach(function (r) {
      if (!r.plan) return;
      var s = status(r.status);
      var p = r.plan;
      var small = p.h < 110 || p.w < 160;
      var nameLines = r.planLabel && r.planLabel.length ? r.planLabel : [r.name];
      var fsName = opts.compact ? (p.w < 130 ? 17 : small ? 26 : 40) : (small ? 18 : 26);
      var fsMeta = opts.compact ? (small ? 0 : 26) : (small ? 15 : 18);
      var lines = nameLines.map(function (t) { return { cls: 't-name', text: t, fs: fsName }; });
      if (fsMeta) {
        lines.push({ cls: 't-status', text: s.mark + ' ' + s.label, fs: fsMeta });
        if (!small && !opts.compact) lines.push({ cls: 't-area', text: areaText(r), fs: fsMeta - 2 });
      }
      var total = lines.reduce(function (sum, l) { return sum + l.fs * 1.3; }, 0);
      var cx = p.x + p.w / 2;
      var y = p.y + p.h / 2 - total / 2;

      var cls = 'plan-room status-' + s.cls + (current === r.slug ? ' is-current' : '') + (current && current !== r.slug ? ' is-dim' : '');
      out.push('<a class="' + cls + '" href="' + esc(roomHref(root, r)) + '" aria-label="' + esc(r.name + ' — статус: ' + s.label) + '"' +
        (current === r.slug ? ' aria-current="page"' : '') + '>');
      out.push('<title>' + esc(r.name + ' · ' + s.label + ' · ' + areaText(r)) + '</title>');
      out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="6"/>');
      lines.forEach(function (l) {
        y += l.fs * 1.3;
        out.push('<text class="' + l.cls + '" x="' + cx + '" y="' + (y - l.fs * 0.3) + '" text-anchor="middle" font-size="' + l.fs + '">' + esc(l.text) + '</text>');
      });
      out.push('</a>');
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
      site: b.site, rooms: b.rooms, palette: b.palette, taste: b.taste,
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
      fetchJSON(root + 'data/taste.json')
    ];
    if (roomSlug) jobs.push(fetchJSON(root + 'rooms/' + encodeURIComponent(roomSlug) + '/room.json').catch(function () { return null; }));
    return Promise.all(jobs).then(function (res) {
      d = d || { content: {}, photos: {}, renders: {} };
      d.site = res[0]; d.rooms = res[1].rooms; d.palette = res[2]; d.taste = res[3];
      if (roomSlug && res[4]) d.content[roomSlug] = res[4];
      d.source = 'json';
      return d;
    }, function (err) {
      if (d) return d;
      throw err;
    });
  }

  function loadError(target, root) {
    target.innerHTML = '<div class="error" role="alert"><strong>Не вдалося завантажити дані.</strong> ' +
      'Запустіть у папці проєкту <code>node build.mjs</code> і оновіть сторінку. ' +
      'Має зʼявитися файл <code>' + esc(root) + 'data/bundle.js</code>.</div>';
  }

  /* ---------- GitHub Issues ---------- */
  function githubRepo(site) {
    if (site && /^[\w.-]+\/[\w.-]+$/.test(site.githubRepo || '')) return site.githubRepo;
    var host = location.hostname;
    if (/\.github\.io$/i.test(host)) {
      var owner = host.split('.')[0];
      var seg = location.pathname.split('/').filter(Boolean)[0];
      if (seg && seg !== 'rooms' && !/\.html?$/i.test(seg)) return owner + '/' + seg;
      return owner + '/' + owner + '.github.io';
    }
    return null;
  }

  function issueURL(site, roomName, question) {
    var repo = githubRepo(site);
    if (!repo) return null;
    var title = '[' + roomName + '] ' + (question ? 'Питання: ' + question : 'Коментар');
    if (title.length > 200) title = title.slice(0, 197) + '…';
    var body = [
      '**Кімната:** ' + roomName,
      /^https?:$/.test(location.protocol) ? '**Сторінка:** ' + location.href.split('#')[0] : '',
      question ? '**Питання:** ' + question : '',
      '',
      '### Коментар',
      ''
    ].filter(function (l, i, a) { return l !== '' || i >= a.length - 3; }).join('\n');
    return 'https://github.com/' + repo + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }

  window.Guide = {
    STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, status: status, statusBadge: statusBadge,
    legendHTML: legendHTML, esc: esc, areaText: areaText, roomHref: roomHref, planSVG: planSVG,
    loadGuide: loadGuide, loadError: loadError, issueURL: issueURL, githubRepo: githubRepo
  };
})();
