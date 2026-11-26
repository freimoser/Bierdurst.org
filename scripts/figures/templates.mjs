// Grafik-Vorlagen. Jede Vorlage bekommt fertige Werte und gibt SVG zurueck.
// Keine Vorlage erfindet Zahlen; alles kommt aus content.mjs oder aus den
// gepflegten Datensaetzen in data/.

import { T, WIDTH, text, paragraph, rect, line, round, ebcColor, glass, rangeBar, header, footer, footerHeight, document_, wrap, textWidth, niceMax } from './svg.mjs';

const dec = (value) => String(value).replace('.', ',');

function metricRow(y, label, valueLabel, bar) {
  return [
    text(label, 70, y, { size: 26, weight: 600, fill: T.inkSoft }),
    text(valueLabel, WIDTH - 70, y, { size: 29, weight: 700, fill: T.ink, anchor: 'end' }),
    bar
  ].join('');
}

function scaleTicks(x, y, w, min, max, ticks, suffix = '') {
  return ticks.map((tick) => {
    const px = x + ((tick - min) / (max - min)) * w;
    return text(`${dec(tick)}${suffix}`, px, y, { size: 21, fill: T.inkFaint, anchor: 'middle' });
  }).join('');
}

// ---------------------------------------------------------------- Steckbrief
export function steckbrief({ profile, eyebrow = 'Biersorte', source }) {
  const head = header(eyebrow, `${profile.name} im Steckbrief`, profile.classification);
  const body = [];
  let y = head.bottom + 20;

  const glassX = 86;
  const glassW = 230;
  const glassH = 330;
  body.push(glass(glassX, y + 10, glassW, glassH, profile.colorRange, { id: profile.slug.replace(/\W/g, '') }));
  body.push(text('Farbe laut Steckbrief', glassX + glassW / 2, y + glassH + 72, { size: 22, fill: T.inkFaint, anchor: 'middle' }));
  const colorRows = wrap(profile.colorWords, 330, 24, 600, 2);
  colorRows.forEach((row, index) => {
    body.push(text(row, glassX + glassW / 2, y + glassH + 106 + index * 32, { size: 24, weight: 600, fill: T.ink, anchor: 'middle' }));
  });
  // Untere Kante der Farbbeschriftung; der Trennstrich darunter richtet sich
  // danach, sonst schneidet er bei zweizeiliger Farbe durch den Text.
  const colorBottom = y + glassH + 106 + colorRows.length * 32;

  const colX = 430;
  const colW = WIDTH - colX - 70;
  let rowY = y + 44;

  for (const metric of profile.metrics) {
    body.push(text(metric.label, colX, rowY, { size: 26, weight: 600, fill: T.inkSoft }));
    body.push(text(metric.value, WIDTH - 70, rowY, { size: 30, weight: 700, fill: T.ink, anchor: 'end' }));
    if (metric.range) {
      body.push(rangeBar(colX, rowY + 20, colW, 22, metric.min, metric.max, metric.range[0], metric.range[1], { fill: metric.fill ?? T.amber }));
      body.push(scaleTicks(colX, rowY + 76, colW, metric.min, metric.max, metric.ticks, metric.suffix ?? ''));
    } else {
      body.push(rect(colX, rowY + 20, colW, 22, { fill: T.lineSoft, radius: 11 }));
      body.push(text(metric.note ?? 'keine Spanne angegeben', colX, rowY + 76, { size: 21, fill: T.inkFaint }));
    }
    rowY += 128;
  }

  const factY = rowY + 6;
  const facts = [['Gärung', profile.fermentation ?? 'je nach Ausgangsstil'], ['Passendes Glas', profile.glass], ['Region', profile.region]];
  const factW = (WIDTH - 140 - 36) / 2;
  let fx = 70;
  let fy = Math.max(factY, colorBottom + 46);
  body.push(line(70, fy - 34, WIDTH - 70, fy - 34, { stroke: T.line }));
  let factLines = 1;
  facts.slice(0, 2).forEach(([label, value], index) => {
    const cx = 70 + index * (factW + 36);
    body.push(text(label, cx, fy + 24, { size: 22, weight: 700, fill: T.amberDark, spacing: 1.6 }));
    body.push(paragraph(value, cx, fy + 62, factW, { size: 26, weight: 500, fill: T.ink, maxLines: 2 }));
    factLines = Math.max(factLines, wrap(value, factW, 26, 500, 2).length);
  });
  const height = fy + 62 + factLines * 38 + 36 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// --------------------------------------------------------------------- Duell
export function duell({ title, left, right, metrics, source, note }) {
  const head = header('Direktvergleich', title, note);
  const body = [];
  let y = head.bottom + 10;

  const sides = [left, right];
  const colors = [T.amber, T.green];
  sides.forEach((side, index) => {
    const cx = index === 0 ? 150 : WIDTH - 150 - 150;
    body.push(glass(cx, y, 150, 215, side.colorRange, { id: `${title.replace(/\W/g, '')}${index}`, bubbles: false }));
    body.push(text(side.name, cx + 75, y + 272, { size: 34, weight: 800, fill: T.ink, anchor: 'middle' }));
    body.push(`<rect x="${round(cx + 75 - 60)}" y="${round(y + 288)}" width="120" height="6" rx="3" fill="${colors[index]}"/>`);
  });
  body.push(text('vs.', WIDTH / 2, y + 140, { size: 44, weight: 800, fill: T.inkFaint, anchor: 'middle' }));

  let rowY = y + 360;
  for (const metric of metrics) {
    body.push(text(metric.label, 70, rowY, { size: 27, weight: 700, fill: T.ink }));
    const barX = 70;
    const barW = WIDTH - 140;
    sides.forEach((side, index) => {
      const value = metric.values[index];
      const lineY = rowY + 30 + index * 52;
      body.push(text(side.name, barX, lineY + 16, { size: 22, weight: 600, fill: T.inkSoft }));
      const trackX = barX + 180;
      const trackW = barW - 180 - 230;
      if (value.range) {
        body.push(rangeBar(trackX, lineY, trackW, 20, metric.min, metric.max, value.range[0], value.range[1], { fill: colors[index] }));
      } else {
        body.push(rect(trackX, lineY, trackW, 20, { fill: T.lineSoft, radius: 10 }));
      }
      body.push(text(value.label, WIDTH - 70, lineY + 17, { size: 25, weight: 700, fill: T.ink, anchor: 'end' }));
    });
    body.push(scaleTicks(barX + 180, rowY + 162, barW - 180 - 230, metric.min, metric.max, metric.ticks, metric.suffix ?? ''));
    rowY += 212;
  }
  const height = rowY - 20 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// --------------------------------------------------------------------- Skala
export function skala({ eyebrow, title, subtitle, bands, axisLabel, source, swatchFromEbc = false }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const x = 70;
  const w = WIDTH - 140;
  let y = head.bottom + 24;

  const total = bands.reduce((sum, band) => sum + (band.weight ?? 1), 0);
  let cursor = x;
  const bandH = 96;
  bands.forEach((band, index) => {
    const bw = (w * (band.weight ?? 1)) / total;
    const fill = swatchFromEbc ? ebcColor(band.ebc) : band.fill;
    const first = index === 0;
    const last = index === bands.length - 1;
    body.push(`<path d="M ${round(cursor + (first ? 14 : 0))} ${round(y)} h ${round(bw - (first ? 14 : 0) - (last ? 14 : 0))} ${last ? `a 14 14 0 0 1 14 14 v ${bandH - 28} a 14 14 0 0 1 -14 14` : `v ${bandH}`} h ${round(-(bw - (first ? 14 : 0) - (last ? 14 : 0)))} ${first ? `a 14 14 0 0 1 -14 -14 v ${-(bandH - 28)} a 14 14 0 0 1 14 -14` : `v ${-bandH}`} z" fill="${fill}"/>`);
    const textFill = band.dark ? T.cream : T.ink;
    body.push(text(band.value, cursor + bw / 2, y + 44, { size: 28, weight: 800, fill: textFill, anchor: 'middle' }));
    wrap(band.label, bw - 18, 21, 500, 2).forEach((row, line_) => {
      body.push(text(row, cursor + bw / 2, y + 70 + line_ * 24, { size: 21, weight: 500, fill: textFill, anchor: 'middle', opacity: 0.88 }));
    });
    cursor += bw;
  });
  y += bandH + 30;
  body.push(text(axisLabel, x, y + 10, { size: 22, weight: 600, fill: T.amberDark, spacing: 1.4 }));
  y += 52;

  cursor = x;
  bands.forEach((band) => {
    const bw = (w * (band.weight ?? 1)) / total;
    if (band.examples) {
      wrap(band.examples, bw - 20, 23, 400, 3).forEach((row, line_) => {
        body.push(text(row, cursor + bw / 2, y + 22 + line_ * 30, { size: 23, fill: T.inkSoft, anchor: 'middle' }));
      });
    }
    cursor += bw;
  });
  const exampleLines = Math.max(...bands.map((band) => (band.examples ? wrap(band.examples, (w / total) * (band.weight ?? 1) - 20, 23, 400, 3).length : 0)), 0);
  const height = y + exampleLines * 30 + 36 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ----------------------------------------------------------------- Zeitreihe
export function zeitreihe({ eyebrow, title, subtitle, series, unit, valueFormat, source, highlight = [] }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const x = 110;
  const w = WIDTH - 180;
  const top = head.bottom + 50;
  const chartH = 330;
  const max = Math.max(...series.map((point) => point.value));
  const axisMax = niceMax(max);
  const format = valueFormat ?? ((value) => value.toLocaleString('de-DE'));

  for (let i = 0; i <= 4; i += 1) {
    const value = (axisMax / 4) * i;
    const gy = top + chartH - (value / axisMax) * chartH;
    body.push(line(x, gy, x + w, gy, { stroke: i === 0 ? T.inkFaint : T.lineSoft, width: i === 0 ? 2 : 1.5 }));
    body.push(text(format(value), x - 18, gy + 8, { size: 21, fill: T.inkFaint, anchor: 'end' }));
  }

  const slot = w / series.length;
  const barW = Math.min(64, slot * 0.58);
  series.forEach((point, index) => {
    const bx = x + slot * index + (slot - barW) / 2;
    const bh = (point.value / axisMax) * chartH;
    const isMarked = highlight.includes(point.year);
    body.push(rect(bx, top + chartH - bh, barW, bh, { fill: isMarked ? T.amber : T.green, radius: 6, opacity: isMarked ? 1 : 0.82 }));
    if (isMarked) {
      body.push(text(format(point.value), bx + barW / 2, top + chartH - bh - 16, { size: 24, weight: 800, fill: T.ink, anchor: 'middle' }));
    }
    body.push(text(String(point.year), bx + barW / 2, top + chartH + 36, { size: 21, fill: T.inkSoft, anchor: 'middle' }));
  });
  body.push(text(unit, x, top - 22, { size: 22, weight: 600, fill: T.amberDark }));
  body.push(text('Achse beginnt bei null', x + w, top - 22, { size: 21, fill: T.inkFaint, anchor: 'end' }));
  const height = top + chartH + 72 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ------------------------------------------------------------------- Balken
export function balken({ eyebrow, title, subtitle, items, unit, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const labelW = 340;
  const x = 70 + labelW;
  // Platz fuer die laengste Wertebeschriftung reservieren, sonst laeuft der
  // laengste Balken darunter.
  const valueGutter = Math.max(...items.map((item) => textWidth(item.valueLabel, 30, 800))) + 40;
  const w = WIDTH - x - valueGutter - 70;
  let y = head.bottom + 36;
  const max = Math.max(...items.map((item) => item.value));
  body.push(text(unit, x, y - 14, { size: 22, weight: 600, fill: T.amberDark }));
  for (const item of items) {
    const bh = 52;
    body.push(text(item.label, 70, y + 36, { size: 28, weight: 700, fill: T.ink }));
    if (item.sublabel) body.push(text(item.sublabel, 70, y + 64, { size: 21, fill: T.inkFaint }));
    body.push(rect(x, y + 8, w, bh, { fill: T.lineSoft, radius: 8 }));
    body.push(rect(x, y + 8, Math.max(8, (item.value / max) * w), bh, { fill: item.fill ?? T.amber, radius: 8 }));
    body.push(text(item.valueLabel, WIDTH - 70, y + 44, { size: 30, weight: 800, fill: T.ink, anchor: 'end' }));
    y += item.sublabel ? 96 : 84;
  }
  if (note) {
    y += 14;
    body.push(paragraph(note, 70, y + 20, WIDTH - 140, { size: 23, fill: T.inkSoft, maxLines: 2 }));
    y += 40;
  }
  const height = y + 30 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// -------------------------------------------------------------- Punktediagramm
// Fuer eng beieinanderliegende Werte. Punkte implizieren keine Laenge, deshalb
// darf die Achse hier beschnitten sein -- sie wird ausdruecklich beschriftet.
export function punkte({ eyebrow, title, subtitle, items, min, max, ticks, suffix, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const labelW = 420;
  const x = 70 + labelW;
  const w = WIDTH - x - 180;
  let y = head.bottom + 40;
  // Der Hinweis gehoert nur dorthin, wo die Achse tatsaechlich beschnitten ist.
  const axisNote = min > 0
    ? `Achse von ${dec(min)}${suffix} bis ${dec(max)}${suffix} — kein Nullpunkt`
    : `Achse von null bis ${dec(max)}${suffix}`;
  body.push(text(axisNote, 70, y - 16, { size: 22, weight: 600, fill: T.amberDark }));
  const rowH = 54;
  const chartTop = y + 10;
  const chartBottom = chartTop + items.length * rowH;
  ticks.forEach((tick) => {
    const tx = x + ((tick - min) / (max - min)) * w;
    body.push(line(tx, chartTop, tx, chartBottom, { stroke: T.lineSoft, width: 1.5 }));
    body.push(text(`${dec(tick)}${suffix}`, tx, chartBottom + 36, { size: 21, fill: T.inkFaint, anchor: 'middle' }));
  });
  items.forEach((item, index) => {
    const cy = chartTop + index * rowH + rowH / 2;
    body.push(text(item.label, 70, cy + 9, { size: 26, weight: item.emphasis ? 800 : 500, fill: item.emphasis ? T.ink : T.inkSoft }));
    body.push(line(x, cy, x + w, cy, { stroke: T.lineSoft, width: 1 }));
    const px = x + ((item.value - min) / (max - min)) * w;
    body.push(`<circle cx="${round(px)}" cy="${round(cy)}" r="${item.emphasis ? 15 : 12}" fill="${item.fill ?? T.green}"/>`);
    body.push(text(item.valueLabel, WIDTH - 70, cy + 9, { size: 25, weight: item.emphasis ? 800 : 600, fill: T.ink, anchor: 'end' }));
  });
  y = chartBottom + 60;
  if (note) {
    body.push(paragraph(note, 70, y + 20, WIDTH - 140, { size: 23, fill: T.inkSoft, maxLines: 3 }));
    y += 40;
  }
  const height = y + 30 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// -------------------------------------------------------------------- Ablauf
export function ablauf({ eyebrow, title, subtitle, steps, source }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const x = 70;
  const w = WIDTH - 140;
  let y = head.bottom + 36;
  const colW = w / steps.length;
  const circleY = y + 46;
  body.push(line(x + colW / 2, circleY, x + w - colW / 2, circleY, { stroke: T.line, width: 3 }));
  // Titel und Fliesstext beginnen in allen Spalten auf derselben Grundlinie,
  // auch wenn ein Titel zweizeilig wird.
  const titleRows = steps.map((step) => wrap(step.title, colW - 30, 27, 800, 2));
  const maxTitleLines = Math.max(...titleRows.map((rows) => rows.length));
  // maxLines ist grosszuegig: lieber eine Zeile mehr als ein Satz, der mit
  // Auslassungspunkten endet.
  const bodyRows = steps.map((step) => wrap(step.body, colW - 30, 23, 400, 9));
  const maxBodyLines = Math.max(...bodyRows.map((rows) => rows.length));
  steps.forEach((step, index) => {
    const cx = x + colW * index + colW / 2;
    body.push(`<circle cx="${round(cx)}" cy="${round(circleY)}" r="34" fill="${T.amber}"/>`);
    body.push(text(String(index + 1), cx, circleY + 13, { size: 34, weight: 800, fill: T.ink, anchor: 'middle' }));
    titleRows[index].forEach((row, li) => {
      body.push(text(row, cx, circleY + 86 + li * 34, { size: 27, weight: 800, fill: T.ink, anchor: 'middle' }));
    });
    bodyRows[index].forEach((row, li) => {
      body.push(text(row, cx, circleY + 86 + maxTitleLines * 34 + 14 + li * 31, { size: 23, fill: T.inkSoft, anchor: 'middle' }));
    });
  });
  const height = circleY + 86 + maxTitleLines * 34 + 14 + maxBodyLines * 31 + 46 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ---------------------------------------------------------------- Kennzahlen
export function kennzahlen({ eyebrow, title, subtitle, tiles, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const x = 70;
  const w = WIDTH - 140;
  const gap = 28;
  const tileW = (w - gap * (tiles.length - 1)) / tiles.length;
  let y = head.bottom + 30;
  const tileH = 260;
  tiles.forEach((tile, index) => {
    const tx = x + (tileW + gap) * index;
    body.push(rect(tx, y, tileW, tileH, { fill: T.paper, radius: 20, stroke: T.line, strokeWidth: 2 }));
    body.push(rect(tx, y, tileW, 8, { fill: index === 0 ? T.amber : T.green, radius: 4 }));
    const valueSize = textWidth(tile.value, 68, 800) > tileW - 60 ? 50 : 68;
    body.push(text(tile.value, tx + tileW / 2, y + 108, { size: valueSize, weight: 800, fill: T.ink, anchor: 'middle' }));
    body.push(text(tile.unit, tx + tileW / 2, y + 146, { size: 24, weight: 600, fill: T.amberDark, anchor: 'middle' }));
    wrap(tile.label, tileW - 50, 23, 400, 3).forEach((row, li) => {
      body.push(text(row, tx + tileW / 2, y + 190 + li * 30, { size: 23, fill: T.inkSoft, anchor: 'middle' }));
    });
  });
  y += tileH + 36;
  if (note) {
    body.push(paragraph(note, x, y + 20, w, { size: 24, fill: T.inkSoft, maxLines: 3 }));
    y += 40;
  }
  const height = y + 30 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}

// ------------------------------------------------------------------ Zwei Wege
export function zweiwege({ eyebrow, title, subtitle, columns, source, note }) {
  const head = header(eyebrow, title, subtitle);
  const body = [];
  const x = 70;
  const w = WIDTH - 140;
  const gap = 36;
  const colW = (w - gap) / 2;
  let y = head.bottom + 30;
  const colors = [T.amber, T.green];
  // Beide Karten bekommen die Hoehe der laengeren Spalte, sonst enden sie
  // auf unterschiedlicher Hoehe und das Bild wirkt schief.
  const boxH = Math.max(...columns.map((column) => {
    const rowsHeight = column.rows.reduce((sum, row) => sum + 44 + wrap(row[1], colW - 68, 24, 500, 2).length * 30, 0);
    const tagsHeight = column.examples ? wrap(column.examples, colW - 68, 24, 500, 3).length * 32 + 70 : 0;
    return 72 + rowsHeight + tagsHeight + 36;
  }));
  let maxBottom = y + boxH;
  columns.forEach((column, index) => {
    const cx = x + (colW + gap) * index;
    let cy = y + 72;
    body.push(rect(cx, y, colW, boxH, { fill: T.paper, radius: 20, stroke: T.line, strokeWidth: 2 }));
    body.push(rect(cx, y, colW, 8, { fill: colors[index], radius: 4 }));
    body.push(text(column.title, cx + 34, y + 56, { size: 36, weight: 800, fill: T.ink }));
    cy = y + 104;
    for (const [label, value] of column.rows) {
      body.push(text(label, cx + 34, cy, { size: 23, weight: 700, fill: T.amberDark }));
      const lines = wrap(value, colW - 68, 24, 500, 2);
      lines.forEach((row, li) => body.push(text(row, cx + 34, cy + 32 + li * 30, { size: 24, weight: 500, fill: T.ink })));
      cy += 44 + lines.length * 30;
    }
    if (column.examples) {
      body.push(line(cx + 34, cy + 2, cx + colW - 34, cy + 2, { stroke: T.lineSoft }));
      body.push(text('Typische Vertreter', cx + 34, cy + 38, { size: 22, weight: 700, fill: T.inkFaint, spacing: 1.2 }));
      wrap(column.examples, colW - 68, 24, 500, 3).forEach((row, li) => {
        body.push(text(row, cx + 34, cy + 74 + li * 32, { size: 24, weight: 500, fill: T.ink }));
      });
    }
  });
  y = maxBottom + 30;
  if (note) {
    body.push(paragraph(note, x, y + 20, w, { size: 24, fill: T.inkSoft, maxLines: 3 }));
    y += 46;
  }
  const height = y + 30 + footerHeight(source);
  return { height, svg: document_(height, head.markup + body.join('') + footer(height, source)) };
}
