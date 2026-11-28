// Eine Wahrheit je Bierstil.
//
// Die Werte eines Stils standen an drei Stellen: in der Steckbrief-Tabelle der
// Sortenseite, in der Gegenueberstellung jeder Vergleichsseite und in
// data/beer-styles.json, aus der das Bierkompendium baut. Alle drei wurden
// unabhaengig gepflegt und liefen auseinander -- /biersorten/pils/ nannte
// 5 bis 8 Grad, /bierkompendium/pils/ nannte 6 bis 8.
//
// Jetzt gilt: data/beer-styles.json ist die eine Quelle. Das Feld "page"
// verbindet einen Stil mit seiner Sortenseite; diese Pruefung faellt durch,
// sobald die Tabelle dort etwas anderes sagt als die Datei.
//
// Welche Seite bei einem Widerspruch gewinnt, entschied, ob die zitierte
// Quelle das Feld ueberhaupt deckt:
//   Alkohol         -> Stilrichtlinie (BJCP, Brewers Association, Brauer-Bund)
//   Trinktemperatur -> veroeffentlichter Text; keine der Richtlinien nennt eine
//   Passendes Glas  -> veroeffentlichter Text, aus demselben Grund
//
// Aufruf: node scripts/check-style-truth.mjs

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { keyedTable, readBody } from './figures/content.mjs';

const NUMBERS = /\d+(?:[.,]\d+)?/g;

// Kleinster und groesster Wert der Zelle. So tragen auch Zellen mit zwei
// Spannen ("Pale Ale 4,5 bis 6 % vol, IPA 5,5 bis 7,5 % vol") die richtigen
// Eckwerte, und ein "von ... bis ..." mit Zwischentext ebenso.
function cellSpan(cell) {
  const list = (String(cell ?? '').match(NUMBERS) ?? []).map((t) => Number(t.replace(',', '.')));
  return list.length ? [Math.min(...list), Math.max(...list)] : null;
}
const union = (list) => [Math.min(...list.map((r) => r[0])), Math.max(...list.map((r) => r[1]))];
const fmt = (r) => (r ? r.join('–') : '—');

// Spalten der Vergleichsseiten. Ein Eintrag ist eine Liste von Stil-Slugs oder
// {page} fuer eine Dachseite wie Lagerbier, die keinen einzelnen Stil
// beschreibt -- dann gilt deren eigene Steckbrief-Tabelle als Massstab.
const SPALTEN = {
  'altbier-oder-pils': [['altbier'], ['pils']],
  'bockbier-oder-doppelbock': [['bockbier'], ['doppelbock']],
  'bockbier-oder-weizenbock': [['bockbier'], ['weizenbock']],
  'dunkelbier-oder-schwarzbier': [['dunkelbier'], ['schwarzbier']],
  'hefeweizen-oder-kristallweizen': [['weissbier'], ['kristallweizen']],
  'helles-oder-export': [['helles'], ['dortmunder-export']],
  'helles-oder-weizenbier': [['helles'], { page: 'weizenbier' }],
  'ipa-oder-pils': [['india-pale-ale', 'pale-ale'], ['pils']],
  'koelsch-oder-altbier': [['koelsch'], ['altbier']],
  'koelsch-oder-pils': [['koelsch'], ['pils']],
  'lager-oder-helles': [{ page: 'lagerbier' }, ['helles']],
  'maerzen-oder-festbier': [['maerzen'], ['festbier']],
  'pils-oder-export': [['pils'], ['dortmunder-export']],
  'pils-oder-helles': [['pils'], ['helles']],
  'pils-oder-lager': [['pils'], { page: 'lagerbier' }],
  'porter-oder-stout': [['porter'], ['stout']]
};

const styles = JSON.parse(readFileSync('data/beer-styles.json', 'utf8'));
const bySlug = Object.fromEntries(styles.map((s) => [s.slug, s]));
const problems = [];
const pages = {};
for (const style of styles) {
  if (!style.page) continue;
  (pages[style.page] ??= []).push(style);
}

for (const [page, group] of Object.entries(pages)) {
  const file = `content/biersorten/${page}/index.md`;
  if (!existsSync(file)) {
    problems.push(`${group.map((s) => s.slug).join(', ')}: "page" zeigt auf ${file}, die es nicht gibt`);
    continue;
  }
  const table = keyedTable(readBody(file));
  const checks = [
    ['Alkohol', cellSpan(table['Alkohol']), union(group.map((s) => s.alcohol))],
    ['Trinktemperatur', cellSpan(table['Trinktemperatur']), union(group.map((s) => s.temperature))]
  ];
  for (const [field, md, json] of checks) {
    if (!md) { problems.push(`${page}: Tabellenzeile "${field}" fehlt oder nennt keine Zahl`); continue; }
    if (md[0] !== json[0] || md[1] !== json[1]) {
      problems.push(`${page}: ${field} — Tabelle sagt ${fmt(md)}, beer-styles.json sagt ${fmt(json)} (${group.map((s) => s.slug).join(' + ')})`);
    }
  }
}

// Die Gegenueberstellungen tragen dieselben Werte ein drittes Mal. Sie muessen
// zur selben Quelle passen wie die Sortenseite.
for (const [page, columns] of Object.entries(SPALTEN)) {
  const file = `content/biervergleich/${page}/index.md`;
  if (!existsSync(file)) { problems.push(`${page}: Vergleichsseite fehlt, steht aber in SPALTEN`); continue; }
  const raw = readFileSync(file, 'utf8');
  for (const field of ['Alkohol', 'Trinktemperatur']) {
    const row = raw.match(new RegExp(`^\\| ${field} \\| (.*?) \\| (.*?) \\|$`, 'm'));
    if (!row) continue;
    columns.forEach((spec, index) => {
      const md = cellSpan(row[index + 1]);
      let soll;
      if (Array.isArray(spec)) {
        soll = union(spec.map((slug) => (field === 'Alkohol' ? bySlug[slug].alcohol : bySlug[slug].temperature)));
      } else {
        soll = cellSpan(keyedTable(readBody(`content/biersorten/${spec.page}/index.md`))[field]);
      }
      if (!md || !soll) return;
      if (md[0] !== soll[0] || md[1] !== soll[1]) {
        const quelle = Array.isArray(spec) ? spec.join(' + ') : `Dachseite ${spec.page}`;
        problems.push(`${page}, Spalte ${index + 1}: ${field} — Tabelle sagt ${fmt(md)}, ${quelle} sagt ${fmt(soll)}`);
      }
    });
  }
}

// Vorspann und FAQ wiederholen die Alkoholspanne im Fliesstext. Lief die
// Tabelle der Quelle nach und der Satz darueber nicht mit, widersprach die
// Seite sich selbst -- auf /biersorten/pils/ stand im Vorspann 4,5 und in der
// Tabelle zwei Zeilen tiefer 4,4. Geprueft wird hier nur, ob eine Spanne im
// Text ausserhalb der Tabellenspanne liegt; engere Angaben im Text sind in
// Ordnung, sie konkretisieren.
const PROSA = /(\d+(?:,\d+)?)\s*(?:bis|–)\s*(\d+(?:,\d+)?)\s*(?:%|Prozent)/g;
for (const dir of ['content/biersorten', 'content/biervergleich']) {
  for (const entry of readdirSync(dir)) {
    const file = `${dir}/${entry}/index.md`;
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    const row = raw.match(/^\| Alkohol \|([^\n]*)\|$/m);
    if (!row) continue;
    const tabelle = cellSpan(row[1]);
    if (!tabelle) continue;
    const prosa = raw.split('\n').filter((zeile) => !zeile.startsWith('|')).join('\n');
    for (const hit of prosa.matchAll(PROSA)) {
      const von = Number(hit[1].replace(',', '.'));
      const bis = Number(hit[2].replace(',', '.'));
      // Ueber 15 % ist keine Alkoholangabe mehr, sondern Stammwuerze o. ae.
      if (bis > 15) continue;
      if (von >= tabelle[0] && bis <= tabelle[1]) continue;
      problems.push(`${entry}: Fliesstext nennt ${hit[1]}–${hit[2]} %, die Tabelle derselben Seite ${fmt(tabelle)}`);
    }
  }
}

// Ein Stil darf nur an einer Sortenseite haengen, sonst gaebe es wieder zwei
// Stellen, die ihn beschreiben.
const claimed = {};
for (const style of styles) {
  if (!style.page) continue;
  if (claimed[style.slug]) problems.push(`${style.slug}: von "${claimed[style.slug]}" und "${style.page}" beansprucht`);
  claimed[style.slug] = style.page;
}

// Dachseiten beschreiben keinen einzelnen Stil, sondern eine Gruppe. Sie sind
// hier aufgezaehlt, damit eine Sortenseite nicht aus Versehen ungeprueft
// bleibt: Jede neue Seite ohne Stil faellt auf.
const DACHSEITEN = new Set(['lagerbier', 'weizenbier', 'radler-biermischgetraenke']);
for (const dir of readdirSync('content/biersorten')) {
  if (!existsSync(`content/biersorten/${dir}/index.md`)) continue;
  if (pages[dir] || DACHSEITEN.has(dir)) continue;
  problems.push(`${dir}: keine Sortenseite eines Stils und nicht als Dachseite eingetragen — die Werte dort pruefst du niemand`);
}

const ohne = styles.filter((s) => !s.page).map((s) => s.slug);
if (problems.length) {
  console.error(`${problems.length} Abweichung(en) zwischen Sortenseite und beer-styles.json:`);
  problems.forEach((row) => console.error(`  ${row}`));
  process.exit(1);
}
console.log(`${Object.keys(pages).length} Sortenseiten und ${Object.keys(SPALTEN).length} Vergleichsseiten gegen beer-styles.json geprueft: Alkohol und Trinktemperatur stimmen ueberein.`);
console.log(`${ohne.length} Stile ohne eigene Sortenseite (nur im Bierkompendium): ${ohne.join(', ')}`);
console.log(`${DACHSEITEN.size} Dachseiten ohne einzelnen Stil: ${[...DACHSEITEN].join(', ')}`);
