import assert from 'node:assert/strict';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

interface TraceEvent {
  readonly name: string;
  readonly ts?: number;
  readonly args?: { readonly data?: Record<string, unknown> };
}

interface Shift {
  readonly atMs: number;
  readonly score: number;
  readonly nodes: readonly { readonly from: readonly number[]; readonly to: readonly number[] }[];
}

const layoutShifts = (lhMod as unknown as { layoutShifts(events: readonly TraceEvent[]): Shift[] }).layoutShifts;

const shift = (ts: number, data: Record<string, unknown>): TraceEvent => ({ name: 'LayoutShift', ts, args: { data } });

test('layoutShifts reports time, score and the old and new rectangles of main-frame shifts', () => {
  const events: TraceEvent[] = [
    { name: 'navigationStart', ts: 1_000 },
    shift(251_000, { is_main_frame: true, score: 0.158, impacted_nodes: [{ old_rect: [0, 300, 412, 8000], new_rect: [0, 556, 412, 8000] }] }),
    shift(260_000, { is_main_frame: false, score: 0.5 }),
    shift(270_000, { is_main_frame: true, had_recent_input: true, score: 0.4 }),
    { name: 'FirstPaint', ts: 100_000 },
  ];
  assert.deepEqual(layoutShifts(events), [
    { atMs: 250, score: 0.158, nodes: [{ from: [0, 300, 412, 8000], to: [0, 556, 412, 8000] }] },
  ]);
});

test('layoutShifts is empty when the trace holds no shift', () => {
  assert.deepEqual(layoutShifts([{ name: 'navigationStart', ts: 1 }]), []);
});
