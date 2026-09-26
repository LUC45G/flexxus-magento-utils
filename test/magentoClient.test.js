import test from 'node:test';
import assert from 'node:assert/strict';
import { MagentoClient, assertProductsResponse } from '../src/magentoClient.js';

test('assertProductsResponse accepts Magento product search shape', () => {
  assert.doesNotThrow(() => assertProductsResponse({ items: [], total_count: 0 }, 'https://example.com'));
});

test('assertProductsResponse rejects unexpected shape', () => {
  assert.throws(
    () => assertProductsResponse({ message: 'not products' }, 'https://example.com'),
    /Unexpected Magento products response/,
  );
});

test('MagentoClient requires either token or username/password', async () => {
  const client = new MagentoClient({ baseUrl: 'https://example.com/rest/default', pageSize: 1 });
  await assert.rejects(() => client.getToken(), /Missing Magento auth/);
});

test('MagentoClient reuses configured token', async () => {
  const client = new MagentoClient({ baseUrl: 'https://example.com/rest/default', token: 'abc', pageSize: 1 });
  assert.equal(await client.getToken(), 'abc');
});
