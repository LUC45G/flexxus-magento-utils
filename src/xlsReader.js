import xlsx from 'xlsx';
import { normalizeText } from './text.js';

const SKU_ALIASES = ['codigo_producto', 'codigo producto', 'codigo', 'sku', 'codigo articulo', 'id_articulo', 'id articulo'];
const NAME_ALIASES = ['nombre', 'descripcion', 'articulo', 'producto'];
const CATEGORY_ALIASES = ['categoria', 'descripcion categoria', 'rubro'];
const CONDITION_ALIASES = ['condicion', 'estado', 'observacion', 'venta'];
const ACTIVE_ALIASES = ['activo', 'activo?', 'active'];

function canonicalHeader(value) {
  return normalizeText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function findColumn(headers, configured, aliases) {
  if (configured) {
    const found = headers.find((header) => canonicalHeader(header) === canonicalHeader(configured));
    if (!found) {
      throw new Error(`Configured XLS column "${configured}" was not found. Available columns: ${headers.join(', ')}`);
    }
    return found;
  }

  const canonicalAliases = aliases.map(canonicalHeader);
  return headers.find((header) => {
    const canonical = canonicalHeader(header);
    return canonicalAliases.some((alias) => canonical === alias || canonical.includes(alias));
  });
}

function isLikelyHeaderRow(row) {
  const canonicalCells = row.map(canonicalHeader);
  return canonicalCells.some((cell) => cell === 'codigo') && canonicalCells.some((cell) => cell.includes('activo'));
}

function rowsFromReportSheet(sheet) {
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const rows = [];
  let headers = null;

  for (const row of matrix) {
    const cells = row.map((cell) => String(cell).trim());
    if (isLikelyHeaderRow(cells)) {
      headers = cells;
      continue;
    }
    if (!headers || !cells.some(Boolean)) {
      continue;
    }

    const object = {};
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (header) {
        object[header] = cells[index] ?? '';
      }
    }
    rows.push(object);
  }

  return rows;
}

function sheetToRows(sheet) {
  const regularRows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const regularHeaders = Object.keys(regularRows[0] || {});
  const hasSyntheticHeaders = regularHeaders.some((header) => header.startsWith('__EMPTY'));

  if (hasSyntheticHeaders || regularHeaders.length <= 1) {
    const reportRows = rowsFromReportSheet(sheet);
    if (reportRows.length) {
      return reportRows;
    }
  }

  return regularRows;
}

export function readWorkbookInfo(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  return workbook.SheetNames.map((sheetName) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerRow = rows.find((row) => row.some((cell) => String(cell).trim()));
    return {
      sheetName,
      headers: headerRow ? headerRow.map((cell) => String(cell).trim()).filter(Boolean) : [],
      rowCount: Math.max(rows.length - 1, 0),
    };
  });
}

export function readFlexxusXls(filePath, configuredColumns = {}) {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = sheetToRows(sheet);

  if (!rows.length) {
    throw new Error(`No rows found in XLS file: ${filePath}`);
  }

  const headers = Object.keys(rows[0]);
  const skuColumn = findColumn(headers, configuredColumns.sku, SKU_ALIASES);
  const nameColumn = findColumn(headers, configuredColumns.name, NAME_ALIASES);
  const categoryColumn = findColumn(headers, configuredColumns.category, CATEGORY_ALIASES);
  const conditionColumn = findColumn(headers, configuredColumns.condition, CONDITION_ALIASES);

  if (!skuColumn) {
    throw new Error(`Could not detect XLS SKU column. Available columns: ${headers.join(', ')}`);
  }

  return {
    sheetName,
    columns: { sku: skuColumn, name: nameColumn, category: categoryColumn, condition: conditionColumn },
    rows,
  };
}

export function readFlexxusArticlesXls(filePath, configuredColumns = {}) {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const rows = sheetToRows(workbook.Sheets[sheetName]);

  if (!rows.length) {
    throw new Error(`No rows found in XLS file: ${filePath}`);
  }

  const headers = Object.keys(rows[0]);
  const skuColumn = findColumn(headers, configuredColumns.sku, SKU_ALIASES);
  const activeColumn = findColumn(headers, configuredColumns.active, ACTIVE_ALIASES);

  if (!skuColumn) {
    throw new Error(`Could not detect XLS SKU column. Available columns: ${headers.join(', ')}`);
  }
  if (!activeColumn) {
    throw new Error(`Could not detect XLS active column. Available columns: ${headers.join(', ')}`);
  }

  return {
    sheetName,
    columns: { sku: skuColumn, active: activeColumn },
    rows,
  };
}
