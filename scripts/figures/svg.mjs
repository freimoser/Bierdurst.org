// Zeichen-Primitive fuer die Artikelgrafiken.
// Die Grafiken entstehen einmalig lokal (npm run figures) und werden committet.
// Sie laufen bewusst NICHT im prebuild: auf dem CI-Runner fehlen die hier
// verwendeten Schriften, das Ergebnis saehe anders aus als das abgenommene.

export const T = {
  ink: '#17322c',
  inkSoft: '#46635b',
  inkFaint: '#7d9089',
  cream: '#fffaf0',
  paper: '#fffef9',
  amber: '#f3a712',
  amberDark: '#c77700',
  foam: '#fff2ca',
  green: '#21493e',
  line: '#e7dfcf',
  lineSoft: '#f0e9db',
  font: '"Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif'
};

export const WIDTH = 1400;

export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

// Naeherung der Textbreite. Ohne Font-Engine ist das eine Schaetzung; die
// Faktoren sind an Helvetica Neue gemessen und bewusst leicht grosszuegig,
// damit Umbrueche eher zu frueh als zu spaet kommen.
// Faktoren gegen die gerenderte Schrift gemessen, mit Sicherheitsaufschlag.
// scripts/figures/calibrate.mjs prueft sie nach; die Schaetzung darf die
// gemessene Breite nie unterschreiten, sonst laufen Zeilen aus dem Bild.
const RATIO = { 400: 0.58, 500: 0.594, 600: 0.611, 700: 0.627, 800: 0.645 };

export function textWidth(text, size, weight = 400) {
  const ratio = RATIO[weight] ?? 0.52;
  let units = 0;
  for (const ch of String(text)) {
    if (/[ .,;:!'`|iIlj]/.test(ch)) units += 0.42;
    else if (/[frt()[\]-]/.test(ch)) units += 0.62;
    else if (/[mwMW—]/.test(ch)) units += 1.5;
    else if (/[A-ZÄÖÜ]/.test(ch)) units += 1.18;
    else units += 1;
  }
  return units * ratio * size;
}

export function wrap(text, maxWidth, size, weight = 400, maxLines = 99) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, weight) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s.,;:]+$/, '')}…`;
  return kept;
}

export function text(content, x, y, { size = 28, weight = 400, fill = T.ink, anchor = 'start', spacing = 0, opacity = 1 } = {}) {
  const attrs = [
    `x="${round(x)}"`,
    `y="${round(y)}"`,
    `font-family='${T.font}'`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    spacing ? `letter-spacing="${spacing}"` : '',
    opacity !== 1 ? `opacity="${opacity}"` : ''
  ].filter(Boolean).join(' ');
  return `<text ${attrs}>${esc(content)}</text>`;
}

export function paragraph(content, x, y, maxWidth, { size = 28, weight = 400, fill = T.ink, lineHeight = 1.45, anchor = 'start', maxLines = 99 } = {}) {
  return wrap(content, maxWidth, size, weight, maxLines)
    .map((line, index) => text(line, x, y + index * size * lineHeight, { size, weight, fill, anchor }))
    .join('');
}

export function paragraphHeight(content, maxWidth, size, weight = 400, lineHeight = 1.45, maxLines = 99) {
  return wrap(content, maxWidth, size, weight, maxLines).length * size * lineHeight;
}

export function rect(x, y, w, h, { fill = T.paper, radius = 0, stroke = null, strokeWidth = 2, opacity = 1 } = {}) {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"${radius ? ` rx="${radius}"` : ''} fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

export function line(x1, y1, x2, y2, { stroke = T.line, width = 2, dash = null } = {}) {
  return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
}

export function round(value) {
  return Math.round(value * 100) / 100;
}

// Bierfarben nach EBC. Die Stuetzpunkte sind an gaengigen EBC-Farbtafeln
// orientiert und werden dazwischen linear interpoliert.
const EBC_STOPS = [
  [2, [250, 231, 150]],
  [4, [248, 220, 110]],
  [8, [243, 196, 60]],
  [12, [233, 170, 29]],
  [18, [214, 139, 21]],
  [26, [191, 108, 17]],
  [35, [160, 78, 18]],
  [45, [126, 55, 19]],
  [60, [92, 38, 19]],
  [80, [58, 24, 16]],
  [120, [30, 15, 12]]
];

export function ebcColor(ebc) {
  const value = Math.max(1, Math.min(140, Number(ebc) || 1));
  for (let i = 0; i < EBC_STOPS.length - 1; i += 1) {
    const [a, ca] = EBC_STOPS[i];
    const [b, cb] = EBC_STOPS[i + 1];
    if (value >= a && value <= b) {
      const t = (value - a) / (b - a);
      const mix = ca.map((channel, index) => Math.round(channel + (cb[index] - channel) * t));
      return `rgb(${mix.join(',')})`;
    }
  }
  return value < EBC_STOPS[0][0] ? `rgb(${EBC_STOPS[0][1].join(',')})` : `rgb(${EBC_STOPS.at(-1)[1].join(',')})`;
}

// Deutsche Farbwoerter aus den Steckbrief-Tabellen auf einen EBC-Bereich
// abbilden. Die Seite nennt die Farbe in Worten, die Grafik zeigt sie als
// Flaeche; beides muss zueinander passen.
const COLOR_WORDS = [
  [/nahezu schwarz|tiefschwarz|schwarz/i, 95],
  [/dunkelbraun/i, 62],
  [/kupferrot|kupfer/i, 40],
  [/rotbraun|braun/i, 50],
  [/bernstein/i, 26],
  [/goldgelb|golden|gold/i, 12],
  [/hellgold/i, 9],
  [/strohgelb|strohfarben/i, 6],
  [/hellgelb/i, 7],
  [/sehr hell/i, 5],
  [/hell/i, 8],
  [/dunkel/i, 55],
  [/trüb/i, 12]
];

export function colorRangeFromWords(words = '') {
  const hits = [];
  const parts = String(words).split(/\s+bis\s+|\s*,\s*|\s+und\s+/i);
  for (const part of parts) {
    for (const [pattern, ebc] of COLOR_WORDS) {
      if (pattern.test(part)) { hits.push(ebc); break; }
    }
  }
  if (!hits.length) {
    for (const [pattern, ebc] of COLOR_WORDS) if (pattern.test(words)) hits.push(ebc);
  }
  if (!hits.length) return [8, 20];
  return [Math.min(...hits), Math.max(...hits)];
}

// Bierglas mit Schaumkrone. Die Fuellung nimmt den Farbbereich des Stils auf,
// damit das Glas die Farbangabe der Seite zeigt und nicht irgendein Gelb.
export function glass(x, y, w, h, ebcRange, { id = 'g', bubbles = true } = {}) {
  const [from, to] = Array.isArray(ebcRange) ? ebcRange : [ebcRange, ebcRange];
  const top = ebcColor(from);
  const bottom = ebcColor(to === from ? from + 6 : to);
  const foamH = Math.round(h * 0.16);
  const taper = w * 0.08;
  const bodyTop = y + foamH;
  const bodyH = h - foamH;
  const path = `M ${round(x)} ${round(bodyTop)} L ${round(x + w)} ${round(bodyTop)} L ${round(x + w - taper)} ${round(bodyTop + bodyH)} Q ${round(x + w / 2)} ${round(bodyTop + bodyH + 14)} ${round(x + taper)} ${round(bodyTop + bodyH)} Z`;
  const bubbleMarkup = bubbles
    ? [[0.3, 0.72, 5], [0.52, 0.56, 4], [0.42, 0.38, 3.4], [0.66, 0.78, 3.6], [0.58, 0.3, 3]]
        .map(([bx, by, r]) => `<circle cx="${round(x + w * bx)}" cy="${round(bodyTop + bodyH * by)}" r="${r}" fill="#ffffff" opacity="0.3"/>`)
        .join('')
    : '';
  return `
    <defs>
      <linearGradient id="beer-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/>
        <stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
    </defs>
    <ellipse cx="${round(x + w / 2)}" cy="${round(y + h + 16)}" rx="${round(w * 0.46)}" ry="9" fill="${T.ink}" opacity="0.07"/>
    <path d="${path}" fill="url(#beer-${id})"/>
    ${bubbleMarkup}
    <rect x="${round(x - 4)}" y="${round(y)}" width="${round(w + 8)}" height="${foamH + 6}" rx="${Math.round(foamH / 2)}" fill="${T.foam}"/>
    <path d="${path}" fill="none" stroke="${T.ink}" stroke-width="3" opacity="0.16"/>`;
}

// Balken fuer einen Wertebereich auf einer gemeinsamen Achse. Zeigt eine
// Spanne, keinen Scheinpunktwert.
export function rangeBar(x, y, w, h, scaleMin, scaleMax, from, to, { fill = T.amber, track = T.lineSoft, label = null, labelSize = 26 } = {}) {
  const span = scaleMax - scaleMin || 1;
  const clamp = (v) => Math.max(0, Math.min(1, (v - scaleMin) / span));
  const a = clamp(from);
  const b = clamp(to);
  const barX = x + a * w;
  const barW = Math.max(h, (b - a) * w);
  return [
    rect(x, y, w, h, { fill: track, radius: h / 2 }),
    rect(barX, y, barW, h, { fill, radius: h / 2 }),
    label ? text(label, x + w + 22, y + h * 0.78, { size: labelSize, weight: 600, fill: T.ink }) : ''
  ].join('');
}

export function document_(height, inner, { background = T.cream } = {}) {
  return `<svg width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${height}" fill="${background}"/>
  ${inner}
</svg>`;
}

// Kopf- und Fusszeile sind auf allen Grafiken gleich aufgebaut: Augenbrauen-
// Zeile, Titel, optionaler Vorspann, unten die Quelle und die Marke.
export function header(eyebrow, title, subtitle, { x = 70, y = 86, maxWidth = WIDTH - 140 } = {}) {
  let cursor = y;
  const out = [rect(x, cursor - 34, 64, 7, { fill: T.amber, radius: 4 })];
  out.push(text(eyebrow.toUpperCase(), x, cursor, { size: 24, weight: 700, fill: T.amberDark, spacing: 2.6 }));
  cursor += 56;
  const titleSize = textWidth(title, 52, 800) > maxWidth * 2 ? 44 : 52;
  const titleLines = wrap(title, maxWidth, titleSize, 800, 3);
  titleLines.forEach((row, index) => {
    out.push(text(row, x, cursor + index * titleSize * 1.18, { size: titleSize, weight: 800, fill: T.ink }));
  });
  cursor += (titleLines.length - 1) * titleSize * 1.18 + 20;
  if (subtitle) {
    cursor += 34;
    const subLines = wrap(subtitle, maxWidth, 28, 400, 3);
    subLines.forEach((row, index) => {
      out.push(text(row, x, cursor + index * 40, { size: 28, weight: 400, fill: T.inkSoft }));
    });
    cursor += (subLines.length - 1) * 40;
  }
  return { markup: out.join(''), bottom: cursor + 42 };
}

// Hoehe, die die Fusszeile am unteren Rand belegt. Jede Vorlage rechnet sie
// auf ihren Inhalt drauf, statt eine Zahl zu raten -- sonst schneidet der
// Trennstrich durch den Text, sobald die Quelle zweizeilig wird.
export function footerHeight(source) {
  const lines = source ? wrap(source, WIDTH - 460, 23, 400, 3).length : 1;
  return 94 + lines * 30;
}

export function footer(height, source, { x = 70 } = {}) {
  const lines = source ? wrap(source, WIDTH - 460, 23, 400, 3) : [];
  const space = footerHeight(source);
  const out = [line(x, height - space, WIDTH - x, height - space, { stroke: T.line, width: 2 })];
  const lastBaseline = height - 54;
  lines.forEach((row, index) => {
    out.push(text(row, x, lastBaseline - (lines.length - 1 - index) * 30, { size: 23, fill: T.inkFaint }));
  });
  out.push(`<g transform="translate(${WIDTH - x - 230} ${height - 88})">
    <rect x="0" y="0" width="26" height="32" rx="4" fill="${T.amber}"/>
    <rect x="4" y="4" width="18" height="5" rx="2.5" fill="${T.foam}"/>
    ${text('BierDurst.org', 40, 24, { size: 26, weight: 800, fill: T.ink })}
  </g>`);
  return out.join('');
}

// Rundet ein Achsenmaximum auf einen lesbaren Wert auf -- unabhaengig von der
// Groessenordnung. Eine feste Schrittweite wie 400 passt zu 1.552 Braustaetten,
// aber nicht zu 95,8 Millionen Hektolitern.
export function niceMax(max) {
  if (!(max > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}
