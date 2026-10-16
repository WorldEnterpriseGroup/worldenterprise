/**
 * <we-video> (WP-22, #88): the island of CaptionedVideo. It never starts playback; it only stops it when the film can no longer be
 * watched, so nothing plays to an empty room:
 *
 * - the tab is hidden (visibilitychange),
 * - the player scrolls fully out of view (IntersectionObserver),
 * - the visitor leaves the page (pagehide, and astro:before-preparation should client-side routing ever be enabled).
 *
 * Without JavaScript the native player still works; only these pauses are lost.
 */

/** Pauses every playing video inside `root`. Exported for the unit tests. */
export function pauseAll(root: ParentNode): number {
  let paused = 0;
  for (const video of Array.from(root.querySelectorAll('video'))) {
    if (!video.paused) {
      video.pause();
      paused += 1;
    }
  }
  return paused;
}

export class WeVideo extends HTMLElement {
  private observer: IntersectionObserver | undefined;

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') pauseAll(this);
  };

  private readonly onLeave = (): void => {
    pauseAll(this);
  };

  connectedCallback(): void {
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onLeave);
    document.addEventListener('astro:before-preparation', this.onLeave);
    if (typeof IntersectionObserver === 'function') {
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target;
          // Picture-in-picture is a deliberate choice to keep watching elsewhere: scrolling away does not stop it.
          if (entry.isIntersecting || !(video instanceof HTMLVideoElement) || video.paused || document.pictureInPictureElement === video) continue;
          video.pause();
        }
      });
      for (const video of Array.from(this.querySelectorAll('video'))) this.observer.observe(video);
    }
    this.dataset.ready = '';
  }

  disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onLeave);
    document.removeEventListener('astro:before-preparation', this.onLeave);
    this.observer?.disconnect();
    this.observer = undefined;
    pauseAll(this);
  }
}

export function defineWeVideo(): void {
  if (!customElements.get('we-video')) customElements.define('we-video', WeVideo);
}
