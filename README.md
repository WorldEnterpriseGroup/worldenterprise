# World Enterprise Incubator

Source for [worldenterprise.org](https://worldenterprise.org), the public website of World Enterprise
Group Incorporated: a fully digital, fully remote incubator for SaaS companies that provides dedicated
team seats steered by WE.

The site is a static Astro 7 build. Content, design tokens, routes and navigation are typed data in
`src/`. Nothing is built or previewed locally: GitLab CI is the only place that runs `astro build`,
audits and browser tests.

## Branches

| Branch | Purpose |
|---|---|
| `demo` | Integration branch. Every push runs `verify:static` and deploys the internal GitLab Pages preview. |
| `wp/<id>` | Work-package branches, merged into `demo` only when their pipeline is green. |
| `gh-pages` | Release branch. GitLab mirrors it to GitHub, where Actions builds and deploys to GitHub Pages. |

`CNAME` at the repository root binds the custom domain and must never be changed or removed.

## How the site is organised

| Path | What lives there |
|---|---|
| `src/data/routes.ts` | The route ledger: 90 rows, each with `launch`, `indexable`, layout and owner. Everything that lists pages is generated from it and from the routes that exist. |
| `src/data/flags.ts`, `src/data/site.ts`, `src/data/claims.ts` | Publication flags (all OFF), site identity and the claims ladder. Nothing about clients, people, metrics or prices is published without a source. |
| `src/content/` | Typed content collections (pages, services, playbooks, guides, insights, research, library) with strict schemas. |
| `src/pages/`, `src/layouts/`, `src/components/` | Routes, page layouts and components. Every internal link goes through `href()` in `src/lib/url.ts`. |
| `src/styles/` | Layered CSS on OKLCH tokens (`@layer reset, tokens, base, layout, components, utilities, pages, print`). Light theme only. |
| `scripts/` | Audits, the Lighthouse runner, the ownership check and the release gate. |
| `tests/unit/`, `tests/e2e/` | `node --test` unit tests and the Playwright suites (CI only). |
| `.astro-magazine/` | Ownership map, decisions, handoffs and the integration review. |

## Quality gates

GitLab runs every gate; see `.gitlab-ci.yml` for the stages and `docs/runbook-release.md` for the procedure.

- `verify:static`: type check, unit tests, contrast, production-shaped build, route ledger export.
- `audit:*`: claims, images, links, route ledger, dist, static accessibility, SEO, JSON-LD and token audits over `dist/`.
- `e2e:*`: Playwright at 1440 and 390 px (routes, axe, menu, interaction, forms, layout stability), plus no-js, forced-colors and zoom-200 modes.
- `qa:lighthouse`: mobile budgets on eight routes.
- `verify:release`: a `PUBLIC_RELEASE=1` build. A launched route that is missing, a draft, or a launched form with no endpoint fails it; only operator-gated items are allowed off `gh-pages`.

## Operator-owned items

These are the only things standing between the build and a release, and none of them is code:
the intake and newsletter endpoints (`PUBLIC_WE_INTAKE_API_URL`, `PUBLIC_WE_NEWSLETTER_API_URL`), a monitored security mailbox
for `/.well-known/security.txt`, confirmation of the `hello@` and `apply@` mailboxes, and counsel sign-off on the terms
and on the public benefit corporation wording. The flag snapshot is in `.astro-magazine/decisions.md`.

## Local commands (type level only)

```sh
npm ci
npx astro sync
npx astro check
npm run test:unit
```

## Release

See [docs/runbook-release.md](docs/runbook-release.md) for the release procedure, gates and rollback.
Architecture decisions are recorded in [docs/adr/0001-astro-rebuild.md](docs/adr/0001-astro-rebuild.md).

## Licence status

The `LICENSE` file at the repository root is the MIT licence inherited from the previous template
repository and is left untouched. No third-party template code, styles, scripts or images are used in
this build. Brand assets (logo, hexagon graphics, fonts) come from the World Enterprise brand kit;
the fonts are SIL Open Font License and their licence texts ship beside them in
`src/assets/fonts/`. The licence that applies to the new site source is to be confirmed by the owner.
