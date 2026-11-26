// Der Katalog aller Artikelgrafiken.
// Biersorten und Vergleiche entstehen aus den Tabellen der jeweiligen Seite,
// damit Bild und Text dieselben Zahlen zeigen. Alles Uebrige ist hier
// ausgeschrieben und nennt seine Quelle.

import { readFileSync } from 'node:fs';
import { styleProfile, duelProfile, publishedSlugs, pageFile, readBody, tables } from './content.mjs';
import { colorRangeFromWords, ebcColor as ebcColorOf, T } from './svg.mjs';

const stats = JSON.parse(readFileSync('data/beer-market-statistics.json', 'utf8'));
const stat = (slug) => stats.find((entry) => entry.slug === slug);

const dec = (value) => String(value).replace('.', ',');
const pct = (from, to) => (from === to ? `${dec(from)} %` : `${dec(from)} bis ${dec(to)} %`);
const BB = 'Quelle: Deutscher Brauer-Bund, Deutsche Brauwirtschaft in Zahlen 2025. Abruf November 2026.';
const OWN = 'Werte aus der Steckbrief-Tabelle dieser Seite. Stilangaben sind Spannen, keine Markenwerte.';

function bitterLabel(score) {
  if (score === null) return 'ohne Angabe';
  const [from, to] = score;
  const name = (value) => (value < 1.2 ? 'sehr mild' : value < 2.2 ? 'mild' : value < 3.4 ? 'moderat' : value < 4.4 ? 'deutlich' : 'kräftig');
  // "deutlich bis deutlich" waere Unsinn: fallen beide Enden in dieselbe
  // Stufe, nennt die Grafik sie nur einmal.
  return name(from) === name(to) ? name(from) : `${name(from)} bis ${name(to)}`;
}

// --------------------------------------------------------------- Biersorten
const STYLE_PAGES = [
  'pils', 'helles', 'weizenbier', 'dunkelbier', 'schwarzbier', 'koelsch',
  'altbier', 'lagerbier', 'kellerbier-zwickelbier', 'festbier-oktoberfestbier', 'alkoholfreies-bier'
];

function styleFigures() {
  const out = [];
  for (const name of STYLE_PAGES) {
    const slug = `/biersorten/${name}/`;
    const profile = styleProfile(slug);
    if (!profile) continue;
    const colorRange = colorRangeFromWords(profile.colorWords);
    const alcoholFree = name === 'alkoholfreies-bier';
    const alcohol = alcoholFree ? [0, 0.5] : profile.alcohol;
    const alcoholValue = alcoholFree ? '0,0 bis 0,5 % vol' : (profile.alcohol ? `${pct(profile.alcohol[0], profile.alcohol[1])} vol` : 'ohne Angabe');

    const metrics = [
      {
        label: 'Alkoholgehalt',
        value: alcoholValue,
        range: alcohol,
        min: 0, max: 10, ticks: [0, 2.5, 5, 7.5, 10], suffix: ' %'
      },
      {
        label: 'Bitterkeit laut Steckbrief',
        value: bitterLabel(profile.bitterness),
        range: profile.bitterness,
        min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5],
        note: profile.bitternessText,
        fill: T.green
      },
      {
        label: 'Trinktemperatur',
        value: profile.temperature ? `${dec(profile.temperature[0])} bis ${dec(profile.temperature[1])} °C` : 'ohne Angabe',
        range: profile.temperature,
        min: 0, max: 16, ticks: [0, 4, 8, 12, 16], suffix: ' °'
      }
    ];

    // Ausgeschrieben statt mit Prozentzeichen: Der Alt-Text wird vorgelesen.
    const alcoholPhrase = alcoholFree
      ? 'Alkoholgehalt 0,0 bis 0,5 Prozent'
      : `Alkoholgehalt ${pct(profile.alcohol[0], profile.alcohol[1]).replace(' %', ' Prozent')}`;
    out.push({
      slug,
      file: `biersorten-${name}`,
      template: 'steckbrief',
      props: {
        profile: { ...profile, colorRange, metrics },
        eyebrow: 'Biersorte',
        source: OWN
      },
      alt: `Steckbrief-Grafik zu ${profile.name}: ein Bierglas in der Farbe ${profile.colorWords.split(',')[0]}, daneben Balken für ${alcoholPhrase}, Bitterkeit ${bitterLabel(profile.bitterness)} und Trinktemperatur ${profile.temperature ? `${dec(profile.temperature[0])} bis ${dec(profile.temperature[1])} Grad` : 'ohne Angabe'}.`,
      caption: `${profile.name} auf einen Blick: Farbe, ${alcoholFree ? 'Restalkohol' : 'Alkoholgehalt'}, Bitterkeit und Trinktemperatur. Die Werte sind Stilspannen aus der Tabelle unten — einzelne Marken können davon abweichen.`
    });
  }
  return out;
}

// ------------------------------------------------------------- Biervergleich
const DUEL_PAGES = ['pils-oder-helles', 'pils-oder-lager', 'lager-oder-helles', 'koelsch-oder-altbier', 'dunkelbier-oder-schwarzbier'];

function duelFigures() {
  const out = [];
  for (const name of DUEL_PAGES) {
    const slug = `/biervergleich/${name}/`;
    const duel = duelProfile(slug);
    if (!duel) continue;
    const prep = (side) => ({ ...side, colorRange: colorRangeFromWords(side.colorWords) });
    const left = prep(duel.left);
    const right = prep(duel.right);
    const metrics = [
      {
        label: 'Alkoholgehalt in Prozent',
        min: 3.5, max: 6.5, ticks: [3.5, 4.5, 5.5, 6.5], suffix: ' %',
        values: [left, right].map((side) => ({ range: side.alcohol, label: side.alcohol ? `${pct(side.alcohol[0], side.alcohol[1])} vol` : 'ohne Angabe' }))
      },
      {
        label: 'Bitterkeit laut Steckbrief',
        min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5],
        values: [left, right].map((side) => ({ range: side.bitterness, label: bitterLabel(side.bitterness) }))
      },
      {
        label: 'Trinktemperatur in Grad',
        min: 2, max: 14, ticks: [2, 6, 10, 14], suffix: ' °',
        values: [left, right].map((side) => ({ range: side.temperature, label: side.temperature ? `${dec(side.temperature[0])} bis ${dec(side.temperature[1])} °C` : 'ohne Angabe' }))
      }
    ];
    out.push({
      slug,
      file: `biervergleich-${name}`,
      template: 'duell',
      props: {
        title: `${left.name} oder ${right.name}`,
        left, right, metrics,
        note: `${left.name}: ${left.classification}. ${right.name}: ${right.classification}.`,
        source: OWN
      },
      alt: `Vergleichsgrafik ${left.name} gegen ${right.name}: zwei Biergläser in ihrer typischen Farbe, darunter Balken für Alkoholgehalt, Bitterkeit und Trinktemperatur. ${left.name} liegt bei ${left.alcohol ? pct(left.alcohol[0], left.alcohol[1]).replace(' %', ' Prozent') : 'ohne Angabe'} Alkohol, ${right.name} bei ${right.alcohol ? pct(right.alcohol[0], right.alcohol[1]).replace(' %', ' Prozent') : 'ohne Angabe'}.`,
      caption: `${left.name} und ${right.name} auf denselben Skalen. Die Balken zeigen Spannen des Bierstils, nicht Werte einzelner Marken.`
    });
  }
  return out;
}

// ------------------------------------------------------------- Handgebautes
function manualFigures() {
  const brauereien = stat('brauereien-deutschland');
  const absatz = stat('bierabsatz-deutschland');
  const beschaeftigte = stat('beschaeftigte-brauindustrie-deutschland');

  return [
    {
      slug: '/bierwissen/ibu-beim-bier/',
      file: 'bierwissen-ibu-skala',
      template: 'skala',
      props: {
        eyebrow: 'Bierwissen', title: 'Die IBU-Skala im Überblick',
        subtitle: 'IBU misst die analytisch bestimmbaren Bitterstoffe aus dem Hopfen. Wie bitter ein Bier schmeckt, hängt zusätzlich von Malz, Alkohol und Restsüße ab.',
        axisLabel: 'INTERNATIONAL BITTERNESS UNITS',
        bands: [
          { value: 'unter 15', label: 'sehr mild', fill: '#fdf0c8', examples: 'viele milde Helle und Weizenbiere' },
          { value: '15 – 25', label: 'mild bis ausgewogen', fill: '#f8dc8a', examples: 'Helles, Kölsch, Export' },
          { value: '25 – 40', label: 'klar wahrnehmbare Bittere', fill: '#f3a712', examples: 'viele deutsche Pilsbiere' },
          { value: '40 – 60', label: 'deutlich bitter', fill: '#c77700', dark: true, examples: 'norddeutsches Pils, Altbier' },
          { value: 'über 60', label: 'sehr stark gehopft', fill: '#21493e', dark: true, examples: 'IPA und moderne Hopfenbiere' }
        ],
        source: 'Einordnung aus der Tabelle dieser Seite. Zwei Biere mit gleicher IBU-Zahl können unterschiedlich bitter schmecken.'
      },
      alt: 'Fünfstufige IBU-Skala von unter 15 für sehr milde Biere über 25 bis 40 für klar wahrnehmbare Bittere bis über 60 für sehr stark gehopfte Biere wie IPA, mit Beispielen je Stufe.',
      caption: 'Die IBU-Skala als grobe Orientierung. Ein kräftiger Malzkörper kann hohe Werte ausgleichen — gleiche IBU bedeutet deshalb nicht gleicher Geschmack.'
    },
    {
      slug: '/bierwissen/ebc-beim-bier/',
      file: 'bierwissen-ebc-farbskala',
      template: 'skala',
      props: {
        eyebrow: 'Bierwissen', title: 'Die EBC-Farbskala von strohgelb bis schwarz',
        subtitle: 'EBC beschreibt die Farbe von Bier und Würze über die Lichtabsorption. Niedrige Werte stehen für sehr helle, hohe für dunkelbraune bis schwarze Biere.',
        axisLabel: 'EUROPEAN BREWERY CONVENTION',
        swatchFromEbc: true,
        bands: [
          { value: '4 – 8', label: 'sehr hell bis strohgelb', ebc: 6, examples: 'Helles, leichtes Lager' },
          { value: '8 – 16', label: 'goldgelb', ebc: 12, examples: 'Pils, Export' },
          { value: '16 – 30', label: 'bernsteinfarben', ebc: 23, examples: 'Märzen, Kellerbier' },
          { value: '30 – 60', label: 'kupfer bis braun', ebc: 45, dark: true, examples: 'Altbier, Dunkelbier' },
          { value: 'über 60', label: 'dunkelbraun bis schwarz', ebc: 85, dark: true, examples: 'Schwarzbier, Porter, Stout' }
        ],
        source: 'Farbbereiche aus der Tabelle dieser Seite. Der sichtbare Eindruck hängt zusätzlich von Glas, Licht und Trübung ab.'
      },
      alt: 'EBC-Farbskala in fünf Feldern: 4 bis 8 strohgelb für Helles, 8 bis 16 goldgelb für Pils, 16 bis 30 bernsteinfarben für Märzen, 30 bis 60 kupfer bis braun für Altbier und über 60 dunkelbraun bis schwarz für Schwarzbier und Stout.',
      caption: 'Die EBC-Werte als Farbflächen. Farbe verrät weder Alkoholgehalt noch Süße: Ein dunkles Bier kann leicht und trocken sein.'
    },
    {
      slug: '/bierwissen/optimale-trinktemperatur-bier/',
      file: 'bierwissen-trinktemperatur',
      template: 'skala',
      props: {
        eyebrow: 'Bierwissen', title: 'Trinktemperatur nach Bierstil',
        subtitle: 'Leichte, erfrischende Biere schmecken kühler. Aromatische, dunkle und starke Biere dürfen wärmer sein, weil Kälte Geruch und Geschmack dämpft.',
        axisLabel: 'GUTE AUSGANGSTEMPERATUR IN GRAD CELSIUS',
        bands: [
          { value: '5 – 7 °C', label: 'Pils und leichtes Lager', fill: '#cfe6ef', examples: 'auch alkoholfreies Pils' },
          { value: '6 – 9 °C', label: 'Helles, Kölsch und Weizen', fill: '#f8dc8a', examples: 'Export und Kristallweizen' },
          { value: '8 – 10 °C', label: 'Kellerbier, Dunkel und Märzen', fill: '#f3a712', examples: 'Zwickel und Rotbier' },
          { value: '10 – 13 °C', label: 'Bockbier und kräftige Ales', fill: '#c77700', dark: true, examples: 'Maibock und Doppelbock' },
          { value: '12 – 15 °C', label: 'sehr starke Stouts und Spezialbiere', fill: '#21493e', dark: true, examples: 'Eisbock, Imperial Stout' }
        ],
        source: 'Startwerte aus der Tabelle dieser Seite. Bier erwärmt sich im Glas, darf also etwas kühler eingeschenkt werden.'
      },
      alt: 'Temperaturskala für Bier in fünf Stufen von 5 bis 7 Grad für Pils und leichtes Lager über 8 bis 10 Grad für Kellerbier und Dunkel bis 12 bis 15 Grad für sehr starke Stouts und Spezialbiere.',
      caption: 'Startwerte, keine festen Regeln. Ein Bier, das im Glas wärmer wird, zeigt oft mehr Aroma; eiskaltes Bier wirkt milder und weniger bitter.'
    },
    {
      slug: '/bierwissen/stammwuerze-beim-bier/',
      file: 'bierwissen-stammwuerze',
      template: 'skala',
      props: {
        eyebrow: 'Bierwissen', title: 'Stammwürze und die deutschen Biergattungen',
        subtitle: 'Die Stammwürze in Grad Plato beschreibt den Extraktgehalt der Würze vor der Gärung. Das deutsche Biersteuerrecht teilt Biere danach in Gattungen ein.',
        axisLabel: 'STAMMWÜRZE IN GRAD PLATO',
        bands: [
          { value: 'unter 7 °P', label: 'Einfachbier', fill: '#fdf0c8', weight: 1, examples: 'sehr leichte Biere, selten im Handel' },
          { value: '7 – 11 °P', label: 'Schankbier', fill: '#f8dc8a', weight: 1.2, examples: 'leichte Biere, Berliner Weisse' },
          { value: '11 – 16 °P', label: 'Vollbier', fill: '#f3a712', weight: 2, examples: 'Pils, Helles, Weizen, Kölsch, Alt' },
          { value: 'ab 16 °P', label: 'Starkbier', fill: '#c77700', weight: 1.2, dark: true, examples: 'Bock, Doppelbock, Eisbock' }
        ],
        source: 'Gattungsgrenzen nach dem deutschen Biersteuerrecht. Stammwürze ist nicht dasselbe wie Alkoholgehalt.'
      },
      alt: 'Skala der Stammwürze in Grad Plato mit den vier deutschen Biergattungen: Einfachbier unter 7 Grad, Schankbier 7 bis 11 Grad, Vollbier 11 bis 16 Grad mit Pils und Helles sowie Starkbier ab 16 Grad mit Bock und Doppelbock.',
      caption: 'Die Stammwürze entscheidet über die Biergattung, nicht der Alkoholgehalt. Der größte Teil des deutschen Marktes liegt im Bereich Vollbier.'
    },
    {
      slug: '/bierwissen/obergaerig-oder-untergaerig/',
      file: 'bierwissen-gaerung',
      template: 'zweiwege',
      props: {
        eyebrow: 'Bierwissen', title: 'Obergärig oder untergärig: der Unterschied',
        subtitle: 'Die Gärungsart ist das wichtigste Ordnungsmerkmal der Bierwelt. Sie entscheidet über Hefestamm, Gärtemperatur und einen großen Teil des Aromas.',
        columns: [
          {
            title: 'Obergärig',
            rows: [
              ['HEFE', 'Saccharomyces cerevisiae, steigt zum Ende der Gärung nach oben'],
              ['GÄRTEMPERATUR', 'etwa 15 bis 22 °C, also deutlich wärmer'],
              ['TYPISCHES AROMA', 'fruchtige und würzige Gärnebenprodukte, etwa Banane oder Nelke'],
              ['REIFEZEIT', 'meist kürzer']
            ],
            examples: 'Weizenbier, Kölsch, Altbier, Pale Ale, Stout, Porter, Gose'
          },
          {
            title: 'Untergärig',
            rows: [
              ['HEFE', 'Saccharomyces pastorianus, sinkt zum Ende der Gärung nach unten'],
              ['GÄRTEMPERATUR', 'etwa 4 bis 12 °C, also deutlich kühler'],
              ['TYPISCHES AROMA', 'sauber vergoren, Malz und Hopfen treten klarer hervor'],
              ['REIFEZEIT', 'meist länger, das Bier lagert kühl nach']
            ],
            examples: 'Pils, Helles, Export, Lager, Märzen, Dunkelbier, Schwarzbier, Bock'
          }
        ],
        note: 'Die Gärungsart sagt nichts über Farbe oder Stärke: Es gibt helle und dunkle Biere in beiden Familien.',
        source: 'Einordnung nach gängiger Brauereipraxis und den Stilprofilen dieser Seite.'
      },
      alt: 'Gegenüberstellung von obergäriger und untergäriger Gärung: links Saccharomyces cerevisiae bei 15 bis 22 Grad mit fruchtigem Aroma und Beispielen wie Weizenbier und Kölsch, rechts Saccharomyces pastorianus bei 4 bis 12 Grad mit sauberem Aroma und Beispielen wie Pils und Helles.',
      caption: 'Hefe, Gärtemperatur und Reifezeit trennen die beiden Bierfamilien. Farbe und Alkoholgehalt gehören nicht dazu.'
    },
    {
      slug: '/bierwissen/wie-viele-brauereien-gibt-es/',
      file: 'bierwissen-brauereien-zeitreihe',
      template: 'zeitreihe',
      props: {
        eyebrow: 'Bestenlisten und Zahlen', title: 'Braustätten in Deutschland seit 2015',
        subtitle: brauereien.summary,
        series: brauereien.series,
        unit: 'BETRIEBENE BRAUSTÄTTEN',
        valueFormat: (value) => value.toLocaleString('de-DE'),
        highlight: [2019, 2025],
        source: `${brauereien.sourceName}. ${brauereien.sourceDate}. ${brauereien.chartNote}`
      },
      alt: 'Balkendiagramm der betriebenen Braustätten in Deutschland von 2015 bis 2025. Der Höchststand liegt 2019 bei 1.552, danach sinkt die Zahl auf 1.415 im Jahr 2025.',
      caption: 'Nach dem Höchststand 2019 ist die Zahl der Braustätten um 8,8 Prozent gesunken. Die Achse beginnt bei null, die Säulen sind damit direkt vergleichbar.'
    },
    {
      slug: '/bestenlisten/wie-viel-bier-wird-getrunken/',
      file: 'bestenlisten-bierabsatz-zeitreihe',
      template: 'zeitreihe',
      props: {
        eyebrow: 'Bestenlisten und Zahlen', title: 'Bierabsatz in Deutschland seit 2015',
        subtitle: absatz.summary,
        series: absatz.series,
        unit: 'MILLIONEN HEKTOLITER',
        // Die Reihe steht bereits in Millionen Hektolitern.
        valueFormat: (value) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
        highlight: [2015, 2025],
        source: `${absatz.sourceName}. ${absatz.sourceDate}. ${absatz.chartNote}`
      },
      alt: 'Balkendiagramm des Bierabsatzes in Deutschland von 2015 bis 2025 mit einem Rückgang auf 77,7 Millionen Hektoliter im Jahr 2025, dem niedrigsten Wert der Reihe.',
      caption: 'Der steuerlich erfasste Bierabsatz liegt 2025 um 19 Prozent unter dem Wert von 2015. Alkoholfreies Bier und Malztrunk sind in dieser Reihe nicht enthalten.'
    },
    {
      slug: '/bestenlisten/beliebteste-biersorten-deutschland/',
      file: 'bestenlisten-beliebteste-biersorten',
      template: 'balken',
      props: {
        eyebrow: 'Bestenlisten und Zahlen', title: 'Die drei größten Biersorten in Deutschland',
        subtitle: 'Pils ist weiterhin mit Abstand die beliebteste Biersorte. Helles folgt auf Platz 2, alkoholfreies Bier auf Platz 3.',
        unit: 'MARKTANTEIL, GROB',
        items: [
          { label: 'Pils', sublabel: 'weiterhin klar führend', value: 50, valueLabel: 'knapp 50 %' },
          { label: 'Helles', sublabel: 'wächst bundesweit', value: 12, valueLabel: 'etwa 12 %', fill: T.green },
          { label: 'Alkoholfreies Bier', sublabel: 'stark wachsend', value: 9.5, valueLabel: '9,5 %', fill: T.green }
        ],
        note: 'Nicht verwechseln: Alkoholfreie Biere und Biermischgetränke haben 2025 erstmals beim Umsatz im Handel die 10-Prozent-Marke überschritten. Der Marktanteil liegt bei 9,5 Prozent.',
        source: 'Quelle: Deutscher Brauer-Bund, Stand Februar 2026. Werte können je nach Absatz, Umsatz und Erhebungsmethode abweichen.'
      },
      alt: 'Balkendiagramm der drei größten Biersorten in Deutschland: Pils mit knapp 50 Prozent Marktanteil, Helles mit etwa 12 Prozent und alkoholfreies Bier mit 9,5 Prozent.',
      caption: 'Pils hat rund viermal so viel Marktanteil wie Helles. Die Balken beginnen bei null und sind deshalb direkt vergleichbar.'
    },
    {
      slug: '/oktoberfest/bierpreise/',
      file: 'oktoberfest-masspreise',
      template: 'punkte',
      props: {
        eyebrow: 'Oktoberfest', title: 'Maßpreise in den großen Festzelten 2026',
        subtitle: 'In den regulären Zelten lagen die Preise eng beieinander. Die Augustiner-Festhalle war am günstigsten, das Weinzelt ist ein eigener Fall.',
        min: 14.5, max: 18.5, ticks: [14.5, 15.5, 16.5, 17.5, 18.5], suffix: ' €',
        items: [
          { label: 'Augustiner-Festhalle', value: 14.9, valueLabel: '14,90 €', emphasis: true, fill: T.amber },
          { label: 'Fischer-Vroni', value: 15.75, valueLabel: '15,75 €' },
          { label: 'Hacker-Festzelt', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Hofbräu-Festzelt', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Käfer Wiesn-Schänke', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Marstall', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Ochsenbraterei', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Paulaner-Festzelt', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Schottenhamel', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Schützen-Festzelt', value: 15.8, valueLabel: '15,80 €' },
          { label: 'Armbrustschützenzelt', value: 15.9, valueLabel: '15,90 €' },
          { label: 'Bräurosl', value: 15.9, valueLabel: '15,90 €' },
          { label: 'Löwenbräu-Festzelt', value: 15.9, valueLabel: '15,90 €' },
          { label: 'Kufflers Weinzelt', value: 18.4, valueLabel: '18,40 €', emphasis: true, fill: T.inkSoft }
        ],
        note: 'Das Weinzelt schenkt in der Maß Weißbier aus und wird deshalb getrennt betrachtet. Die Preise für 2027 sind noch nicht veröffentlicht.',
        source: 'Offizielle Maßpreise des Oktoberfests 2026, Landeshauptstadt München. Stand dieser Seite: 11. November 2026.'
      },
      alt: 'Punktdiagramm der Maßpreise auf dem Oktoberfest 2026: elf große Festzelte liegen zwischen 15,75 und 15,90 Euro, die Augustiner-Festhalle bei 14,90 Euro und Kufflers Weinzelt mit Weißbier bei 18,40 Euro.',
      caption: 'Dreizehn der vierzehn großen Zelte lagen 2026 innerhalb von einem Euro. Die Achse ist bewusst beschnitten und beginnt bei 14,50 Euro.'
    },
    {
      slug: '/bierwissen/wie-wird-bier-gebraut/',
      file: 'bierwissen-brauprozess',
      template: 'ablauf',
      props: {
        eyebrow: 'Bierwissen', title: 'Wie Bier gebraut wird: fünf Schritte',
        subtitle: 'Vom Getreidekorn zum fertigen Bier führt ein Weg, der sich seit Jahrhunderten kaum verändert hat. Nur die Technik dahinter ist heute präziser.',
        steps: [
          { title: 'Mälzen', body: 'Gerste keimt kontrolliert und wird gedarrt. Die Darrtemperatur bestimmt die spätere Farbe.' },
          { title: 'Maischen', body: 'Das Schrot wird mit Wasser erhitzt. Enzyme bauen Stärke zu Zucker ab.' },
          { title: 'Läutern', body: 'Die klare Würze wird von den festen Resten getrennt. Zurück bleibt der Treber.' },
          { title: 'Würzekochen', body: 'Die Würze kocht mit Hopfen. Dabei entstehen die Bitterstoffe, die IBU misst.' },
          { title: 'Gären, reifen', body: 'Hefe wandelt Zucker in Alkohol und Kohlensäure um. Danach reift das Bier kühl nach.' }
        ],
        source: 'Ablauf nach gängiger Brauereipraxis. Das Reinheitsgebot erlaubt für untergäriges Bier Wasser, Malz, Hopfen und Hefe.'
      },
      alt: 'Ablaufgrafik des Bierbrauens in fünf nummerierten Schritten: Mälzen, Maischen, Läutern, Würzekochen sowie Gären und Reifen, jeweils mit kurzer Erklärung.',
      caption: 'Fünf Schritte vom Korn zum Bier. Die Darrtemperatur beim Mälzen entscheidet über die Farbe, das Würzekochen über die Bitterkeit.'
    },
    {
      slug: '/bierwissen/bier-richtig-einschenken/',
      file: 'bierwissen-einschenken',
      template: 'ablauf',
      props: {
        eyebrow: 'Bierwissen', title: 'Bier richtig einschenken',
        subtitle: 'Eine stabile Schaumkrone ist kein Zufall. Sie hängt an Glas, Winkel, Tempo und Temperatur.',
        steps: [
          { title: 'Glas spülen', body: 'Sauber und fettfrei. Fettreste lassen den Schaum sofort zusammenfallen.' },
          { title: 'Schräg ansetzen', body: 'Das Glas etwa 45 Grad neigen und das Bier an die Innenwand laufen lassen.' },
          { title: 'Aufrichten', body: 'Ab der Hälfte das Glas langsam gerade stellen, damit sich Schaum bildet.' },
          { title: 'Absetzen lassen', body: 'Kurz warten, dann nachschenken. So wird die Krone fest statt grobporig.' }
        ],
        source: 'Hinweise aus dem Text dieser Seite. Glasform und Kohlensäuregehalt beeinflussen das Ergebnis zusätzlich.'
      },
      alt: 'Ablaufgrafik zum Einschenken von Bier in vier Schritten: sauberes Glas spülen, Glas schräg ansetzen, beim Einschenken aufrichten und den Schaum absetzen lassen.',
      caption: 'Vier Schritte zu einer stabilen Schaumkrone. Ein fettfreies Glas ist dabei wichtiger als das Tempo.'
    },
    {
      slug: '/bierwissen/wie-viele-flaschen-bierkasten/',
      file: 'bierwissen-bierkasten',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Der Standard-Bierkasten in Zahlen',
        subtitle: 'Der verbreitetste Kasten in Deutschland fasst 20 Flaschen zu 0,5 Litern. Daneben gibt es mehrere gängige Abweichungen.',
        tiles: [
          { value: '20', unit: 'FLASCHEN', label: 'im verbreitetsten Kasten mit 0,5-Liter-Flaschen' },
          { value: '10', unit: 'LITER', label: 'Füllmenge dieses Kastens, ohne Leergut gerechnet' },
          { value: '≈ 15', unit: 'KILOGRAMM', label: 'Gesamtgewicht mit Glas und Kasten, je nach Flaschentyp' }
        ],
        note: 'Häufige Abweichungen: 24 Flaschen zu 0,33 Litern ergeben rund 8 Liter, 11 Flaschen zu 0,5 Litern rund 5,5 Liter. Entscheidend ist immer die Angabe auf dem Kasten.',
        source: 'Werte aus den Tabellen dieser Seite. Gewichte schwanken mit Flaschenform, Glasstärke und Kastenmaterial.'
      },
      alt: 'Drei Kennzahlen zum Standard-Bierkasten: 20 Flaschen, 10 Liter Füllmenge und rund 15 Kilogramm Gesamtgewicht mit Glas und Kasten.',
      caption: 'Der verbreitetste Kasten: 20 mal 0,5 Liter ergeben 10 Liter Bier und rund 15 Kilogramm, die man tragen muss.'
    },
    {
      slug: '/bierwissen/wie-viele-glaeser-aus-bierfass/',
      file: 'bierwissen-fass-glaeser',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Wie viele Gläser ein Bierfass ergibt',
        subtitle: 'Die rechnerische Zahl ist eine Obergrenze. Schaum, Anstich und Restmengen im Fass verringern sie in der Praxis.',
        tiles: [
          { value: '60', unit: 'GLÄSER À 0,5 L', label: 'rechnerisch aus einem 30-Liter-Fass' },
          { value: '100', unit: 'GLÄSER À 0,5 L', label: 'rechnerisch aus einem 50-Liter-Fass' },
          { value: '5 – 10 %', unit: 'VERLUST', label: 'realistischer Abzug für Schaum, Anstich und Restmenge' }
        ],
        note: 'Für die Planung einer Feier lohnt es sich, mit der unteren Zahl zu rechnen: Ein 50-Liter-Fass ergibt praktisch eher 90 als 100 Gläser.',
        source: 'Werte aus den Tabellen dieser Seite. Der Verlust hängt stark von Zapfanlage, Kühlung und Bedienung ab.'
      },
      alt: 'Drei Kennzahlen zum Bierfass: 60 Gläser zu 0,5 Litern aus einem 30-Liter-Fass, 100 Gläser aus einem 50-Liter-Fass und 5 bis 10 Prozent Verlust durch Schaum und Restmenge.',
      caption: 'Die rechnerische Zahl ist die Obergrenze. Wer eine Feier plant, sollte 5 bis 10 Prozent Verlust einkalkulieren.'
    },
    {
      slug: '/oktoberfest/sechs-oktoberfestbrauereien/',
      file: 'oktoberfest-brauereien',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Oktoberfest', title: 'Die sechs Münchner Oktoberfestbrauereien',
        subtitle: 'Nur Bier dieser sechs Brauereien darf auf dem Oktoberfest ausgeschenkt werden. Die Bezeichnung Oktoberfestbier ist geschützt.',
        tiles: [
          { value: '6', unit: 'BRAUEREIEN', label: 'Augustiner, Hacker-Pschorr, Hofbräu, Löwenbräu, Paulaner und Spaten' },
          { value: 'München', unit: 'STADTGEBIET', label: 'Voraussetzung: Das Bier muss im Münchner Stadtgebiet gebraut werden' },
          { value: 'ca. 6 %', unit: 'VOL ALKOHOL', label: 'Festbier ist stärker eingebraut als ein normales Helles' }
        ],
        note: 'Die Zulassung ist an den Brauort gebunden, nicht an die Eigentümerstruktur. Mehrere der sechs Brauereien gehören heute zu größeren Konzernen.',
        source: 'Landeshauptstadt München, Regelwerk zum Oktoberfest. Abruf November 2026.'
      },
      alt: 'Drei Kennzahlen zu den Oktoberfestbrauereien: sechs zugelassene Münchner Brauereien, Brauort im Münchner Stadtgebiet als Voraussetzung und rund 6 Prozent Alkohol im Festbier.',
      caption: 'Sechs Brauereien, ein Brauort: Nur im Münchner Stadtgebiet gebrautes Bier darf auf der Wiesn ausgeschenkt werden.'
    },
    {
      slug: '/bierwissen/wie-viele-kalorien-hat-bier/',
      file: 'bierwissen-kalorien',
      template: 'balken',
      props: {
        eyebrow: 'Bierwissen', title: 'Kalorien je 0,5 Liter nach Bierart',
        subtitle: 'Der Alkohol liefert den größten Teil der Energie, der Restextrakt den Rest. Deshalb liegen starke Biere deutlich höher.',
        unit: 'KILOKALORIEN JE 0,5 LITER, GERUNDET',
        items: [
          { label: 'Alkoholfreies Bier', sublabel: 'je nach Ausgangsstil', value: 115, valueLabel: 'ca. 115 kcal', fill: T.green },
          { label: 'Leichtbier', sublabel: 'reduzierter Alkohol', value: 140, valueLabel: 'ca. 140 kcal', fill: T.green },
          { label: 'Pils', sublabel: 'trocken vergoren', value: 210, valueLabel: 'ca. 210 kcal' },
          { label: 'Helles', sublabel: 'etwas mehr Restextrakt', value: 215, valueLabel: 'ca. 215 kcal' },
          { label: 'Weizenbier', sublabel: 'vollmundiger', value: 230, valueLabel: 'ca. 230 kcal' },
          { label: 'Bockbier', sublabel: 'deutlich stärker', value: 330, valueLabel: 'ca. 330 kcal', fill: T.amberDark }
        ],
        note: 'Gerundete Orientierungswerte. Maßgeblich ist immer die Nährwertangabe des jeweiligen Produkts.',
        source: 'Werte aus der Kalorientabelle dieser Seite. Alkohol liefert rund 7 Kilokalorien je Gramm.'
      },
      alt: 'Balkendiagramm der Kalorien je halbem Liter Bier: alkoholfreies Bier rund 115 Kilokalorien, Leichtbier 140, Pils 210, Helles 215, Weizenbier 230 und Bockbier rund 330 Kilokalorien.',
      caption: 'Bockbier liefert je halbem Liter fast dreimal so viel Energie wie alkoholfreies Bier. Der Alkohol macht den Unterschied, nicht die Farbe.'
    },
    {
      slug: '/bierwissen/wie-viel-alkohol-hat-bier/',
      file: 'bierwissen-alkoholgehalt',
      template: 'skala',
      props: {
        eyebrow: 'Bierwissen', title: 'Alkoholgehalt nach Bierart',
        subtitle: 'Der Alkoholgehalt hängt an der Stammwürze und am Vergärungsgrad. Die Bierart gibt nur die Richtung vor, entscheidend bleibt das Etikett.',
        axisLabel: 'ALKOHOL IN PROZENT VOL',
        bands: [
          { value: '0,0 – 0,5 %', label: 'alkoholfrei', fill: '#cfe6ef', examples: 'alkoholfreies Pils und Weizen' },
          { value: '2,5 – 3,5 %', label: 'Schankbier und Leichtbier', fill: '#fdf0c8', examples: 'Berliner Weisse, Leichtbier' },
          { value: '4,5 – 5,5 %', label: 'der übliche Bereich', fill: '#f3a712', weight: 1.6, examples: 'Pils, Helles, Weizen, Kölsch, Alt' },
          { value: '5,8 – 6,3 %', label: 'Festbier und Export', fill: '#c77700', dark: true, examples: 'Oktoberfestbier, Exportbier' },
          { value: 'ab 6,5 %', label: 'Starkbier', fill: '#21493e', dark: true, examples: 'Bock, Doppelbock, Eisbock' }
        ],
        source: 'Spannen aus den Steckbriefen dieser Seite. Der konkrete Wert auf dem Etikett ist verbindlich.'
      },
      alt: 'Skala des Alkoholgehalts von Bier: 0,0 bis 0,5 Prozent alkoholfrei, 2,5 bis 3,5 Prozent Schank- und Leichtbier, 4,5 bis 5,5 Prozent der übliche Bereich mit Pils und Helles, 5,8 bis 6,3 Prozent Festbier sowie ab 6,5 Prozent Starkbier.',
      caption: 'Der ganz überwiegende Teil des deutschen Biermarktes liegt zwischen 4,5 und 5,5 Prozent. Festbier und Bock liegen darüber.'
    },
    {
      slug: '/bierwissen/wie-lange-ist-bier-haltbar/',
      file: 'bierwissen-haltbarkeit',
      template: 'zweiwege',
      props: {
        eyebrow: 'Bierwissen', title: 'Was mit Bier nach dem Mindesthaltbarkeitsdatum passiert',
        subtitle: 'Das Mindesthaltbarkeitsdatum ist kein Verfallsdatum. Es beschreibt, wie lange die Brauerei die volle Qualität zusichert.',
        columns: [
          {
            title: 'Gut gelagert',
            rows: [
              ['TEMPERATUR', 'kühl und gleichmäßig, etwa 5 bis 10 °C'],
              ['LICHT', 'dunkel, am besten im Karton oder Keller'],
              ['POSITION', 'stehend, damit der Kronkorken trocken bleibt'],
              ['NACH DEM MHD', 'meist über Monate trinkbar, verliert aber langsam Frische und Hopfenaroma']
            ],
            examples: 'Starkbier und dunkle Biere reifen teils sogar gewollt nach'
          },
          {
            title: 'Schlecht gelagert',
            rows: [
              ['TEMPERATUR', 'warm oder stark schwankend, etwa auf dem Balkon'],
              ['LICHT', 'direkte Sonne, besonders in grünen und klaren Flaschen'],
              ['POSITION', 'liegend über lange Zeit'],
              ['NACH DEM MHD', 'pappige, kartonartige oder strohige Noten, flacher Schaum']
            ],
            examples: 'Helle, hopfenbetonte Biere wie Pils reagieren am empfindlichsten'
          }
        ],
        note: 'Trübungen, ungewöhnlicher Geruch oder ein zischend überschäumender Inhalt sind Gründe, ein Bier nicht mehr zu trinken.',
        source: 'Einordnung aus dem Text dieser Seite. Das Mindesthaltbarkeitsdatum ist lebensmittelrechtlich kein Verbrauchsdatum.'
      },
      alt: 'Gegenüberstellung guter und schlechter Bierlagerung: links kühl, dunkel und stehend mit monatelanger Trinkbarkeit nach dem Mindesthaltbarkeitsdatum, rechts warm, sonnig und liegend mit pappigen Fehlaromen.',
      caption: 'Lagerung entscheidet mehr über die Haltbarkeit als das aufgedruckte Datum. Wärme und Licht sind die beiden größten Risiken.'
    },
    {
      slug: '/bierwissen/welches-bierglas/',
      file: 'bierwissen-bierglaeser',
      template: 'ablauf',
      props: {
        eyebrow: 'Bierwissen', title: 'Welches Glas zu welchem Bier passt',
        subtitle: 'Die Glasform lenkt Schaum, Kohlensäure und Aroma. Für den Alltag reicht ein sauberer Willi-Becher, für die Verkostung lohnt die Stilform.',
        steps: [
          { title: 'Pilstulpe', body: 'Schlank mit Kelch. Hält die Schaumkrone lange und betont die Hopfenbittere. Für Pils.' },
          { title: 'Willi-Becher', body: 'Gerade und robust. Der Allrounder für Helles, Export, Lager und Dunkelbier.' },
          { title: 'Weizenglas', body: 'Hoch und geschwungen. Gibt dem voluminösen Schaum Platz. Für Weizenbier.' },
          { title: 'Stange', body: 'Schmal und klein. Das Bier bleibt frisch, weil es schnell getrunken wird. Für Kölsch und Alt.' },
          { title: 'Pokal', body: 'Bauchig mit Stiel. Bündelt Malz- und Reifearomen. Für Bock und Starkbier.' }
        ],
        source: 'Zuordnung aus der Tabelle dieser Seite. Entscheidend ist vor allem ein sauberes, fettfreies Glas.'
      },
      alt: 'Übersicht von fünf Bierglasformen mit Zuordnung: Pilstulpe für Pils, Willi-Becher für Helles und Lager, Weizenglas für Weizenbier, Stange für Kölsch und Altbier sowie Pokal für Bock und Starkbier.',
      caption: 'Fünf Formen decken fast alle deutschen Bierstile ab. Die Sauberkeit des Glases wirkt sich stärker aus als die Form.'
    },
    {
      slug: '/bierwissen/deutsches-reinheitsgebot/',
      file: 'bierwissen-reinheitsgebot',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Das Reinheitsgebot in Zahlen',
        subtitle: 'Der Text von 1516 nannte drei Zutaten. Hefe kam erst dazu, als man sie überhaupt nachweisen konnte.',
        tiles: [
          { value: '1516', unit: 'ERLASSEN', label: 'als bayerische Landesordnung in Ingolstadt' },
          { value: '4', unit: 'ZUTATEN HEUTE', label: 'Wasser, Malz, Hopfen und Hefe für untergäriges Bier' },
          { value: '3', unit: 'IM URTEXT', label: 'Wasser, Gerste und Hopfen — Hefe war noch unbekannt' }
        ],
        note: 'Heute gilt nicht der Text von 1516, sondern das Vorläufige Biergesetz. Für obergäriges Bier sind zusätzlich andere Malze und Zucker zulässig.',
        source: 'Deutscher Brauer-Bund und Vorläufiges Biergesetz. Abruf November 2026.'
      },
      alt: 'Drei Kennzahlen zum Reinheitsgebot: erlassen 1516 in Ingolstadt, heute vier zugelassene Zutaten mit Wasser, Malz, Hopfen und Hefe, im Urtext dagegen nur drei.',
      caption: 'Hefe fehlte im Urtext, weil man sie noch nicht kannte. Maßgeblich ist heute ohnehin das Vorläufige Biergesetz, nicht der Text von 1516.'
    },
    {
      slug: '/bierwissen/bier-richtig-lagern/',
      file: 'bierwissen-lagern',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Bier richtig lagern: die drei Stellschrauben',
        subtitle: 'Temperatur, Licht und Zeit bestimmen, wie lange ein Bier frisch bleibt. Alle drei lassen sich zu Hause leicht kontrollieren.',
        tiles: [
          { value: '5 – 10', unit: 'GRAD CELSIUS', label: 'kühl und möglichst gleichmäßig, ohne starke Schwankungen' },
          { value: 'dunkel', unit: 'OHNE SONNE', label: 'Licht erzeugt in grünen und klaren Flaschen Fehlaromen' },
          { value: 'stehend', unit: 'NICHT LIEGEND', label: 'so bleibt der Kronkorken trocken und dichtet länger ab' }
        ],
        note: 'Helle, hopfenbetonte Biere reagieren am empfindlichsten. Starkbier und dunkle Biere vertragen längere Lagerung deutlich besser.',
        source: 'Hinweise aus dem Text dieser Seite.'
      },
      alt: 'Drei Regeln zur Bierlagerung: 5 bis 10 Grad Celsius gleichmäßig kühl, dunkel ohne Sonnenlicht und stehend statt liegend, damit der Kronkorken trocken bleibt.',
      caption: 'Kühl, dunkel, stehend. Mehr braucht es zu Hause nicht, und helles Pils dankt es am deutlichsten.'
    },
    {
      slug: '/bestenlisten/was-kostet-bier-in-deutschland/',
      file: 'bestenlisten-bierpreise',
      template: 'punkte',
      props: {
        eyebrow: 'Bestenlisten und Zahlen', title: 'Was ein halber Liter Bier kostet',
        subtitle: 'Zwischen Handel und Gastronomie liegt ein Vielfaches. Der Ort entscheidet stärker über den Preis als die Marke.',
        min: 0, max: 8, ticks: [0, 2, 4, 6, 8], suffix: ' €',
        items: [
          { label: 'Kasten im Angebot, je 0,5 l', value: 0.6, valueLabel: 'ab ca. 0,60 €', fill: T.green },
          { label: 'Kasten regulär, je 0,5 l', value: 0.9, valueLabel: 'ca. 0,90 €', fill: T.green },
          { label: 'Kiosk oder Tankstelle', value: 1.8, valueLabel: 'ca. 1,80 €' },
          { label: 'Kneipe, ländlich', value: 3.5, valueLabel: 'ca. 3,50 €', emphasis: true },
          { label: 'Kneipe, Großstadt', value: 4.8, valueLabel: 'ca. 4,80 €', emphasis: true },
          { label: 'Festival oder Stadion', value: 6.5, valueLabel: 'ca. 6,50 €', fill: T.amberDark }
        ],
        note: 'Gerundete Orientierungswerte ohne Pfand. Die Spanne innerhalb jeder Kategorie ist groß und regional sehr unterschiedlich.',
        source: 'Einordnung aus dem Text dieser Seite. Preise ändern sich laufend; verbindlich ist immer die Angabe vor Ort.'
      },
      alt: 'Punktdiagramm der Bierpreise je halbem Liter in Deutschland: ab 0,60 Euro im Kastenangebot, rund 1,80 Euro am Kiosk, 3,50 Euro in der Landkneipe, 4,80 Euro in der Großstadtkneipe und etwa 6,50 Euro auf Festivals.',
      caption: 'Dasselbe Bier kostet auf dem Festival das Zehnfache des Kastenpreises. Der Ausschankort ist der größte Preistreiber.'
    },
    {
      slug: '/bierwissen/abgelaufenes-bier-trinken/',
      file: 'bierwissen-abgelaufenes-bier',
      template: 'ablauf',
      props: {
        eyebrow: 'Bierwissen', title: 'Abgelaufenes Bier prüfen: vier Schritte',
        subtitle: 'Das Mindesthaltbarkeitsdatum ist kein Verfallsdatum. Diese vier Prüfungen klären in einer Minute, ob ein Bier noch taugt.',
        steps: [
          { title: 'Flasche ansehen', body: 'Rost am Kronkorken, aufgewölbter Verschluss oder starke Trübung sprechen dagegen.' },
          { title: 'Öffnen und hören', body: 'Ein normales Zischen ist gut. Gar kein Druck oder heftiges Überschäumen ist ein Warnzeichen.' },
          { title: 'Riechen', body: 'Pappig, kartonartig oder muffig heißt: gealtert. Essigsauer heißt: wegschütten.' },
          { title: 'Klein probieren', body: 'Schmeckt es flach, aber sauber, ist es unbedenklich — nur nicht mehr frisch.' }
        ],
        source: 'Hinweise aus dem Text dieser Seite. Im Zweifel gilt: wegschütten ist billiger als ein verdorbener Abend.'
      },
      alt: 'Ablaufgrafik zum Prüfen von abgelaufenem Bier in vier Schritten: Flasche ansehen, beim Öffnen auf das Zischen hören, am Bier riechen und eine kleine Menge probieren.',
      caption: 'Vier Prüfungen in einer Minute. Pappige Noten bedeuten gealtert, essigsaurer Geruch bedeutet weg damit.'
    },
    {
      slug: '/bierregionen/bier-in-bayern/',
      file: 'bierregionen-bayern',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierregionen', title: 'Bier in Bayern in Zahlen',
        subtitle: 'Bayern stellt den größten Teil der deutschen Braustätten. Besonders dicht ist das Netz in Oberfranken.',
        tiles: [
          { value: '≈ 600', unit: 'BRAUSTÄTTEN', label: 'rund 40 Prozent aller Braustätten in Deutschland' },
          { value: 'Oberfranken', unit: 'DICHTESTE REGION', label: 'weltweit eine der höchsten Brauereidichten je Einwohner' },
          { value: 'Helles', unit: 'LEITSORTE', label: 'daneben Weizenbier, Kellerbier, Dunkel und Festbier' }
        ],
        note: 'Die Zahl der Braustätten ist kein Maß für die Produktionsmenge: Viele bayerische Betriebe sind klein und regional.',
        source: 'Deutscher Brauer-Bund und Biersteuerstatistik. Abruf November 2026. Regionale Zahlen schwanken je nach Erhebungsjahr.'
      },
      alt: 'Drei Kennzahlen zu Bier in Bayern: rund 600 Braustätten und damit etwa 40 Prozent aller deutschen Braustätten, Oberfranken als dichteste Brauereiregion und Helles als Leitsorte.',
      caption: 'Bayern stellt rund 40 Prozent der deutschen Braustätten. Viele davon sind kleine Betriebe mit regionaler Reichweite.'
    },
    {
      slug: '/bierwissen/wie-viel-bier-pro-person/',
      file: 'bierwissen-biermenge-pro-person',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Wie viel Bier pro Person einplanen',
        subtitle: 'Für die Planung einer Feier sind drei Größen entscheidend: Dauer, Anteil der Biertrinkenden und Tageszeit.',
        tiles: [
          { value: '2 – 3', unit: 'HALBE JE PERSON', label: 'übliche Spanne für einen Abend von etwa vier Stunden' },
          { value: '60 – 70 %', unit: 'TRINKEN BIER', label: 'realistischer Anteil auf einer gemischten Feier' },
          { value: '+ 20 %', unit: 'PUFFER', label: 'Reserve, damit nichts ausgeht — Bier hält sich ohnehin' }
        ],
        note: 'Alkoholfreies Bier, Wasser und Softgetränke gehören in jede Planung. Wer fährt, bleibt nüchtern.',
        source: 'Orientierungswerte aus dem Text dieser Seite und dem Partyrechner. Keine Empfehlung zum Konsum.'
      },
      alt: 'Drei Planungsgrößen für den Bierbedarf einer Feier: zwei bis drei halbe Liter je Person an einem Abend, 60 bis 70 Prozent Biertrinkende und 20 Prozent Puffer.',
      caption: 'Zwei bis drei Halbe je Person, aber nur für die Biertrinkenden, plus Puffer. Alkoholfreies gehört in jede Planung.'
    },
    {
      slug: '/bierwissen/bier-einfrieren/',
      file: 'bierwissen-einfrieren',
      template: 'zweiwege',
      props: {
        eyebrow: 'Bierwissen', title: 'Bier im Gefrierfach: was wirklich passiert',
        subtitle: 'Schnellkühlen funktioniert, Einfrieren nicht. Der Unterschied liegt bei wenigen Minuten und einem geplatzten Glas.',
        columns: [
          {
            title: 'Kurz kühlen',
            rows: [
              ['DAUER', 'etwa 15 bis 25 Minuten im Gefrierfach'],
              ['ERGEBNIS', 'das Bier erreicht Trinktemperatur, ohne Schaden zu nehmen'],
              ['SICHERHEIT', 'Wecker stellen — vergessene Flaschen sind der häufigste Fehler'],
              ['SCHNELLER GEHT', 'nasses Tuch um die Flasche, dann ins Gefrierfach']
            ],
            examples: 'Dose kühlt schneller als Glas, 0,33 l schneller als 0,5 l'
          },
          {
            title: 'Durchfrieren',
            rows: [
              ['DAUER', 'ab etwa 90 Minuten, je nach Gerät'],
              ['ERGEBNIS', 'Wasser dehnt sich aus, Flasche oder Dose platzt'],
              ['GESCHMACK', 'nach dem Auftauen flockig, flach und schal'],
              ['KOHLENSÄURE', 'entweicht beim Platzen vollständig']
            ],
            examples: 'Auch ohne Platzen bleibt das Bier geschmacklich beschädigt'
          }
        ],
        note: 'Bier gefriert nicht bei null Grad, sondern erst bei etwa minus zwei bis minus drei Grad — der Alkohol senkt den Gefrierpunkt.',
        source: 'Einordnung aus dem Text dieser Seite. Zeiten gelten für ein übliches Vier-Sterne-Gefrierfach.'
      },
      alt: 'Gegenüberstellung von kurzem Kühlen und Durchfrieren von Bier: links 15 bis 25 Minuten im Gefrierfach mit gutem Ergebnis, rechts ab 90 Minuten mit geplatzter Flasche, flockigem Geschmack und entwichener Kohlensäure.',
      caption: 'Zwischen gut gekühlt und geplatzt liegt gut eine Stunde. Alkohol senkt den Gefrierpunkt auf etwa minus zwei bis minus drei Grad.'
    },
    {
      slug: '/bierwissen/wie-viele-biersorten-gibt-es/',
      file: 'bierwissen-sorten-marken',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Sorten, Marken, Braustätten: drei verschiedene Zahlen',
        subtitle: 'Diese drei Begriffe werden ständig verwechselt. Sie zählen völlig unterschiedliche Dinge.',
        tiles: [
          { value: 'über 40', unit: 'BIERSORTEN', label: 'Bierstile laut Deutschem Brauer-Bund' },
          { value: '≈ 7.000', unit: 'BIERMARKEN', label: 'Branchenschätzung, keine amtliche Vollerhebung' },
          { value: '1.415', unit: 'BRAUSTÄTTEN', label: 'in der Biersteuerstatistik erfasst, Stand 2025' }
        ],
        note: 'Eine Sorte ist ein Bierstil wie Pils. Eine Marke ist der Marktauftritt eines Herstellers. Eine Braustätte ist ein Produktionsstandort.',
        source: BB
      },
      alt: 'Drei Kennzahlen im Vergleich: über 40 Biersorten, rund 7.000 Biermarken als Branchenschätzung und 1.415 erfasste Braustätten in Deutschland im Jahr 2025.',
      caption: 'Sorte, Marke und Braustätte sind drei verschiedene Dinge. Nur die Braustätten werden amtlich gezählt.'
    },
    {
      slug: '/bestenlisten/',
      file: 'bestenlisten-beschaeftigte',
      template: 'zeitreihe',
      props: {
        eyebrow: 'Bestenlisten und Zahlen', title: 'Beschäftigte in der deutschen Brauindustrie',
        subtitle: beschaeftigte.summary,
        series: beschaeftigte.series,
        unit: 'BESCHÄFTIGTE',
        valueFormat: (value) => value.toLocaleString('de-DE'),
        highlight: [2019, 2025],
        source: `${beschaeftigte.sourceName}. ${beschaeftigte.sourceDate}. ${beschaeftigte.chartNote}`
      },
      alt: 'Balkendiagramm der Beschäftigten in der deutschen Brauindustrie von 2015 bis 2025 mit einem Höchstwert von 28.133 im Jahr 2019 und 27.380 Beschäftigten im Jahr 2025.',
      caption: 'Die Beschäftigung ist deutlich stabiler als der Bierabsatz: gegenüber 2024 sogar ein leichtes Plus von 0,3 Prozent.'
    },
    {
      slug: '/oktoberfest/',
      file: 'oktoberfest-ueberblick',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Oktoberfest', title: 'Das Oktoberfest 2027 in Zahlen',
        subtitle: 'Das nächste Oktoberfest findet vom 18. September bis 3. Oktober 2027 statt. Die wichtigsten festen Größen im Überblick.',
        tiles: [
          { value: '16', unit: 'TAGE', label: '18. September bis 3. Oktober 2027' },
          { value: '6', unit: 'BRAUEREIEN', label: 'nur Münchner Bier darf ausgeschenkt werden' },
          { value: '14', unit: 'GROSSE ZELTE', label: 'dazu rund zwei Dutzend kleinere Betriebe' }
        ],
        note: 'Die Maßpreise für 2027 sind noch nicht veröffentlicht. 2026 lagen sie in den großen Zelten überwiegend zwischen 14,80 und 15,90 Euro.',
        source: 'Landeshauptstadt München, offizielle Oktoberfest-Informationen. Abruf November 2026.'
      },
      alt: 'Drei Kennzahlen zum Oktoberfest 2027: 16 Festtage vom 18. September bis 3. Oktober, sechs zugelassene Münchner Brauereien und 14 große Festzelte.',
      caption: 'Sechzehn Tage, sechs Brauereien, vierzehn große Zelte. Die Maßpreise für 2027 stehen noch nicht fest.'
    },
    {
      slug: '/biersorten/',
      file: 'biersorten-familien',
      template: 'zweiwege',
      props: {
        eyebrow: 'Biersorten', title: 'Die deutsche Bierwelt in zwei Familien',
        subtitle: 'Fast jedes deutsche Bier lässt sich einer der beiden Gärungsarten zuordnen. Das ist der schnellste Einstieg in die Sortenvielfalt.',
        columns: [
          {
            title: 'Untergärig',
            rows: [
              ['ANTEIL AM MARKT', 'der weitaus größte Teil des deutschen Biermarktes'],
              ['CHARAKTER', 'sauber vergoren, Malz und Hopfen klar erkennbar'],
              ['TRINKTEMPERATUR', 'meist 5 bis 10 °C'],
              ['EINSTIEG', 'Helles, wenn es mild sein soll; Pils, wenn es herb sein darf']
            ],
            examples: 'Pils, Helles, Export, Lager, Märzen, Dunkel, Schwarzbier, Bock'
          },
          {
            title: 'Obergärig',
            rows: [
              ['ANTEIL AM MARKT', 'kleiner, aber regional sehr stark verankert'],
              ['CHARAKTER', 'fruchtige und würzige Aromen aus der Gärung'],
              ['TRINKTEMPERATUR', 'meist 6 bis 12 °C'],
              ['EINSTIEG', 'Weizenbier, wenn es fruchtig sein soll; Kölsch, wenn es schlank sein darf']
            ],
            examples: 'Weizenbier, Kölsch, Altbier, Gose, Berliner Weisse, Pale Ale, Stout'
          }
        ],
        note: 'Alkoholfreies Bier ist keine eigene Familie: Es gibt es in beiden Gärungsarten und in fast jedem Stil.',
        source: 'Einordnung nach den Stilprofilen dieser Seite.'
      },
      alt: 'Die deutsche Bierwelt in zwei Familien: links untergärige Biere wie Pils, Helles und Bock mit 5 bis 10 Grad Trinktemperatur, rechts obergärige Biere wie Weizenbier, Kölsch und Altbier mit 6 bis 12 Grad.',
      caption: 'Zwei Gärungsarten ordnen fast die gesamte deutsche Biervielfalt. Alkoholfreies Bier gibt es in beiden Familien.'
    }
  ];
}


// ------------------------------------------------- Zweite Welle: der Rest
// Alles, was nach den Steckbriefen und Vergleichen noch ohne Abbildung war,
// ohne die sieben Rechtstexte.

// Wie viele der 14 grossen Zelte je Brauerei -- aus der Tabelle der Seite
// gezaehlt, damit die Grafik einer Aenderung dort folgt.
function tentsPerBrewery() {
  const file = pageFile('/oktoberfest/bier-in-welchem-festzelt/');
  if (!file) return [];
  const table = tables(readBody(file))[0];
  if (!table) return [];
  const counts = new Map();
  for (const row of table.slice(1)) {
    if (row.length < 2) continue;
    const brewery = row[1].trim();
    if (!brewery) continue;
    counts.set(brewery, (counts.get(brewery) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'de'));
}

// Die Stile der Startseiten-Grafik: Mitte und Spannweite aus den Steckbriefen.
function stylePoints() {
  const points = [];
  for (const name of STYLE_PAGES) {
    const profile = styleProfile(`/biersorten/${name}/`);
    if (!profile || !profile.bitterness) continue;
    const color = colorRangeFromWords(profile.colorWords);
    const x = (color[0] + color[1]) / 2;
    const y = (profile.bitterness[0] + profile.bitterness[1]) / 2;
    points.push({
      label: profile.name,
      x, y,
      xSpan: color[0] === color[1] ? null : color,
      ySpan: profile.bitterness[0] === profile.bitterness[1] ? null : profile.bitterness,
      fill: ebcColorOf(x)
    });
  }
  return points;
}

function waveTwoFigures() {
  const tents = tentsPerBrewery();
  const points = stylePoints();

  return [
    {
      slug: '/',
      file: 'start-stile-karte',
      template: 'streudiagramm',
      props: {
        eyebrow: 'Überblick', title: 'Deutsche Bierstile nach Farbe und Bitterkeit',
        subtitle: 'Zwei Fragen beantworten die meisten: Wie dunkel ist es, und wie herb? Jeder Punkt sitzt in der Mitte seiner Spanne, die Linien zeigen, wie weit der Stil reicht.',
        points,
        xTicks: [
          { value: 4, label: 'strohgelb' },
          { value: 14, label: 'goldgelb' },
          { value: 30, label: 'bernstein' },
          { value: 55, label: 'braun' },
          { value: 80, label: 'schwarz' }
        ],
        yTicks: [
          { value: 1, label: 'sehr mild' },
          { value: 2, label: 'mild' },
          { value: 3, label: 'moderat' },
          { value: 4, label: 'deutlich' },
          { value: 5, label: 'kräftig' }
        ],
        xLabel: 'FARBE', yLabel: 'BITTERKEIT',
        note: 'Alkoholfreies Bier fehlt bewusst: Es gibt den Stil in fast jeder Farbe und jeder Bitterkeit, ein einzelner Punkt wäre irreführend.',
        source: 'Farb- und Bitterkeitsangaben aus den Steckbriefen der elf Sortenseiten. Einzelne Marken können außerhalb ihrer Stilspanne liegen.'
      },
      alt: 'Streudiagramm der deutschen Bierstile: waagerecht die Farbe von strohgelb bis schwarz, senkrecht die Bitterkeit von sehr mild bis kräftig. Helles und Weizenbier liegen hell und mild, Pils hell und deutlich bitter, Schwarzbier und Dunkelbier dunkel und moderat.',
      caption: 'Farbe und Bitterkeit hängen nicht zusammen: Pils ist hell und herb, Dunkelbier dunkel und mild. Die Linien zeigen, wie weit jeder Stil reicht.'
    },
    {
      slug: '/bierwissen/',
      file: 'bierwissen-hub-kennzahlen',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Die drei Zahlen auf einem Bier-Steckbrief',
        subtitle: 'Wer diese drei Kürzel kennt, versteht fast jede Produktbeschreibung. Sie messen drei verschiedene Dinge und sagen nichts übereinander aus.',
        tiles: [
          { value: 'IBU', unit: 'BITTERKEIT', label: 'Bitterstoffe aus dem Hopfen, etwa 5 bis über 60' },
          { value: 'EBC', unit: 'FARBE', label: 'Farbtiefe über die Lichtabsorption, 4 bis über 60' },
          { value: '°P', unit: 'STAMMWÜRZE', label: 'Extraktgehalt vor der Gärung, entscheidet über die Biergattung' }
        ],
        note: 'Ein hoher EBC-Wert bedeutet nicht viel Alkohol, und gleiche IBU bedeuten nicht gleichen Geschmack. Die drei Werte sind voneinander unabhängig.',
        source: 'Einordnung aus den Erklärseiten zu IBU, EBC und Stammwürze in diesem Bereich.'
      },
      alt: 'Drei Kennzahlen des Bier-Steckbriefs: IBU für die Bitterkeit aus dem Hopfen, EBC für die Farbtiefe und Grad Plato für die Stammwürze vor der Gärung.',
      caption: 'IBU, EBC und Grad Plato messen Bitterkeit, Farbe und Stammwürze — drei unabhängige Größen, die oft miteinander verwechselt werden.'
    },
    {
      slug: '/biervergleich/',
      file: 'biervergleich-hub-stil-marke',
      template: 'zweiwege',
      props: {
        eyebrow: 'Biervergleich', title: 'Was der Stil vorgibt und was die Marke entscheidet',
        subtitle: 'Jeder Vergleich auf dieser Seite arbeitet mit Spannen. Das ist kein Ausweichen: Ein Bierstil legt einen Rahmen fest, das konkrete Produkt füllt ihn aus.',
        columns: [
          {
            title: 'Der Stil gibt vor',
            rows: [
              ['GÄRUNG', 'obergärig oder untergärig, das ändert keine Brauerei im Nachhinein'],
              ['FARBBEREICH', 'ein Schwarzbier wird nicht strohgelb'],
              ['TYPISCHE SPANNE', 'Alkohol und Bitterkeit bewegen sich in einem bekannten Rahmen'],
              ['ERWARTUNG', 'wonach das Bier ungefähr schmecken sollte']
            ],
            examples: 'Darum stehen in unseren Tabellen Bereiche und keine festen Werte'
          },
          {
            title: 'Die Marke entscheidet',
            rows: [
              ['GENAUER ALKOHOL', 'nur das Etikett ist verbindlich'],
              ['REZEPTUR', 'Hopfensorte, Malzmischung und Vergärungsgrad'],
              ['FRISCHE', 'Alter und Lagerung verändern den Eindruck deutlich'],
              ['PREIS', 'sagt für sich genommen nichts über den Stil aus']
            ],
            examples: 'Zwei Pils derselben Stilspanne können spürbar verschieden schmecken'
          }
        ],
        note: 'Ein Vergleich zweier Stile beantwortet deshalb die Frage „welche Richtung passt mir?“ und nicht „welches Bier soll ich kaufen?“.',
        source: 'Redaktionelle Einordnung, wie sie allen Vergleichsseiten in diesem Bereich zugrunde liegt.'
      },
      alt: 'Gegenüberstellung: Der Bierstil gibt Gärung, Farbbereich, typische Spanne und Erwartung vor, die einzelne Marke entscheidet über genauen Alkoholgehalt, Rezeptur, Frische und Preis.',
      caption: 'Deshalb stehen in den Vergleichstabellen Spannen: Der Stil steckt den Rahmen ab, das einzelne Produkt füllt ihn aus.'
    },
    {
      slug: '/bier-rechner/',
      file: 'bier-rechner-hub',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierrechner', title: 'Welcher Rechner welche Frage beantwortet',
        subtitle: 'Alle vier laufen vollständig im Browser, ohne Konto und ohne gespeicherte Daten. Sie geben Bereiche aus, keine Scheingenauigkeit.',
        tiles: [
          { value: 'Menge', unit: 'FÜR EINE FEIER', label: 'Wie viele Liter, Flaschen und Kästen brauche ich?' },
          { value: 'Fass', unit: 'IN GLÄSER', label: 'Wie viele Gläser ergibt ein Fass nach Ausschankverlust?' },
          { value: 'Preis', unit: 'JE LITER', label: 'Welches Gebinde ist wirklich günstiger?' },
          { value: 'Kühlzeit', unit: 'SCHÄTZUNG', label: 'Wie lange braucht das Bier bis zur Trinktemperatur?' }
        ],
        note: 'Der Mengenrechner ist ausdrücklich eine Einkaufshilfe und keine empfohlene Trinkmenge. Wasser und alkoholfreie Getränke gehören in jede Planung.',
        source: 'Die Rechner rufen keine Händlerpreise ab und speichern nichts.'
      },
      alt: 'Vier Bierrechner im Überblick: Menge für eine Feier, Gläser aus einem Fass, Preis je Liter und geschätzte Kühlzeit, jeweils mit der Frage, die sie beantworten.',
      caption: 'Vier Rechner für vier Fragen. Alle arbeiten im Browser und geben bewusst Bereiche statt scheingenauer Einzelwerte aus.'
    },
    {
      slug: '/bierregionen/',
      file: 'bierregionen-nord-sued',
      template: 'zweiwege',
      props: {
        eyebrow: 'Bierregionen', title: 'Nord und West gegen Süd und Ost',
        subtitle: 'Pils führt bundesweit, doch die regionalen Stile verlaufen entlang einer erkennbaren Linie. Heute ist fast alles überall zu bekommen — die Vorlieben sind geblieben.',
        columns: [
          {
            title: 'Nord und West',
            rows: [
              ['LEITSTIL', 'hopfenherbes Pils, besonders sichtbar im Norden'],
              ['STADTSTILE', 'Kölsch in Köln, Altbier in Düsseldorf — zwei klar abgegrenzte obergärige Stile'],
              ['BESONDERES', 'Berliner Weisse als säuerlicher historischer Stadtstil'],
              ['EXPORT', 'Baden-Württemberg mit Export, Pils und Kristallweizen']
            ],
            examples: 'Pils, Kölsch, Altbier, Export, Berliner Weisse'
          },
          {
            title: 'Süd und Ost',
            rows: [
              ['LEITSTIL', 'malzbetonte Lagerbiere und Weizen'],
              ['BAYERN', 'Helles, Weizen, Dunkel, Bock und Festbier'],
              ['FRANKEN', 'Kellerbier, Rauchbier und Landbier aus dichter Dorfbrauereikultur'],
              ['MITTELDEUTSCHLAND', 'Schwarzbier in Sachsen und Thüringen, Gose aus Leipzig']
            ],
            examples: 'Helles, Weizen, Kellerbier, Rauchbier, Schwarzbier, Gose'
          }
        ],
        note: 'Die Grenze ist historisch gewachsen: Vor der modernen Logistik wurde Bier vor allem nahe der Brauerei getrunken, und lokale Gewohnheiten konnten sich festigen.',
        source: 'Einordnung aus der Regionentabelle dieser Seite.'
      },
      alt: 'Gegenüberstellung der deutschen Bierregionen: Nord und West mit hopfenherbem Pils, Kölsch, Altbier und Export, Süd und Ost mit malzbetontem Hellem, Weizen, Kellerbier, Rauchbier, Schwarzbier und Gose.',
      caption: 'Die Trennlinie ist historisch gewachsen. Erhältlich ist heute fast alles überall — die regionalen Vorlieben sind trotzdem geblieben.'
    },
    {
      slug: '/bierwissen/was-ist-bier/',
      file: 'bierwissen-vier-zutaten',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Die vier Grundzutaten und ihre Aufgabe',
        subtitle: 'Bier entsteht im Kern aus vier Zutaten. Jede übernimmt eine eigene Aufgabe, und schon kleine Änderungen führen zu deutlich verschiedenen Ergebnissen.',
        tiles: [
          { value: 'Wasser', unit: 'DER GRÖSSTE ANTEIL', label: 'bildet den mengenmäßig größten Teil des fertigen Biers' },
          { value: 'Malz', unit: 'ZUCKER UND FARBE', label: 'liefert vergärbare Zucker, Farbe und Geschmacksstoffe' },
          { value: 'Hopfen', unit: 'BITTERE UND AROMA', label: 'steuert Bitterkeit, Aroma und Haltbarkeit bei' },
          { value: 'Hefe', unit: 'DIE GÄRUNG', label: 'wandelt Zucker in Alkohol und Kohlensäure um, prägt das Aroma' }
        ],
        note: 'Helles Malz ergibt nicht automatisch ein mildes Bier, und viel Hopfen bedeutet nicht zwingend extreme Bitterkeit: Sorte und Zeitpunkt der Hopfengabe sind ebenso wichtig.',
        source: 'Zuordnung aus dem Text dieser Seite. Für obergäriges Bier sind nach dem Vorläufigen Biergesetz weitere Malze und Zucker zulässig.'
      },
      alt: 'Die vier Grundzutaten des Biers mit ihren Aufgaben: Wasser als größter Anteil, Malz für Zucker und Farbe, Hopfen für Bitterkeit und Aroma, Hefe für die Gärung.',
      caption: 'Vier Zutaten, vier Aufgaben. Welche Hopfensorte wann zugegeben wird, verändert das Ergebnis oft stärker als die reine Menge.'
    },
    {
      slug: '/bierwissen/wie-viele-biermarken-gibt-es/',
      file: 'bierwissen-biermarken',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Biermarken in Deutschland',
        subtitle: 'Die Zahl der Marken liegt deutlich über der Zahl der Brauereien, weil eine Brauerei mehrere Marken und unter jeder Marke mehrere Sorten führen kann.',
        tiles: [
          { value: '> 7.500', unit: 'BIERMARKEN', label: 'Angabe des Deutschen Brauer-Bundes für 2026' },
          { value: '≈ 1.400', unit: 'BRAUEREIEN', label: 'aus denen diese Marken stammen' },
          { value: '3', unit: 'BEGRIFFE', label: 'Marke, Produkt und Biersorte zählen nicht dasselbe' }
        ],
        note: 'Ein großer Teil der Marken ist nur regional oder direkt bei der Brauerei erhältlich. Das Supermarktregal zeigt davon nur einen kleinen Ausschnitt.',
        source: 'Deutscher Brauer-Bund, Stand 2026. Je nach Quelle werden Marken, einzelne Produkte oder Sorten unterschiedlich gezählt.'
      },
      alt: 'Drei Kennzahlen zu Biermarken in Deutschland: mehr als 7.500 Marken aus rund 1.400 Brauereien, und drei Begriffe — Marke, Produkt und Biersorte — die nicht dasselbe zählen.',
      caption: 'Mehr als 7.500 Marken aus rund 1.400 Brauereien. Die meisten davon stehen in keinem Supermarktregal.'
    },
    {
      slug: '/bierwissen/wie-schwer-ist-bierkasten/',
      file: 'bierwissen-kastengewicht',
      template: 'balken',
      props: {
        eyebrow: 'Bierwissen', title: 'Woraus sich das Gewicht eines Bierkastens ergibt',
        subtitle: 'Ein voller Kasten wiegt häufig 16 bis 20 Kilogramm. Die Beispielrechnung unten zeigt, wie sich das auf Bier, Glas und Kasten verteilt.',
        unit: 'KILOGRAMM IM RECHENBEISPIEL',
        items: [
          { label: 'Bier', sublabel: '10 Liter, rund ein Kilo je Liter', value: 10, valueLabel: 'ca. 10 kg' },
          { label: 'Leere Glasflaschen', sublabel: '20 Stück, je nach Mehrwegsystem', value: 7, valueLabel: 'ca. 7 kg', fill: T.green },
          { label: 'Kunststoffkasten', sublabel: 'häufig ein bis zwei Kilogramm', value: 1.5, valueLabel: 'ca. 1,5 kg', fill: T.green }
        ],
        note: 'Zusammen ergibt das rund 18,5 Kilogramm. Das ist ein Rechenbeispiel und kein Standardwert: Flaschenform, Glasstärke und Kastenmaterial verschieben es spürbar.',
        source: 'Beispielrechnung aus dem Text dieser Seite.'
      },
      alt: 'Balkendiagramm zur Zusammensetzung eines Bierkastens im Rechenbeispiel: rund 10 Kilogramm Bier, rund 7 Kilogramm leere Glasflaschen und rund 1,5 Kilogramm Kunststoffkasten, zusammen etwa 18,5 Kilogramm.',
      caption: 'Gut die Hälfte des Gewichts ist Bier, der Rest ist Verpackung. Deshalb wiegt ein Kasten mit kleineren Flaschen nicht automatisch weniger.'
    },
    {
      slug: '/bierwissen/wie-viele-liter-bierkasten/',
      file: 'bierwissen-kastenliter',
      template: 'balken',
      props: {
        eyebrow: 'Bierwissen', title: 'Wie viel Bier in den gängigen Kästen steckt',
        subtitle: 'Die Flaschenzahl allein sagt wenig. Erst Flaschenzahl mal Flascheninhalt ergibt die Menge, die sich vergleichen lässt.',
        unit: 'LITER JE KASTEN',
        items: [
          { label: '20 × 0,5 l', sublabel: 'der verbreitetste Kasten', value: 10, valueLabel: '10,0 l' },
          { label: '24 × 0,33 l', sublabel: 'häufig bei Spezialitäten', value: 7.92, valueLabel: '7,92 l', fill: T.green },
          { label: '20 × 0,33 l', sublabel: 'kleineres Gebinde', value: 6.6, valueLabel: '6,6 l', fill: T.green },
          { label: '11 × 0,5 l', sublabel: 'kleiner Kasten', value: 5.5, valueLabel: '5,5 l', fill: T.green }
        ],
        note: 'Zwei Kästen können ähnlich teuer aussehen und doch fast doppelt so viel enthalten. Für Preisvergleiche taugt deshalb nur der Preis je Liter.',
        source: 'Werte aus der Tabelle dieser Seite.'
      },
      alt: 'Balkendiagramm der Füllmengen gängiger Bierkästen: 20 mal 0,5 Liter ergeben 10 Liter, 24 mal 0,33 Liter ergeben 7,92 Liter, 20 mal 0,33 Liter ergeben 6,6 Liter und 11 mal 0,5 Liter ergeben 5,5 Liter.',
      caption: 'Der größte und der kleinste Kasten unterscheiden sich fast um das Doppelte. Die Flaschenzahl auf der Vorderseite verrät das nicht.'
    },
    {
      slug: '/bierwissen/bier-im-kuehlschrank-kuehlen/',
      file: 'bierwissen-kuehlzeiten',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierwissen', title: 'Drei Wege, Bier kalt zu bekommen',
        subtitle: 'Die Zeitfenster sind Orientierungswerte einer Brauerei, kein kontrollierter Methodenvergleich. Gebindegröße und Beladung verschieben sie deutlich.',
        tiles: [
          { value: '6 – 8', unit: 'STUNDEN', label: 'Kühlschrank, ab Raumtemperatur bis zur vollständigen Kühlung' },
          { value: '30 – 60', unit: 'MINUTEN', label: 'Gefrierfach — nur mit Timer, das Bier kann gefrieren' },
          { value: '5 – 10', unit: 'MINUTEN', label: 'Eiswasser mit Salz, regelmäßig kontrollieren' }
        ],
        note: 'Für einen ganzen warmen Kasten lässt sich aus den Zeitfenstern für einzelne Gebinde keine feste Dauer ableiten. Plane Vorlauf ein und miss nach.',
        source: 'Coronado Brewing: Beer Cooling Times, geprüft am 29. September 2026. Die Brauerei nennt keine einheitliche Gebindegröße.'
      },
      alt: 'Drei Kühlmethoden für Bier mit ihren groben Zeitfenstern: Kühlschrank 6 bis 8 Stunden, Gefrierfach 30 bis 60 Minuten und Eiswasser mit Salz 5 bis 10 Minuten.',
      caption: 'Eiswasser mit Salz ist um ein Vielfaches schneller als der Kühlschrank. Beim Gefrierfach entscheidet der Timer, ob die Flasche heil bleibt.'
    },
    {
      slug: '/bierwissen/bier-kalorien-tabelle/',
      file: 'bierwissen-kalorien-produkte',
      template: 'balken',
      props: {
        eyebrow: 'Bierwissen', title: 'Kalorien je 0,5 Liter in sechs Produktbeispielen',
        subtitle: 'Diese Werte gelten für die unten verlinkten Produkte, nicht pauschal für die ganze Biersorte. Bei geänderter Rezeptur gilt die aktuelle Kennzeichnung.',
        unit: 'KILOKALORIEN JE 0,5 LITER',
        items: [
          { label: 'Alkoholfrei', sublabel: 'Paulaner Münchner Hell alkoholfrei', value: 120, valueLabel: '120 kcal', fill: T.green },
          { label: 'Radler', sublabel: 'Paulaner Natur Radler', value: 185, valueLabel: '185 kcal', fill: T.green },
          { label: 'Helles', sublabel: 'Paulaner Münchner Hell', value: 190, valueLabel: '190 kcal' },
          { label: 'Pils', sublabel: 'Bitburger Premium Pils', value: 200, valueLabel: '200 kcal' },
          { label: 'Weizen', sublabel: 'Paulaner Hefe-Weißbier Naturtrüb', value: 210, valueLabel: '210 kcal' },
          { label: 'Festbier', sublabel: 'Paulaner Oktoberfest Bier', value: 235, valueLabel: '235 kcal', fill: T.amberDark }
        ],
        note: 'Zwischen Pils und Weizen liegen hier 10 Kilokalorien je halbem Liter. Daraus lässt sich keine allgemeine Regel für jedes Weizen und jedes Pils ableiten.',
        source: 'Herstellerangaben je 100 ml, Stand 29. September 2026. Portionswerte daraus berechnet und auf ganze Kilokalorien gerundet.'
      },
      alt: 'Balkendiagramm der Kalorien je 0,5 Liter in sechs konkreten Produkten: alkoholfreies Helles 120, Radler 185, Helles 190, Pils 200, Weizen 210 und Festbier 235 Kilokalorien.',
      caption: 'Alkoholfrei heißt nicht kalorienfrei: 120 Kilokalorien je halbem Liter stehen 235 beim Festbier gegenüber.'
    },
    {
      slug: '/biervergleich/alkoholfrei-oder-null-komma-null/',
      file: 'biervergleich-alkoholfrei-null',
      template: 'zweiwege',
      props: {
        eyebrow: 'Direktvergleich', title: 'Alkoholfrei oder 0,0 Prozent',
        subtitle: 'Die beiden Angaben sind nicht dasselbe. Der Unterschied liegt nicht im Geschmack, sondern in dem, was die Kennzeichnung zusichert.',
        columns: [
          {
            title: 'Alkoholfrei',
            rows: [
              ['RESTALKOHOL', 'geringe Restmengen bis 0,5 Prozent sind zulässig'],
              ['IN DER PRAXIS', 'viele Produkte liegen deutlich darunter'],
              ['VERBINDLICH', 'nur die konkrete Angabe auf dem Produkt'],
              ['GEEIGNET', 'wenn minimale Restmengen in Ordnung sind']
            ],
            examples: 'Auch natürlich fermentierte Lebensmittel enthalten Alkoholspuren'
          },
          {
            title: '0,0 Prozent',
            rows: [
              ['RESTALKOHOL', 'kein messbarer Alkohol in der angegebenen Größenordnung'],
              ['IN DER PRAXIS', 'ausdrücklich so gekennzeichnet'],
              ['VERBINDLICH', 'die Kennzeichnung selbst ist die Zusage'],
              ['GEEIGNET', 'wenn Alkohol vollständig vermieden werden soll']
            ],
            examples: 'Die einfachere Wahl aus medizinischen, religiösen oder persönlichen Gründen'
          }
        ],
        note: 'In Schwangerschaft, bei Erkrankungen, Medikamenteneinnahme oder Suchterkrankungen sollte die eigene Situation mit medizinischem Fachpersonal geklärt werden.',
        source: 'Einordnung aus dem Text dieser Seite. Alkoholreduziertes Bier enthält mehr als alkoholfreies, aber weniger als das Ausgangsbier.'
      },
      alt: 'Gegenüberstellung von alkoholfreiem Bier und 0,0-Prozent-Bier: alkoholfrei darf bis zu 0,5 Prozent Restalkohol enthalten, 0,0 Prozent sagt keinen messbaren Alkohol zu.',
      caption: 'Der Unterschied liegt in der Zusicherung, nicht im Geschmack. Wer Alkohol vollständig vermeiden will, greift zur 0,0-Kennzeichnung.'
    },
    {
      slug: '/biervergleich/radler-oder-alsterwasser/',
      file: 'biervergleich-radler-alster',
      template: 'zweiwege',
      props: {
        eyebrow: 'Direktvergleich', title: 'Radler oder Alsterwasser',
        subtitle: 'Beide Namen bezeichnen meist dieselbe Grundidee: Bier mit Zitronenlimonade. Der wichtigste Unterschied ist die regionale Sprache.',
        columns: [
          {
            title: 'Radler',
            rows: [
              ['WO GELÄUFIG', 'Süd- und Westdeutschland'],
              ['BASISBIER', 'oft Helles oder ein anderes helles Lagerbier'],
              ['GESCHMACK', 'mehr Malzsüße durch das hellere Lager'],
              ['ALKOHOL', 'bei halb und halb etwa 2 bis 3 Prozent']
            ],
            examples: 'Ein Russ ist Weizenbier mit Limonade und damit etwas anderes'
          },
          {
            title: 'Alsterwasser',
            rows: [
              ['WO GELÄUFIG', 'Norddeutschland, kurz auch Alster'],
              ['BASISBIER', 'häufig Pils, aber nicht zwingend'],
              ['GESCHMACK', 'mehr Bitterkeit durch das Pils'],
              ['ALKOHOL', 'bei halb und halb etwa 2 bis 3 Prozent']
            ],
            examples: 'Der Name allein garantiert keine festgelegte Rezeptur'
          }
        ],
        note: 'Es gibt kein überall identisches Mischungsverhältnis. Fertig abgefüllte Produkte können süßer, saurer oder bierbetonter schmecken.',
        source: 'Einordnung aus dem Text dieser Seite.'
      },
      alt: 'Gegenüberstellung von Radler und Alsterwasser: Radler ist im Süden und Westen geläufig und basiert oft auf Hellem, Alsterwasser im Norden und häufig auf Pils, beide mit etwa 2 bis 3 Prozent Alkohol.',
      caption: 'Der Unterschied ist vor allem sprachlich. Spürbar wird er über das Basisbier: Pils bringt Bitterkeit, Helles Malzsüße.'
    },
    {
      slug: '/oktoberfest/festzelte/',
      file: 'oktoberfest-zelte-zahlen',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Oktoberfest', title: 'Die Zeltlandschaft der Wiesn in Zahlen',
        subtitle: 'Die offizielle Wiesn besteht aus deutlich mehr als den bekannten großen Hallen. Dazu kommen die Angebote auf der Oidn Wiesn.',
        tiles: [
          { value: '14', unit: 'GROSSE FESTZELTE', label: 'von sehr groß bis mittelgroß, mit festem Brauereibezug' },
          { value: '21', unit: 'KLEINERE BETRIEBE', label: 'oft spezialisierte Küche, kürzere Wege, ruhigere Atmosphäre' },
          { value: '≈ 10.000', unit: 'PLÄTZE', label: 'im Hofbräu-Festzelt einschließlich Außenbereich, dem größten Zelt' }
        ],
        note: 'Kapazitäten und Zeltkonzepte können sich zwischen den Jahren verändern. Für Reservierungen gelten die aktuellen Angaben des jeweiligen Festwirts.',
        source: 'Zeltverzeichnis dieser Seite nach Angaben der Landeshauptstadt München. Abruf November 2026.'
      },
      alt: 'Drei Kennzahlen zur Wiesn-Zeltlandschaft: 14 große Festzelte, 21 kleinere Betriebe und rund 10.000 Plätze im Hofbräu-Festzelt einschließlich Außenbereich.',
      caption: 'Die kleineren Betriebe sind keine Nebenrolle: Sie bieten oft spezialisierte Küche und kürzere Wege als die großen Hallen.'
    },
    {
      slug: '/oktoberfest/bier-in-welchem-festzelt/',
      file: 'oktoberfest-zelte-je-brauerei',
      template: 'balken',
      props: {
        eyebrow: 'Oktoberfest', title: 'Wie sich die 14 großen Zelte auf die Brauereien verteilen',
        subtitle: 'Sechs Brauereien teilen sich die großen Festzelte. Die Zuordnungen sind über Jahre hinweg stabil.',
        unit: 'ANZAHL DER GROSSEN FESTZELTE',
        items: tents.map((row, index) => ({
          label: row.label,
          value: row.value,
          valueLabel: `${row.value} ${row.value === 1 ? 'Zelt' : 'Zelte'}`,
          fill: index === 0 ? T.amber : T.green
        })),
        note: 'Kufflers Weinzelt zählt hier bei Paulaner mit, schenkt in der Maß aber Weißbier aus und wird beim Preisvergleich getrennt betrachtet.',
        source: 'Gezählt aus der Zelttabelle dieser Seite. Quelle der Zuordnungen: offizielle Übersicht von Oktoberfest.de, geprüft am 29. September 2026.'
      },
      alt: 'Balkendiagramm der Verteilung der 14 großen Oktoberfestzelte auf die sechs Münchner Brauereien, angeführt von Paulaner mit vier Zelten, gefolgt von Spaten mit drei.',
      caption: 'Paulaner stellt das Bier in vier der vierzehn großen Zelte, Hofbräu nur in einem — dem größten von allen.'
    },
    {
      slug: '/oktoberfest/welches-bier-gibt-es/',
      file: 'oktoberfest-wiesnbiere',
      template: 'punkte',
      props: {
        eyebrow: 'Oktoberfest', title: 'Alkoholgehalt der sechs Wiesnbiere',
        subtitle: 'Festbier ist stärker eingebraut als ein normales Helles. Zwischen dem stärksten und dem mildesten Wiesnbier liegt knapp ein halbes Prozent.',
        min: 5.8, max: 6.4, ticks: [5.8, 6.0, 6.2, 6.4], suffix: ' %',
        items: [
          { label: 'Augustiner Wiesnbier', value: 6.3, valueLabel: '6,3 % vol', emphasis: true, fill: T.amber },
          { label: 'Hofbräu Oktoberfestbier', value: 6.2, valueLabel: '6,2 % vol' },
          { label: 'Löwenbräu Oktoberfestbier', value: 6.1, valueLabel: '6,1 % vol' },
          { label: 'Hacker-Pschorr Oktoberfestbier', value: 6.0, valueLabel: '6,0 % vol' },
          { label: 'Paulaner Oktoberfestbier', value: 6.0, valueLabel: '6,0 % vol' },
          { label: 'Spaten Oktoberfestbier', value: 5.9, valueLabel: 'etwa 5,9 % vol', emphasis: true, fill: T.inkSoft }
        ],
        note: 'Ein normales Helles liegt meist bei 4,7 bis 5,4 Prozent. Eine Maß Wiesnbier enthält deshalb spürbar mehr Alkohol als eine Maß Helles.',
        source: 'Offizielle Übersicht der sechs Wiesn-Brauereien, geprüft am 29. September 2026. Für ein konkretes Produkt gilt die aktuelle Herstellerangabe.'
      },
      alt: 'Punktdiagramm des Alkoholgehalts der sechs Wiesnbiere: Augustiner mit 6,3 Prozent am stärksten, Hofbräu 6,2, Löwenbräu 6,1, Hacker-Pschorr und Paulaner je 6,0 und Spaten mit etwa 5,9 Prozent.',
      caption: 'Alle sechs liegen zwischen 5,9 und 6,3 Prozent — deutlich über einem normalen Hellen mit 4,7 bis 5,4 Prozent.'
    },
    {
      slug: '/oktoberfest/reservierung-oeffnungszeiten/',
      file: 'oktoberfest-oeffnungszeiten',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Oktoberfest', title: 'Wann die Festzelte geöffnet sind',
        subtitle: 'Die großen Zelte folgen einem festen Rhythmus. Letzter Bierausschank und Musikende liegen jeweils eine Stunde vor Schluss.',
        tiles: [
          { value: '10 – 23.30', unit: 'MONTAG BIS FREITAG', label: 'letzter Ausschank und Musikende gewöhnlich um 22.30 Uhr' },
          { value: '9 – 23.30', unit: 'SAMSTAG UND SONNTAG', label: 'auch an Feiertagen öffnen die großen Zelte früher' },
          { value: 'bis 1 Uhr', unit: 'ZWEI AUSNAHMEN', label: 'Käfer Wiesn-Schänke und Kufflers Weinzelt, letzter Ausschank 0.30 Uhr' }
        ],
        note: 'Am ersten Samstag öffnen die Zelte um 9 Uhr, Bier gibt es erst nach dem offiziellen Anstich um 12 Uhr. Eine Reservierung ist für den Zeltbesuch nicht grundsätzlich nötig.',
        source: 'Angaben der Landeshauptstadt München zum Oktoberfest. Abruf November 2026.'
      },
      alt: 'Öffnungszeiten der Oktoberfestzelte: montags bis freitags 10 bis 23.30 Uhr, samstags und sonntags ab 9 Uhr, und als Ausnahme Käfer Wiesn-Schänke sowie Kufflers Weinzelt bis 1 Uhr.',
      caption: 'Freie Plätze sind werktags am Vormittag am wahrscheinlichsten. Abends und am Wochenende können Zelte wegen Überfüllung schließen.'
    },
    {
      slug: '/oktoberfest/karte-anreise/',
      file: 'oktoberfest-anreise',
      template: 'zweiwege',
      props: {
        eyebrow: 'Oktoberfest', title: 'Die naheliegende Anreise und die ruhigere',
        subtitle: 'Die Theresienwiese liegt südwestlich der Münchner Innenstadt. Vier Stationen kommen infrage — die nächstgelegene ist nicht immer die beste.',
        columns: [
          {
            title: 'Direkt am Gelände',
            rows: [
              ['STATION', 'Theresienwiese, U4 und U5'],
              ['WEG', 'unmittelbar am Festgelände'],
              ['NACHTEIL', 'zu Spitzenzeiten sehr voll'],
              ['GEEIGNET', 'außerhalb der Stoßzeiten']
            ],
            examples: 'Die naheliegendste Verbindung, aber selten die entspannteste'
          },
          {
            title: 'Kurzer Fußweg, dafür ruhiger',
            rows: [
              ['U-BAHN', 'Goetheplatz oder Poccistraße, U3 und U6'],
              ['S-BAHN', 'Hackerbrücke, ausgeschilderter Fußweg, mehrere Linien'],
              ['VOM HAUPTBAHNHOF', 'zu Fuß etwa 15 bis 25 Minuten je nach Eingang'],
              ['VORTEIL', 'je nach Zelt kann der Weg sogar kürzer sein']
            ],
            examples: 'Besonders für Reisende aus dem Umland und vom Hauptbahnhof'
          }
        ],
        note: 'Mit dem Auto ist die direkte Anreise unpraktisch: Sperrungen, Zufahrtsbeschränkungen und kaum Parkplätze. Wer Alkohol trinkt, fährt ohnehin nicht selbst — das gilt auch für Fahrrad und E-Scooter.',
        source: 'Einordnung aus dem Text dieser Seite. Den verbindlichen Geländeplan veröffentlicht die Landeshauptstadt München.'
      },
      alt: 'Anreisevergleich zum Oktoberfest: direkt am Gelände die Station Theresienwiese mit U4 und U5, als ruhigere Alternative Goetheplatz oder Poccistraße mit U3 und U6, die S-Bahn-Station Hackerbrücke sowie 15 bis 25 Minuten Fußweg vom Hauptbahnhof.',
      caption: 'Die nächstgelegene Station ist zu Spitzenzeiten die vollste. Je nach Zelt ist der Weg von Goetheplatz oder Poccistraße sogar kürzer.'
    },
    {
      slug: '/oktoberfest/bands-musik/',
      file: 'oktoberfest-musik',
      template: 'zweiwege',
      props: {
        eyebrow: 'Oktoberfest', title: 'Wie sich die Musik über den Tag verändert',
        subtitle: 'Jedes Festzelt organisiert sein Programm selbst. Der Tagesverlauf folgt trotzdem in fast allen großen Zelten demselben Muster.',
        columns: [
          {
            title: 'Vormittag und früher Nachmittag',
            rows: [
              ['REPERTOIRE', 'traditionelle Blasmusik, Märsche, Walzer und bayerische Stücke'],
              ['LAUTSTÄRKE', 'gedämpfter, Gespräche am Tisch sind möglich'],
              ['PUBLIKUM', 'ruhiger, häufig Familien und Gäste ohne Reservierung'],
              ['OIDE WIESN', 'setzt den ganzen Tag stärker auf traditionelle Volksmusik']
            ],
            examples: 'Gute Zeit, wenn es um Essen und das Zelt selbst gehen soll'
          },
          {
            title: 'Nachmittag und Abend',
            rows: [
              ['REPERTOIRE', 'bekannte Wiesnhits, Schlager, Rockklassiker und internationale Partylieder'],
              ['LAUTSTÄRKE', 'deutlich lauter, ausgerichtet aufs Mitsingen'],
              ['PUBLIKUM', 'volle Zelte, Bänke werden zur Bühne'],
              ['ZELTSCHLUSS', 'Musikende gewöhnlich eine Stunde vor Schluss']
            ],
            examples: 'Große Partyzelte richten ihr Programm hierauf aus'
          }
        ],
        note: 'Bandpläne ändern sich kurzfristig. Verbindlich sind immer die offiziellen Programmseiten der einzelnen Festzelte.',
        source: 'Einordnung aus dem Text dieser Seite. Einen vollständigen zentralen Spielplan für alle Zelte und Tage gibt es nicht.'
      },
      alt: 'Gegenüberstellung des Musikprogramms auf dem Oktoberfest: vormittags traditionelle Blasmusik, Märsche und Walzer bei moderater Lautstärke, nachmittags und abends Wiesnhits, Schlager und Rockklassiker deutlich lauter.',
      caption: 'Wer das Zelt und das Essen erleben will, kommt vormittags. Wer feiern will, abends. Das Programm wechselt in fast jedem großen Zelt.'
    },
    {
      slug: '/bierregionen/bier-in-muenchen/',
      file: 'bierregionen-muenchen',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierregionen', title: 'München in drei Jahreszahlen',
        subtitle: 'Die Münchner Bierkultur ist älter als das Oktoberfest und hat mit dem Hellen einen Stil hervorgebracht, der heute weit über Bayern hinaus erfolgreich ist.',
        tiles: [
          { value: '1328', unit: 'ÄLTESTE DER SECHS', label: 'Brautradition bei Augustiner, der ältesten Oktoberfestbrauerei' },
          { value: '1894', unit: 'DAS HELLE KOMMT', label: 'Spaten bringt ein frühes Münchner Hell auf den Markt' },
          { value: '6', unit: 'WIESNBRAUEREIEN', label: 'nur ihr Bier darf als Oktoberfestbier ausgeschenkt werden' }
        ],
        note: 'Die Münchner Szene besteht nicht nur aus den sechs Großen: Kleinere und neuere Brauereien bringen Kellerbier, IPA und alkoholfreie Biere dazu.',
        source: 'Brauereitabelle dieser Seite. Für eine Stadtübersicht ist zwischen Stadtgebiet, Landkreis und Münchner Marken zu unterscheiden.'
      },
      alt: 'Drei Jahreszahlen zur Münchner Bierkultur: Augustiner als älteste der sechs Oktoberfestbrauereien mit Brautradition seit 1328, Spaten mit einem frühen Münchner Hell ab 1894 und sechs zugelassene Wiesnbrauereien.',
      caption: 'Das Helle ist jünger als die Brauereien, die es brauen. Erst Ende des 19. Jahrhunderts wurde der Stil populär.'
    },
    {
      slug: '/bier-rechner/bierpreis-pro-liter/',
      file: 'rechner-bierpreis',
      template: 'balken',
      props: {
        eyebrow: 'Bierrechner', title: 'Warum der Kastenpreis in die Irre führt',
        subtitle: 'Drei Angebote, die im Regal ähnlich aussehen. Erst der Preis je Liter zeigt, welches wirklich günstiger ist.',
        unit: 'PREIS JE LITER, OHNE PFAND',
        items: [
          { label: '20 × 0,5 l für 18 €', sublabel: '10 Liter Getränkemenge', value: 1.8, valueLabel: '1,80 €', fill: T.green },
          { label: '24 × 0,33 l für 16 €', sublabel: '7,92 Liter, also weniger Bier', value: 2.02, valueLabel: 'ca. 2,02 €' },
          { label: 'Sixpack 6 × 0,33 l für 5,49 €', sublabel: '1,98 Liter', value: 2.77, valueLabel: 'ca. 2,77 €', fill: T.amberDark }
        ],
        note: 'Der Kasten mit mehr Flaschen ist hier der teurere: 24 kleine Flaschen enthalten weniger Bier als 20 große. Das Sixpack kostet je Liter gut die Hälfte mehr als der große Kasten.',
        source: 'Rechenbeispiele aus der Tabelle dieser Seite. Pfand bleibt außen vor, weil es bei Rückgabe erstattet wird.'
      },
      alt: 'Balkendiagramm dreier Bierangebote nach Preis je Liter: 20 mal 0,5 Liter für 18 Euro ergeben 1,80 Euro je Liter, 24 mal 0,33 Liter für 16 Euro rund 2,02 Euro und ein Sixpack rund 2,77 Euro je Liter.',
      caption: 'Mehr Flaschen heißt nicht mehr Bier. Der Kasten mit 24 kleinen Flaschen ist je Liter teurer als der mit 20 großen.'
    },
    {
      slug: '/bier-rechner/fassbier/',
      file: 'rechner-fassbier',
      template: 'balken',
      props: {
        eyebrow: 'Bierrechner', title: 'Was der Ausschankverlust aus einem Fass macht',
        subtitle: 'Die rechnerische Glaszahl ist eine Obergrenze. Schaum, Anstich und Restmengen gehen davon ab — der Rechner weist beides getrennt aus.',
        unit: 'HALBE LITER AUS EINEM 50-LITER-FASS',
        items: [
          { label: 'ohne Verlust', sublabel: 'die rechnerische Obergrenze', value: 100, valueLabel: '100 Gläser' },
          { label: '5 Prozent Verlust', sublabel: 'gut eingestellte Anlage', value: 95, valueLabel: '95 Gläser', fill: T.green },
          { label: '10 Prozent Verlust', sublabel: 'realistisch im laufenden Betrieb', value: 90, valueLabel: '90 Gläser', fill: T.green }
        ],
        note: 'Die Glaszahl wird immer abgerundet, weil ein Rest kein volles Getränk ergibt. Für die Planung lohnt es sich, mit der unteren Zahl zu rechnen.',
        source: 'Rechenweg dieser Seite: nutzbare Liter = Fassgröße × (1 − Verlust ÷ 100), geteilt durch die Glasgröße.'
      },
      alt: 'Balkendiagramm der Glaszahl aus einem 50-Liter-Fass: 100 halbe Liter ohne Verlust, 95 bei 5 Prozent Ausschankverlust und 90 bei 10 Prozent.',
      caption: 'Zehn Prozent Verlust kosten zehn Gläser. Für die Planung einer Feier ist die untere Zahl die ehrlichere.'
    },
    {
      slug: '/bier-rechner/bier-kuehlzeit/',
      file: 'rechner-kuehlzeit',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierrechner', title: 'Was die geschätzte Kühlzeit verschiebt',
        subtitle: 'Hinter dem Rechner stehen konservativ gewählte Zeitbereiche, keine physikalische Simulation. Drei Größen verändern das Ergebnis am stärksten.',
        tiles: [
          { value: 'Differenz', unit: 'START ZU ZIEL', label: 'je weiter Start- und Wunschtemperatur auseinanderliegen, desto länger' },
          { value: 'Gebinde', unit: 'DOSE ODER GLAS', label: 'Dose kühlt schneller als Glas, 0,33 l schneller als 0,5 l' },
          { value: 'Menge', unit: 'EINZELN ODER KASTEN', label: 'mehrere Gebinde wärmen sich gegenseitig, dafür gibt es einen Aufschlag' }
        ],
        note: 'Der Rechner gibt „ungefähr 2 bis 4 Stunden“ aus statt „2 Stunden 17 Minuten“. Ohne Messung der tatsächlichen Wärmeübertragung wäre eine minutengenaue Zahl irreführend.',
        source: 'Rechenlogik dieser Seite. Das Gefrierfach bieten wir bewusst nicht als Standardmethode an.'
      },
      alt: 'Drei Einflussgrößen auf die geschätzte Kühlzeit: die Temperaturdifferenz zwischen Start und Ziel, das Gebinde aus Dose oder Glas und die Menge von einzelner Flasche bis ganzem Kasten.',
      caption: 'Deshalb gibt der Rechner Zeitbereiche aus. Eine minutengenaue Zahl wäre ohne Temperaturmessung erfunden.'
    },
    {
      slug: '/bier-rechner/biermenge-party/',
      file: 'rechner-biermenge',
      template: 'kennzahlen',
      props: {
        eyebrow: 'Bierrechner', title: 'Drei Szenarien statt einer Zahl',
        subtitle: 'Der Rechner gibt nicht ein Ergebnis aus, sondern drei. Das macht sichtbar, dass es sich um eine Schätzung für den Einkauf handelt.',
        tiles: [
          { value: 'knapp', unit: 'WENIG RESERVE', label: 'wenn viele andere Getränke im Angebot sind' },
          { value: 'normal', unit: 'AUSGEWOGEN', label: 'die mittlere Annahme — kein Richtwert für den Konsum' },
          { value: 'großzügig', unit: 'MIT PUFFER', label: 'längere Veranstaltung oder unsichere Gästezahl' }
        ],
        note: 'Die Zahlen gelten der Einkaufsplanung für erwachsene Gäste und sind kein Konsumziel. Wasser und alkoholfreie Getränke gehören in jede Planung.',
        source: 'Rechenlogik dieser Seite. Das Ergebnis wird auf ganze Flaschen und anschließend auf ganze Kästen aufgerundet.'
      },
      alt: 'Drei Planungsszenarien des Biermengenrechners: knapp mit wenig Reserve, normal als ausgewogene Annahme und großzügig mit Puffer für längere Feiern.',
      caption: 'Das mittlere Szenario ist ein Einkaufsvorschlag, keine richtige Trinkmenge. Deshalb nennt der Rechner alle drei.'
    }
  ];
}

export function catalogue() {
  const published = publishedSlugs();
  const all = [...styleFigures(), ...duelFigures(), ...manualFigures(), ...waveTwoFigures()];
  const kept = all.filter((figure) => published.has(figure.slug));
  const dropped = all.filter((figure) => !published.has(figure.slug));
  return { figures: kept, dropped };
}
