import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './content' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().regex(/^\/.+|^\/$/),
    canonical: z.url(),
    seo_title: z.string().max(60).optional(),
    meta_title: z.string().optional(),
    meta_description: z.string(),
    page_type: z.string(),
    cluster: z.string(),
    publish_phase: z.number(),
    launch_status: z.enum(['publish', 'queue']),
    index: z.boolean(),
    last_updated: z.coerce.date(),
    category: z.string().optional(),
    sources: z.array(z.url()).optional(),
    tool_id: z.string().optional(),
    review_cycle: z.string().optional(),
    priority: z.string().optional()
  })
});

export const collections = { pages };
