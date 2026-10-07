/**
 * Progressive enhancement for the mega menu. The popover attributes already open and close panels
 * without this script; it adds focus return, arrow keys, hover intent and panel positioning.
 */
const WIDE = window.matchMedia('(min-width: 1100px)');
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)');
const HOVER_MS = 150;

const nav = document.querySelector<HTMLElement>('[data-mega-nav]');
const triggers = nav ? Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-mega-trigger]')) : [];
const panelOf = (t: HTMLButtonElement): HTMLElement | null => document.getElementById(t.getAttribute('popovertarget') ?? '');

function placePanel(panel: HTMLElement): void {
  const header = document.querySelector('.site-header');
  if (header) panel.style.setProperty('--panel-top', `${Math.round(header.getBoundingClientRect().bottom)}px`);
}

function syncExpanded(t: HTMLButtonElement, open: boolean): void {
  t.setAttribute('aria-expanded', open ? 'true' : 'false');
}

let hoverTimer: number | undefined;

for (const t of triggers) {
  const panel = panelOf(t);
  if (!panel) continue;
  syncExpanded(t, false);
  t.setAttribute('aria-controls', panel.id);

  panel.addEventListener('beforetoggle', (e) => {
    const next = (e as ToggleEvent).newState === 'open';
    if (next) placePanel(panel);
    syncExpanded(t, next);
  });
  panel.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'closed' && panel.contains(document.activeElement)) t.focus();
  });
  panel.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) panel.hidePopover();
  });

  t.addEventListener('pointerenter', (e) => {
    if (!FINE.matches || e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      if (!panel.matches(':popover-open')) panel.showPopover();
    }, HOVER_MS);
  });
  t.addEventListener('pointerleave', () => window.clearTimeout(hoverTimer));

  t.addEventListener('keydown', (e) => {
    const i = triggers.indexOf(t);
    if (e.key === 'ArrowRight') triggers[(i + 1) % triggers.length]?.focus();
    else if (e.key === 'ArrowLeft') triggers[(i - 1 + triggers.length) % triggers.length]?.focus();
    else if (e.key === 'Home') triggers[0]?.focus();
    else if (e.key === 'End') triggers[triggers.length - 1]?.focus();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!panel.matches(':popover-open')) panel.showPopover();
      panel.querySelector<HTMLElement>('a')?.focus();
    } else return;
    if (e.key !== 'ArrowDown') e.preventDefault();
  });
}

WIDE.addEventListener('change', () => {
  for (const el of document.querySelectorAll<HTMLElement>('[data-mega-panel], [data-mobile-drawer]')) {
    if (el.matches(':popover-open')) el.hidePopover();
  }
});

const drawer = document.querySelector<HTMLElement>('[data-mobile-drawer]');
drawer?.addEventListener('click', (e) => {
  if ((e.target as Element).closest('a')) drawer.hidePopover();
});
