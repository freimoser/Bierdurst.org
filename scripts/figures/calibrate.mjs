// Misst die tatsaechliche Textbreite der gerenderten Schrift und vergleicht
// sie mit der Schaetzung in svg.mjs. Ohne diesen Abgleich laufen Zeilen aus
// dem Bild, weil die Schaetzung zu optimistisch ist.
// Aufruf: node scripts/figures/calibrate.mjs

import sharp from 'sharp';
import { textWidth, T } from './svg.mjs';

async function measure(label, size, weight) {
  const svg = `<svg width="6000" height="${size * 3}" xmlns="http://www.w3.org/2000/svg">
    <rect width="6000" height="${size * 3}" fill="#ffffff"/>
    <text x="20" y="${size * 2}" font-family='${T.font}' font-size="${size}" font-weight="${weight}" fill="#000000">${label.replace(/&/g, '&amp;')}</text>
  </svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  return info.width;
}

const samples = [
  ['EBC beschreibt die Farbe von Bier und Würze über die Lichtabsorption.', 28, 400],
  ['Die EBC-Farbskala von strohgelb bis schwarz', 52, 800],
  ['Trinktemperatur', 26, 600],
  ['4,5 bis 5,2 % vol', 30, 700],
  ['Werte aus der Steckbrief-Tabelle dieser Seite.', 23, 400],
  ['Pils oder Helles', 52, 800],
  ['Alkoholgehalt in Prozent', 27, 700],
  ['untergäriges helles Lagerbier', 28, 400],
  ['Wie Bier gebraut wird: fünf Schritte', 52, 800],
  ['Hefe wandelt Zucker in Alkohol und Kohlensäure um.', 23, 400],
  ['BIERSORTE', 24, 700]
];

let worst = 0;
for (const [label, size, weight] of samples) {
  const actual = await measure(label, size, weight);
  const estimate = textWidth(label, size, weight);
  const factor = actual / estimate;
  worst = Math.max(worst, factor);
  console.log(`${String(Math.round(factor * 1000) / 1000).padEnd(6)} gemessen=${String(actual).padStart(5)} geschaetzt=${String(Math.round(estimate)).padStart(5)}  w${weight}/${size}px  "${label.slice(0, 44)}"`);
}
console.log(`\nGroesster Faktor: ${Math.round(worst * 1000) / 1000} (Ziel: <= 1.00, also Schaetzung nie kleiner als gemessen)`);
