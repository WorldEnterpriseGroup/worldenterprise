# WP-32b handoff: hosts and period labels (D-W10-6)

- Host classes added in `tests/unit/wp-60/sources.ts`: scholarly (nber.org, kauffman.org, gemconsortium.org), datapublisher (carta.com, cbinsights.com), program (directory and program sites; no statistics, no regulations). Pinned in `tests/unit/wp-60/sources-ledger.test.ts` and `tests/unit/wp-32b/hosts.test.ts`.
- Not added: crowell.com (law firm). WP-34 should cite sbir.gov, sba.gov or congress.gov for the legal reading, or request a decision.
- ST-16 and ST-18 periods corrected in `src/data/sales/stats.ts` (NBER w24489: top 0.1% columns cover firms founded 2007 to 2009; the 41.9 figure covers 2007 to 2014).
- Open for other owners: ST-17 sample window unverified; the caption in `src/pages/why-it-takes-time/index.astro` (about line 268, WP-37) and `AZOULAY.period` in `src/components/visuals/styleguide/samples.ts` (line 45, WP-36) still say 2007 to 2014 for the top 0.1% figure.
