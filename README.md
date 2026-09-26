# ecommerce-utils

_CLI utilities_ para auditar productos del ERP Flexxus contra el eCommerce Magento 2.4. 

## Setup

```powershell
npm install --cache .npm-cache
Copy-Item .env.example .env
```

Edita `.env` con las credenciales reales de Flexxus y Magento.

## Comandos

```powershell
npm run audit
npm run ingresos:magento
npm run magento:doctor
npm run xls:columns
```

### audit

Muestra una tabla contando con los productos ACTIVOS en Magento que tienen en Flexxus las siguientes condiciones:

1. Inactivos.
2. Discontinuos.
3. A Pedido.
4. Saldo.
5. Oferta.
6. Suspendidos a la venta.

Para los inactivos además muestra en pantalla un listado de los SKUs encontrados.

#### Parámetros Admitidos

`audit` admite los siguientes parámetros

- --json: imprime resultado como JSON. _(opcional)_
- --xls <path>: Excel de stock/condiciones. _(opcional)_
- --articles-xls <path>: Excel de artículos con columna "Activo?". _(opcional)_

### ingresos:magento

Lee el Excel de ingresos, consulta si cada código existe en Magento y si está habilitado, y genera un Excel con la información recolectada.

#### Parámetros Admitidos

- --file <path>: Excel de ingresos. _(opcional)_

- --output <path>: archivo de salida. Si no lo pasás, genera uno en outputs/. _(opcional)_

### magento:doctor

Chequea conexión/configuración de Magento y muestra una muestra de productos.

#### Parámetros Admitidos

- --sample-size <number>: cantidad de productos para inspeccionar. _(opcional)_

### xls:columns
Inspecciona hojas y encabezados de un Excel.

#### Parámetros Admitidos

- --file <path>: Excel a inspeccionar. Si el parámetro no existe o está vacío, ofrece un selector interactivo. _(opcional)_

<br />

---

_González Lucas - 2026_