/**
 * The filterable index (WP-24): a group of radio buttons over a list, where CSS alone (`:has(:checked)`) hides the items outside the
 * chosen group. No script and no inline style: each option takes one of a fixed number of slots, and FilterIndex.astro ships one
 * rule per slot. An item names its groups with the classes `itemClasses` returns. Pure helpers, unit-tested in tests/unit/wp-24.
 */

/** How many options a filter can hold; FilterIndex.astro has exactly this many slot rules. */
export const FILTER_SLOTS = 16;

export interface FilterOption {
  /** Stable key of the group (a desk id, a kind, a stage). */
  readonly key: string;
  readonly label: string;
  /** How many items the group holds, shown beside the label. */
  readonly count: number;
}

export interface FilterSlot extends FilterOption {
  readonly slot: number;
}

/** Validates the options and assigns each its slot, in the order given. Groups with no items are dropped (an empty filter is noise). */
export function filterSlots(options: readonly FilterOption[]): readonly FilterSlot[] {
  const kept = options.filter((o) => o.count > 0);
  if (kept.length > FILTER_SLOTS) throw new RangeError(`filterSlots: ${kept.length} options, at most ${FILTER_SLOTS}`);
  const keys = new Set<string>();
  return kept.map((o, slot) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(o.key)) throw new RangeError(`filterSlots: key "${o.key}" must be lower-case letters, digits and hyphens`);
    if (keys.has(o.key)) throw new RangeError(`filterSlots: key "${o.key}" is listed twice`);
    if (o.label.trim() === '') throw new RangeError(`filterSlots: option "${o.key}" has no label`);
    keys.add(o.key);
    return { ...o, slot };
  });
}

/** The class an item carries for one slot. */
export const slotClass = (slot: number): string => `fi-${slot}`;

/** The classes for an item in the given groups: `fi-item` plus one slot class per group. Unknown keys throw, so a typo fails the build. */
export function itemClasses(slots: readonly FilterSlot[], keys: readonly string[]): string {
  const classes = keys.map((key) => {
    const found = slots.find((s) => s.key === key);
    if (found === undefined) throw new RangeError(`itemClasses: no filter option "${key}"`);
    return slotClass(found.slot);
  });
  return ['fi-item', ...new Set(classes)].join(' ');
}

/** "1 article" / "12 articles". */
export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
