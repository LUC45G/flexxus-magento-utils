import { getInactiveFlexxusSkus } from './flexxusClient.js';
import { getActiveMagentoSkuSet } from './magentoClient.js';
import { includesText, normalizeSku, normalizeText } from './text.js';

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function xlsMatches(row, columns, predicate) {
  return predicate({
    sku: normalizeSku(row[columns.sku]),
    name: columns.name ? row[columns.name] : '',
    category: columns.category ? row[columns.category] : '',
    condition: columns.condition ? row[columns.condition] : '',
  });
}

function countXlsRows(rows, columns, activeMagentoSkus, predicate) {
  const skus = rows
    .filter((row) => xlsMatches(row, columns, predicate))
    .map((row) => normalizeSku(row[columns.sku]))
    .filter((sku) => sku && activeMagentoSkus.has(sku));

  return uniqueSorted(skus).length;
}

export function getAuditCandidateSkus({ flexxusProducts, xlsData }) {
  const skus = new Set(getInactiveFlexxusSkus(flexxusProducts));
  const { rows, columns } = xlsData;
  const predicates = [
    ({ category }) => includesText(category, 'discontinuo'),
    ({ category }) => includesText(category, 'a pedido'),
    ({ name }) => includesText(name, 'saldo'),
    ({ name }) => includesText(name, 'oferta'),
    ({ condition }) => includesText(condition, 'suspendida la venta'),
  ];

  for (const row of rows) {
    const sku = normalizeSku(row[columns.sku]);
    if (!sku) continue;
    const product = {
      sku,
      name: columns.name ? row[columns.name] : '',
      category: columns.category ? row[columns.category] : '',
      condition: columns.condition ? row[columns.condition] : '',
    };
    if (predicates.some((predicate) => predicate(product))) {
      skus.add(sku);
    }
  }

  return [...skus];
}

export function getInactiveArticleSkus(articlesData) {
  const { rows, columns } = articlesData;
  return new Set(
    rows
      .filter((row) => ['no', '0', 'false'].includes(normalizeText(row[columns.active])))
      .map((row) => normalizeSku(row[columns.sku]))
      .filter(Boolean),
  );
}

export function getAuditCandidateSkusFromXls({ inactiveSkus, xlsData }) {
  const skus = new Set(inactiveSkus);
  const { rows, columns } = xlsData;
  const predicates = [
    ({ category }) => includesText(category, 'discontinuo'),
    ({ category }) => includesText(category, 'a pedido'),
    ({ name }) => includesText(name, 'saldo'),
    ({ name }) => includesText(name, 'oferta'),
    ({ condition }) => includesText(condition, 'suspendida la venta'),
  ];

  for (const row of rows) {
    const sku = normalizeSku(row[columns.sku]);
    if (!sku) continue;
    const product = {
      sku,
      name: columns.name ? row[columns.name] : '',
      category: columns.category ? row[columns.category] : '',
      condition: columns.condition ? row[columns.condition] : '',
    };
    if (predicates.some((predicate) => predicate(product))) {
      skus.add(sku);
    }
  }

  return [...skus];
}

export function buildAudit({ flexxusProducts, magentoProducts, xlsData }) {
  const activeMagentoSkus = getActiveMagentoSkuSet(magentoProducts);
  const inactiveFlexxusSkus = flexxusProducts instanceof Set ? flexxusProducts : getInactiveFlexxusSkus(flexxusProducts);
  const inactiveAndWebActiveSkus = uniqueSorted([...inactiveFlexxusSkus].filter((sku) => activeMagentoSkus.has(sku)));
  const { rows, columns } = xlsData;

  return {
    inactiveWebActive: {
      label: 'Inactivos Flexxus + activos web',
      count: inactiveAndWebActiveSkus.length,
      skus: inactiveAndWebActiveSkus,
    },
    discontinuosWebActive: {
      label: 'Discontinuos Flexxus + activos web',
      count: countXlsRows(rows, columns, activeMagentoSkus, ({ category }) =>
        includesText(category, 'discontinuo'),
      ),
    },
    aPedidoWebActive: {
      label: 'A pedido Flexxus + activos web',
      count: countXlsRows(rows, columns, activeMagentoSkus, ({ category }) =>
        includesText(category, 'a pedido'),
      ),
    },
    saldoNameWebActive: {
      label: 'Nombre contiene saldo + activos web',
      count: countXlsRows(rows, columns, activeMagentoSkus, ({ name }) => includesText(name, 'saldo')),
    },
    ofertaNameWebActive: {
      label: 'Nombre contiene oferta + activos web',
      count: countXlsRows(rows, columns, activeMagentoSkus, ({ name }) => includesText(name, 'oferta')),
    },
    ventaSuspendidaWebActive: {
      label: 'Suspendida la venta + activos web',
      count: countXlsRows(rows, columns, activeMagentoSkus, ({ condition }) =>
        includesText(condition, 'suspendida la venta'),
      ),
    },
  };
}
