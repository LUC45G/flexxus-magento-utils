import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlexxusProductsUrl, getInactiveFlexxusSkus } from '../src/flexxusClient.js';

test('puts active query param before pagination for Flexxus products', () => {
  const url = buildFlexxusProductsUrl('https://flexxus.example.com', {
    query: { active: 0 },
    limit: 500,
    offset: 0,
  });

  assert.equal(
    url.toString(),
    'https://flexxus.example.com/v2/products?active=0&limit=500&offset=0',
  );
});

test('extracts inactive Flexxus SKUs only', () => {
  const skus = getInactiveFlexxusSkus([
    { CODIGO_PRODUCTO: 'A1', ACTIVO: 0 },
    { CODIGO_PRODUCTO: 'B2', ACTIVO: 1 },
  ]);

  assert.deepEqual([...skus], ['A1']);
});
