import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import xlsx from 'xlsx';
import {
  buildIngresosMagentoRows,
  defaultIngresosOutputPath,
  readIngresosXls,
  writeIngresosMagentoXls,
} from '../src/ingresos.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-utils-ingresos-'));
}

test('reads last sheet with real headers on row 2', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'ingresos.xlsx');
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([['otra hoja']]), 'Primera');
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.aoa_to_sheet([
      ['GENERAL'],
      ['CODIGO', 'ARTICULO ', 'CANTIDAD ', 'PROVEEDOR '],
      ['001', 'Articulo uno', '2', 'Proveedor A'],
      ['', 'Sin codigo', '1', 'Proveedor B'],
    ]),
    'GENERAL ',
  );
  xlsx.writeFile(workbook, filePath);

  const data = readIngresosXls(filePath);

  assert.equal(data.sheetName, 'GENERAL ');
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.columns, {
    code: 'CODIGO',
    article: 'ARTICULO ',
    quantity: 'CANTIDAD ',
    provider: 'PROVEEDOR ',
  });
});

test('builds Magento status rows for ingresos', () => {
  const rows = buildIngresosMagentoRows(
    [
      { CODIGO: '001', ARTICULO: 'A', CANTIDAD: '2', PROVEEDOR: 'P1' },
      { CODIGO: '002', ARTICULO: 'B', CANTIDAD: '3', PROVEEDOR: 'P2' },
      { CODIGO: '003', ARTICULO: 'C', CANTIDAD: '4', PROVEEDOR: 'P3' },
    ],
    { code: 'CODIGO', article: 'ARTICULO', quantity: 'CANTIDAD', provider: 'PROVEEDOR' },
    [
      { sku: '001', status: 1 },
      { sku: '002', status: 2 },
    ],
  );

  assert.deepEqual(rows, [
    { CODIGO: '001', ARTICULO: 'A', CANTIDAD: '2', PROVEEDOR: 'P1', CARGADO: 'Si', HABILITADO: 'Si' },
    { CODIGO: '002', ARTICULO: 'B', CANTIDAD: '3', PROVEEDOR: 'P2', CARGADO: 'Si', HABILITADO: 'NO' },
    { CODIGO: '003', ARTICULO: 'C', CANTIDAD: '4', PROVEEDOR: 'P3', CARGADO: 'No', HABILITADO: 'N/C' },
  ]);
});

test('writes ingresos Magento workbook', () => {
  const dir = makeTempDir();
  const outputPath = path.join(dir, 'out.xlsx');
  writeIngresosMagentoXls(
    [{ CODIGO: '001', ARTICULO: 'A', CANTIDAD: '2', PROVEEDOR: 'P1', CARGADO: 'Si', HABILITADO: 'Si' }],
    outputPath,
  );

  assert.equal(fs.existsSync(outputPath), true);
  const workbook = xlsx.readFile(outputPath);
  assert.equal(workbook.SheetNames[0], 'Magento');
});

test('creates default output path under outputs', () => {
  assert.match(defaultIngresosOutputPath(new Date('2026-09-26T12:34:00Z')), /outputs.*ingresos-magento-2026-09-26-12-34\.xlsx$/);
});
