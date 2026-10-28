import assert from 'node:assert/strict';
import test from 'node:test';
import { FORM_ROUTES, forms, mailboxFor, parseEndpoint, publicContactAddress } from '../../../src/data/forms.ts';
import { flags } from '../../../src/data/flags.ts';

test('only absolute https endpoints are accepted', () => {
  assert.equal(parseEndpoint('https://intake.example.org/v1'), 'https://intake.example.org/v1');
  assert.equal(parseEndpoint('http://intake.example.org/v1'), null);
  assert.equal(parseEndpoint('/relative'), null);
  assert.equal(parseEndpoint(undefined), null);
});

test('without configuration the intake form is disabled, and the confirmed shared-mailbox aliases are the only fallback (2026-10-28)', () => {
  assert.equal(forms.intake.mode, process.env.PUBLIC_WE_INTAKE_API_URL ? 'endpoint' : 'mailto');
  assert.equal(mailboxFor('apply'), 'apply@worldenterprise.org');
  assert.equal(mailboxFor('contact'), 'hello@worldenterprise.org');
  assert.equal(publicContactAddress(), 'hello@worldenterprise.org');
});

test('the seat price is unpublished and the rate is null (claim C-06)', () => {
  assert.equal(flags.seatPrice.published, false);
  assert.equal(flags.seatPrice.monthlyRate, null);
});

test('form routes are declared', () => {
  assert.equal(FORM_ROUTES['/apply/'], 'intake');
  assert.equal(FORM_ROUTES['/contact/'], 'intake');
});
