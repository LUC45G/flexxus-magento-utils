import test from 'node:test';
import assert from 'node:assert/strict';
import { includesText, normalizeSku, normalizeText } from '../src/text.js';

test('normalizes SKUs', () => {
  assert.equal(normalizeSku(' ab-12 '), 'AB-12');
});

test('normalizes searchable text', () => {
  assert.equal(normalizeText('  Suspéndida LA Venta  '), 'suspendida la venta');
  assert.equal(includesText('Categoría: DISCONTÍNUO', 'discontinuo'), true);
});
