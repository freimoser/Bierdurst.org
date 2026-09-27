import { getCollection } from 'astro:content';
import manifest from '../../data/url-manifest.json';

export const prerender = true;

const labels: Record<string, string> = {
  home: 'Startseite',
  biersorten: 'Biersorten',
  biervergleich: 'Biervergleiche',
  bierwissen: 'Bierwissen',
  'bier-rechner': 'Bierrechner',
  bierregionen: 'Bierregionen',
  oktoberfest: 'Oktoberfest',
  bestenlisten: 'Bestenlisten',
  legal: 'Über BierDurst.org'
};

export async function GET() {
  const launchSlugs = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
  const entries = await getCollection('pages', ({ data }) => launchSlugs.has(data.slug) && data.index);
  const groups = new Map<string, typeof entries>();

  for (const entry of entries.sort((a, b) => a.data.slug.localeCompare(b.data.slug, 'de'))) {
    const group = entry.data.cluster;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  const sections = [...groups.entries()].map(([group, pages]) => {
    const rows = pages.map(({ data }) => `- [${data.title}](${data.canonical}): ${data.meta_description}`).join('\n');
    return `## ${labels[group] ?? group}\n\n${rows}`;
  });

  const text = [
    '# BierDurst.org',
    '',
    '> Deutschsprachiges Informationsportal zu Biersorten, Bierwissen, Vergleichen, Rechnern, Bierregionen und dem Oktoberfest.',
    '',
    'Die Inhalte werden redaktionell eingeordnet, mit Quellen belegt und fördern einen verantwortungsvollen Umgang mit Alkohol.',
    '',
    ...sections,
    '',
    '## Redaktion und Methodik',
    '',
    '- [Über uns](https://bierdurst.org/ueber-uns/)',
    '- [Quellen und Methodik](https://bierdurst.org/quellen-methodik/)',
    '- [Redaktionsrichtlinien](https://bierdurst.org/redaktionsrichtlinien/)',
    '- [Verantwortungsvoller Alkoholkonsum](https://bierdurst.org/verantwortungsvoller-alkoholkonsum/)',
    ''
  ].join('\n');

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

