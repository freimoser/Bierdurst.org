import { readdir, readFile } from 'node:fs/promises';
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

for (const [path, file] of expectedFiles) {
  if (!htmlFiles.includes(file)) errors.push(`Sitemap-URL ohne HTML: ${path}`);
}

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
  const descriptions = [...html.matchAll(/<meta name="description" content="([^"]+)"/g)];
  const h1s = [...html.matchAll(/<h1(?:\s|>)/g)];
  if (!title || descriptions.length !== 1 || !canonical || h1s.length !== 1) errors.push(`SEO-Grunddaten unvollständig in ${path}`);
  if (title?.includes('…')) errors.push(`Abgeschnittener Titel in ${path}: ${title}`);
  if (title && title.length > 60) errors.push(`Titel über 60 Zeichen in ${path}: ${title.length}`);
  if (title && (ogTitle !== title || twitterTitle !== title)) errors.push(`Social-Titel weicht in ${path} vom Seitentitel ab`);
  if (path !== '/404/' && canonical !== `https://bierdurst.org${path}`) errors.push(`Falscher Canonical in ${path}: ${canonical}`);
  if (/lorem ipsum/i.test(html)) errors.push(`Lorem Ipsum in ${path}`);
  if (/Werbefläche|derzeit deaktiviert|Für das MVP|Prüfrhythmus: (?:6|12|18) months|before and during each Oktoberfest season/i.test(html)) errors.push(`Sichtbarer Baustellen- oder englischer Redaktionstext in ${path}`);
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

if (allFiles.includes('dist/sitemap-full.xml') || allFiles.includes('dist/ads.txt.template')) errors.push('Roadmap- oder Template-Datei wurde versehentlich veröffentlicht.');
if (errors.length) {
  console.error(errors.slice(0, 80).join('\n'));
  process.exit(1);
}
console.log(`${htmlFiles.length} HTML-Dateien, ${sitemapPaths.size} Launch-URLs, interne Links, Titel und Canonicals erfolgreich geprüft.`);
