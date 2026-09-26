import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAudit, getAuditCandidateSkus, getAuditCandidateSkusFromXls, getInactiveArticleSkus } from '../src/audit.js';

test('builds counts and lists inactive web-active SKUs', () => {
  const audit = buildAudit({
    flexxusProducts: [
      { CODIGO_PRODUCTO: 'A1', ACTIVO: 0 },
      { CODIGO_PRODUCTO: 'B2', ACTIVO: 1 },
      { CODIGO_PRODUCTO: 'C3', ACTIVO: 0 },
    ],
    magentoProducts: [
      { sku: 'A1', status: 1, name: 'Product A' },
      { sku: 'B2', status: 1, name: 'Product B' },
      { sku: 'C3', status: 2, name: 'Product C' },
      { sku: 'D4', status: 1, name: 'Product D' },
    ],
    xlsData: {
      columns: { sku: 'Codigo', name: 'Nombre', category: 'Categoria', condition: 'Condicion' },
      rows: [
        { Codigo: 'A1', Nombre: 'Producto normal', Categoria: 'Discontinuo', Condicion: '' },
        { Codigo: 'B2', Nombre: 'Oferta demo', Categoria: 'A Pedido', Condicion: 'Suspendida la venta' },
        { Codigo: 'C3', Nombre: 'Saldo viejo', Categoria: 'Discontinuo', Condicion: '' },
        { Codigo: 'D4', Nombre: 'Saldo online', Categoria: 'Normal', Condicion: '' },
        { Codigo: 'E5', Nombre: 'Producto normal', Categoria: 'Normal', Condicion: 'A Pedido' },
        { Codigo: 'F6', Nombre: 'Producto normal', Categoria: 'Suspendida la venta', Condicion: 'Normal' },
      ],
    },
  });

  assert.deepEqual(audit.inactiveWebActive.skus, ['A1']);
  assert.equal(audit.inactiveWebActive.count, 1);
  assert.equal(audit.discontinuosWebActive.count, 1);
  assert.equal(audit.aPedidoWebActive.count, 1);
  assert.equal(audit.saldoNameWebActive.count, 1);
  assert.equal(audit.ofertaNameWebActive.count, 1);
  assert.equal(audit.ventaSuspendidaWebActive.count, 1);
});

test('extracts inactive article SKUs from Activo column', () => {
  const inactiveSkus = getInactiveArticleSkus({
    columns: { sku: 'Código', active: 'Activo?' },
    rows: [
      { Código: 'A1', 'Activo?': 'No' },
      { Código: 'B2', 'Activo?': 'Si' },
      { Código: 'C3', 'Activo?': 'no' },
    ],
  });

  assert.deepEqual([...inactiveSkus], ['A1', 'C3']);
});

test('collects relevant candidates from inactive SKUs and condition XLS', () => {
  const candidateSkus = getAuditCandidateSkusFromXls({
    inactiveSkus: new Set(['A1']),
    xlsData: {
      columns: { sku: 'Codigo', name: 'Nombre', category: 'Categoria', condition: 'Condicion' },
      rows: [
        { Codigo: 'B2', Nombre: 'Oferta demo', Categoria: 'Normal', Condicion: '' },
        { Codigo: 'C3', Nombre: 'Normal', Categoria: 'Normal', Condicion: 'Suspendida la venta' },
        { Codigo: 'E5', Nombre: 'Normal', Categoria: 'Normal', Condicion: 'A Pedido' },
        { Codigo: 'F6', Nombre: 'Normal', Categoria: 'Suspendida la venta', Condicion: 'Normal' },
        { Codigo: 'D4', Nombre: 'Normal', Categoria: 'Normal', Condicion: '' },
      ],
    },
  });

  assert.deepEqual(candidateSkus.sort(), ['A1', 'B2', 'C3']);
});

test('collects only relevant Magento candidate SKUs', () => {
  const candidateSkus = getAuditCandidateSkus({
    flexxusProducts: [
      { CODIGO_PRODUCTO: 'A1', ACTIVO: 0 },
      { CODIGO_PRODUCTO: 'B2', ACTIVO: 1 },
    ],
    xlsData: {
      columns: { sku: 'Codigo', name: 'Nombre', category: 'Categoria', condition: 'Condicion' },
      rows: [
        { Codigo: 'B2', Nombre: 'Oferta demo', Categoria: 'Normal', Condicion: '' },
        { Codigo: 'C3', Nombre: 'Normal', Categoria: 'Normal', Condicion: 'Suspendida la venta' },
        { Codigo: 'E5', Nombre: 'Normal', Categoria: 'Normal', Condicion: 'A Pedido' },
        { Codigo: 'F6', Nombre: 'Normal', Categoria: 'Suspendida la venta', Condicion: 'Normal' },
        { Codigo: 'D4', Nombre: 'Normal', Categoria: 'Normal', Condicion: '' },
      ],
    },
  });

  assert.deepEqual(candidateSkus.sort(), ['A1', 'B2', 'C3']);
});
