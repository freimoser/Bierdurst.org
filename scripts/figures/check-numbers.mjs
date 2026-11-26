// Prueft, ob jede Zahl in Alt-Text und Bildunterschrift auch im Text der
// Seite steht, auf der die Grafik erscheint.
//
// Der Grund: Eine Grafik, die eine plausible Fachzahl nennt, die auf der
// Seite nicht vorkommt, widerspricht entweder der Tabelle darunter oder
// behauptet mehr, als die Seite hergibt. Beides ist uns passiert.
//
// Zahlen, die berechtigt abweichen, stehen unten einzeln mit Begruendung.
// Alles andere laesst die Pruefung fehlschlagen.
// Aufruf: node scripts/figures/check-numbers.mjs

import { readFileSync } from 'node:fs';
import { pageFile, readBody } from './content.mjs';

// slug -> { zahlen, grund }
const ALLOWED = {
  '/bierwissen/wie-viele-brauereien-gibt-es/': {
    numbers: ['2015', '2019', '1.552', '8,8'],
    reason: 'Zeitreihe aus data/beer-market-statistics.json, im Bild mit Quelle Deutscher Brauer-Bund ausgewiesen.'
  },
  '/bestenlisten/wie-viel-bier-wird-getrunken/': {
    numbers: ['2015', '77,7', '19'],
    reason: 'Destatis-Zeitreihe; 77,7 Mio. hl ist dieselbe Zahl wie die 7,8 Mrd. Liter der Seite, nur in Hektolitern.'
  },
  '/bestenlisten/': {
    numbers: ['2015', '2025', '2019', '2024', '28.133', '27.380'],
    reason: 'Bereichsseite ohne eigene Zahlen; die Zeitreihe stammt aus data/beer-market-statistics.json mit Quelle im Bild.'
  },
  '/bierregionen/bier-in-bayern/': {
    numbers: ['588', '2025', '41,6', '190', '131'],
    reason: 'Statistisches Bundesamt 2025, belegt auf /bierwissen/wie-viele-brauereien-gibt-es/; im Bild als Herkunft genannt.'
  },
  '/oktoberfest/bierpreise/': {
    numbers: ['14,50'],
    reason: 'Anfang der beschnittenen Achse, keine Preisangabe.'
  },
  '/oktoberfest/': {
    numbers: ['16'],
    reason: 'Festdauer, aus den Daten 18. September bis 3. Oktober der Seite gerechnet.'
  },
  '/oktoberfest/welches-bier-gibt-es/': {
    numbers: ['4,7', '5,4'],
    reason: 'Querverweis auf den Steckbrief von /biersorten/helles/, im Bild als solcher gekennzeichnet.'
  },
  '/oktoberfest/reservierung-oeffnungszeiten/': {
    numbers: ['23.30'],
    reason: 'Schreibweise: die Seite setzt 23:30 mit Doppelpunkt.'
  },
  '/bierwissen/wie-viele-biersorten-gibt-es/': {
    numbers: ['14'],
    reason: 'Anzahl der Sorten, die die Seite selbst als Einstieg aufzaehlt.'
  },
  '/bierwissen/wie-schwer-ist-bierkasten/': {
    numbers: ['7'],
    reason: 'Die Seite schreibt "sieben Kilogramm" aus.'
  },
  '/bier-rechner/fassbier/': {
    numbers: ['95'],
    reason: 'Aus der Formel der Seite gerechnet: 50 Liter minus 5 Prozent, geteilt durch 0,5.'
  }
};

const index = JSON.parse(readFileSync('data/page-figures.json', 'utf8'));
const numbers = (value) => [...String(value).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0]);
const normalise = (value) => value.replace(/\./g, '').replace(',', '.');

const problems = [];
let allowedHits = 0;

for (const [slug, figure] of Object.entries(index)) {
  const file = pageFile(slug);
  if (!file) { problems.push(`${slug}: keine Markdown-Datei gefunden`); continue; }
  const pageNumbers = new Set(numbers(readBody(file)).map(normalise));
  const allowed = new Set((ALLOWED[slug]?.numbers ?? []).map(normalise));
  // Zahlen bis einschliesslich 3 sind Aufzaehlungen ("drei Schritte"), keine Messwerte.
  const unexplained = [...new Set([...numbers(figure.alt), ...numbers(figure.caption)])]
    .filter((value) => Number(normalise(value)) > 3)
    .filter((value) => !pageNumbers.has(normalise(value)))
    .filter((value) => {
      if (allowed.has(normalise(value))) { allowedHits += 1; return false; }
      return true;
    });
  if (unexplained.length) problems.push(`${slug}\n   nicht auf der Seite und nicht begruendet: ${unexplained.join(', ')}`);
}

if (problems.length) {
  console.error('Zahlen ohne Deckung im Seitentext:\n');
  problems.forEach((row) => console.error(`  ${row}`));
  console.error('\nEntweder die Grafik an die Seite anpassen oder die Abweichung in ALLOWED begruenden.');
  process.exit(1);
}
console.log(`${Object.keys(index).length} Grafiken geprueft: jede Zahl steht auf ihrer Seite oder ist in ALLOWED begruendet (${allowedHits} Ausnahmen).`);
