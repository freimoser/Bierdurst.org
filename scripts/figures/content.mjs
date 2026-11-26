// Liest die Werte fuer die Grafiken aus den Seiten selbst.
// Grundsatz: Die Grafik darf nur zeigen, was im Text der Seite steht. Sonst
// widerspricht das Bild der Tabelle darunter.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function readBody(file) {
  const source = readFileSync(file, 'utf8');
  return source.split(/^---\s*$/m).slice(2).join('---');
}

export function readFrontmatter(file) {
  const source = readFileSync(file, 'utf8');
  const block = source.split(/^---\s*$/m)[1] ?? '';
  const out = {};
  for (const row of block.split('\n')) {
    const match = row.match(/^([a-z_]+):\s*(.+)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

// Alle Markdown-Tabellen einer Seite als Zellmatrix.
export function tables(markdown) {
  const found = [];
  let current = null;
  for (const row of markdown.split('\n')) {
    const match = row.match(/^\|(.+)\|\s*$/);
    if (!match) { if (current) { found.push(current); current = null; } continue; }
    const cells = match[1].split('|').map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (!current) current = [];
    current.push(cells);
  }
  if (current) found.push(current);
  return found;
}

// Steckbrief-Tabelle: erste Spalte Merkmal, zweite Spalte Wert.
export function keyedTable(markdown, index = 0) {
  const table = tables(markdown)[index];
  if (!table) return {};
  const out = {};
  for (const row of table.slice(1)) if (row.length >= 2) out[row[0]] = row[1];
  return out;
}

const NUM = '(\\d+(?:[.,]\\d+)?)';

function num(value) {
  return Number(String(value).replace(',', '.'));
}

// "meist etwa 4,7 bis 5,4 % vol" -> [4.7, 5.4]; "etwa 7 °C" -> [7, 7]
export function range(value) {
  if (!value) return null;
  const span = String(value).match(new RegExp(`${NUM}\\s*(?:bis|–|—|-)\\s*${NUM}`));
  if (span) return [num(span[1]), num(span[2])];
  const single = String(value).match(new RegExp(NUM));
  return single ? [num(single[1]), num(single[1])] : null;
}

// Bitterkeit steht auf den Seiten in Worten. Die Grafik zeigt sie als Spanne
// auf einer Skala von 0 bis 5, nicht als erfundene IBU-Zahl.
const BITTER_WORDS = [
  [/sehr niedrig|sehr mild/i, 0.6],
  [/zurückhaltend|dezent/i, 2.0],
  [/niedrig/i, 1.5],
  [/mild/i, 1.9],
  [/ausgewogen|fein/i, 3.0],
  [/moderat/i, 3.0],
  [/hopfenherb|herb/i, 4.3],
  [/deutlich/i, 4.0],
  [/kräftig|stark/i, 4.8]
];

export function bitterness(value) {
  if (!value || /abhängig|je nach|variabel/i.test(value)) return null;
  const hits = [];
  for (const part of String(value).split(/\s+bis\s+|\s*,\s*|\s+und\s+|\s+oder\s+/i)) {
    for (const [pattern, score] of BITTER_WORDS) {
      if (pattern.test(part)) { hits.push(score); break; }
    }
  }
  if (!hits.length) return null;
  return [Math.min(...hits), Math.max(...hits)];
}

export function fermentation(classification = '') {
  if (/untergärig/i.test(classification)) return 'untergärig';
  if (/obergärig/i.test(classification)) return 'obergärig';
  return null;
}

export function publishedSlugs() {
  const manifest = JSON.parse(readFileSync('data/url-manifest.json', 'utf8'));
  return new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
}

export function pageFile(slug) {
  const file = join('content', slug.replace(/^\/|\/$/g, ''), 'index.md');
  return existsSync(file) ? file : null;
}

export function listCluster(cluster) {
  const base = join('content', cluster);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// Aus "Was ist Pils?" wird "Pils", aus "Was sind Kellerbier und Zwickelbier?"
// wird "Kellerbier und Zwickelbier". Ohne das steht "Was sind ..." mitten im
// Grafiktitel.
function styleName(title) {
  const stripped = title
    .replace(/^Was (ist|sind)\s+(ein |eine |das |der |die )?/i, '')
    .replace(/\?$/, '')
    .split(' oder ')[0]
    .trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

// Steckbrief einer Biersorten-Seite, vollstaendig aus deren eigener Tabelle.
export function styleProfile(slug) {
  const file = pageFile(slug);
  if (!file) return null;
  const markdown = readBody(file);
  const row = keyedTable(markdown);
  const front = readFrontmatter(file);
  const classification = row['Einordnung'] ?? '';
  return {
    slug,
    title: front.title ?? '',
    name: styleName(front.title ?? ''),
    classification,
    colorWords: row['Farbe'] ?? '',
    alcoholText: row['Alkohol'] ?? '',
    alcohol: range(row['Alkohol']),
    bitternessText: row['Bitterkeit'] ?? '',
    bitterness: bitterness(row['Bitterkeit']),
    temperatureText: row['Trinktemperatur'] ?? '',
    temperature: range(row['Trinktemperatur']),
    glass: row['Passendes Glas'] ?? '',
    region: row['Region'] ?? '',
    fermentation: fermentation(classification)
  };
}

// Vergleichstabelle einer Biervergleich-Seite: drei Spalten, zwei Kandidaten.
export function duelProfile(slug) {
  const file = pageFile(slug);
  if (!file) return null;
  const markdown = readBody(file);
  const table = tables(markdown)[0];
  if (!table || table[0].length < 3) return null;
  const front = readFrontmatter(file);
  const head = table[0];
  const row = {};
  for (const cells of table.slice(1)) if (cells.length >= 3) row[cells[0]] = [cells[1], cells[2]];
  const side = (index) => ({
    name: head[index + 1],
    classification: row['Einordnung']?.[index] ?? '',
    colorWords: row['Farbe']?.[index] ?? '',
    alcoholText: row['Alkohol']?.[index] ?? '',
    alcohol: range(row['Alkohol']?.[index]),
    bitternessText: row['Bitterkeit']?.[index] ?? '',
    bitterness: bitterness(row['Bitterkeit']?.[index]),
    temperatureText: row['Trinktemperatur']?.[index] ?? '',
    temperature: range(row['Trinktemperatur']?.[index]),
    region: row['Typische Region']?.[index] ?? '',
    fermentation: fermentation(row['Einordnung']?.[index] ?? '')
  });
  return { slug, title: front.title ?? '', left: side(0), right: side(1) };
}
