import assert from 'node:assert/strict';
import { test } from 'node:test';
import { containsPotentialPrivateHealthInformation, validateSubmittedText } from '../src/utils/validateSubmittedText.ts';

test('submitted academic text rejects empty, oversized and non-string values', () => {
  assert.deepEqual(validateSubmittedText(''), { ok: false, reason: 'invalid' });
  assert.deepEqual(validateSubmittedText(42), { ok: false, reason: 'invalid' });
  assert.deepEqual(validateSubmittedText('x'.repeat(11), 10), { ok: false, reason: 'too-long' });
});

test('submitted academic text rejects common identifiers and personal health narratives', () => {
  assert.equal(containsPotentialPrivateHealthInformation('student@example.com'), true);
  assert.equal(containsPotentialPrivateHealthInformation('My patient history: fever'), true);
  assert.equal(validateSubmittedText('My patient has diabetes').ok, false);
});

test('ordinary academic text is returned trimmed and bounded', () => {
  assert.deepEqual(validateSubmittedText('  Explain the cardiac cycle.  ', 100), { ok: true, text: 'Explain the cardiac cycle.' });
});
