// Grafik-Vorlagen. Jede Vorlage bekommt fertige Werte und gibt SVG zurueck.
// Keine Vorlage erfindet Zahlen; alles kommt aus content.mjs oder aus den
// gepflegten Datensaetzen in data/.
//
// Alle Vorlagen rechnen auf einer 820 Einheiten breiten Flaeche (svg.mjs).
// Auf dem Handy steht die Abbildung in einer 343 Pixel breiten Spalte, auf dem
// Schreibtisch in einer 600 Pixel breiten. Damit die kleinste Schrift auf dem
// Handy ueber 10 Pixel bleibt, steht alles untereinander, was frueher
// nebeneinander stand: zwei Karten, Ablaufschritte, die Bitterkeitsskala.

import { T, WIDTH, M, INNER, TYPE, text, paragraph, paragraphHeight, rect, line, round, ebcColor, glass, rangeBar, header, footer, footerHeight, document_, wrap, textWidth, niceMax } from './svg.mjs';

const dec = (value) => String(value).replace('.', ',');

// Achsenbeschriftung. Die aeusseren Werte haengen an der Achsenkante statt
// mittig darunter, sonst ragen sie bei 820 Einheiten aus dem Bild. Stossen die
// Beschriftungen aneinander, faellt jede zweite weg -- gezaehlt vom Ende her,
// damit der letzte Wert immer stehen bleibt.
function axisTicks(x, y, w, min, max, ticks = [], suffix = '') {
  if (!ticks.length) return '';
  const span = max - min || 1;
  const widest = Math.max(...ticks.map((tick) => textWidth(`${dec(tick)}${suffix}`, TYPE.foot, 400)));
  const fits = ticks.length < 2 || w / (ticks.length - 1) >= widest + 14;
  const shown = fits ? ticks : ticks.filter((_, index) => (ticks.length - 1 - index) % 2 === 0);
  return shown.map((tick) => {
    const px = x + ((tick - min) / span) * w;
    const anchor = tick === ticks[0] ? 'start' : tick === ticks.at(-1) ? 'end' : 'middle';
    return text(`${dec(tick)}${suffix}`, px, y, { size: TYPE.foot, fill: T.inkFaint, anchor });
  }).join('');
}

// Kleine Versalzeile ueber einem Block. Sie darf umbrechen: Eine Achsen-
// angabe wie "Achse von 14,50 Euro bis 18,50 Euro -- kein Nullpunkt" passt in
// Versalien nicht in eine Zeile von 724 Einheiten.
const SPACING = 1.4;
function kicker(label, x, y, maxWidth = INNER) {
  const content = String(label).toUpperCase();
  // wrap() kennt die Laufweite nicht; sie kommt hier vom Umbruchmass ab.
  const rows = wrap(content, maxWidth - content.length * SPACING, TYPE.label, 700, 2);
  return {
    markup: rows.map((row, index) => text(row, x, y + index * 32, {
      size: TYPE.label, weight: 700, fill: T.amberDark, spacing: SPACING
    })).join(''),
    height: rows.length * 32
  };
}

// ---------------------------------------------------------------- Steckbrief
export function steckbrief({ profile, eyebrow = 'Biersorte', source }) {
  const head = header(eyebrow, `${profile.name} im Steckbrief`, profile.classification);
  const body = [];
  let y = head.bottom;

  // Glas links, Farbwoerter daneben. Darunter laufen die Spannen ueber die
  // volle Breite -- nebeneinander blieben fuer die Achse keine 300 Einheiten.
  const glassW = 132;
  const glassH = 196;
  body.push(glass(M, y, glassW, glassH, profile.colorRange, { id: profile.slug.replace(/\W/g, '') }));
  const cx = M + glassW + 38;
  const cw = WIDTH - M - cx;
  body.push(kicker('Farbe laut Steckbrief', cx, y + 36, cw).markup);
  const colorRows = wrap(profile.colorWords, cw, TYPE.strong, 600, 4);
  colorRows.forEach((row, index) => {
    body.push(text(row, cx, y + 80 + index * 36, { size: TYPE.strong, weight: 600, fill: T.ink }));
  });
  y += Math.max(glassH + 56, 80 + colorRows.length * 36 + 34);

  body.push(line(M, y - 22, WIDTH - M, y - 22, { stroke: T.line }));
  for (const metric of profile.metrics) {
    body.push(text(metric.label, M, y + 26, { size: TYPE.strong, weight: 600, fill: T.inkSoft }));
    body.push(text(metric.value, WIDTH - M, y + 26, { size: TYPE.value, weight: 700, fill: T.ink, anchor: 'end' }));
    if (metric.range) {
      body.push(rangeBar(M, y + 48, INNER, 20, metric.min, metric.max, metric.range[0], metric.range[1], { fill: metric.fill ?? T.amber }));
      body.push(axisTicks(M, y + 102, INNER, metric.min, metric.max, metric.ticks, metric.suffix ?? ''));
    } else {
      body.push(rect(M, y + 48, INNER, 20, { fill: T.lineSoft, radius: 10 }));
      body.push(text(metric.note ?? 'keine Spanne angegeben', M, y + 102, { size: TYPE.foot, fill: T.inkFaint }));
    }
    y += 138;
  }

  body.push(line(M, y - 14, WIDTH - M, y - 14, { stroke: T.line }));
  const facts = [['Gärung', profile.fermentation ?? 'je nach Ausgangsstil'], ['Passendes Glas', profile.glass]];
  const factW = (INNER - 32) / 2;
  let factLines = 1;
  facts.forEach(([label, value], index) => {
    const fx = M + index * (factW + 32);
    body.push(kicker(label, fx, y + 30, factW).markup);
    body.push(paragraph(value, fx, y + 72, factW, { size: TYPE.body, weight: 500, fill: T.ink, maxLines: 4 }));
    factLines = Math.max(factLines, wrap(value, factW, TYPE.body, 500, 4).length);
  });
  const height = y + 72 + factLines * 39 + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// --------------------------------------------------------------------- Duell
export function duell({ title, left, right, metrics, source, note }) {
  const head = header('Direktvergleich', title, note);
  const body = [];
  let y = head.bottom;

  const sides = [left, right];
  const colors = [T.amber, T.green];
  const glassW = 118;
  const glassH = 168;
  sides.forEach((side, index) => {
    const gx = index === 0 ? M + 46 : WIDTH - M - 46 - glassW;
    body.push(glass(gx, y, glassW, glassH, side.colorRange, { id: `${title.replace(/\W/g, '')}${index}`, bubbles: false }));
    const nameSize = textWidth(side.name, 30, 800) > 330 ? 26 : 30;
    body.push(text(side.name, gx + glassW / 2, y + glassH + 62, { size: nameSize, weight: 800, fill: T.ink, anchor: 'middle' }));
    body.push(`<rect x="${round(gx + glassW / 2 - 44)}" y="${round(y + glassH + 78)}" width="88" height="6" rx="3" fill="${colors[index]}"/>`);
  });
  body.push(text('vs.', WIDTH / 2, y + glassH / 2 + 14, { size: 36, weight: 800, fill: T.inkFaint, anchor: 'middle' }));
  y += glassH + 126;

  // Je Kennzahl eine Ueberschrift, darunter beide Seiten mit eigenem Balken
  // ueber die volle Breite. Nebeneinander blieben fuer jeden Balken 300
  // Einheiten, und die Werte haetten sich mit den Namen ueberschnitten.
  for (const metric of metrics) {
    body.push(text(metric.label, M, y, { size: TYPE.strong, weight: 700, fill: T.ink }));
    let rowY = y + 44;
    sides.forEach((side, index) => {
      const value = metric.values[index];
      body.push(text(side.name, M, rowY, { size: TYPE.label, weight: 600, fill: T.inkSoft }));
      body.push(text(value.label, WIDTH - M, rowY, { size: TYPE.strong, weight: 700, fill: T.ink, anchor: 'end' }));
      if (value.range) {
        body.push(rangeBar(M, rowY + 16, INNER, 18, metric.min, metric.max, value.range[0], value.range[1], { fill: colors[index] }));
      } else {
        body.push(rect(M, rowY + 16, INNER, 18, { fill: T.lineSoft, radius: 9 }));
      }
      rowY += 70;
    });
    body.push(axisTicks(M, rowY + 20, INNER, metric.min, metric.max, metric.ticks, metric.suffix ?? ''));
    y = rowY + 78;
  }
  const height = y - 20 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// --------------------------------------------------------------------- Skala
// Die Skala laeuft von oben nach unten. Quer ueber die Breite blieben je Stufe
// 140 Einheiten; eine Beschriftung wie "klar wahrnehmbare Bittere" braucht das
// Dreifache und wurde auf dem Handy 5 Pixel gross.
export function skala({ eyebrow, title, subtitle, bands, axisLabel, source, swatchFromEbc = false }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const kick = kicker(axisLabel, M, y);
  body.push(kick.markup);
  y += kick.height + 12;

  const chipW = 176;
  const textX = M + chipW + 26;
  const textW = WIDTH - M - textX;
  for (const band of bands) {
    const fill = swatchFromEbc ? ebcColor(band.ebc) : band.fill;
    const labelRows = wrap(band.label, textW, TYPE.strong, 700, 2);
    const exampleRows = band.examples ? wrap(band.examples, textW, TYPE.body, 400, 3) : [];
    const rowH = Math.max(66, 12 + labelRows.length * 36 + exampleRows.length * 34 + 12);
    body.push(rect(M, y, chipW, rowH, { fill, radius: 12 }));
    const valueSize = textWidth(band.value, 30, 800) > chipW - 24 ? 26 : 30;
    body.push(text(band.value, M + chipW / 2, y + rowH / 2 + valueSize * 0.36, {
      size: valueSize, weight: 800, fill: band.dark ? T.cream : T.ink, anchor: 'middle'
    }));
    labelRows.forEach((row, index) => {
      body.push(text(row, textX, y + 36 + index * 36, { size: TYPE.strong, weight: 700, fill: T.ink }));
    });
    exampleRows.forEach((row, index) => {
      body.push(text(row, textX, y + 36 + labelRows.length * 36 + index * 34, { size: TYPE.body, fill: T.inkSoft }));
    });
    y += rowH + 16;
  }
  const height = y + 22 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ----------------------------------------------------------------- Zeitreihe
export function zeitreihe({ eyebrow, title, subtitle, series, unit, valueFormat, source, highlight = [] }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const format = valueFormat ?? ((value) => value.toLocaleString('de-DE'));
  const max = Math.max(...series.map((point) => point.value));
  const axisMax = niceMax(max);
  // Linker Rand nach der breitesten Achsenzahl, nicht nach einer geratenen Zahl.
  const gutter = Math.max(...[0, 1, 2, 3, 4].map((step) => textWidth(format((axisMax / 4) * step), TYPE.foot, 400))) + 18;
  const x = M + gutter;
  const w = WIDTH - M - x;
  const top = head.bottom + 46;
  const chartH = 300;

  body.push(text(unit, M, top - 24, { size: TYPE.label, weight: 600, fill: T.amberDark }));
  for (let i = 0; i <= 4; i += 1) {
    const value = (axisMax / 4) * i;
    const gy = top + chartH - (value / axisMax) * chartH;
    body.push(line(x, gy, x + w, gy, { stroke: i === 0 ? T.inkFaint : T.lineSoft, width: i === 0 ? 2 : 1.5 }));
    body.push(text(format(value), x - 14, gy + 9, { size: TYPE.foot, fill: T.inkFaint, anchor: 'end' }));
  }

  const slot = w / series.length;
  const barW = Math.min(46, slot * 0.62);
  // Jahreszahlen duennen, wenn sie sonst aneinanderstossen. Gezaehlt vom Ende,
  // damit das juengste Jahr immer beschriftet ist.
  const step = Math.max(1, Math.ceil((textWidth('2026', TYPE.foot, 400) + 12) / slot));
  series.forEach((point, index) => {
    const bx = x + slot * index + (slot - barW) / 2;
    const bh = (point.value / axisMax) * chartH;
    const isMarked = highlight.includes(point.year);
    body.push(rect(bx, top + chartH - bh, barW, bh, { fill: isMarked ? T.amber : T.green, radius: 5, opacity: isMarked ? 1 : 0.82 }));
    if (isMarked) {
      body.push(text(format(point.value), bx + barW / 2, top + chartH - bh - 16, { size: TYPE.strong, weight: 800, fill: T.ink, anchor: 'middle' }));
    }
    if ((series.length - 1 - index) % step === 0) {
      body.push(text(String(point.year), bx + barW / 2, top + chartH + 38, { size: TYPE.foot, fill: T.inkSoft, anchor: 'middle' }));
    }
  });
  const height = top + chartH + 104 + footerHeight(source);
  body.push(text('Achse beginnt bei null', M, top + chartH + 74, { size: TYPE.foot, fill: T.inkFaint }));
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ------------------------------------------------------------------- Balken
// Beschriftung ueber dem Balken statt in einer Spalte daneben: Eine Spalte
// haette bei 820 Einheiten entweder den Balken oder die Beschriftung erdrueckt.
export function balken({ eyebrow, title, subtitle, items, unit, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const kick = kicker(unit, M, y);
  body.push(kick.markup);
  y += kick.height + 10;
  const gutter = Math.max(...items.map((item) => textWidth(item.valueLabel, TYPE.value, 800))) + 24;
  const barMax = INNER - gutter;
  const max = Math.max(...items.map((item) => item.value));
  for (const item of items) {
    const labelRows = wrap(item.label, INNER, TYPE.strong, 700, 2);
    labelRows.forEach((row, index) => {
      body.push(text(row, M, y + 26 + index * 36, { size: TYPE.strong, weight: 700, fill: T.ink }));
    });
    let barY = y + 26 + labelRows.length * 36;
    if (item.sublabel) {
      const subRows = wrap(item.sublabel, INNER, TYPE.foot, 400, 2);
      subRows.forEach((row, index) => body.push(text(row, M, barY + 16 + index * 32, { size: TYPE.foot, fill: T.inkFaint })));
      barY += 30 + (subRows.length - 1) * 32;
    }
    barY += 12;
    body.push(rect(M, barY, barMax, 40, { fill: T.lineSoft, radius: 8 }));
    body.push(rect(M, barY, Math.max(10, (item.value / max) * barMax), 40, { fill: item.fill ?? T.amber, radius: 8 }));
    body.push(text(item.valueLabel, WIDTH - M, barY + 29, { size: TYPE.value, weight: 800, fill: T.ink, anchor: 'end' }));
    y = barY + 40 + 26;
  }
  if (note) {
    y += 22;
    body.push(paragraph(note, M, y + 20, INNER, { size: TYPE.foot, fill: T.inkSoft, maxLines: 5 }));
    y += paragraphHeight(note, INNER, TYPE.foot, 400, 1.45, 5);
  }
  const height = y + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// -------------------------------------------------------------- Punktediagramm
// Fuer eng beieinanderliegende Werte. Punkte implizieren keine Laenge, deshalb
// darf die Achse hier beschnitten sein -- sie wird ausdruecklich beschriftet.
export function punkte({ eyebrow, title, subtitle, items, min, max, ticks, suffix, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const axisNote = min > 0
    ? `Achse von ${dec(min)}${suffix} bis ${dec(max)}${suffix} — kein Nullpunkt`
    : `Achse von null bis ${dec(max)}${suffix}`;
  const kick = kicker(axisNote, M, y);
  body.push(kick.markup);
  y += kick.height + 8;

  const valueGutter = Math.max(...items.map((item) => textWidth(item.valueLabel, TYPE.strong, 800))) + 22;
  const w = INNER - valueGutter;
  const rowH = 74;
  const chartTop = y + 8;
  items.forEach((item, index) => {
    const ly = chartTop + index * rowH + 26;
    body.push(text(item.label, M, ly, { size: TYPE.body, weight: item.emphasis ? 800 : 500, fill: item.emphasis ? T.ink : T.inkSoft }));
    body.push(text(item.valueLabel, WIDTH - M, ly, { size: TYPE.strong, weight: item.emphasis ? 800 : 600, fill: T.ink, anchor: 'end' }));
    const cy = ly + 24;
    body.push(line(M, cy, M + w, cy, { stroke: T.lineSoft, width: 1.5 }));
    const px = M + ((item.value - min) / (max - min)) * w;
    body.push(`<circle cx="${round(px)}" cy="${round(cy)}" r="${item.emphasis ? 14 : 11}" fill="${item.fill ?? T.green}"/>`);
  });
  const chartBottom = chartTop + items.length * rowH;
  body.push(axisTicks(M, chartBottom + 30, w, min, max, ticks, suffix));
  y = chartBottom + 62;
  if (note) {
    body.push(paragraph(note, M, y + 20, INNER, { size: TYPE.foot, fill: T.inkSoft, maxLines: 5 }));
    y += paragraphHeight(note, INNER, TYPE.foot, 400, 1.45, 5);
  }
  const height = y + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// -------------------------------------------------------------------- Ablauf
// Schritte untereinander. Nebeneinander blieben je Schritt rund 180 Einheiten
// und damit zwoelf Zeichen pro Zeile.
export function ablauf({ eyebrow, title, subtitle, steps, source }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const r = 27;
  const textX = M + 2 * r + 26;
  const textW = WIDTH - M - textX;
  const blocks = steps.map((step) => ({
    titleRows: wrap(step.title, textW, TYPE.strong, 800, 2),
    bodyRows: wrap(step.body, textW, TYPE.body, 400, 9)
  }));
  blocks.forEach((block, index) => {
    const blockH = Math.max(2 * r + 16, 6 + block.titleRows.length * 36 + 8 + block.bodyRows.length * 36 + 10);
    const cy = y + r + 2;
    if (index < blocks.length - 1) {
      body.push(line(M + r, cy + r + 10, M + r, y + blockH + 24, { stroke: T.line, width: 3 }));
    }
    body.push(`<circle cx="${M + r}" cy="${round(cy)}" r="${r}" fill="${T.amber}"/>`);
    body.push(text(String(index + 1), M + r, cy + 11, { size: TYPE.strong, weight: 800, fill: T.ink, anchor: 'middle' }));
    block.titleRows.forEach((row, li) => {
      body.push(text(row, textX, y + 30 + li * 36, { size: TYPE.strong, weight: 800, fill: T.ink }));
    });
    block.bodyRows.forEach((row, li) => {
      body.push(text(row, textX, y + 30 + block.titleRows.length * 36 + 12 + li * 36, { size: TYPE.body, fill: T.inkSoft }));
    });
    y += blockH + 20;
  });
  const height = y + 16 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ---------------------------------------------------------------- Kennzahlen
export function kennzahlen({ eyebrow, title, subtitle, tiles, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const gap = 24;
  // Hoechstens zwei Kacheln nebeneinander. Bei vier blieben je 170 Einheiten,
  // die Zahl haette auf 26 schrumpfen muessen und waere kleiner gewesen als
  // ihre Beschriftung.
  const cols = tiles.length === 1 ? 1 : 2;
  const colW = (INNER - gap * (cols - 1)) / cols;
  const labelLines = Math.max(...tiles.map((tile) => wrap(tile.label, colW - 40, TYPE.body, 400, 6).length));
  const tileH = 156 + labelLines * 34;
  const rows = Math.ceil(tiles.length / cols);
  tiles.forEach((tile, index) => {
    // Eine ungerade letzte Kachel nimmt die ganze Breite, statt eine Luecke zu
    // lassen.
    const alone = cols === 2 && tiles.length % 2 === 1 && index === tiles.length - 1;
    const tw = alone ? INNER : colW;
    const tx = alone ? M : M + (colW + gap) * (index % cols);
    const ty = y + (tileH + gap) * Math.floor(index / cols);
    body.push(rect(tx, ty, tw, tileH, { fill: T.paper, radius: 18, stroke: T.line, strokeWidth: 2 }));
    body.push(rect(tx, ty, tw, 7, { fill: index === 0 ? T.amber : T.green, radius: 4 }));
    const valueSize = [TYPE.hero, 46, 40, 34, 30, 26].find((size) => textWidth(tile.value, size, 800) <= tw - 36) ?? 26;
    body.push(text(tile.value, tx + tw / 2, ty + 92, { size: valueSize, weight: 800, fill: T.ink, anchor: 'middle' }));
    body.push(text(tile.unit, tx + tw / 2, ty + 128, { size: TYPE.label, weight: 600, fill: T.amberDark, anchor: 'middle' }));
    wrap(tile.label, tw - 40, TYPE.body, 400, 6).forEach((row, li) => {
      body.push(text(row, tx + tw / 2, ty + 166 + li * 34, { size: TYPE.body, fill: T.inkSoft, anchor: 'middle' }));
    });
  });
  y += rows * tileH + (rows - 1) * gap + 34;
  if (note) {
    body.push(paragraph(note, M, y + 18, INNER, { size: TYPE.foot, fill: T.inkSoft, maxLines: 5 }));
    y += paragraphHeight(note, INNER, TYPE.foot, 400, 1.45, 5);
  }
  const height = y + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ------------------------------------------------------------------ Zwei Wege
// Zwei Karten untereinander. Nebeneinander hatte jede Karte 330 Einheiten
// Innenbreite: Fliesstext in 24 Einheiten wurde auf dem Handy 6 Pixel gross.
export function zweiwege({ eyebrow, title, subtitle, columns, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const colors = [T.amber, T.green];
  const pad = 28;
  const innerW = INNER - 2 * pad;
  columns.forEach((column, index) => {
    const blocks = column.rows.map(([label, value]) => ({ label, lines: wrap(value, innerW, TYPE.body, 500, 4) }));
    const exampleRows = column.examples ? wrap(column.examples, innerW, TYPE.body, 500, 4) : [];
    const rowsH = blocks.reduce((sum, block) => sum + 38 + block.lines.length * 34, 0);
    const tagsH = exampleRows.length ? 54 + exampleRows.length * 34 : 0;
    const cardH = 104 + rowsH + tagsH + 20;
    body.push(rect(M, y, INNER, cardH, { fill: T.paper, radius: 18, stroke: T.line, strokeWidth: 2 }));
    body.push(rect(M, y, INNER, 7, { fill: colors[index], radius: 4 }));
    body.push(text(column.title, M + pad, y + 62, { size: 34, weight: 800, fill: T.ink }));
    let cy = y + 108;
    for (const block of blocks) {
      body.push(text(block.label, M + pad, cy, { size: TYPE.label, weight: 700, fill: T.amberDark, spacing: 1.2 }));
      block.lines.forEach((row, li) => {
        body.push(text(row, M + pad, cy + 34 + li * 34, { size: TYPE.body, weight: 500, fill: T.ink }));
      });
      cy += 38 + block.lines.length * 34;
    }
    if (exampleRows.length) {
      body.push(line(M + pad, cy + 2, WIDTH - M - pad, cy + 2, { stroke: T.lineSoft }));
      body.push(text('Typische Vertreter', M + pad, cy + 40, { size: TYPE.label, weight: 700, fill: T.inkFaint, spacing: 1.2 }));
      exampleRows.forEach((row, li) => {
        body.push(text(row, M + pad, cy + 76 + li * 34, { size: TYPE.body, weight: 500, fill: T.ink }));
      });
    }
    y += cardH + 24;
  });
  y += 6;
  if (note) {
    body.push(paragraph(note, M, y + 18, INNER, { size: TYPE.foot, fill: T.inkSoft, maxLines: 5 }));
    y += paragraphHeight(note, INNER, TYPE.foot, 400, 1.45, 5);
  }
  const height = y + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// -------------------------------------------------------------- Stilkarte
// Farbe und Bitterkeit fuer jeden Stil, Zeile fuer Zeile.
//
// Vorher war das ein Streudiagramm. Auf 820 Einheiten geht das nicht auf: Elf
// Namen an elf Punkten, von denen fuenf dicht beieinanderliegen, schieben sich
// uebereinander, und die Farbwoerter unter der Waagerechten verschmelzen zu
// Brei. Zwei Spannen je Zeile zeigen dieselben beiden Groessen, und beide
// Spalten enthalten nur Balken -- Text steht allein in der vollen Breite.
export function stilkarte({ eyebrow, title, subtitle, points, xTicks, yTicks, xLabel, yLabel, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  let y = head.bottom;
  const at = (tick) => (typeof tick === 'object' ? tick.value : tick);
  const name = (tick) => (typeof tick === 'object' ? tick.label : String(tick));
  const xMin = at(xTicks[0]);
  const xMax = at(xTicks.at(-1));
  const yMin = at(yTicks[0]);
  const yMax = at(yTicks.at(-1));

  const gap = 40;
  const colW = (INNER - gap) / 2;
  const colX = [M, M + colW + gap];
  const axes = [
    { label: xLabel, from: name(xTicks[0]), to: name(xTicks.at(-1)) },
    { label: yLabel, from: name(yTicks[0]), to: name(yTicks.at(-1)) }
  ];
  axes.forEach((axis, index) => {
    body.push(kicker(axis.label, colX[index], y, colW).markup);
    body.push(text(axis.from, colX[index], y + 34, { size: TYPE.foot, fill: T.inkFaint }));
    body.push(text(axis.to, colX[index] + colW, y + 34, { size: TYPE.foot, fill: T.inkFaint, anchor: 'end' }));
  });
  y += 56;

  // Von hell nach dunkel: So wird die linke Spalte von oben nach unten zu
  // einem Farbverlauf, und die Sortierung traegt selbst eine Aussage.
  const ordered = [...points].sort((a, b) => a.x - b.x);
  for (const point of ordered) {
    body.push(text(point.label, M, y + 26, { size: TYPE.strong, weight: 700, fill: T.ink }));
    const xSpan = point.xSpan ?? [point.x, point.x];
    const ySpan = point.ySpan ?? [point.y, point.y];
    body.push(rangeBar(colX[0], y + 42, colW, 22, xMin, xMax, xSpan[0], xSpan[1], { fill: point.fill }));
    body.push(rangeBar(colX[1], y + 42, colW, 22, yMin, yMax, ySpan[0], ySpan[1], { fill: T.green }));
    y += 82;
  }
  y += 8;
  if (note) {
    body.push(paragraph(note, M, y + 18, INNER, { size: TYPE.foot, fill: T.inkSoft, maxLines: 5 }));
    y += paragraphHeight(note, INNER, TYPE.foot, 400, 1.45, 5);
  }
  const height = y + 26 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}
