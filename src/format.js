const AUDIT_ORDER = [
  'inactiveWebActive',
  'discontinuosWebActive',
  'aPedidoWebActive',
  'saldoNameWebActive',
  'ofertaNameWebActive',
  'ventaSuspendidaWebActive',
];

export function printAuditTable(audit) {
  const rows = AUDIT_ORDER.map((key) => ({
    criterio: audit[key].label,
    cantidad: audit[key].count,
  }));

  console.table(rows);

  if (audit.inactiveWebActive.skus.length) {
    console.log('SKUs inactivos en Flexxus y activos en web:');
    for (const sku of audit.inactiveWebActive.skus) {
      console.log(sku);
    }
  }
}

export function printWorkbookInfo(info) {
  for (const sheet of info) {
    console.log(`Hoja: ${sheet.sheetName}`);
    console.log(`Filas aproximadas: ${sheet.rowCount}`);
    console.log('Columnas:');
    for (const header of sheet.headers) {
      console.log(`- ${header}`);
    }
    console.log('');
  }
}
