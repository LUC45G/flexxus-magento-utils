import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import { normalizeSku, normalizeText } from './text.js';

const COLUMN_ALIASES = {
  code: ['codigo'],
  article: ['articulo'],
  quantity: ['cantidad'],
  provider: ['proveedor'],
};

function canonicalHeader(value) {
  return normalizeText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findColumn(headers, aliases) {
  const canonicalAliases = aliases.map(canonicalHeader);
  return headers.find((header) => {
    const canonical = canonicalHeader(header);
    return canonicalAliases.some((alias) => canonical === alias || canonical.includes(alias));
  });
}

export function readIngresosXls(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames.at(-1);
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    range: 1,
    defval: '',
    raw: false,
  });

  if (!rows.length) {
    throw new Error(`No rows found in ingresos file: ${filePath}`);
  }

  const headers = Object.keys(rows[0]);
  const columns = {
    code: findColumn(headers, COLUMN_ALIASES.code),
    article: findColumn(headers, COLUMN_ALIASES.article),
    quantity: findColumn(headers, COLUMN_ALIASES.quantity),
    provider: findColumn(headers, COLUMN_ALIASES.provider),
  };

  for (const [key, column] of Object.entries(columns)) {
    if (!column) {
      throw new Error(`Could not detect ingresos column "${key}". Available columns: ${headers.join(', ')}`);
    }
  }

  return {
    sheetName,
    columns,
    rows: rows.filter((row) => normalizeSku(row[columns.code])),
  };
}

export function buildIngresosMagentoRows(ingresosRows, columns, magentoProducts) {
  const productsBySku = new Map(magentoProducts.map((product) => [normalizeSku(product.sku), product]));

  return ingresosRows.map((row) => {
    const sku = normalizeSku(row[columns.code]);
    const product = productsBySku.get(sku);
    const loaded = Boolean(product);
    const enabled = !loaded ? 'N/C' : Number(product.status) === 1 ? 'Si' : 'NO';

    return {
      CODIGO: sku,
      ARTICULO: row[columns.article],
      CANTIDAD: row[columns.quantity],
      PROVEEDOR: row[columns.provider],
      CARGADO: loaded ? 'Si' : 'No',
      HABILITADO: enabled,
    };
  });
}

export function defaultIngresosOutputPath(now = new Date()) {
  const stamp = now
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '-');
  return path.resolve('outputs', `ingresos-magento-${stamp}.xlsx`);
}

export function writeIngresosMagentoXls(rows, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(rows, {
    header: ['CODIGO', 'ARTICULO', 'CANTIDAD', 'PROVEEDOR', 'CARGADO', 'HABILITADO'],
  });
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Magento');
  xlsx.writeFile(workbook, outputPath);
  return outputPath;
}
