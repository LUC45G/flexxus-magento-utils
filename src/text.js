export function normalizeSku(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
}

export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function includesText(value, needle) {
  return normalizeText(value).includes(normalizeText(needle));
}
