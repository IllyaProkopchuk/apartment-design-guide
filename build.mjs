#!/usr/bin/env node
// Збірка гіда. Без залежностей, потрібен лише Node.js 18+.
//   node build.mjs
// Що робить:
//   1. Читає data/*.json і перевіряє статуси та slug-и.
//   2. Для кожної кімнати створює rooms/<slug>/ (photos/, renders/, room.json, якщо їх немає)
//      і генерує rooms/<slug>/index.html з templates/room.html.
//   3. Сканує rooms/<slug>/photos/ і rooms/<slug>/renders/: підпис = назва файлу без розширення,
//      «(подобається)» / «(не подобається)» дають мітки й групу.
//   4. Записує все в data/bundle.js (потрібен, щоб сайт відкривався з диска без сервера).

import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATUSES = ['ідея', 'вибираємо', 'затверджено'];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg']);
const MARK = /\(\s*(не\s+)?подобається\s*\)/giu;

const warnings = [];
const warn = (m) => warnings.push(m);

const exists = (p) => access(p).then(() => true, () => false);
const readJSON = async (rel) => {
  try {
    return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    throw new Error(`Не вдалося прочитати ${rel}: ${e.message}`);
  }
};
const escHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EMPTY_ROOM = {
  style: { directions: [], mood: '' },
  palette: [],
  materials: { floor: '', walls: '', ceiling: '' },
  furniture: [],
  lighting: [],
  questions: [],
  decision: { summary: '', date: '' }
};

// Назви файлів — вільний текст («гарно, але мало акценту»). Ділимо підпис на частини
// (по комах і перед «але», «крім», «окрім») і визначаємо тон кожної частини за словами-маркерами.
// Частина без маркерів успадковує тон попередньої: «подобається плитка, дзеркала» → обидві «плюс».
const NOT_LETTER_BEFORE = '(?<!\\p{L})';
const NOT_LETTER_AFTER = '(?!\\p{L})';
const NEGATIVE = new RegExp([
  'не\\s+подоба', 'не\\s+дуже', 'не\\s+хоч', 'забагато', 'надто',
  `${NOT_LETTER_BEFORE}мало${NOT_LETTER_AFTER}`, 'відсутн', `${NOT_LETTER_BEFORE}о?крім${NOT_LETTER_AFTER}`
].join('|'), 'iu');
const POSITIVE = new RegExp([
  'подоба[єе]', 'гарн', `${NOT_LETTER_BEFORE}все${NOT_LETTER_AFTER}`, 'особливо'
].join('|'), 'iu');

function clauseTone(text) {
  if (MARK.test(text)) { MARK.lastIndex = 0; return /\(\s*не\s/iu.test(text) ? 'dislike' : 'like'; }
  MARK.lastIndex = 0;
  if (NEGATIVE.test(text)) return 'dislike';
  if (POSITIVE.test(text)) return 'like';
  return null;
}

export function parseCaption(fileName) {
  const caption = path.parse(fileName).name.normalize('NFC').replace(/\s+/g, ' ').trim();
  const clauses = caption
    .split(/(?<=,)\s*|\s+(?=(?:але|о?крім)\s)/iu)
    .map((s) => s.trim())
    .filter(Boolean);
  const segments = [];
  let prev = 'neutral';
  for (const text of clauses) {
    const tone = clauseTone(text) || prev;
    segments.push({ text, tone });
    prev = tone;
  }
  if (!segments.length) segments.push({ text: caption, tone: 'neutral' });

  // Короткі фрази для підпису: спершу плюси, потім мінуси, без службових слів.
  const tidy = (t) => t
    .replace(MARK, '').replace(/^(але|а|і)\s+/iu, '').replace(/^(не\s+)?подоба[єе]ть?с?я\s*:?\s*/iu, '')
    .replace(/^о?крім\s+/iu, '').replace(/[\s,;:]+$/u, '').trim();
  const likes = segments.filter((s) => s.tone === 'like').map((s) => tidy(s.text)).filter(Boolean);
  const dislikes = segments.filter((s) => s.tone === 'dislike').map((s) => tidy(s.text)).filter(Boolean);
  const like = segments.some((s) => s.tone === 'like');
  const dislike = segments.some((s) => s.tone === 'dislike');
  const group = like && dislike ? 'mixed' : like ? 'like' : dislike ? 'dislike' : 'neutral';
  return { caption, segments, group, likes, dislikes };
}

async function scanImages(slug, sub) {
  const dir = path.join(ROOT, 'rooms', slug, sub);
  if (!(await exists(dir))) return [];
  // Файли прямо в папці + підпапки-зони (наприклад photos/kukhnia, photos/vitalnia).
  const entries = (await readdir(dir, { withFileTypes: true })).filter((f) => !f.name.startsWith('.'));
  const files = entries.filter((f) => f.isFile()).map((f) => ({ name: f.name, zone: null }));
  for (const d of entries.filter((f) => f.isDirectory())) {
    for (const f of await readdir(path.join(dir, d.name), { withFileTypes: true })) {
      if (f.isFile() && !f.name.startsWith('.')) files.push({ name: f.name, zone: d.name });
    }
  }
  const out = [];
  for (const { name, zone } of files) {
    const rel = zone ? `${zone}/${name}` : name;
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      warn(`rooms/${slug}/${sub}/${rel}: не зображення, пропущено`);
      continue;
    }
    const src = `rooms/${slug}/${sub}/` + (zone ? encodeURIComponent(zone) + '/' : '') + encodeURIComponent(name);
    out.push({ file: name, path: rel, zone, src, ...parseCaption(name) });
  }
  return out.sort((a, b) => a.caption.localeCompare(b.caption, 'uk'));
}

// Ручні правки з room.json → "photoOverrides": { "файл.jpg": { "like": "що подобається", "dislike": "що ні", "with": "інше-фото.jpg", "caption": "новий підпис", "favorite": true, "tone": "like|dislike|neutral", "note": "..." } }
// Для підписів на кшталт «те саме», з яких тон не зрозумілий.
function applyOverrides(list, overrides, slug) {
  if (!overrides) return list;
  const byName = new Map(list.map((p) => [p.file.normalize('NFC'), p]));
  for (const [name, o] of Object.entries(overrides)) {
    const p = byName.get(name.normalize('NFC'));
    if (!p) { warn(`rooms/${slug}/room.json: photoOverrides → файл «${name}» не знайдено в photos/`); continue; }
    if (o.caption) {
      const parsed = parseCaption(o.caption + path.extname(p.file));
      p.caption = parsed.caption; p.segments = parsed.segments; p.group = parsed.group;
    }
    if (o.like !== undefined || o.dislike !== undefined) {
      p.likes = o.like ? [o.like] : [];
      p.dislikes = o.dislike ? [o.dislike] : [];
      p.group = p.likes.length && p.dislikes.length ? 'mixed' : p.likes.length ? 'like' : p.dislikes.length ? 'dislike' : 'neutral';
    }
    if (o.tone) {
      if (!['like', 'dislike', 'neutral'].includes(o.tone)) { warn(`photoOverrides «${name}»: tone має бути like, dislike або neutral`); continue; }
      p.segments = p.segments.map((s) => (s.tone === 'neutral' ? { ...s, tone: o.tone } : s));
      p.group = o.tone === 'neutral' ? 'neutral' : o.tone;
    }
    if (o.note) p.note = o.note;
    if (o.favorite) p.favorite = true;
  }
  // "with": "інше-фото.jpg" — показати це фото в одній картці з іншим (той самий проєкт, інший ракурс).
  const merged = new Set();
  for (const [name, o] of Object.entries(overrides)) {
    if (!o.with) continue;
    const p = byName.get(name.normalize('NFC'));
    const target = byName.get(String(o.with).normalize('NFC'));
    if (!p || !target) { warn(`rooms/${slug}/room.json: photoOverrides «${name}» → with: файл «${o.with}» не знайдено`); continue; }
    (target.more = target.more || []).push({ file: p.file, path: p.path, src: p.src });
    merged.add(p);
  }
  return list.filter((p) => !merged.has(p));
}

async function main() {
  const site = await readJSON('data/site.json');
  const { rooms } = await readJSON('data/rooms.json');
  const palette = await readJSON('data/palette.json');
  const taste = await readJSON('data/taste.json');
  const about = await readJSON('data/about.json');
  const template = await readFile(path.join(ROOT, 'templates/room.html'), 'utf8');

  const seen = new Set();
  for (const r of rooms) {
    if (!r.slug || !/^[a-z0-9-]+$/.test(r.slug)) throw new Error(`Кімната «${r.name}»: slug має бути латиницею (a-z, 0-9, -), зараз «${r.slug}»`);
    if (seen.has(r.slug)) throw new Error(`Slug «${r.slug}» повторюється в data/rooms.json`);
    seen.add(r.slug);
    if (!STATUSES.includes(String(r.status).trim().toLowerCase())) warn(`${r.name}: невідомий статус «${r.status}». Допустимі: ${STATUSES.join(', ')}`);
  }
  if (palette.status && !STATUSES.includes(palette.status)) warn(`data/palette.json: невідомий статус «${palette.status}»`);

  const content = {}, photos = {}, renders = {};
  for (const r of rooms) {
    const dir = path.join(ROOT, 'rooms', r.slug);
    for (const sub of ['photos', 'renders']) {
      await mkdir(path.join(dir, sub), { recursive: true });
      const keep = path.join(dir, sub, '.gitkeep');
      if (!(await exists(keep))) await writeFile(keep, '');
    }
    const roomJSON = path.join(dir, 'room.json');
    if (!(await exists(roomJSON))) await writeFile(roomJSON, JSON.stringify(EMPTY_ROOM, null, 2) + '\n');
    try {
      content[r.slug] = JSON.parse(await readFile(roomJSON, 'utf8'));
    } catch (e) {
      throw new Error(`rooms/${r.slug}/room.json: помилка JSON — ${e.message}`);
    }

    const html = template.replaceAll('{{SLUG}}', escHTML(r.slug)).replaceAll('{{NAME}}', escHTML(r.name));
    await writeFile(path.join(dir, 'index.html'), html);

    photos[r.slug] = applyOverrides(await scanImages(r.slug, 'photos'), content[r.slug].photoOverrides, r.slug);
    renders[r.slug] = await scanImages(r.slug, 'renders');
  }

  // Папки кімнат, яких немає в rooms.json
  if (await exists(path.join(ROOT, 'rooms'))) {
    for (const d of await readdir(path.join(ROOT, 'rooms'), { withFileTypes: true })) {
      if (d.isDirectory() && !seen.has(d.name)) warn(`rooms/${d.name}/ немає в data/rooms.json — сторінка не показується`);
    }
  }

  const bundle = { generatedAt: new Date().toISOString(), site, rooms, palette, taste, about, content, photos, renders };
  await writeFile(
    path.join(ROOT, 'data/bundle.js'),
    '// Згенеровано build.mjs — не редагуйте вручну. Джерело: data/*.json і rooms/*/\n' +
      'window.GUIDE_DATA = ' + JSON.stringify(bundle, null, 1) + ';\n'
  );

  console.log('Готово. Кімнати:');
  for (const r of rooms) {
    const p = photos[r.slug];
    const n = (g) => p.filter((x) => x.group === g).length;
    console.log(`  ${r.name.padEnd(20)} ${String(r.status).padEnd(12)} фото: ${p.length} (👍 ${n('like')} / 👎 ${n('dislike')} / ± ${n('mixed')} / нейтр. ${n('neutral')}), рендери: ${renders[r.slug].length}`);
  }
  if (warnings.length) {
    console.log('\nПопередження:');
    for (const w of warnings) console.log('  • ' + w);
  }
}

main().catch((e) => {
  console.error('Помилка: ' + e.message);
  process.exit(1);
});
