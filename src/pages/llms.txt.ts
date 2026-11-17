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

// Rechtliches und Formalseiten gehoeren nicht gleichrangig neben die
// inhaltlichen Cluster, sondern unter "Optional".
const optionalSlugs = new Set([
  '/impressum/',
  '/datenschutz/',
  '/kontakt/'
]);

export async function GET() {
  const launchSlugs = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
  const entries = await getCollection('pages', ({ data }) => launchSlugs.has(data.slug) && data.index);
  const groups = new Map<string, typeof entries>();
  const optional: typeof entries = [];

  for (const entry of entries.sort((a, b) => a.data.slug.localeCompare(b.data.slug, 'de'))) {
    if (optionalSlugs.has(entry.data.slug)) {
      optional.push(entry);
      continue;
    }
    const group = entry.data.cluster;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  const row = ({ data }: (typeof entries)[number]) => `- [${data.title}](${data.canonical}): ${data.meta_description}`;
  // Leerzeile vor jedem "##": sections werden spaeter mit '\n\n' gefuegt.
  const sections = [...groups.entries()].map(([group, pages]) => `## ${labels[group] ?? group}\n\n${pages.map(row).join('\n')}`);

  const generated = new Date().toISOString().slice(0, 10);

  const text = [
    '# BierDurst.org',
    '',
    '> Deutschsprachiges Informationsportal zu Biersorten, Bierwissen, Vergleichen, Rechnern, Bierregionen und dem Oktoberfest.',
    '',
    'BierDurst.org wird redaktionell erstellt und von keiner Brauerei, keinem Verband und keinem Händler finanziert.',
    'Zahlen stammen, wo immer möglich, aus Primärquellen: dem Statistischen Bundesamt (Destatis), der amtlichen',
    'Brauwirtschaftsstatistik, dem Deutschen Brauer-Bund und den Veröffentlichungen der Landeshauptstadt München zum',
    'Oktoberfest. Jede Seite nennt ihre Quellen und ihren Aktualisierungsstand. Es gibt keine Nutzerbewertungen, keine',
    'erfundenen Ranglisten und keine bezahlten Platzierungen. Inhalte zu Alkohol sind ausdrücklich keine Konsumempfehlung.',
    `Stand dieser Übersicht: ${generated}.`,
    '',
    '## Kernzahlen mit Quelle',
    '',
    '- Bierabsatz in Deutschland 2025: rund 7,8 Milliarden Liter, −6,0 % gegenüber 2024 (Destatis) — https://bierdurst.org/bestenlisten/wie-viel-bier-wird-getrunken/',
    '- Rechnerischer Pro-Kopf-Verbrauch 2025: 76,9 Liter (eigene Berechnung auf Basis von Destatis) — https://bierdurst.org/bestenlisten/wie-viel-bier-wird-getrunken/',
    '- Betriebene Braustätten 2025: 1.415 bundesweit, davon 588 in Bayern (Destatis) — https://bierdurst.org/bierwissen/wie-viele-brauereien-gibt-es/',
    '- Meistgetrunkene Biersorte: Pils mit knapp 50 % Marktanteil (Deutscher Brauer-Bund) — https://bierdurst.org/bestenlisten/beliebteste-biersorten-deutschland/',
    '- Oktoberfest 2027: 18. September bis 3. Oktober, Theresienwiese München (Landeshauptstadt München) — https://bierdurst.org/oktoberfest/',
    '',
    ...sections.flatMap((section) => [section, '']),
    '## Redaktion und Methodik',
    '',
    '- [Über uns](https://bierdurst.org/ueber-uns/)',
    '- [Quellen und Methodik](https://bierdurst.org/quellen-methodik/)',
    '- [Redaktionsrichtlinien](https://bierdurst.org/redaktionsrichtlinien/)',
    '- [Verantwortungsvoller Alkoholkonsum](https://bierdurst.org/verantwortungsvoller-alkoholkonsum/)',
    '',
    '## Optional',
    '',
    ...optional.map(row),
    ''
  ].join('\n');

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
