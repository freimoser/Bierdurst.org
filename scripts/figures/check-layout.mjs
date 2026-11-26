// Prueft, ob in einer Grafik Text aus der Zeichenflaeche laeuft oder sich
// Zeilen ueberdecken.
//
// Anlass: Beim Umbau von 1400 auf 820 Einheiten aendert sich jede Spalten-
// breite. Ein Name, der vorher passte, ragt jetzt vielleicht ueber den Rand --
// und das faellt beim Durchblaettern von 69 Bildern nicht zuverlaessig auf.
// Gemessen wird gegen dieselbe Schaetzfunktion, die auch die Umbrueche setzt;
// scripts/figures/calibrate.mjs haelt sie an der echten Schrift nach.

import { catalogue } from './catalogue.mjs';
import { WIDTH, textWidth } from './svg.mjs';
import * as templates from './templates.mjs';

const TEXT = /<text ([^>]*)>([^<]*)<\/text>/g;
const attr = (source, name) => source.match(new RegExp(`${name}="([^"]*)"`))?.[1];

const problems = [];
const { figures } = catalogue();

for (const figure of figures) {
  const template = templates[figure.template];
  if (!template) continue;
  const { svg, height } = template(figure.props);
  // Die Wortmarke in der Fusszeile sitzt in einer verschobenen Gruppe; ihre
  // Koordinaten sind lokal und hier nicht vergleichbar.
  const flat = svg.replace(/<g transform="translate[^>]*>[\s\S]*?<\/g>/g, '');
  const lines = [];
  for (const [, attrs, content] of flat.matchAll(TEXT)) {
    if (!content.trim()) continue;
    const size = Number(attr(attrs, 'font-size'));
    const weight = Number(attr(attrs, 'font-weight')) || 400;
    const x = Number(attr(attrs, 'x'));
    const y = Number(attr(attrs, 'y'));
    const anchor = attr(attrs, 'text-anchor') ?? 'start';
    const spacing = Number(attr(attrs, 'letter-spacing')) || 0;
    const w = textWidth(content, size, weight) + content.length * spacing;
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    lines.push({ content, left, right: left + w, y, size });
  }
  for (const entry of lines) {
    // Zwei Einheiten Spiel: Die Breitenschaetzung ist bewusst grosszuegig.
    if (entry.left < -2) problems.push(`${figure.file}: "${entry.content}" ragt ${Math.round(-entry.left)} Einheiten ueber den linken Rand`);
    if (entry.right > WIDTH + 2) problems.push(`${figure.file}: "${entry.content}" ragt ${Math.round(entry.right - WIDTH)} Einheiten ueber den rechten Rand`);
    if (entry.y > height - 4) problems.push(`${figure.file}: "${entry.content}" steht unterhalb des Bildes`);
    if (entry.y - entry.size < -2) problems.push(`${figure.file}: "${entry.content}" steht oberhalb des Bildes`);
    // Auslassungspunkte kommen in diesem Bestand nur aus wrap(): Sie heissen,
    // dass der Text nicht in die vorgesehenen Zeilen passte.
    if (entry.content.endsWith('\u2026')) problems.push(`${figure.file}: "${entry.content}" ist abgeschnitten`);
  }
  // Ueberdeckung: zwei Zeilen auf nahezu gleicher Grundlinie, deren Kaesten
  // einander schneiden.
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.6) continue;
      const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlap > 4) problems.push(`${figure.file}: "${a.content}" und "${b.content}" ueberdecken sich um ${Math.round(overlap)} Einheiten`);
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} Layout-Problem(e):`);
  problems.forEach((row) => console.error(`  ${row}`));
  process.exit(1);
}
console.log(`${figures.length} Grafiken geprueft: kein Text laeuft aus dem Bild oder ueber anderen Text.`);
