import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBaseUrl } from '../src/config.js';

test('normalizes base URLs with and without protocol', () => {
  assert.equal(normalizeBaseUrl('https://example.com/'), 'https://example.com');
  assert.equal(normalizeBaseUrl('http://example.com/api'), 'http://example.com/api');
  assert.equal(normalizeBaseUrl('example.com/api/'), 'https://example.com/api');
});
