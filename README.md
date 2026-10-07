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
