# Asset sources

All brand assets are copied unmodified from the private brand source repository of World Enterprise Group Incorporated, with two exceptions. The
font files were re-wrapped from WOFF to WOFF2 (fontTools, table for table, nothing added or removed). Glyph outlines, metrics,
name tables and character coverage are identical, and each font is about 20 percent smaller. The wordmark SVG was optimised: its
sixteen gradients all had two identical stops, so they became flat fills, and SVGO ran at precision 2 (22.7 KB to 8.1 KB; a raster
diff at 1x, 2x and 4x shows no pixel off by more than 18 of 255, only on antialiased edges). The same file is the press download
in public/press/, and tests/unit/wp-19/wordmark.test.ts keeps the two identical.

| Path here | Brand source path | Licence |
|---|---|---|
| fonts/*.woff2, fonts/LICENSE-*.txt | publish/fonts/ | SIL OFL 1.1, texts included |
| brand/we-logo-wordmark.svg | brand/assets/we-logo-wordmark.svg | World Enterprise brand |
| hex/*.svg | elevate/C-graphics/ | World Enterprise brand |
| icons/A..G-*.svg | elevate/C-graphics/icons/ | World Enterprise brand |

Skipped deliberately: the 08 seal graphics. They carry "Business Incubator Agreement" wording, which implies a
contractual status the site must not claim (claims ladder, section 3).

public/favicon.svg and public/apple-touch-icon.png are original marks drawn for this site from the brand blue.
