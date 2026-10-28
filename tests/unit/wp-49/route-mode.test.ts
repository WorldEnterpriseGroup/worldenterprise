import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveRouteMode } from '../../../src/data/forms.ts';

test('with no endpoint, only apply and contact are mailto; every other launched form route counts as disabled for the release gate', () => {
  // Without an endpoint variable, and with the mailboxes confirmed on 2026-10-28, the intake form is in mailto mode.
  if (process.env.PUBLIC_WE_INTAKE_API_URL) return;
  assert.equal(effectiveRouteMode('/apply/'), 'mailto');
  assert.equal(effectiveRouteMode('/contact/'), 'mailto');
  assert.equal(effectiveRouteMode('/investors/interest/'), 'disabled');
  assert.equal(effectiveRouteMode('/network/partners/enquire/'), 'disabled');
  assert.equal(effectiveRouteMode('/briefs/funding-paths/'), 'disabled');
  assert.equal(effectiveRouteMode('/about/'), null);
});
