// Erzeugt public/logo-512.png fuer die Organization-Node im JSON-LD.
// Google akzeptiert fuer `logo` in der Regel kein SVG, favicon.svg reicht dort
// also nicht. Quadratisch, randlos lesbar, in den Markenfarben.
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const AMBER = '#f3a712';
const FOAM = '#fff2ca';
const GREEN = '#21493e';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${GREEN}"/>
  <g transform="translate(166 104)">
    <rect x="0" y="54" width="180" height="250" rx="28" fill="${AMBER}"/>
    <rect x="-6" y="30" width="192" height="46" rx="23" fill="${FOAM}"/>
    <rect x="34" y="120" width="22" height="120" rx="11" fill="#ffffff" opacity="0.38"/>
    <rect x="80" y="104" width="22" height="152" rx="11" fill="#ffffff" opacity="0.30"/>
    <rect x="126" y="134" width="22" height="100" rx="11" fill="#ffffff" opacity="0.38"/>
  </g>
  <text x="256" y="452" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="60" font-weight="700" fill="${FOAM}">BierDurst</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile('public/logo-512.png', png);
console.log(`public/logo-512.png erzeugt (${Math.round(png.length / 1024)} KB).`);
