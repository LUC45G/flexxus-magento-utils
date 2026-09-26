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

test('fails clearly for multiple candidates without an interactive console', async () => {
  const dir = makeTempDir();
  writeFile(dir, 'a.xls');
  writeFile(dir, 'b.xlsx');

  await assert.rejects(
    () => resolveExcelPath({ rootDir: dir }),
    /Multiple XLS\/XLSX files found/,
  );
});

test('interactive selection accepts a valid number', async () => {
  const dir = makeTempDir();
  const selected = writeFile(dir, 'b.xlsx');
  const other = writeFile(dir, 'a.xls');
  fs.utimesSync(selected, new Date('2026-01-02'), new Date('2026-01-02'));
  fs.utimesSync(other, new Date('2026-01-01'), new Date('2026-01-01'));
  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;

  const promise = resolveExcelPath({ rootDir: dir, input, output });
  input.end('1\n');

  assert.equal(await promise, selected);
});
