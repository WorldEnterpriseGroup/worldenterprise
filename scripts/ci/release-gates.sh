#!/bin/sh
# The release gate sequence, run by .github/workflows/pages.yml and by the GitLab verify:release job so both enforce the same thing.
# It builds the release dist (PUBLIC_RELEASE=1, no styleguide), then audits exactly what is published: CNAME is copied into dist before
# audit-dist, because that audit checks the final dist. RELEASE_ALLOW comes from the calling job (empty on a release tag and gh-pages).
set -eu

npm run verify:release
npm run audit:contrast
npm run audit:claims
node scripts/lib/export-ledger.mjs reports/ledger.json
cp CNAME dist/CNAME
node scripts/lib/audit-dist.mjs --dist dist --cname CNAME --cname-in-dist
node scripts/audit-csp.mjs --dist dist
node scripts/audit-route-ledger.mjs --dist dist --ledger reports/ledger.json --strict
node scripts/audit-links.mjs --dist dist --ledger reports/ledger.json --strict
node scripts/audit-images.mjs --dist dist
