import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { unified } from '@astrojs/markdown-remark';

const manifest = JSON.parse(readFileSync(new URL('./data/url-manifest.json', import.meta.url), 'utf8'));
const published = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));

function launchLinksOnly() {
  return (tree) => {
    const walk = (node) => {
      if (node?.type === 'element' && node.tagName === 'a') {
        const href = node.properties?.href;
        if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
          const path = href.split('#')[0].split('?')[0];
          if (path && !published.has(path) && !path.includes('.')) {
            const section = `/${path.split('/').filter(Boolean)[0]}/`;
            node.properties.href = published.has(section) ? section : '/';
          }
        }
      }
      if (Array.isArray(node?.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}

const figures = JSON.parse(readFileSync(new URL('./data/page-figures.json', import.meta.url), 'utf8'));

// Setzt die Uebersichtsgrafik der Seite hinter den ersten Absatz, also hinter
// das "Kurz gesagt". Davor waere sie das LCP-Element und wuerde den Text
// nach unten druecken; dahinter steht sie an der Stelle, an der die Seite
// ihre Zusammenfassung ohnehin bebildert.
// Die Zuordnung kommt aus data/page-figures.json, das scripts/generate-figures.mjs
// schreibt. Steht dort nichts, bleibt die Seite unveraendert.
function articleFigure() {
  return (tree, file) => {
    const path = file?.history?.[0] ?? file?.path ?? '';
    const match = path.replace(/\\/g, '/').match(/\/content\/(.+)\/index\.md$/);
    const slug = match ? `/${match[1]}/` : (path.endsWith('/content/index.md') ? '/' : null);
    const figure = slug ? figures[slug] : null;
    if (!figure || !Array.isArray(tree.children)) return;

    const index = tree.children.findIndex((node) => node.type === 'element' && node.tagName === 'p');
    if (index === -1) return;

    tree.children.splice(index + 1, 0, {
      type: 'element',
      tagName: 'figure',
      properties: { className: ['article-figure'] },
      children: [
        {
          type: 'element',
          tagName: 'img',
          properties: {
            src: figure.src,
            alt: figure.alt,
            width: figure.width,
            height: figure.height,
            loading: 'lazy',
            decoding: 'async'
          },
          children: []
        },
        {
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: figure.caption }]
        }
      ]
    });
  };
}

function removeMarkdownH1() {
  return (tree) => {
    const walk = (node) => {
      if (Array.isArray(node?.children)) {
        node.children = node.children.filter((child) => !(child.type === 'element' && child.tagName === 'h1'));
        node.children.forEach(walk);
      }
    };
    walk(tree);
  };
}

export default defineConfig({
  site: 'https://bierdurst.org',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: unified({
      syntaxHighlight: false,
      rehypePlugins: [launchLinksOnly, removeMarkdownH1, articleFigure]
    })
  },
  build: {
    format: 'directory'
  }
});
