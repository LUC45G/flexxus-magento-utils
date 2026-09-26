import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const EXCEL_EXTENSIONS = new Set(['.xls', '.xlsx']);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatCandidate(candidate, index) {
  const date = candidate.mtime.toISOString().slice(0, 19).replace('T', ' ');
  return `${index + 1}. ${candidate.name} (${formatBytes(candidate.size)}, ${date})`;
}

export function findExcelFiles(rootDir = process.cwd()) {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && EXCEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const filePath = path.resolve(rootDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        name: entry.name,
        path: filePath,
        size: stat.size,
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime() || a.name.localeCompare(b.name));
}

export function validateExcelPath(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`XLS file does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`XLS path is not a file: ${resolved}`);
  }
  if (!EXCEL_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    throw new Error(`XLS path must end with .xls or .xlsx: ${resolved}`);
  }
  return resolved;
}

export async function resolveExcelPath({
  explicitPath,
  envPath,
  rootDir = process.cwd(),
  input = process.stdin,
  output = process.stdout,
} = {}) {
  if (explicitPath) return validateExcelPath(explicitPath);
  if (envPath) return validateExcelPath(envPath);

  const candidates = findExcelFiles(rootDir);

  if (candidates.length === 0) {
    throw new Error('No XLS/XLSX files found in project root. Use --xls <path>.');
  }

  if (candidates.length === 1) {
    return candidates[0].path;
  }

  if (!input.isTTY || !output.isTTY) {
    const list = candidates.map((candidate, index) => formatCandidate(candidate, index)).join('\n');
    throw new Error(`Multiple XLS/XLSX files found and console is not interactive. Use --xls <path>.\n${list}`);
  }

  output.write('Select a Flexxus XLS/XLSX file:\n');
  for (const [index, candidate] of candidates.entries()) {
    output.write(`${formatCandidate(candidate, index)}\n`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const answer = await rl.question('File number: ');
      const index = Number(answer.trim()) - 1;
      if (Number.isInteger(index) && candidates[index]) {
        return candidates[index].path;
      }
      output.write(`Please enter a number from 1 to ${candidates.length}.\n`);
    }
  } finally {
    rl.close();
  }
}
