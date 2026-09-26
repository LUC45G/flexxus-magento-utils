import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function optionalPathEnv(name) {
  const value = optionalEnv(name);
  return value ? path.resolve(value) : undefined;
}

export function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getConfig() {
  return {
    flexxus: {
      baseUrl: normalizeBaseUrl(requireEnv('FLEXXUS_BASE_URL')),
      username: requireEnv('FLEXXUS_USERNAME'),
      password: requireEnv('FLEXXUS_PASSWORD'),
      pageSize: Number(optionalEnv('FLEXXUS_PAGE_SIZE', '500')),
      deviceInfo: optionalEnv(
        'FLEXXUS_DEVICE_INFO',
        '{"model":"0","platform":"0","uuid":"ecommerce-utils","version":"0","manufacturer":"0"}',
      ),
    },
    magento: {
      baseUrl: normalizeBaseUrl(requireEnv('MAGENTO_BASE_URL')),
      token: optionalEnv('MAGENTO_TOKEN'),
      username: optionalEnv('MAGENTO_USERNAME'),
      password: optionalEnv('MAGENTO_PASSWORD'),
      pageSize: Number(optionalEnv('MAGENTO_PAGE_SIZE', '1000')),
      skuBatchSize: Number(optionalEnv('MAGENTO_SKU_BATCH_SIZE', '500')),
    },
    xlsPath: optionalPathEnv('FLEXXUS_XLS_PATH'),
    columns: {
      sku: optionalEnv('FLEXXUS_XLS_SKU_COLUMN'),
      name: optionalEnv('FLEXXUS_XLS_NAME_COLUMN'),
      category: optionalEnv('FLEXXUS_XLS_CATEGORY_COLUMN'),
      condition: optionalEnv('FLEXXUS_XLS_CONDITION_COLUMN'),
    },
  };
}

export function getXlsConfig() {
  return {
    xlsPath: optionalPathEnv('FLEXXUS_XLS_PATH'),
    columns: {
      sku: optionalEnv('FLEXXUS_XLS_SKU_COLUMN'),
      name: optionalEnv('FLEXXUS_XLS_NAME_COLUMN'),
      category: optionalEnv('FLEXXUS_XLS_CATEGORY_COLUMN'),
      condition: optionalEnv('FLEXXUS_XLS_CONDITION_COLUMN'),
    },
  };
}
