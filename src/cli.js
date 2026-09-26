import path from 'node:path';
import { Command } from 'commander';
import { getConfig, getXlsConfig } from './config.js';
import { MagentoClient } from './magentoClient.js';
import { buildAudit, getAuditCandidateSkusFromXls, getInactiveArticleSkus } from './audit.js';
import { printAuditTable, printWorkbookInfo } from './format.js';
import { readFlexxusArticlesXls, readFlexxusXls, readWorkbookInfo } from './xlsReader.js';
import { resolveExcelPath } from './xlsResolver.js';
import { createProgressReporter } from './progress.js';
import {
  buildIngresosMagentoRows,
  defaultIngresosOutputPath,
  readIngresosXls,
  writeIngresosMagentoXls,
} from './ingresos.js';

const FLEXXUS_DIR = 'Flexxus';

export async function runCli(argv) {
  const program = new Command();

  program
    .name('ecom-utils')
    .description('Audit Flexxus ERP products against Magento products')
    .version('0.1.0');

  program
    .command('audit')
    .description('Count Flexxus product groups that are still active in Magento')
    .option('--json', 'print JSON instead of a console table')
    .option('--xls <path>', 'Flexxus stock/conditions XLS export path')
    .option('--articles-xls <path>', 'Flexxus articles XLS export path with Activo? column')
    .action(async (options) => {
      const config = getConfig();
      const progress = createProgressReporter({ enabled: !options.json });
      const conditionsPath = await resolveExcelPath({
        explicitPath: options.xls,
        rootDir: FLEXXUS_DIR,
        nameIncludes: 'stock',
        label: 'Flexxus stock/conditions Excel',
      });
      const articlesPath = await resolveExcelPath({
        explicitPath: options.articlesXls,
        rootDir: FLEXXUS_DIR,
        nameIncludes: 'art',
        label: 'Flexxus articles Excel',
      });

      progress.step(1, 5, 'Leyendo planilla de condiciones...');
      progress.startBatch({ completed: 0, total: 1, processed: 0, totalItems: 1 });
      const xlsData = readFlexxusXls(conditionsPath, config.columns);
      progress.finishBatch({ completed: 1, total: 1, processed: 1, totalItems: 1 });
      progress.detail(`${xlsData.rows.length} filas`);

      progress.step(2, 5, 'Leyendo listado de articulos...');
      progress.startBatch({ completed: 0, total: 1, processed: 0, totalItems: 1 });
      const articlesData = readFlexxusArticlesXls(articlesPath, config.columns);
      progress.finishBatch({ completed: 1, total: 1, processed: 1, totalItems: 1 });
      const inactiveSkus = getInactiveArticleSkus(articlesData);
      progress.detail(`${articlesData.rows.length} filas, ${inactiveSkus.size} inactivos`);

      progress.step(3, 5, 'Armando SKUs candidatos...');
      const candidateSkus = getAuditCandidateSkusFromXls({ inactiveSkus, xlsData });
      progress.detail(`${candidateSkus.length} SKUs candidatos`);

      progress.step(4, 5, 'Consultando Magento...');
      const magentoProducts = await new MagentoClient(config.magento).fetchActiveProductsBySkus(candidateSkus, {
        onBatchStart: (state) => progress.startBatch(state),
        onBatchFinish: (state) => progress.finishBatch(state),
        onBatchError: (state) => progress.finishBatch(state),
      });
      progress.done(`${magentoProducts.length} productos activos encontrados`);

      progress.step(5, 5, 'Calculando conteos...');
      const audit = buildAudit({ flexxusProducts: inactiveSkus, magentoProducts, xlsData });
      progress.done();

      if (options.json) {
        console.log(JSON.stringify(audit, null, 2));
      } else {
        printAuditTable(audit);
      }
    });

  program
    .command('ingresos:magento')
    .description('Create an Excel report showing whether ingreso products exist and are enabled in Magento')
    .option('--file <path>', 'Ingresos Excel path')
    .option('--output <path>', 'Output Excel path')
    .action(async (options) => {
      const config = getConfig();
      const progress = createProgressReporter({ enabled: true });
      const inputPath = await resolveExcelPath({
        explicitPath: options.file,
        rootDir: FLEXXUS_DIR,
        nameIncludes: 'ingresos',
        label: 'Flexxus ingresos Excel',
      });

      progress.step(1, 4, 'Leyendo Excel de ingresos...');
      progress.startBatch({ completed: 0, total: 1, processed: 0, totalItems: 1 });
      const ingresos = readIngresosXls(inputPath);
      progress.finishBatch({ completed: 1, total: 1, processed: 1, totalItems: 1 });
      progress.detail(`${ingresos.rows.length} filas desde hoja "${ingresos.sheetName}"`);

      progress.step(2, 4, 'Consultando Magento...');
      const skus = ingresos.rows.map((row) => row[ingresos.columns.code]);
      const magentoProducts = await new MagentoClient(config.magento).fetchProductsBySkus(skus, {
        onBatchStart: (state) => progress.startBatch(state),
        onBatchFinish: (state) => progress.finishBatch(state),
        onBatchError: (state) => progress.finishBatch(state),
      });
      progress.done(`${magentoProducts.length} productos cargados encontrados`);

      progress.step(3, 4, 'Armando reporte...');
      const rows = buildIngresosMagentoRows(ingresos.rows, ingresos.columns, magentoProducts);
      progress.detail(`${rows.length} filas`);

      progress.step(4, 4, 'Escribiendo Excel...');
      const outputPath = options.output ? path.resolve(options.output) : defaultIngresosOutputPath();
      writeIngresosMagentoXls(rows, outputPath);
      progress.done(outputPath);

      console.log(outputPath);
    });

  program
    .command('magento:doctor')
    .description('Check Magento REST configuration and product access')
    .option('--sample-size <number>', 'number of products to inspect', '100')
    .action(async (options) => {
      const config = getConfig();
      const doctor = await new MagentoClient(config.magento).doctor(Number(options.sampleSize));
      console.log(JSON.stringify(doctor, null, 2));
    });

  program
    .command('xls:columns')
    .description('Print sheet names and detected headers from a Flexxus XLS export')
    .option('--file <path>', 'XLS file path')
    .action(async (options) => {
      const config = getXlsConfig();
      const xlsPath = await resolveExcelPath({ explicitPath: options.file, envPath: config.xlsPath });
      const info = readWorkbookInfo(xlsPath);
      printWorkbookInfo(info);
    });

  await program.parseAsync(argv);
}
