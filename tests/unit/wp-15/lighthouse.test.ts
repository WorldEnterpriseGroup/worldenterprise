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
  readonly input: boolean;
  readonly nodes: readonly { readonly from: readonly number[]; readonly to: readonly number[] }[];
}

const layoutShifts = (lhMod as unknown as { layoutShifts(events: readonly TraceEvent[]): Shift[] }).layoutShifts;

const shift = (ts: number, data: Record<string, unknown>): TraceEvent => ({ name: 'LayoutShift', ts, args: { data } });

test('layoutShifts reports time, score and the old and new rectangles of main-frame shifts', () => {
  const events: TraceEvent[] = [
    { name: 'navigationStart', ts: 1_000 },
    shift(251_000, { is_main_frame: true, weighted_score_delta: 0.158, impacted_nodes: [{ old_rect: [0, 300, 412, 8000], new_rect: [0, 556, 412, 8000] }] }),
    shift(260_000, { is_main_frame: false, weighted_score_delta: 0.5 }),
    { name: 'FirstPaint', ts: 100_000 },
  ];
  assert.deepEqual(layoutShifts(events), [
    { atMs: 250, score: 0.158, input: false, nodes: [{ from: [0, 300, 412, 8000], to: [0, 556, 412, 8000] }] },
  ]);
});

test('layoutShifts keeps shifts that Chromium flagged with recent input, as Lighthouse counts them, and marks them', () => {
  const events: TraceEvent[] = [
    { name: 'navigationStart', ts: 0 },
    shift(120_000, { is_main_frame: true, had_recent_input: true, weighted_score_delta: 0.158 }),
  ];
  assert.deepEqual(layoutShifts(events), [{ atMs: 120, score: 0.158, input: true, nodes: [] }]);
});

test('layoutShifts is empty when the trace holds no shift', () => {
  assert.deepEqual(layoutShifts([{ name: 'navigationStart', ts: 1 }]), []);
});
