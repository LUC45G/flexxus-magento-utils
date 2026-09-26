import { requestStrictJson } from './http.js';
import { normalizeSku } from './text.js';

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export class MagentoClient {
  constructor(config) {
    this.config = config;
    this.token = config.token;
  }

  async getToken() {
    if (this.token) {
      return this.token;
    }

    if (!this.config.username || !this.config.password) {
      throw new Error('Missing Magento auth. Set MAGENTO_TOKEN or MAGENTO_USERNAME and MAGENTO_PASSWORD.');
    }

    const url = `${this.config.baseUrl}/V1/integration/admin/token`;
    const data = await requestStrictJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });

    if (typeof data !== 'string' || !data.trim()) {
      throw new Error(
        'Magento admin token endpoint did not return a token. If the admin user requires 2FA, use MAGENTO_TOKEN from an integration or TFA flow.',
      );
    }

    this.token = data;
    return this.token;
  }

  async fetchProducts() {
    return this.fetchProductsBySearchCriteria();
  }

  async fetchActiveProducts() {
    return this.fetchProductsBySearchCriteria((url) => {
      url.searchParams.set('searchCriteria[filter_groups][0][filters][0][field]', 'status');
      url.searchParams.set('searchCriteria[filter_groups][0][filters][0][value]', '1');
      url.searchParams.set('searchCriteria[filter_groups][0][filters][0][condition_type]', 'eq');
    });
  }

  async fetchActiveProductsBySkus(skus, options = {}) {
    return this.fetchProductsBySkus(skus, {
      ...options,
      activeOnly: true,
    });
  }

  async fetchProductsBySkus(skus, options = {}) {
    const normalizedSkus = [...new Set(skus.map(normalizeSku).filter(Boolean))];
    if (!normalizedSkus.length) return [];

    const products = [];
    const batchSize = this.config.skuBatchSize || 100;
    const batches = chunk(normalizedSkus, batchSize);

    for (let index = 0; index < batches.length; index += 1) {
      const skuBatch = batches[index];
      const startedState = {
        completed: index,
        total: batches.length,
        processed: Math.min(index * batchSize, normalizedSkus.length),
        totalItems: normalizedSkus.length,
        found: products.length,
      };
      options.onBatchStart?.(startedState);

      let page;
      try {
        page = await this.fetchProductsBySearchCriteria((url) => {
          let groupIndex = 0;
          if (options.activeOnly) {
            url.searchParams.set('searchCriteria[filter_groups][0][filters][0][field]', 'status');
            url.searchParams.set('searchCriteria[filter_groups][0][filters][0][value]', '1');
            url.searchParams.set('searchCriteria[filter_groups][0][filters][0][condition_type]', 'eq');
            groupIndex = 1;
          }
          url.searchParams.set(`searchCriteria[filter_groups][${groupIndex}][filters][0][field]`, 'sku');
          url.searchParams.set(`searchCriteria[filter_groups][${groupIndex}][filters][0][value]`, skuBatch.join(','));
          url.searchParams.set(`searchCriteria[filter_groups][${groupIndex}][filters][0][condition_type]`, 'in');
        }, skuBatch.length, { fields: false });
      } catch (error) {
        options.onBatchError?.(startedState);
        throw error;
      }

      products.push(...page);
      const finishedState = {
        completed: index + 1,
        total: batches.length,
        processed: Math.min((index + 1) * batchSize, normalizedSkus.length),
        totalItems: normalizedSkus.length,
        found: products.length,
      };
      options.onProgress?.(finishedState);
      options.onBatchFinish?.(finishedState);
    }

    return products;
  }

  async fetchProductsBySearchCriteria(applySearchCriteria = () => {}, pageSizeOverride = undefined, options = {}) {
    const products = [];
    let currentPage = 1;
    const pageSize = pageSizeOverride || this.config.pageSize;
    const token = await this.getToken();

    while (true) {
      const url = new URL(`${this.config.baseUrl}/V1/products`);
      applySearchCriteria(url);
      url.searchParams.set('searchCriteria[pageSize]', String(pageSize));
      url.searchParams.set('searchCriteria[currentPage]', String(currentPage));
      if (options.fields !== false) {
        url.searchParams.set('fields', 'items[sku,status,name],total_count');
      }

      const data = await requestStrictJson(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assertProductsResponse(data, url);
      const page = data.items;
      products.push(...page);

      if (products.length >= Number(data?.total_count || 0) || page.length < pageSize) break;
      currentPage += 1;
    }

    return products;
  }

  async doctor(sampleSize = 100) {
    const token = await this.getToken();
    const url = new URL(`${this.config.baseUrl}/V1/products`);
    url.searchParams.set('searchCriteria[pageSize]', String(sampleSize));
    url.searchParams.set('searchCriteria[currentPage]', '1');
    url.searchParams.set('fields', 'items[sku,status,name],total_count');

    const data = await requestStrictJson(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertProductsResponse(data, url);

    const statusCounts = {};
    for (const product of data.items) {
      const key = String(product.status ?? 'missing');
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }

    return {
      baseUrl: this.config.baseUrl,
      auth: this.config.token ? 'token' : 'username/password',
      totalCount: Number(data.total_count || 0),
      sampleSize: data.items.length,
      firstProduct: data.items[0] || null,
      statusCounts,
    };
  }
}

export function assertProductsResponse(data, url) {
  if (!data || !Array.isArray(data.items) || data.total_count === undefined) {
    throw new Error(
      `Unexpected Magento products response from ${url}. Expected JSON with items[] and total_count. Check MAGENTO_BASE_URL and token permissions.`,
    );
  }
}

export function getActiveMagentoSkuSet(products) {
  return new Set(
    products
      .filter((product) => Number(product.status) === 1)
      .map((product) => normalizeSku(product.sku))
      .filter(Boolean),
  );
}
