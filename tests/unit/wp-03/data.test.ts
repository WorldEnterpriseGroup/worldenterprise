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

test('without configuration every form is disabled and no mailbox is published', () => {
  assert.equal(forms.intake.mode, process.env.PUBLIC_WE_INTAKE_API_URL ? 'endpoint' : 'disabled');
  assert.equal(mailboxFor('apply'), null);
  assert.equal(mailboxFor('contact'), null);
  assert.equal(publicContactAddress(), null);
});

test('the seat price is unpublished and the rate is null (claim C-06)', () => {
  assert.equal(flags.seatPrice.published, false);
  assert.equal(flags.seatPrice.monthlyRate, null);
});

test('form routes are declared', () => {
  assert.equal(FORM_ROUTES['/apply/'], 'intake');
  assert.equal(FORM_ROUTES['/contact/'], 'intake');
});
