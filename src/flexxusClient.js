import { requestJson } from './http.js';
import { normalizeSku } from './text.js';

export function buildFlexxusProductsUrl(baseUrl, { query = {}, limit, offset }) {
  const url = new URL(`${baseUrl}/v2/products`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return url;
}

export class FlexxusClient {
  constructor(config) {
    this.config = config;
    this.token = null;
  }

  async login() {
    const body = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
      deviceinfo: this.config.deviceInfo,
    });

    const data = await requestJson(`${this.config.baseUrl}/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!data?.token) {
      throw new Error('Flexxus login did not return a token');
    }

    this.token = data.token;
    return data.token;
  }

  async fetchProducts(query = {}) {
    if (!this.token) {
      await this.login();
    }

    const products = [];
    let offset = 0;
    const limit = this.config.pageSize;

    while (true) {
      const url = buildFlexxusProductsUrl(this.config.baseUrl, { query, limit, offset });

      const data = await requestJson(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      const page = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      products.push(...page);

      if (page.length < limit) break;
      offset += limit;
    }

    return products;
  }
}

export function getInactiveFlexxusSkus(products) {
  return new Set(
    products
      .filter((product) => Number(product.ACTIVO) === 0)
      .map((product) => normalizeSku(product.CODIGO_PRODUCTO))
      .filter(Boolean),
  );
}
