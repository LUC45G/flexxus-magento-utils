import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';

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

function renderInteractiveCandidates({ candidates, selectedIndex, output, firstRender }) {
  if (!firstRender) {
    output.write(`\x1b[${candidates.length}A`);
  }

  for (const [index, candidate] of candidates.entries()) {
    const prefix = index === selectedIndex ? '>' : ' ';
    output.write(`\x1b[2K\r${prefix} ${formatCandidate(candidate, index)}\n`);
  }
}

async function selectExcelCandidate({ candidates, label, input, output }) {
  let selectedIndex = 0;
  let firstRender = true;
  const hadRawMode = input.isRaw === true;

  output.write(`Select a ${label} file with ↑/↓ and Enter:\n`);
  output.write('\x1b[?25l');

  if (typeof input.setRawMode === 'function') {
    input.setRawMode(true);
  }
  if (typeof input.resume === 'function') {
    input.resume();
  }
  readline.emitKeypressEvents(input);

  return new Promise((resolve, reject) => {
    function finish(error, candidate) {
      input.off('keypress', onKeypress);
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(hadRawMode);
      }
      output.write('\x1b[?25h\n');

      if (error) {
        reject(error);
        return;
      }
      resolve(candidate.path);
    }

    function render() {
      renderInteractiveCandidates({ candidates, selectedIndex, output, firstRender });
      firstRender = false;
    }

    function onKeypress(_chunk, key = {}) {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('File selection cancelled.'));
        return;
      }
      if (key.name === 'escape') {
        finish(new Error('File selection cancelled.'));
        return;
      }
      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % candidates.length;
        render();
        return;
      }
      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + candidates.length) % candidates.length;
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish(undefined, candidates[selectedIndex]);
      }
    }

    input.on('keypress', onKeypress);
    render();
  });
}

export function findExcelFiles(rootDir = process.cwd(), { nameIncludes } = {}) {
  const needle = nameIncludes ? nameIncludes.toLowerCase() : undefined;
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && EXCEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
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
  nameIncludes,
  label = 'XLS/XLSX',
  input = process.stdin,
  output = process.stdout,
} = {}) {
  if (explicitPath) return validateExcelPath(explicitPath);
  if (envPath) return validateExcelPath(envPath);

  const candidates = findExcelFiles(rootDir, { nameIncludes });

  if (candidates.length === 0) {
    const filterText = nameIncludes ? ` containing "${nameIncludes}"` : '';
    throw new Error(`No ${label} files${filterText} found in ${path.resolve(rootDir)}. Use an explicit file path.`);
  }

  if (candidates.length === 1) {
    return candidates[0].path;
  }

  if (!input.isTTY || !output.isTTY) {
    const list = candidates.map((candidate, index) => formatCandidate(candidate, index)).join('\n');
    throw new Error(`Multiple ${label} files found and console is not interactive. Use an explicit file path.\n${list}`);
  }

  return selectExcelCandidate({ candidates, label, input, output });
}
