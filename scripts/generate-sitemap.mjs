import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : (entry.name === 'index.md' ? [path] : []);
  }));
  return nested.flat();
}

function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return match?.[1].trim().replace(/^['"]|['"]$/g, '');
}

const W3C_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Frueheste moegliche Veroeffentlichung: Registrierung der Domain
// (whois: Creation Date 2026-08-23). Das Git-Erstdatum ist das Datum, an dem
// der Text geschrieben wurde -- teils Wochen davor. Als datePublished waere
// das nachweislich falsch, weil es die Seite da noch nicht gab.
const SITE_LAUNCH = '2026-08-23';

// Git kennt das echte Datum jeder Datei. Das Frontmatter-Feld `last_updated`
// wird redaktionell gepflegt und bleibt deshalb manchmal stehen; wir nehmen den
// spaeteren der beiden Werte, damit eine vergessene Pflege das Datum nicht
// faelschlich alt haelt.
//
// Wichtig: Der Deploy-Workflow braucht `fetch-depth: 0`. Mit einem flachen
// Klon kennt Git nur den letzten Commit und datiert jede Datei auf den
// Build-Tag -- schlechter als ein alter, aber ehrlicher Stempel.
function gitDate(file, which) {
  try {
    const format = which === 'first' ? '%cs' : '%cs';
    const args = which === 'first'
      ? ['log', '--diff-filter=A', '--follow', '-1', `--format=${format}`, '--', file]
      : ['log', '-1', `--format=${format}`, '--', file];
    const out = execFileSync('git', args, { encoding: 'utf8' }).trim();
    return W3C_DATE.test(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

const pages = [];
const pageDates = {};
const manifest = JSON.parse(await readFile('data/url-manifest.json', 'utf8'));
const launchSlugs = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
let gitAvailable = false;

for (const file of await markdownFiles('content')) {
  const source = await readFile(file, 'utf8');
  const frontmatter = source.split('---', 3)[1] ?? '';
  const slug = field(frontmatter, 'slug');
  if (!launchSlugs.has(slug) || field(frontmatter, 'index') !== 'true') continue;

  const declared = field(frontmatter, 'last_updated');
  const modified = gitDate(file, 'last');
  const created = gitDate(file, 'first');
  if (modified) gitAvailable = true;

  const candidates = [declared, modified].filter((date) => date && W3C_DATE.test(date));
  const lastmod = candidates.sort().at(-1);
  if (!lastmod) throw new Error(`Kein gueltiges lastmod fuer ${slug} (${file})`);
  if (!slug.endsWith('/')) throw new Error(`Slug ohne abschliessenden Schraegstrich: ${slug}`);

  pages.push({ slug, lastmod });
  // Veroeffentlichung = spaeteres von Autorendatum und Domain-Start, aber nie
  // nach der letzten Aenderung. Ohne Git-Datum bleibt das Feld leer, statt
  // eines zu raten.
  const published = created ? (created > SITE_LAUNCH ? created : SITE_LAUNCH) : undefined;
  pageDates[slug] = {
    modified: lastmod,
    ...(published && published <= lastmod ? { published } : {})
  };
}

pages.sort((a, b) => a.slug.localeCompare(b.slug, 'de'));
const rows = pages.map(({ slug, lastmod }) => `  <url>\n    <loc>https://bierdurst.org${slug === '/' ? '/' : slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
await writeFile('public/sitemap.xml', xml);
await writeFile('data/page-dates.json', `${JSON.stringify(pageDates, null, 2)}\n`);

const distinct = new Set(pages.map((page) => page.lastmod)).size;
console.log(`Launch-Sitemap mit ${pages.length} URLs erzeugt (${distinct} verschiedene lastmod-Werte).`);
if (!gitAvailable) {
  console.warn('WARNUNG: Keine Git-Daten lesbar. lastmod faellt auf das Frontmatter zurueck.');
}
