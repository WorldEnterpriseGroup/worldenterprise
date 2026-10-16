# Media primitives (WP-22, #88)

Three reusable components for showing rather than telling: a captioned video, a lightbox gallery and a carousel. Each is plain HTML
that works without JavaScript, upgraded by a small custom-element island. All three fit the strict CSP: no inline script or style, no
`data:` or `blob:` media, no third-party requests. Video, captions and images are imported from `src/assets/**`, so Vite emits them to
`_astro/` with hashed names under the site base.

| Component | Island | Without JavaScript |
| --- | --- | --- |
| `CaptionedVideo.astro` | `src/scripts/media-video.ts` (`<we-video>`) | the native player, poster, transcript and download link |
| `LightboxGallery.astro` | `src/scripts/media-lightbox.ts` (`<we-lightbox>`) | an ordered grid of links to the full-size images |
| `Carousel.astro` | `src/scripts/media-carousel.ts` (`<we-carousel>`) | an ordered list that scrolls sideways (native CSS scroll buttons and markers where the browser has them) |

The site's own uses are wrappers fed by the storyboard `decade.ts`: `DecadeFilm.astro` (on /about/, `#decade`), `DecadeCarousel.astro`
(on /about/) and `WorldsGallery.astro` (on /network/). Read them as worked examples.

Every text prop is passed through `cleanText` (`src/components/visuals/contracts.ts`): a banned word or a price fails the build.

## CaptionedVideo

```astro
---
import CaptionedVideo from '../components/media/CaptionedVideo.astro';
import poster from '../assets/video/film-poster.avif';
import webm from '../assets/video/film.webm?url';
import mp4 from '../assets/video/film.mp4?url';
import captions from '../assets/video/film.en.vtt?url';
---
<CaptionedVideo id="film" title="Film title" webm={webm} mp4={mp4} captions={captions} poster={poster}
  width={1920} height={1080} duration={57} silent summary="One line on what the film shows." downloadName="film.mp4">
  <Fragment slot="transcript">
    <p>Everything the film says and shows, in order.</p>
  </Fragment>
</CaptionedVideo>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | string | Required, unique on the page. Prefixes the title and cue ids. |
| `title` | string | Required. The player's accessible name and the transcript's summary. |
| `mp4` | string | Required. H.264 MP4 URL (`?url` import); also the download. |
| `webm` | string | Optional. AV1 WebM URL, offered first (`codecs="av01.0.08M.10"`). |
| `captions` | string | Required. WebVTT URL, as `<track kind="captions">`. |
| `captionsLang`, `captionsLabel` | string | Default `en`, `English`. |
| `captionsOn` | boolean | Default `false`: silent films print their words on screen. Set `true` for a film with speech. |
| `poster` | ImageMetadata | Required. Encoded as AVIF at `posterWidth` (default 3840, sharp on 4K in full screen). |
| `width`, `height` | number | Required. The film's intrinsic size; the player keeps a 16:9 box, so nothing shifts. |
| `duration` | number | Required, seconds. Shown as `<time datetime="PT57S">0:57</time>` in the content cue. |
| `silent` | boolean | Adds "no sound" to the content cue. |
| `summary` | string | Required. One line on what the film shows, in the content cue (also the player's description). |
| `downloadName` | string | File name offered by the download links. |
| slot `transcript` | HTML | Required (the build fails without it). Rendered in a `<details>` beside the player. |

Behavior: `preload="none"` (only the poster loads until play), native controls, `playsinline`, never autoplays. The island pauses the
film when the tab is hidden, when the player scrolls fully out of view (except in picture-in-picture) and on `pagehide`; it never calls
`play()`. Encode with `src/assets/video/tools/render-decade.mjs` as the reference: SVT-AV1 10-bit WebM and x264 High MP4 with
`+faststart`, each at most 4 MB (`tests/unit/wp-22/media-files.test.ts`).

## LightboxGallery

```astro
<LightboxGallery id="gallery" label="Worlds WE builds" labelledby="gallery-heading"
  items={[{ image: still1, alt: 'What the image shows', caption: 'The caption', credit: 'Rendered by WE' }, ...]} />
```

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | string | Required, unique on the page. |
| `label` | string | Required. The viewer's title and the grid's name when `labelledby` is absent. |
| `labelledby` | string | Id of a visible heading that names the grid. |
| `items` | `LightboxItem[]` | At least two: `{ image: ImageMetadata, alt, caption, credit? }`. Masters 2560 px wide or more. |

Thumbnails are `<img>` 512 px wide (1024 px candidate for dense screens), lazy and async, within the image audit's budget. Each sits in a
real link to the widest AVIF (up to 3840). The island opens the link in a native modal `<dialog closedby="any">` instead: focus goes to
Close and comes back to the thumbnail; Tab cycles inside the viewer; Escape, Close and a click on the empty area around the picture close
it; Previous and Next (and ArrowLeft/ArrowRight, Home/End while the dialog has focus) step through the set with wrap-around; "n of N" is
shown and a polite live region announces "Image n of N: caption". The viewer's image is created on open (with a 1280 to 3840 `srcset`),
so a closed viewer fetches nothing. Under reduced motion the zoom-in transition and the thumbnail hover zoom are off.

## Carousel

```astro
<h3 id="steps-title">The steps</h3>
<Carousel id="steps" label="The steps" labelledby="steps-title" size="card">
  <li><h3>Step one</h3><p>...</p></li>
  <li><h3>Step two</h3><p>...</p></li>
</Carousel>
```

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | string | Required, unique on the page. |
| `label` | string | Required. Names the region (unless `labelledby`) and the list. |
| `labelledby` | string | Id of a visible heading that names the region. |
| `size` | `'card' \| 'wide'` | Item width: about 22rem or 36rem, never wider than the track. |
| default slot | `<li>` elements | The items, in order. Style them in the parent; a `data-label` or the first heading names each item button. |

The track is a CSS scroll-snap `<ol>`, focusable so the keyboard can scroll it. The island adds Previous/Next (disabled at the ends, with
focus handed to the other button), one button per item (`aria-current` on the current one) and the "Item n of N" status in a polite live
region, spoken once a scroll settles. No autoplay. Smooth scrolling comes only from CSS under `prefers-reduced-motion: no-preference`.
Before the island is ready, browsers with `::scroll-button()` and `::scroll-marker` draw their native controls; the island's controls
replace them once it runs, so nothing is drawn twice.

## Tests

- `tests/unit/wp-22/`: the storyboard and captions file, the encoded media, the source rules of these components, the island helpers, and
  the server and dist audit changes for video.
- `tests/e2e/wave8/wp-22/media.spec.ts`: the components in place on /about/ and /network/, with and without JavaScript, axe, 390 and
  1920 px widths.
