import { glob, file } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { schemas } from './lib/content-schemas.ts';

/**
 * Content collections (SAGE-PLAN 6.4). The schemas are in `src/lib/content-schemas.ts` so that plain-Node unit tests can parse
 * frontmatter against the same objects; this file only binds each one to its loader. Every object is strict: unknown frontmatter
 * keys fail the build.
 */

const mdLoader = (base: string) => glob({ pattern: '**/*.{md,mdx}', base });

const pages = defineCollection({ loader: mdLoader('./src/content/pages'), schema: schemas.pages });
const services = defineCollection({ loader: mdLoader('./src/content/services'), schema: schemas.services });
const playbooks = defineCollection({ loader: mdLoader('./src/content/playbooks'), schema: schemas.playbooks });
const guides = defineCollection({ loader: mdLoader('./src/content/guides'), schema: schemas.guides });
const insights = defineCollection({ loader: mdLoader('./src/content/insights'), schema: schemas.insights });
const research = defineCollection({ loader: mdLoader('./src/content/research'), schema: schemas.research });
const library = defineCollection({ loader: mdLoader('./src/content/library'), schema: schemas.library });
/** Open abstracts of the gated briefs. The full text is under infra/intake/briefs/, outside every path the build reads. */
const briefs = defineCollection({ loader: mdLoader('./src/content/briefs'), schema: schemas.briefs });
const faq = defineCollection({ loader: file('src/data/faq.yaml'), schema: schemas.faq });
const glossary = defineCollection({ loader: file('src/data/glossary.yaml'), schema: schemas.glossary });

/** L2 collections: schema defined, collection empty. */
const people = defineCollection({ loader: mdLoader('./src/content/people'), schema: schemas.people });
const events = defineCollection({ loader: mdLoader('./src/content/events'), schema: schemas.events });
const portfolio = defineCollection({ loader: mdLoader('./src/content/portfolio'), schema: schemas.portfolio });

export const collections = { pages, services, playbooks, guides, insights, research, library, briefs, faq, glossary, people, events, portfolio };
