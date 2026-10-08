/**
 * Progressive enhancement for the mega menu and the mobile drawer. The popover attributes already open and close both without this
 * script; it adds focus return, arrow keys, hover intent, panel positioning and keeping keyboard focus inside the open drawer.
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

const LEAVE_MS = 250;

for (const t of triggers) {
  const panel = panelOf(t);
  if (!panel) continue;
  // Timers belong to one trigger. Shared between triggers, moving the pointer from one item to the next let the second item's enter
  // cancel the first item's pending close, and a stale close could fire on the panel that had just opened.
  let hoverTimer: number | undefined;
  let leaveTimer: number | undefined;
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

  let openedByHover = false;

  t.addEventListener('pointerenter', (e) => {
    if (!FINE.matches || e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer);
    window.clearTimeout(leaveTimer);
    hoverTimer = window.setTimeout(() => {
      if (!panel.matches(':popover-open')) {
        // Opening one panel light-dismisses another, so only one is ever open.
        panel.showPopover();
        openedByHover = true;
      }
    }, HOVER_MS);
  });

  // A panel opened by hover closes shortly after the pointer leaves both trigger and panel (WCAG 1.4.13: the pointer may travel into it).
  const scheduleLeave = (): void => {
    window.clearTimeout(hoverTimer);
    if (!openedByHover) return;
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      if (openedByHover && panel.matches(':popover-open') && !panel.contains(document.activeElement)) panel.hidePopover();
    }, LEAVE_MS);
  };
  const cancelLeave = (): void => window.clearTimeout(leaveTimer);
  t.addEventListener('pointerleave', scheduleLeave);
  panel.addEventListener('pointerleave', scheduleLeave);
  panel.addEventListener('pointerenter', cancelLeave);
  panel.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'closed') openedByHover = false;
  });
  t.addEventListener('click', () => {
    openedByHover = false;
  });

  // Keyboard users who Tab past the last link leave the panel; close it so it does not linger over the page.
  panel.addEventListener('focusout', (e) => {
    const next = (e as FocusEvent).relatedTarget as Node | null;
    if (next && !panel.contains(next) && next !== t && panel.matches(':popover-open')) panel.hidePopover();
  });

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

// The drawer is a non-modal popover with a scrim over the page, so it has to behave like the modal it looks like: Tab and Shift+Tab stay
// inside it (WCAG 2.4.3 Focus Order), and Escape, which the popover handles itself, returns focus to the Menu button.
const TABBABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The drawer's current tab stops in order. Links in a collapsed section are not stops. */
function drawerStops(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((node) => {
    const collapsed = node.closest('details:not([open])');
    if (collapsed !== null && !(node.tagName === 'SUMMARY' && node.parentElement === collapsed)) return false;
    return node.checkVisibility();
  });
}

if (drawer) {
  const menuButton = document.querySelector<HTMLElement>('button.mobile-nav__toggle[popovertarget="mobile-drawer"]:not([popovertargetaction])');
  drawer.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'open') drawerStops(drawer)[0]?.focus();
    else if (drawer.contains(document.activeElement)) menuButton?.focus();
  });

  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const stops = drawerStops(drawer);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) return;
    const active = document.activeElement;
    const inside = active !== null && drawer.contains(active);
    if (e.shiftKey && (!inside || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  });

  // Anything else that puts keyboard focus outside the open drawer (a script, an assistive technology, the Menu button reached with
  // Shift+Tab) is sent back in. Pointer focus is left alone, so pressing the Menu button at tablet widths still toggles the drawer.
  document.addEventListener('focusin', (e) => {
    if (!drawer.matches(':popover-open')) return;
    const target = e.target;
    if (!(target instanceof Element) || drawer.contains(target) || !target.matches(':focus-visible')) return;
    (drawerStops(drawer)[0] ?? drawer).focus();
  });
}
