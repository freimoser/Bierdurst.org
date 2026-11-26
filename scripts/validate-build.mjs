import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}

const allFiles = await files('dist');
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapPaths = new Set([...sitemap.matchAll(/<loc>https:\/\/bierdurst\.org([^<]*)<\/loc>/g)].map((match) => match[1] || '/'));
const expectedFiles = new Map([...sitemapPaths].map((path) => [path, path === '/' ? 'dist/index.html' : `dist${path}index.html`]));
const errors = [];
const incoming = new Map([...sitemapPaths].map((path) => [path, 0]));

if (!allFiles.includes('dist/llms.txt')) errors.push('llms.txt fehlt im Build.');
if (!allFiles.includes('dist/rss.xml')) errors.push('rss.xml fehlt im Build.');
if (allFiles.includes('dist/llms.txt')) {
  const llms = await readFile('dist/llms.txt', 'utf8');
  for (const path of sitemapPaths) {
    if (!llms.includes(`https://bierdurst.org${path}`)) errors.push(`llms.txt enthält ${path} nicht.`);
  }
}
if (allFiles.includes('dist/og.png') && (await stat('dist/og.png')).size >= 200_000) errors.push('Standard-OG-Bild ist größer als 200 KB.');

for (const [path, file] of expectedFiles) {
  if (!htmlFiles.includes(file)) errors.push(`Sitemap-URL ohne HTML: ${path}`);
}

// Zuordnung aus scripts/generate-figures.mjs. Fehlt eine Grafik im HTML,
// ist der Rehype-Schritt in astro.config.mjs stillschweigend ausgefallen.
const figureIndex = JSON.parse(await readFile('data/page-figures.json', 'utf8'));
const figureSlugs = new Set(Object.keys(figureIndex));

const titles = new Map();
const canonicals = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const rel = relative('dist', file).split(sep).join('/');
  const path = rel === 'index.html' ? '/' : rel === '404.html' ? '/404/' : `/${rel.replace(/index\.html$/, '')}`;
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? '';
  const isNoIndex = /\bnoindex\b/i.test(robots);
  if (path !== '/404/' && !sitemapPaths.has(path) && !isNoIndex) errors.push(`Indexierbares HTML außerhalb der Launch-Sitemap: ${path}`);
  if (sitemapPaths.has(path) && isNoIndex) errors.push(`Noindex-URL in der Launch-Sitemap: ${path}`);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  const twitterTitle = html.match(/<meta name="twitter:title" content="([^"]+)"/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const descriptions = [...html.matchAll(/<meta name="description" content="([^"]+)"/g)];
  const h1s = [...html.matchAll(/<h1(?:\s|>)/g)];
  if (!title || descriptions.length !== 1 || !canonical || h1s.length !== 1) errors.push(`SEO-Grunddaten unvollständig in ${path}`);
  if (title?.includes('…')) errors.push(`Abgeschnittener Titel in ${path}: ${title}`);
  if (title && title.length > 60) errors.push(`Titel über 60 Zeichen in ${path}: ${title.length}`);
  if (title && (ogTitle !== title || twitterTitle !== title)) errors.push(`Social-Titel weicht in ${path} vom Seitentitel ab`);
  if (path !== '/404/' && canonical !== `https://bierdurst.org${path}`) errors.push(`Falscher Canonical in ${path}: ${canonical}`);
  if (sitemapPaths.has(path)) {
    const expectedOgImage = `https://bierdurst.org/og${path}index.png`;
    if (ogImage !== expectedOgImage) errors.push(`Falsches OG-Bild in ${path}: ${ogImage}`);
    if (!allFiles.includes(`dist/og${path}index.png`)) errors.push(`OG-Bild fehlt für ${path}`);
  }
  // Artikelgrafiken: Jedes <img> braucht einen tragfaehigen Alt-Text sowie
  // Breite und Hoehe, sonst springt das Layout beim Laden. Die Datei selbst
  // wird weiter unten ueber die allgemeine Dateipruefung erfasst.
  for (const tag of html.matchAll(/<img\b[^>]*>/g)) {
    const markup = tag[0];
    const src = markup.match(/\bsrc="([^"]*)"/)?.[1] ?? '(ohne src)';
    const alt = markup.match(/\balt="([^"]*)"/)?.[1];
    if (alt === undefined) errors.push(`Bild ohne alt-Attribut in ${path}: ${src}`);
    else if (alt.trim().length < 40) errors.push(`Zu knapper Alt-Text in ${path} (${alt.length} Zeichen): ${src}`);
    if (!/\bwidth="\d+"/.test(markup) || !/\bheight="\d+"/.test(markup)) errors.push(`Bild ohne width/height in ${path}: ${src}`);
    if (src.startsWith('/') && !allFiles.includes(`dist${src}`)) errors.push(`Bilddatei fehlt: ${src} (${path})`);
  }
  if (figureSlugs.has(path) && !html.includes('class="article-figure"')) errors.push(`Artikelgrafik fehlt im HTML von ${path}`);
  if (/lorem ipsum/i.test(html)) errors.push(`Lorem Ipsum in ${path}`);
  if (/Werbefläche|derzeit deaktiviert|Für das MVP|Prüfrhythmus: (?:6|12|18) months|before and during each Oktoberfest season/i.test(html)) errors.push(`Sichtbarer Baustellen- oder englischer Redaktionstext in ${path}`);
  const hasVisibleFaq = />Häufige Fragen<\/h2>/.test(html) || html.includes('class="stat-faq"');
  const hasFaqSchema = html.includes('"@type":"FAQPage"');
  if (hasVisibleFaq !== hasFaqSchema) errors.push(`FAQ-Inhalt und FAQPage-Schema stimmen in ${path} nicht überein.`);
  // WebApplication gehoert auf die Rechnerseite selbst. Ein Artikel darf den
  // Rechner einbetten, ohne die Anwendung ein zweites Mal zu deklarieren.
  if (path.startsWith('/bier-rechner/') && html.includes('data-calculator') && !html.includes('"@type":"WebApplication"')) errors.push(`WebApplication-Schema fehlt in ${path}.`);
  if (path !== '/404/') {
    if (titles.has(title)) errors.push(`Doppelter Titel: ${title}`); else titles.set(title, path);
    if (canonicals.has(canonical)) errors.push(`Doppelter Canonical: ${canonical}`); else canonicals.set(canonical, path);
  }
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const target = href.split('#')[0].split('?')[0];
    if (!target || target === '/') continue;
    if (target.includes('.')) {
      if (!allFiles.includes(`dist${target}`)) errors.push(`Fehlende Datei ${target} in ${path}`);
    } else if (!htmlFiles.includes(target === '/' ? 'dist/index.html' : `dist${target}index.html`)) {
      errors.push(`Interner Link ohne HTML-Ziel: ${path} → ${target}`);
    } else if (sitemapPaths.has(target) && target !== path) {
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }
}

for (const [path, count] of incoming) {
  if (path !== '/' && count === 0) errors.push(`Verwaiste Launch-Seite ohne internen Eingang: ${path}`);
}

// Jede erzeugte Grafik muss auch ausgeliefert werden.
for (const [slug, figure] of Object.entries(figureIndex)) {
  if (!allFiles.includes(`dist${figure.src}`)) errors.push(`Grafikdatei fehlt im Build: ${figure.src} (${slug})`);
}

if (allFiles.includes('dist/sitemap-full.xml') || allFiles.includes('dist/ads.txt.template')) errors.push('Roadmap- oder Template-Datei wurde versehentlich veröffentlicht.');

// macOS und iCloud legen beim Synchronisieren Kopien wie "index 2.html" an.
// Die landen sonst als doppelter Titel und doppelter Canonical in der Pruefung
// und erzeugen dort Dutzende Folgefehler, die die echte Ursache verdecken.
const strayCopies = allFiles.filter((file) => / \d+\.[a-z0-9]+$/i.test(file));
if (strayCopies.length) {
  errors.unshift(`${strayCopies.length} Dubletten-Dateien in dist/ (z. B. ${relative('dist', strayCopies[0]).split(sep).join('/')}). Vor dem Build entfernen: find dist -name "* [0-9].*" -delete`);
}
if (errors.length) {
  console.error(errors.slice(0, 80).join('\n'));
  process.exit(1);
}
console.log(`${htmlFiles.length} HTML-Dateien, ${sitemapPaths.size} Launch-URLs, interne Links, Titel und Canonicals erfolgreich geprüft.`);
