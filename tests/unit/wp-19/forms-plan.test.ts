import assert from 'node:assert/strict';
import test from 'node:test';
import { planForm, type FormConfig, type FormPage } from '../../../src/data/forms.ts';

// planForm decides what a form permits before any JavaScript runs. The invariant that matters (code-security P1-1): a
// no-JavaScript visitor can only submit a form that the browser POSTs to a confirmed endpoint, never as a GET query string.

const ENDPOINT = 'https://intake.example.test/api/intake';
const MAILBOX = 'apply@worldenterprise.org';

const endpoint: FormConfig = { id: 'intake', mode: 'endpoint', endpoint: ENDPOINT, mailto: null };
const mailto: FormConfig = { id: 'intake', mode: 'mailto', endpoint: null, mailto: MAILBOX };
const disabled: FormConfig = { id: 'intake', mode: 'disabled', endpoint: null, mailto: null };
const newsletterEndpoint: FormConfig = { id: 'newsletter', mode: 'endpoint', endpoint: 'https://intake.example.test/api/newsletter', mailto: null };

test('intake endpoint form posts natively and ships an enabled button', () => {
  for (const kind of ['apply', 'contact'] as const) {
    const plan = planForm(kind, endpoint, MAILBOX, false);
    assert.equal(plan.mode, 'endpoint');
    assert.equal(plan.nativePost, ENDPOINT);
    assert.equal(plan.submitDisabledInMarkup, false);
    assert.equal(plan.scriptEnablesSubmit, true);
    assert.equal(plan.noscript, 'none');
  }
});

test('intake endpoint form that requires JavaScript ships a disabled button and a noscript note', () => {
  const plan = planForm('apply', endpoint, MAILBOX, true);
  assert.equal(plan.nativePost, null);
  assert.equal(plan.submitDisabledInMarkup, true);
  assert.equal(plan.scriptEnablesSubmit, true);
  assert.equal(plan.noscript, 'needs-js');
  assert.equal(plan.mailbox, MAILBOX);
});

test('newsletter in endpoint mode never posts natively: the button is disabled until the script mounts', () => {
  const plan = planForm('newsletter', newsletterEndpoint, null, false);
  assert.equal(plan.mode, 'endpoint');
  assert.equal(plan.nativePost, null);
  assert.equal(plan.submitDisabledInMarkup, true);
  assert.equal(plan.scriptEnablesSubmit, true);
  assert.equal(plan.noscript, 'needs-js');
  assert.equal(plan.mailbox, null);
});

test('mailto mode with a confirmed mailbox is script only, with the prefill note for visitors without JavaScript', () => {
  const plan = planForm('contact', mailto, MAILBOX, false);
  assert.equal(plan.mode, 'mailto');
  assert.equal(plan.nativePost, null);
  assert.equal(plan.submitDisabledInMarkup, true);
  assert.equal(plan.scriptEnablesSubmit, true);
  assert.equal(plan.noscript, 'mailto-no-prefill');
});

test('mailto mode without a mailbox collapses to disabled', () => {
  const plan = planForm('apply', mailto, null, false);
  assert.equal(plan.mode, 'disabled');
  assert.equal(plan.submitDisabledInMarkup, true);
  assert.equal(plan.scriptEnablesSubmit, false);
  assert.equal(plan.noscript, 'none');
});

test('a disabled form stays disabled for everyone', () => {
  for (const kind of ['apply', 'contact', 'newsletter'] as const) {
    const plan = planForm(kind, disabled, null, false);
    assert.equal(plan.mode, 'disabled');
    assert.equal(plan.nativePost, null);
    assert.equal(plan.submitDisabledInMarkup, true);
    assert.equal(plan.scriptEnablesSubmit, false);
  }
});

test('across every kind, mode, mailbox and requires-JS combination only a native POST to an endpoint ships an enabled button', () => {
  const kinds: readonly FormPage[] = ['apply', 'contact', 'newsletter'];
  const configs: readonly FormConfig[] = [endpoint, newsletterEndpoint, mailto, disabled];
  let combinations = 0;
  for (const kind of kinds) {
    for (const config of configs) {
      for (const mailbox of [null, MAILBOX]) {
        for (const requiresJs of [false, true]) {
          combinations += 1;
          const plan = planForm(kind, config, mailbox, requiresJs);
          const label = `${kind} ${config.mode} mailbox=${mailbox !== null} requiresJs=${requiresJs}`;
          assert.equal(plan.submitDisabledInMarkup, plan.nativePost === null, `${label}: the button is enabled in markup exactly when a native POST target exists`);
          if (plan.nativePost !== null) {
            assert.equal(plan.mode, 'endpoint', `${label}: native POST needs endpoint mode`);
            assert.notEqual(kind, 'newsletter', `${label}: the newsletter never posts natively`);
            assert.ok(plan.nativePost.startsWith('https://'), `${label}: native POST target is https`);
          }
          if (!plan.scriptEnablesSubmit) assert.equal(plan.submitDisabledInMarkup, true, `${label}: a form the script will not enable ships disabled`);
        }
      }
    }
  }
  assert.equal(combinations, 48);
});
