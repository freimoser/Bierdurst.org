// Erzeugt die Artikelgrafiken aus den Seiteninhalten und schreibt
// data/page-figures.json, aus dem PageView die Abbildung einsetzt.
//
// Bewusst NICHT im prebuild: Die Grafiken entstehen einmal lokal, werden
// geprueft und committet. Auf dem CI-Runner fehlen die hier verwendeten
// Schriften; eine Neuerzeugung dort saehe anders aus als das abgenommene Bild.
// Aufruf: npm run figures

import { mkdir, writeFile, rm, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { catalogue } from './figures/catalogue.mjs';
import { WIDTH } from './figures/svg.mjs';
import * as templates from './figures/templates.mjs';

const OUT_DIR = 'public/grafik';
// PNG mit Palette: bei Flaechengrafiken kleiner als WebP und ohne
// Artefakte an den Buchstabenkanten.
//
// Der Dateiname traegt eine Kennung aus dem Bildinhalt. Cloudflare liefert
// die Dateien mit Edge-Cache aus; unter festem Namen saehen Besucher eine
// ueberarbeitete Grafik erst Stunden spaeter. Mit der Kennung ist jede neue
// Fassung eine neue URL und sofort sichtbar.
function contentName(file, buffer) {
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
  return `${file}.${hash}.png`;
}

const fresh = process.argv.includes('--clean');
if (fresh) await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const { figures, dropped } = catalogue();
const index = {};
// Namen dieses Laufs; alles andere im Ordner ist eine alte Fassung.
const written = new Set();
const report = [];
let failed = 0;

for (const figure of figures) {
  const template = templates[figure.template];
  if (!template) {
    console.error(`  FEHLER  ${figure.file}: unbekannte Vorlage "${figure.template}"`);
    failed += 1;
    continue;
  }
  let rendered;
  try {
    rendered = template(figure.props);
  } catch (error) {
    console.error(`  FEHLER  ${figure.file}: ${error.message}`);
    failed += 1;
    continue;
  }
  const buffer = await sharp(Buffer.from(rendered.svg), { density: 96 })
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  const name = contentName(figure.file, buffer);
  await writeFile(`${OUT_DIR}/${name}`, buffer);
  written.add(name);
  const bytes = buffer.length;
  index[figure.slug] = {
    src: `/grafik/${name}`,
    width: WIDTH,
    height: Math.round(rendered.height),
    alt: figure.alt,
    caption: figure.caption,
    template: figure.template
  };
  report.push({ file: figure.file, slug: figure.slug, kb: Math.round(bytes / 1024), height: Math.round(rendered.height) });
}

// Vorgaengerfassungen entfernen. Ohne das sammeln sich mit jeder Aenderung
// alte Dateien an, die niemand mehr ausliefert.
let removed = 0;
for (const entry of await readdir(OUT_DIR)) {
  if (!entry.endsWith('.png') || written.has(entry)) continue;
  await unlink(`${OUT_DIR}/${entry}`);
  removed += 1;
}

await writeFile('data/page-figures.json', `${JSON.stringify(index, null, 2)}\n`, 'utf8');

// Astro merkt sich gerenderte Markdown-Seiten im Content-Store und erneuert
// sie nur, wenn sich die Markdown-Datei oder die Konfiguration aendert. Von
// data/page-figures.json weiss der Store nichts: Ohne diesen Schritt baut der
// naechste Build die Seiten mit der alten Abbildung oder ganz ohne. Der Store
// liegt je nach Astro-Version an einer von zwei Stellen.
// scripts/validate-build.mjs faengt den Fall zusaetzlich ab.
for (const store of ['.astro/data-store.json', 'node_modules/.astro/data-store.json']) {
  await rm(store, { force: true });
}

report.sort((a, b) => b.kb - a.kb);
const total = report.reduce((sum, row) => sum + row.kb, 0);
console.log(`${report.length} Grafiken erzeugt in ${OUT_DIR}/ (${total} KB gesamt, Durchschnitt ${Math.round(total / Math.max(1, report.length))} KB).`);
console.log(`Groesste: ${report.slice(0, 3).map((row) => `${row.file} ${row.kb} KB`).join(', ')}`);
if (removed) console.log(`${removed} ueberholte Datei(en) entfernt.`);
if (dropped.length) console.log(`Uebersprungen, Seite nicht veroeffentlicht: ${dropped.map((row) => row.slug).join(', ')}`);
if (failed) {
  console.error(`${failed} Grafik(en) fehlgeschlagen.`);
  process.exit(1);
}

// Pruefungen, die ein stilles Zurueckfallen auf schlechte Alt-Texte verhindern.
const problems = [];
for (const [slug, figure] of Object.entries(index)) {
  if (!figure.alt || figure.alt.length < 60) problems.push(`${slug}: Alt-Text zu kurz (${figure.alt?.length ?? 0} Zeichen)`);
  if (figure.alt && figure.alt.length > 320) problems.push(`${slug}: Alt-Text zu lang (${figure.alt.length} Zeichen)`);
  if (!figure.caption || figure.caption.length < 40) problems.push(`${slug}: Bildunterschrift zu kurz`);
  if (/^(Bild|Grafik|Abbildung)( von)?[.:]?$/i.test(figure.alt ?? '')) problems.push(`${slug}: Alt-Text ohne Inhalt`);
}
if (problems.length) {
  console.error('\nProbleme:');
  problems.forEach((row) => console.error(`  ${row}`));
  process.exit(1);
}
console.log('Alt-Texte und Bildunterschriften vollstaendig.');
