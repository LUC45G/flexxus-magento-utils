import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { findExcelFiles, resolveExcelPath } from '../src/xlsResolver.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-utils-'));
}

function writeFile(dir, name) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, 'placeholder');
  return filePath;
}

test('auto-selects the only Excel file in root', async () => {
  const dir = makeTempDir();
  const filePath = writeFile(dir, 'stock.xls');

  assert.equal(await resolveExcelPath({ rootDir: dir }), filePath);
});

test('explicit path wins over autodetection', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'stock.xls');
  const explicitPath = writeFile(dir, 'manual.xlsx');

  assert.equal(await resolveExcelPath({ rootDir: dir, explicitPath }), explicitPath);
});

test('env path wins over autodetection', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'stock.xls');
  const envPath = writeFile(dir, 'env.xlsx');

  assert.equal(await resolveExcelPath({ rootDir: dir, envPath }), envPath);
});

test('finds xls and xlsx case-insensitively sorted by newest first', () => {
  const dir = makeTempDir();
  const older = writeFile(dir, 'older.XLS');
  const newer = writeFile(dir, 'newer.xlsx');
  writeFile(dir, 'notes.txt');
  fs.utimesSync(older, new Date('2026-01-01'), new Date('2026-01-01'));
  fs.utimesSync(newer, new Date('2026-01-02'), new Date('2026-01-02'));

  assert.deepEqual(
    findExcelFiles(dir).map((candidate) => candidate.name),
    ['newer.xlsx', 'older.XLS'],
  );
});

test('filters Excel files by name fragment case-insensitively', () => {
  const dir = makeTempDir();
  writeFile(dir, 'INGRESOS semana.xlsx');
  writeFile(dir, 'Planilla de Stock.xls');
  writeFile(dir, 'Listado de Articulos.xls');

  assert.deepEqual(
    findExcelFiles(dir, { nameIncludes: 'ingresos' }).map((candidate) => candidate.name),
    ['INGRESOS semana.xlsx'],
  );
  assert.deepEqual(
    findExcelFiles(dir, { nameIncludes: 'ART' }).map((candidate) => candidate.name),
    ['Listado de Articulos.xls'],
  );
});

test('auto-selects the only Excel file matching a filter', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'INGRESOS semana.xlsx');
  writeFile(dir, 'Planilla de Stock.xls');

  const selected = await resolveExcelPath({ rootDir: dir, nameIncludes: 'stock' });

  assert.equal(path.basename(selected), 'Planilla de Stock.xls');
});

test('fails clearly for multiple candidates without an interactive console', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'a.xls');
  writeFile(dir, 'b.xlsx');

  await assert.rejects(
    () => resolveExcelPath({ rootDir: dir, label: 'Flexxus ingresos Excel' }),
    /Multiple Flexxus ingresos Excel files found/,
  );
});

function makeTtyStreams() {
  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;
  return { input, output };
}

test('interactive selection accepts enter for the first option', async () => {
  const dir = makeTempDir();
  const selected = writeFile(dir, 'b.xlsx');
  const other = writeFile(dir, 'a.xls');
  fs.utimesSync(selected, new Date('2026-01-02'), new Date('2026-01-02'));
  fs.utimesSync(other, new Date('2026-01-01'), new Date('2026-01-01'));
  const { input, output } = makeTtyStreams();

  const promise = resolveExcelPath({ rootDir: dir, input, output });
  input.write('\r');

  assert.equal(await promise, selected);
});

test('interactive selection navigates with arrow keys', async () => {
  const dir = makeTempDir();
  const first = writeFile(dir, 'b.xlsx');
  const selected = writeFile(dir, 'a.xls');
  fs.utimesSync(first, new Date('2026-01-02'), new Date('2026-01-02'));
  fs.utimesSync(selected, new Date('2026-01-01'), new Date('2026-01-01'));
  const { input, output } = makeTtyStreams();

  const promise = resolveExcelPath({ rootDir: dir, input, output });
  input.write('\x1B[B');
  input.write('\r');

  assert.equal(await promise, selected);
});

test('interactive selection can be cancelled with escape', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'b.xlsx');
  writeFile(dir, 'a.xls');
  const { input, output } = makeTtyStreams();

  const promise = resolveExcelPath({ rootDir: dir, input, output });
  input.write('\x1B');

  await assert.rejects(() => promise, /File selection cancelled/);
});
