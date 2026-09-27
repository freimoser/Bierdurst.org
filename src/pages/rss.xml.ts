import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import manifest from '../../data/url-manifest.json';

export async function GET(context: { site?: URL }) {
  const launchSlugs = new Set(manifest.filter((page) => page.launch_status === 'publish').map((page) => page.slug));
  const entries = await getCollection('pages', ({ data }) => launchSlugs.has(data.slug) && data.index && data.slug !== '/');

  return rss({
    title: 'BierDurst.org – neue und aktualisierte Inhalte',
    description: 'Aktualisierte Artikel über Biersorten, Bierwissen, Rechner, Bierregionen und das Oktoberfest.',
    site: context.site ?? new URL('https://bierdurst.org'),
    items: entries
      .sort((a, b) => b.data.last_updated.valueOf() - a.data.last_updated.valueOf())
      .map(({ data }) => ({
        title: data.title,
        description: data.meta_description,
        link: data.slug,
        pubDate: data.last_updated
      })),
    customData: '<language>de-DE</language>'
  });
}

