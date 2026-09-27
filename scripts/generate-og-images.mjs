import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return match?.[1].trim().replace(/^['"]|['"]$/g, '');
}

function escapeXml(value = '') {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function titleLines(title, maxLength = 28) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 3) return lines;
  return [lines[0], lines[1], `${lines.slice(2).join(' ').slice(0, maxLength - 1).trim()}…`];
}

function imageSvg(title, category = 'Bierwissen') {
  const lines = titleLines(title);
  const fontSize = title.length > 58 ? 58 : 66;
  const lineHeight = fontSize + 14;
  const titleMarkup = lines.map((line, index) => `<text x="86" y="${250 + index * lineHeight}" class="title">${escapeXml(line)}</text>`).join('');
  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#17140f"/>
          <stop offset="1" stop-color="#2b2112"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" rx="0" fill="url(#bg)"/>
      <circle cx="1070" cy="100" r="230" fill="#f3a712" opacity="0.16"/>
      <circle cx="1060" cy="530" r="310" fill="#f3a712" opacity="0.08"/>
      <rect x="86" y="74" width="72" height="8" rx="4" fill="#f3a712"/>
      <style>
        .eyebrow { font: 700 26px Arial, Helvetica, sans-serif; letter-spacing: 3px; fill: #f3a712; }
        .title { font: 800 ${fontSize}px Arial, Helvetica, sans-serif; fill: #fffaf0; }
        .brand { font: 800 34px Arial, Helvetica, sans-serif; fill: #fffaf0; }
        .domain { font: 500 24px Arial, Helvetica, sans-serif; fill: #d7c9b2; }
      </style>
      <text x="86" y="132" class="eyebrow">${escapeXml(category.toUpperCase())}</text>
      ${titleMarkup}
      <g transform="translate(86 535)">
        <rect x="0" y="0" width="34" height="42" rx="5" fill="#f3a712"/>
        <path d="M34 10h11c13 0 13 23 0 23H34" fill="none" stroke="#f3a712" stroke-width="6"/>
        <rect x="5" y="5" width="24" height="7" rx="3" fill="#fff3d6" opacity="0.9"/>
        <text x="68" y="33" class="brand">BierDurst.org</text>
      </g>
      <text x="1114" y="568" text-anchor="end" class="domain">Unabhängig erklärt</text>
    </svg>`;
}

async function markdownFiles(dir) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : (entry.name === 'index.md' ? [path] : []);
  }));
  return nested.flat();
}

const manifest = JSON.parse(await readFile('data/url-manifest.json', 'utf8'));
const launchSlugs = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
const pages = [];

for (const file of await markdownFiles('content')) {
  const source = await readFile(file, 'utf8');
  const frontmatter = source.split('---', 3)[1] ?? '';
  const slug = field(frontmatter, 'slug');
  if (!launchSlugs.has(slug)) continue;
  pages.push({ slug, title: field(frontmatter, 'title'), category: field(frontmatter, 'category') ?? 'BierDurst.org' });
}

for (const page of pages) {
  const output = page.slug === '/' ? 'public/og/index.png' : `public/og${page.slug}index.png`;
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(imageSvg(page.title, page.category)))
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(output);
}

await sharp(Buffer.from(imageSvg('Bierwissen, Vergleiche und Rechner', 'BierDurst.org')))
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile('public/og.png');

console.log(`${pages.length} individuelle OG-Bilder erzeugt.`);

