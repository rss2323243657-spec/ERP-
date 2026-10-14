import * as XLSX from 'xlsx';
import {
  RawOrderRow,
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
  FilterState,
  KPIOverview,
  TimeComparison,
  AggregatedRow,
  AnomalyItem,
  ProductCompareItem,
} from '../types/sales';

// Normalized key mappings with prioritized aliases (higher priority listed first)
const FIELD_ALIASES: Record<string, string[]> = {
  platformStatus: [
    '平台状态',
    '平台订单状态',
    'platform status',
    'platformstatus',
    'platform order status',
    '订单状态',
    'order status',
    'orderstatus',
    '销售状态',
    '状态',
    'status',
  ],
  unitPrice: [
    '商品单价',
    '销售单价',
    '商品销售单价',
    '售价',
    '实际单价',
    'unit price',
    'unitprice',
    '单价',
    'price',
  ],
  onlineProductSKU: [
    '线上商品sku',
    '线上商品编码',
    'online product sku',
    'online sku',
    'walmart sku',
    'walmart销售sku',
    '平台商品sku',
    '平台sku',
    '销售sku',
    'product sku',
    '线上sku',
  ],
  internalSKU: [
    'sku',
    '内部sku',
    'erp sku',
    '本地sku',
    '公司sku',
    '商品编码',
    '内部编码',
    'erp编号',
    '公司内部产品编码',
    'erp产品编码',
  ],
  productCost: [
    '商品成本',
    '单件成本',
    '单位成本',
    '采购成本',
    '单件产品成本',
    '成本',
    'product cost',
    'cost',
  ],
  orderedQuantity: [
    '商品sku数量',
    '订购数量',
    '购买数量',
    'ordered quantity',
    'orderedquantity',
    '订单数量',
    '数量',
    'qty',
    '件数',
  ],
  shippedQuantity: [
    '发货数量',
    '实际发货数量',
    'shipped quantity',
    'shippedquantity',
    '出库数量',
    '发货件数',
    '实际发货件数',
  ],
  orderId: [
    '订单号',
    '订单编号',
    'erp订单号',
    '平台订单号',
    'order id',
    'orderid',
    '订单号*',
  ],
  orderTime: [
    '下单时间',
    '购买时间',
    '创建时间',
    '下单日期',
    '付款时间',
    '支付时间',
    'order time',
    'ordertime',
    'order date',
  ],
};

function normalizeHeader(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-*()（）]/g, '');
}

export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));

  // Loop over each standard key
  for (const [standardKey, aliases] of Object.entries(FIELD_ALIASES)) {
    // Check aliases in strict PRIORITY order
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      const matched = normalizedHeaders.find((item) => {
        if (item.norm !== normAlias) return false;
        // Never allow internalSKU to match online SKU columns
        if (standardKey === 'internalSKU' && (item.norm.includes('线上') || item.norm.includes('平台'))) {
          return false;
        }
        // Never allow onlineProductSKU to match bare internal 'sku' if it's not marked online
        if (standardKey === 'onlineProductSKU' && item.norm === 'sku') {
          return false;
        }
        return true;
      });

      if (matched) {
        mapping[standardKey] = matched.original;
        break; // Matched highest priority alias
      }
    }
  }

  // Fallback for onlineProductSKU
  if (!mapping.onlineProductSKU) {
    const found = normalizedHeaders.find(
      (h) => h.norm.includes('online') || h.norm.includes('线上') || h.norm.includes('平台sku')
    );
    if (found) mapping.onlineProductSKU = found.original;
  }

  // Fallback for internalSKU
  if (!mapping.internalSKU) {
    const found = normalizedHeaders.find((h) => h.norm === 'sku' && h.original !== mapping.onlineProductSKU);
    if (found) mapping.internalSKU = found.original;
  }

  return mapping;
}

export function isOrderSheet(headers: string[]): boolean {
  const mapping = detectColumnMapping(headers);
  let score = 0;
  if (mapping.onlineProductSKU) score += 2;
  if (mapping.internalSKU) score += 1;
  if (mapping.orderTime) score += 2;
  if (mapping.unitPrice) score += 2;
  if (mapping.shippedQuantity || mapping.orderedQuantity) score += 2;
  if (mapping.platformStatus) score += 1;
  if (mapping.productCost) score += 1;
  return score >= 4;
}

// Check if platformStatus represents a cancelled order
export function isCancelledStatus(status: any): boolean {
  if (status === null || status === undefined) return false;
  const s = String(status).replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'cancel' ||
    s === '已取消' ||
    s === '取消' ||
    s.includes('cancel') ||
    s.includes('已取消')
  );
}

// Clean and parse unit price safely
export function parseUnitPrice(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/[$,￥\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Clean and parse product cost safely
export function parseProductCost(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/[$,￥\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Date parsing with support for multiple formats
export function parseDateString(val: any): {
  iso: string;
  dateOnly: string;
  year: number;
  month: string;
  quarter: string;
  week: string;
  humanRange: {
    dayLabel: string;
    daySubLabel?: string;
    weekLabel: string;
    weekSubLabel?: string;
    monthLabel: string;
    monthSubLabel?: string;
    quarterLabel: string;
    quarterSubLabel?: string;
    yearLabel: string;
    yearSubLabel?: string;
  };
} {
  let d: Date = new Date();
  let hasParsed = false;

  if (typeof val === 'number') {
    // Excel serial number
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const fractional_day = val - Math.floor(val) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    d = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
    hasParsed = !isNaN(d.getTime());
  } else if (val) {
    const rawStr = String(val).trim();
    // Try US date MM/DD/YYYY HH:mm:ss
    const usPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/;
    const usMatch = rawStr.match(usPattern);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10) - 1;
      const day = parseInt(usMatch[2], 10);
      const year = parseInt(usMatch[3], 10);
      d = new Date(year, month, day);
      if (usMatch[4]) {
        const timePart = new Date(`1970-01-01 ${usMatch[4].trim()}`);
        if (!isNaN(timePart.getTime())) {
          d.setHours(timePart.getHours(), timePart.getMinutes(), timePart.getSeconds());
        }
      }
      hasParsed = !isNaN(d.getTime());
    }

    if (!hasParsed) {
      const cleanStr = rawStr.replace(/\//g, '-');
      d = new Date(cleanStr);
      hasParsed = !isNaN(d.getTime());
    }
  }

  if (!hasParsed || isNaN(d.getTime())) {
    d = new Date('2026-09-01T00:00:00');
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  const dateOnly = `${yyyy}-${mm}-${dd}`;
  const iso = `${dateOnly} ${hh}:${min}:${ss}`;
  const month = `${yyyy}-${mm}`;

  const q = Math.ceil((d.getMonth() + 1) / 3);
  const quarter = `${yyyy}-Q${q}`;

  // ISO Week calculation (Monday - Sunday)
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const week = `${yyyy}-W${String(weekNumber).padStart(2, '0')}`;

  // Week start (Monday) and end (Sunday) dates
  const currDay = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - currDay);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monStr = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`;
  const sunStr = `${String(sunday.getMonth() + 1).padStart(2, '0')}/${String(sunday.getDate()).padStart(2, '0')}`;

  // Month range
  const lastDayOfMonth = new Date(yyyy, d.getMonth() + 1, 0).getDate();

  // Quarter range
  const qStartMonth = (q - 1) * 3 + 1;
  const qEndMonth = q * 3;
  const qLastDay = new Date(yyyy, qEndMonth, 0).getDate();

  const humanRange = {
    dayLabel: `${mm}/${dd}`,
    daySubLabel: `${yyyy}年`,
    weekLabel: `${monStr} ~ ${sunStr}`,
    weekSubLabel: `第${weekNumber}周`,
    monthLabel: `${yyyy}年${mm}月`,
    monthSubLabel: `${mm}/01 ~ ${mm}/${lastDayOfMonth}`,
    quarterLabel: `${yyyy} Q${q}`,
    quarterSubLabel: `${String(qStartMonth).padStart(2, '0')}/01 ~ ${String(qEndMonth).padStart(2, '0')}/${qLastDay}`,
    yearLabel: `${yyyy}年度`,
    yearSubLabel: `01/01 ~ 12/31`,
  };

  return { iso, dateOnly, year: yyyy, month, quarter, week, humanRange };
}

export interface SheetAnalysis {
  sheetName: string;
  rowCount: number;
  headers: string[];
  isOrderSheet: boolean;
  columnMapping: Record<string, string>;
}

export function inspectWorkbookSheets(workbook: XLSX.WorkBook): SheetAnalysis[] {
  const result: SheetAnalysis[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!jsonRows || jsonRows.length === 0) {
      result.push({
        sheetName,
        rowCount: 0,
        headers: [],
        isOrderSheet: false,
        columnMapping: {},
      });
      continue;
    }

    const headers = (jsonRows[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    const orderValid = isOrderSheet(headers);
    const columnMapping = detectColumnMapping(headers);

    result.push({
      sheetName,
      rowCount: Math.max(0, jsonRows.length - 1),
      headers,
      isOrderSheet: orderValid,
      columnMapping,
    });
  }

  return result;
}

export const DEFAULT_MONTHLY_EXCHANGE_RATES: Record<string, number> = {
  '2026-10': 7.25,
  '2026-09': 7.20,
  '2026-08': 7.18,
  '2026-07': 7.15,
  '2026-06': 7.12,
  '2026-05': 7.10,
  '2026-04': 7.08,
  '2026-03': 7.10,
  '2026-02': 7.12,
  '2026-01': 7.15,
  '2025-12': 7.12,
  '2025-11': 7.10,
  '2025-10': 7.08,
  '2025-09': 7.05,
  '2025-08': 7.08,
  '2024-10': 7.02,
  '2024-09': 7.05,
  '2024-08': 7.08,
  '2023-10': 7.15,
};
export const FALLBACK_EXCHANGE_RATE = 7.20;

export interface ProcessFileOptions {
  fileName: string;
  workbook: XLSX.WorkBook;
  targetSheets?: string[];
  manualMappings?: Record<string, Record<string, string>>;
  productMappings: Map<string, ProductMappingItem>;
  monthlyExchangeRates?: Record<string, number>;
}

export function recalculateRecordsWithExchangeRates(
  records: StandardSalesRecord[],
  monthlyExchangeRates: Record<string, number>
): StandardSalesRecord[] {
  return records.map((r) => {
    const monthRate =
      monthlyExchangeRates[r.month] ||
      DEFAULT_MONTHLY_EXCHANGE_RATES[r.month] ||
      FALLBACK_EXCHANGE_RATE;
    const rawCostCNY =
      r.productCostCNY ??
      (r.productCostUSD ? r.productCostUSD * (r.exchangeRate || FALLBACK_EXCHANGE_RATE) : r.productCost);
    const costUSD = monthRate > 0 ? rawCostCNY / monthRate : rawCostCNY;
    const salesCostCNY = r.salesQuantity * rawCostCNY;
    const salesCostUSD = r.salesQuantity * costUSD;
    const basicGrossProfit = r.finalSales - salesCostUSD;
    const basicGrossMargin = r.finalSales > 0 ? basicGrossProfit / r.finalSales : 0;

    return {
      ...r,
      exchangeRate: monthRate,
      productCostCNY: rawCostCNY,
      productCostUSD: costUSD,
      productCost: costUSD,
      salesCostCNY,
      salesCost: salesCostUSD,
      basicGrossProfit,
      basicGrossMargin,
    };
  });
}

export function processWorkbookOrders(options: ProcessFileOptions): {
  cleanRecords: StandardSalesRecord[];
  excludedRecords: ExcludedRecord[];
  adjustmentRecords: AdjustmentRecord[];
  log: ProcessingLog;
  maxOrderDate: string;
} {
  const { fileName, workbook, manualMappings, productMappings } = options;
  const sheetAnalyses = inspectWorkbookSheets(workbook);

  const selectedSheets = options.targetSheets || sheetAnalyses.filter((s) => s.isOrderSheet).map((s) => s.sheetName);
  const ignoredSheets = workbook.SheetNames.filter((s) => !selectedSheets.includes(s));

  const cleanRecords: StandardSalesRecord[] = [];
  const excludedRecords: ExcludedRecord[] = [];
  const adjustmentRecords: AdjustmentRecord[] = [];

  let rawCount = 0;
  let cancelledCount = 0;
  let zeroPriceCount = 0;
  let qtyMismatchCount = 0;
  let unmappedCount = 0;
  let totalSalesAmount = 0;
  let maxOrderDate = '';

  const getRowVal = (row: any, key?: string) => {
    if (!key || !row) return undefined;
    if (row[key] !== undefined) return row[key];
    const normKey = normalizeHeader(key);
    for (const k of Object.keys(row)) {
      if (normalizeHeader(k) === normKey) return row[k];
    }
    return undefined;
  };

  for (const sheetName of selectedSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    rawCount += rawRows.length;

    // Get full header row from row 0 array
    const jsonHeaderRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const firstRow: any[] = (jsonHeaderRows && jsonHeaderRows.length > 0 && Array.isArray(jsonHeaderRows[0])) ? jsonHeaderRows[0] : [];
    const rawHeaderRow: string[] = firstRow
      .map((h: any) => String(h || '').trim())
      .filter(Boolean);
    const headers = rawHeaderRow.length > 0 ? rawHeaderRow : (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
    const mapping = manualMappings?.[sheetName] || detectColumnMapping(headers);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const rawOrderId = String(getRowVal(row, mapping.orderId) ?? `ORD-${sheetName}-${i + 1}`).trim();
      const rawOrderTime = getRowVal(row, mapping.orderTime);
      const onlineSKU = String(getRowVal(row, mapping.onlineProductSKU) ?? '').trim() || 'Unknown Online SKU';
      const internalSKU = String(getRowVal(row, mapping.internalSKU) ?? '').trim() || 'Unknown Internal SKU';
      const platformStatus = String(getRowVal(row, mapping.platformStatus) ?? 'Shipped').trim();
      const unitPrice = parseUnitPrice(getRowVal(row, mapping.unitPrice));
      const productCost = parseProductCost(getRowVal(row, mapping.productCost));
      const orderedQty = parseInt(String(getRowVal(row, mapping.orderedQuantity) ?? '1'), 10) || 0;
      const shippedQty = parseInt(String(getRowVal(row, mapping.shippedQuantity) ?? orderedQty), 10) || 0;

      const dateParsed = parseDateString(rawOrderTime);
      const formattedDate = dateParsed.iso;
      const dateOnly = dateParsed.dateOnly;
      const year = dateParsed.year;
      const month = dateParsed.month;
      const quarter = dateParsed.quarter;
      const week = dateParsed.week;

      if (!maxOrderDate || dateOnly > maxOrderDate) {
        maxOrderDate = dateOnly;
      }

      const id = `${rawOrderId}_${onlineSKU}_${sheetName}_${i}`;

      // CRITICAL STEP 1: Check Cancelled status FIRST
      if (isCancelledStatus(platformStatus)) {
        cancelledCount++;
        excludedRecords.push({
          id,
          orderId: rawOrderId,
          orderTime: formattedDate,
          onlineProductSKU: onlineSKU,
          internalSKU,
          platformStatus,
          unitPrice,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          excludeReason: 'Platform Status = Cancelled',
          sheetSource: sheetName,
          fileName,
          raw: row,
        });
        continue;
      }

      // CRITICAL STEP 2: Of the non-cancelled orders, check Unit Price = 0
      if (unitPrice <= 0) {
        zeroPriceCount++;
        excludedRecords.push({
          id,
          orderId: rawOrderId,
          orderTime: formattedDate,
          onlineProductSKU: onlineSKU,
          internalSKU,
          platformStatus,
          unitPrice,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          excludeReason: 'Unit Price = 0 (多渠道配送等非正常Walmart运营数据)',
          sheetSource: sheetName,
          fileName,
          raw: row,
        });
        continue;
      }

      // CRITICAL STEP 3: Check quantity mismatch
      const isMismatch = orderedQty !== shippedQty;
      if (isMismatch) {
        qtyMismatchCount++;
        const rawCalculatedAmount = orderedQty * unitPrice;
        const adjustedFinalSales = shippedQty * unitPrice;
        adjustmentRecords.push({
          id: `adj_${id}`,
          orderId: rawOrderId,
          onlineProductSKU: onlineSKU,
          internalSKU,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          unitPrice,
          rawCalculatedAmount,
          finalSales: adjustedFinalSales,
          diffAmount: adjustedFinalSales - rawCalculatedAmount,
          orderTime: formattedDate,
        });
      }

      // Valid sales calculation
      // Unit price is in USD ($), product cost from raw order table is in RMB (¥)
      // Convert RMB product cost to USD based on the monthly exchange rate (unified per month)
      const monthRate = (options.monthlyExchangeRates && options.monthlyExchangeRates[month])
        ? options.monthlyExchangeRates[month]
        : (DEFAULT_MONTHLY_EXCHANGE_RATES[month] || FALLBACK_EXCHANGE_RATE);
      const productCostCNY = productCost;
      const productCostUSD = monthRate > 0 ? productCostCNY / monthRate : productCostCNY;

      const salesQty = shippedQty;
      const finalSales = salesQty * unitPrice; // USD
      const salesCostCNY = salesQty * productCostCNY; // RMB
      const salesCost = salesQty * productCostUSD; // USD
      const basicGrossProfit = finalSales - salesCost; // USD
      const basicGrossMargin = finalSales > 0 ? basicGrossProfit / finalSales : 0;
      const averageSellingPrice = salesQty > 0 ? finalSales / salesQty : 0;

      // Product Mapping: STRICTLY ERP.onlineProductSKU -> mapping.SKU
      const mapped = productMappings.get(onlineSKU);
      const isUnmapped = !mapped;
      if (isUnmapped) {
        unmappedCount++;
      }

      const spu = mapped ? mapped.SPU : 'Unmapped';
      const prodType = mapped ? mapped.productType : 'Unmapped';

      totalSalesAmount += finalSales;

      cleanRecords.push({
        id,
        orderId: rawOrderId,
        orderTime: formattedDate,
        dateOnly,
        year,
        month,
        quarter,
        week,
        dayLabel: dateParsed.humanRange.dayLabel,
        daySubLabel: dateParsed.humanRange.daySubLabel,
        weekLabel: dateParsed.humanRange.weekLabel,
        weekSubLabel: dateParsed.humanRange.weekSubLabel,
        monthLabel: dateParsed.humanRange.monthLabel,
        monthSubLabel: dateParsed.humanRange.monthSubLabel,
        quarterLabel: dateParsed.humanRange.quarterLabel,
        quarterSubLabel: dateParsed.humanRange.quarterSubLabel,
        yearLabel: dateParsed.humanRange.yearLabel,
        yearSubLabel: dateParsed.humanRange.yearSubLabel,
        onlineProductSKU: onlineSKU,
        internalSKU, // Supplementary internal SKU only
        SPU: spu,
        productType: prodType,
        productCost: productCostUSD,
        productCostCNY,
        productCostUSD,
        exchangeRate: monthRate,
        platformStatus,
        orderedQuantity: orderedQty,
        shippedQuantity: shippedQty,
        unitPrice,
        finalSales,
        salesQuantity: salesQty,
        salesCostCNY,
        salesCost,
        basicGrossProfit,
        basicGrossMargin,
        averageSellingPrice,
        isQtyMismatched: isMismatch,
        isUnmapped,
        sheetSource: sheetName,
        fileName,
      });
    }
  }

  const log: ProcessingLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toLocaleString('zh-CN'),
    fileName,
    totalSheets: workbook.SheetNames.length,
    detectedOrderSheets: selectedSheets,
    ignoredSheets,
    rawCount,
    cancelledCount,
    zeroPriceCount,
    qtyMismatchCount,
    unmappedSkuCount: unmappedCount,
    duplicateCount: 0,
    validSalesCount: cleanRecords.length,
    totalSalesAmount,
  };

  return { cleanRecords, excludedRecords, adjustmentRecords, log, maxOrderDate };
}

export function parseProductMappingFile(workbook: XLSX.WorkBook): ProductMappingItem[] {
  const result: ProductMappingItem[] = [];
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return result;

  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rawRows.length === 0) return result;

  const headers = Object.keys(rawRows[0]);
  let skuKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return norm.includes('sku') || norm.includes('线上sku') || norm.includes('商品sku');
    }) || headers[0];

  let spuKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return norm.includes('spu');
    }) || headers[1] || 'SPU';

  let typeKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return (
        norm.includes('类型') ||
        norm.includes('类目') ||
        norm.includes('类别') ||
        norm.includes('type') ||
        norm.includes('category')
      );
    }) || headers[2] || '产品类型';

  for (const row of rawRows) {
    const sku = String(row[skuKey] ?? '').trim();
    const spu = String(row[spuKey] ?? '').trim();
    const productType = String(row[typeKey] ?? '').trim();

    if (sku) {
      result.push({
        SKU: sku,
        SPU: spu || 'General SPU',
        productType: productType || 'General Category',
      });
    }
  }

  return result;
}

// Calculate KPIs from clean sales dataset with filtering and human-readable time labels
export function filterAndAggregateSales(
  records: StandardSalesRecord[],
  filters: FilterState
): {
  filteredRecords: StandardSalesRecord[];
  kpis: KPIOverview;
  aggregatedByTime: AggregatedRow[];
  aggregatedByProductType: AggregatedRow[];
  aggregatedBySpu: AggregatedRow[];
  aggregatedBySku: AggregatedRow[];
  timeComparison: TimeComparison;
  anomalies: AnomalyItem[];
  maxDateFound: string;
} {
  // Find min & max date in all records
  let maxDateFound = '';
  for (let i = 0; i < records.length; i++) {
    const d = records[i].dateOnly;
    if (!maxDateFound || d > maxDateFound) maxDateFound = d;
  }
  if (!maxDateFound) maxDateFound = '2026-09-01';

  const hasDateRange = Boolean(
    filters.selectedDateRange &&
    filters.selectedDateRange[0] &&
    filters.selectedDateRange[1]
  );
  const startDate = hasDateRange ? filters.selectedDateRange[0] : '';
  const endDate = hasDateRange ? filters.selectedDateRange[1] : '';

  const hasTypeFilter = Boolean(filters.selectedProductType && filters.selectedProductType !== 'ALL');
  const typeFilter = filters.selectedProductType;

  const hasSpuFilter = Boolean(filters.selectedSpu && filters.selectedSpu !== 'ALL');
  const spuFilter = filters.selectedSpu;

  const hasOnlineSkuFilter = Boolean(filters.selectedOnlineSku && filters.selectedOnlineSku !== 'ALL');
  const onlineSkuFilter = filters.selectedOnlineSku;

  const onlineSkuSearchTerm = (filters.onlineSkuSearch || '').trim().toLowerCase();
  const spuSearchTerm = (filters.spuSearch || '').trim().toLowerCase();
  const internalSkuSearchTerm = (filters.internalSkuSearch || '').trim().toLowerCase();
  const globalSearchTerm = (filters.globalSearch || '').trim().toLowerCase();

  const filteredRecords: StandardSalesRecord[] = [];

  // Aggregation maps built in single pass
  type AggEntry = {
    key: string;
    label: string;
    subLabel?: string;
    onlineProductSKU?: string;
    internalSKU?: string;
    SPU?: string;
    productType?: string;
    salesQuantity: number;
    finalSales: number;
    salesCost: number;
    basicGrossProfit: number;
    orders: Set<string>;
  };

  const timeMap = new Map<string, AggEntry>();
  const typeMap = new Map<string, AggEntry>();
  const spuMap = new Map<string, AggEntry>();
  const skuMap = new Map<string, AggEntry>();

  let totalSales = 0;
  let totalQty = 0;
  let totalCost = 0;
  let totalProfit = 0;
  const uniqueOrders = new Set<string>();
  const uniqueOnlineSkus = new Set<string>();
  const uniqueSpus = new Set<string>();
  const uniqueTypes = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    // Date range filter
    if (hasDateRange) {
      if (r.dateOnly < startDate || r.dateOnly > endDate) continue;
    }

    // Type filter
    if (hasTypeFilter && r.productType !== typeFilter) continue;

    // SPU filter
    if (hasSpuFilter && r.SPU !== spuFilter) continue;

    // Online SKU filter (dropdown)
    if (hasOnlineSkuFilter && r.onlineProductSKU !== onlineSkuFilter) continue;

    // Online SKU search input
    if (onlineSkuSearchTerm && !r.onlineProductSKU.toLowerCase().includes(onlineSkuSearchTerm)) {
      continue;
    }

    // SPU search input
    if (spuSearchTerm && !r.SPU.toLowerCase().includes(spuSearchTerm)) {
      continue;
    }

    // Internal SKU search input
    if (internalSkuSearchTerm && !r.internalSKU.toLowerCase().includes(internalSkuSearchTerm)) {
      continue;
    }

    // Global search (bounded to active criteria)
    if (globalSearchTerm) {
      const match =
        r.orderId.toLowerCase().includes(globalSearchTerm) ||
        r.onlineProductSKU.toLowerCase().includes(globalSearchTerm) ||
        r.internalSKU.toLowerCase().includes(globalSearchTerm) ||
        r.SPU.toLowerCase().includes(globalSearchTerm) ||
        r.productType.toLowerCase().includes(globalSearchTerm);
      if (!match) continue;
    }

    filteredRecords.push(r);

    // Accumulate total KPIs
    totalSales += r.finalSales;
    totalQty += r.salesQuantity;
    totalCost += r.salesCost;
    totalProfit += r.basicGrossProfit;
    uniqueOrders.add(r.orderId);
    uniqueOnlineSkus.add(r.onlineProductSKU);
    uniqueSpus.add(r.SPU);
    uniqueTypes.add(r.productType);

    // 1. Time bucket - instant lookup via precalculated labels
    let timeKey = r.month;
    let mainLabel = r.monthLabel || r.month;
    let subLabel = r.monthSubLabel;

    if (filters.timeGranularity === 'day' || filters.timeGranularity === 'custom') {
      timeKey = r.dateOnly;
      mainLabel = r.dayLabel || r.dateOnly;
      subLabel = r.daySubLabel;
    } else if (filters.timeGranularity === 'week') {
      timeKey = r.week;
      mainLabel = r.weekLabel || r.week;
      subLabel = r.weekSubLabel;
    } else if (filters.timeGranularity === 'quarter') {
      timeKey = r.quarter;
      mainLabel = r.quarterLabel || r.quarter;
      subLabel = r.quarterSubLabel;
    } else if (filters.timeGranularity === 'year') {
      timeKey = String(r.year);
      mainLabel = r.yearLabel || String(r.year);
      subLabel = r.yearSubLabel;
    }

    let tEntry = timeMap.get(timeKey);
    if (!tEntry) {
      tEntry = {
        key: timeKey,
        label: mainLabel,
        subLabel,
        salesQuantity: 0,
        finalSales: 0,
        salesCost: 0,
        basicGrossProfit: 0,
        orders: new Set(),
      };
      timeMap.set(timeKey, tEntry);
    }
    tEntry.salesQuantity += r.salesQuantity;
    tEntry.finalSales += r.finalSales;
    tEntry.salesCost += r.salesCost;
    tEntry.basicGrossProfit += r.basicGrossProfit;
    tEntry.orders.add(r.orderId);

    // 2. Product Type bucket
    const typeKey = r.productType || 'Unmapped';
    let typeEntry = typeMap.get(typeKey);
    if (!typeEntry) {
      typeEntry = {
        key: typeKey,
        label: typeKey,
        productType: typeKey,
        salesQuantity: 0,
        finalSales: 0,
        salesCost: 0,
        basicGrossProfit: 0,
        orders: new Set(),
      };
      typeMap.set(typeKey, typeEntry);
    }
    typeEntry.salesQuantity += r.salesQuantity;
    typeEntry.finalSales += r.finalSales;
    typeEntry.salesCost += r.salesCost;
    typeEntry.basicGrossProfit += r.basicGrossProfit;
    typeEntry.orders.add(r.orderId);

    // 3. SPU bucket
    const spuKey = r.SPU || 'Unmapped';
    let sEntry = spuMap.get(spuKey);
    if (!sEntry) {
      sEntry = {
        key: spuKey,
        label: spuKey,
        SPU: spuKey,
        productType: r.productType,
        salesQuantity: 0,
        finalSales: 0,
        salesCost: 0,
        basicGrossProfit: 0,
        orders: new Set(),
      };
      spuMap.set(spuKey, sEntry);
    }
    sEntry.salesQuantity += r.salesQuantity;
    sEntry.finalSales += r.finalSales;
    sEntry.salesCost += r.salesCost;
    sEntry.basicGrossProfit += r.basicGrossProfit;
    sEntry.orders.add(r.orderId);

    // 4. SKU bucket (onlineProductSKU is key)
    const skuKey = r.onlineProductSKU;
    let kEntry = skuMap.get(skuKey);
    if (!kEntry) {
      kEntry = {
        key: skuKey,
        label: skuKey,
        onlineProductSKU: skuKey,
        internalSKU: r.internalSKU,
        SPU: r.SPU,
        productType: r.productType,
        salesQuantity: 0,
        finalSales: 0,
        salesCost: 0,
        basicGrossProfit: 0,
        orders: new Set(),
      };
      skuMap.set(skuKey, kEntry);
    }
    kEntry.salesQuantity += r.salesQuantity;
    kEntry.finalSales += r.finalSales;
    kEntry.salesCost += r.salesCost;
    kEntry.basicGrossProfit += r.basicGrossProfit;
    kEntry.orders.add(r.orderId);
  }

  const basicGrossMargin = totalSales > 0 ? totalProfit / totalSales : 0;
  const averageSellingPrice = totalQty > 0 ? totalSales / totalQty : 0;

  const kpis: KPIOverview = {
    finalSales: totalSales,
    salesQuantity: totalQty,
    salesCost: totalCost,
    basicGrossProfit: totalProfit,
    basicGrossMargin,
    averageSellingPrice,
    orderCount: uniqueOrders.size,
    activeOnlineSkuCount: uniqueOnlineSkus.size,
    activeSpuCount: uniqueSpus.size,
    activeProductTypeCount: uniqueTypes.size,
  };

  // Convert Time Map to Aggregated Rows
  const sortedTimeKeys = Array.from(timeMap.keys()).sort();
  const aggregatedByTime: AggregatedRow[] = sortedTimeKeys.map((key) => {
    const e = timeMap.get(key)!;
    return {
      key,
      label: e.label,
      subLabel: e.subLabel,
      finalSales: e.finalSales,
      salesQuantity: e.salesQuantity,
      salesCost: e.salesCost,
      basicGrossProfit: e.basicGrossProfit,
      basicGrossMargin: e.finalSales > 0 ? e.basicGrossProfit / e.finalSales : 0,
      averageSellingPrice: e.salesQuantity > 0 ? e.finalSales / e.salesQuantity : 0,
      orderCount: e.orders.size,
    };
  });

  // Calculate MoM for time periods
  for (let i = 0; i < aggregatedByTime.length; i++) {
    if (i > 0) {
      const prev = aggregatedByTime[i - 1].finalSales;
      aggregatedByTime[i].growthMoM = prev > 0 ? (aggregatedByTime[i].finalSales - prev) / prev : null;
    } else {
      aggregatedByTime[i].growthMoM = null;
    }
  }

  // Convert Product Type Map
  const aggregatedByProductType: AggregatedRow[] = Array.from(typeMap.values())
    .map((e) => ({
      key: e.key,
      label: e.label,
      productType: e.productType,
      finalSales: e.finalSales,
      salesQuantity: e.salesQuantity,
      salesCost: e.salesCost,
      basicGrossProfit: e.basicGrossProfit,
      basicGrossMargin: e.finalSales > 0 ? e.basicGrossProfit / e.finalSales : 0,
      averageSellingPrice: e.salesQuantity > 0 ? e.finalSales / e.salesQuantity : 0,
      orderCount: e.orders.size,
      sharePercentage: totalSales > 0 ? e.finalSales / totalSales : 0,
    }))
    .sort((a, b) => b.finalSales - a.finalSales);

  // Convert SPU Map
  const aggregatedBySpu: AggregatedRow[] = Array.from(spuMap.values())
    .map((e) => ({
      key: e.key,
      label: e.label,
      SPU: e.SPU,
      productType: e.productType,
      finalSales: e.finalSales,
      salesQuantity: e.salesQuantity,
      salesCost: e.salesCost,
      basicGrossProfit: e.basicGrossProfit,
      basicGrossMargin: e.finalSales > 0 ? e.basicGrossProfit / e.finalSales : 0,
      averageSellingPrice: e.salesQuantity > 0 ? e.finalSales / e.salesQuantity : 0,
      orderCount: e.orders.size,
      sharePercentage: totalSales > 0 ? e.finalSales / totalSales : 0,
    }))
    .sort((a, b) => b.finalSales - a.finalSales);

  // Convert SKU Map
  const aggregatedBySku: AggregatedRow[] = Array.from(skuMap.values())
    .map((e) => ({
      key: e.key,
      label: e.label,
      onlineProductSKU: e.onlineProductSKU,
      internalSKU: e.internalSKU,
      SPU: e.SPU,
      productType: e.productType,
      finalSales: e.finalSales,
      salesQuantity: e.salesQuantity,
      salesCost: e.salesCost,
      basicGrossProfit: e.basicGrossProfit,
      basicGrossMargin: e.finalSales > 0 ? e.basicGrossProfit / e.finalSales : 0,
      averageSellingPrice: e.salesQuantity > 0 ? e.finalSales / e.salesQuantity : 0,
      orderCount: e.orders.size,
      sharePercentage: totalSales > 0 ? e.finalSales / totalSales : 0,
    }))
    .sort((a, b) => b.finalSales - a.finalSales);

  // MoM and YoY calculations for the latest period vs prior periods
  let timeComparison: TimeComparison = {
    priorSales: null,
    priorQty: null,
    momSalesChange: null,
    momQtyChange: null,
    lastYearSales: null,
    lastYearQty: null,
    yoySalesChange: null,
    yoyQtyChange: null,
  };

  if (aggregatedByTime.length >= 2) {
    const currentPeriod = aggregatedByTime[aggregatedByTime.length - 1];
    const priorPeriod = aggregatedByTime[aggregatedByTime.length - 2];
    timeComparison.currentLabel = currentPeriod.label;
    timeComparison.priorLabel = priorPeriod.label;
    timeComparison.priorSales = priorPeriod.finalSales;
    timeComparison.priorQty = priorPeriod.salesQuantity;

    if (priorPeriod.finalSales > 0) {
      timeComparison.momSalesChange = (currentPeriod.finalSales - priorPeriod.finalSales) / priorPeriod.finalSales;
    }
    if (priorPeriod.salesQuantity > 0) {
      timeComparison.momQtyChange = (currentPeriod.salesQuantity - priorPeriod.salesQuantity) / priorPeriod.salesQuantity;
    }

    const curKey = currentPeriod.key;
    if (curKey.includes('-')) {
      const parts = curKey.split('-');
      const curYear = parseInt(parts[0], 10);
      if (!isNaN(curYear)) {
        const lastYearKey = `${curYear - 1}-${parts.slice(1).join('-')}`;
        const lastYearFound = aggregatedByTime.find((t) => t.key === lastYearKey);
        if (lastYearFound) {
          timeComparison.lastYearSales = lastYearFound.finalSales;
          timeComparison.lastYearQty = lastYearFound.salesQuantity;
          if (lastYearFound.finalSales > 0) {
            timeComparison.yoySalesChange = (currentPeriod.finalSales - lastYearFound.finalSales) / lastYearFound.finalSales;
          }
          if (lastYearFound.salesQuantity > 0) {
            timeComparison.yoyQtyChange = (currentPeriod.salesQuantity - lastYearFound.salesQuantity) / lastYearFound.salesQuantity;
          }
        }
      }
    }
  }

  // Automatic Sales Anomaly Identification
  const anomalies: AnomalyItem[] = [];

  if (timeComparison.momSalesChange !== null && timeComparison.momQtyChange !== null) {
    if (timeComparison.momQtyChange > 0.05 && timeComparison.momSalesChange < -0.05) {
      anomalies.push({
        id: 'anom_vol_up_rev_down',
        level: 'warning',
        type: '量额背离（降价倾销/折扣过大）',
        target: '整体店铺',
        title: '销量增长但销售额下滑',
        description: `当前周期销量环比增长 ${(timeComparison.momQtyChange * 100).toFixed(1)}%，但销售额环比下降 ${(Math.abs(timeComparison.momSalesChange) * 100).toFixed(1)}%。表明平均销售单价(ASP)发生下探。`,
        suggestedAction: '核查本期是否开启了高额Coupon、促销折扣或低价捆绑，评估是否侵蚀了毛利底线。',
      });
    } else if (timeComparison.momQtyChange < -0.05 && timeComparison.momSalesChange > 0.05) {
      anomalies.push({
        id: 'anom_vol_down_rev_up',
        level: 'info',
        type: '量额背离（高客单驱动）',
        target: '整体店铺',
        title: '销量下降但销售额逆势上升',
        description: `当前周期销量环比下降 ${(Math.abs(timeComparison.momQtyChange) * 100).toFixed(1)}%，销售额环比增长 ${(timeComparison.momSalesChange * 100).toFixed(1)}%。表明产品销售结构向高客单价SKU转移，或主推款提价。`,
        suggestedAction: '评估提价是否对Walmart自然搜索转化率和购物车胜率(Buy Box)造成长期压制。',
      });
    }
  }

  if (kpis.basicGrossMargin < 0.25 && kpis.finalSales > 0) {
    anomalies.push({
      id: 'anom_low_margin',
      level: 'danger',
      type: '毛利风险',
      target: '全店基础毛利',
      title: '全店基础毛利率偏低警告',
      description: `当前基础毛利率仅为 ${(kpis.basicGrossMargin * 100).toFixed(1)}%（尚未扣除Walmart平台15%佣金及WFS履约费），扣除佣金与履约后净利面临穿透亏损风险。`,
      suggestedAction: '立即排查高成本低售价SKU，收缩负毛利产品推广，调整产品线定价。',
    });
  }

  if (aggregatedBySku.length > 0) {
    const topSku = aggregatedBySku[0];
    if (topSku.sharePercentage && topSku.sharePercentage > 0.45) {
      anomalies.push({
        id: 'anom_sku_concentration',
        level: 'warning',
        type: 'SKU集中度过高',
        target: topSku.onlineProductSKU || '',
        title: `单一SKU营收占比高达 ${(topSku.sharePercentage * 100).toFixed(1)}%`,
        description: `主力销售SKU【${topSku.onlineProductSKU}】贡献了全店超四成销售额，店铺业绩抗风险能力较脆弱。`,
        suggestedAction: '建议加紧二梯队SPU与潜力SKU动销培育，同时严格锁定该主力款在WFS的库存周转天数以防断货。',
      });
    }
  }

  const unmappedSkuCount = aggregatedBySku.filter((s) => s.SPU === 'Unmapped').length;
  if (unmappedSkuCount > 0) {
    anomalies.push({
      id: 'anom_unmapped',
      level: 'info',
      type: '数据映射缺失',
      target: '产品映射表',
      title: `存在 ${unmappedSkuCount} 个未匹配Walmart销售SKU`,
      description: '未映射SKU数据已完全计入全店销售，但无法归集至SPU及产品类型层级。',
      suggestedAction: '前往【数据质量中心】下载未匹配SKU清单，补齐并重新上传产品映射表。',
    });
  }

  return {
    filteredRecords,
    kpis,
    aggregatedByTime,
    aggregatedByProductType,
    aggregatedBySpu,
    aggregatedBySku,
    timeComparison,
    anomalies,
    maxDateFound,
  };
}

// Compute Multi-dimensional Product Comparison (Category / SPU / SKU) between periods (supports multi-period comparison)
export function computeProductMultiComparison(
  records: StandardSalesRecord[],
  granularity: 'day' | 'month' | 'week' | 'quarter' | 'year' | 'custom',
  baseKey: string,
  compKey: string,
  customBaseRange?: [string, string],
  customCompRange?: [string, string],
  multiPeriodKeys?: string[] // Optional multi-period comparison keys, e.g. ['2026', '2025', '2024']
): {
  availablePeriods: { key: string; label: string; subLabel?: string }[];
  categories: ProductCompareItem[];
  spus: ProductCompareItem[];
  skus: ProductCompareItem[];
  macro: {
    currSales: number;
    compSales: number;
    diffSales: number;
    growthSales: number | null;

    currQty: number;
    compQty: number;
    diffQty: number;
    growthQty: number | null;

    currAsp: number;
    compAsp: number;
    diffAsp: number;
    growthAsp: number | null;

    currProfit: number;
    compProfit: number;
    diffProfit: number;

    currMargin: number;
    compMargin: number;
    diffMargin: number;

    // Macro stats for each period in multi-period mode
    periodTotals?: Record<string, {
      sales: number;
      qty: number;
      asp: number;
      profit: number;
      margin: number;
      growthSalesFromBase?: number | null;
      growthQtyFromBase?: number | null;
    }>;
  };
} {
  // 1. Collect all available period options from records
  const periodMap = new Map<string, { label: string; subLabel?: string }>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let key = r.month;
    let label = r.monthLabel || r.month;
    let subLabel = r.monthSubLabel;

    if (granularity === 'day') {
      key = r.dateOnly;
      label = r.dayLabel || r.dateOnly;
      subLabel = r.daySubLabel;
    } else if (granularity === 'week') {
      key = r.week;
      label = r.weekLabel || r.week;
      subLabel = r.weekSubLabel;
    } else if (granularity === 'quarter') {
      key = r.quarter;
      label = r.quarterLabel || r.quarter;
      subLabel = r.quarterSubLabel;
    } else if (granularity === 'year') {
      key = String(r.year);
      label = r.yearLabel || String(r.year);
      subLabel = r.yearSubLabel;
    }

    if (!periodMap.has(key)) {
      periodMap.set(key, { label, subLabel });
    }
  }

  const availablePeriods = Array.from(periodMap.entries())
    .map(([key, info]) => ({ key, label: info.label, subLabel: info.subLabel }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const activeMultiPeriods = (multiPeriodKeys && multiPeriodKeys.length > 0)
    ? multiPeriodKeys
    : [baseKey, compKey].filter(Boolean);

  const getRecordPeriodKey = (r: StandardSalesRecord): string => {
    if (granularity === 'week') return r.week;
    if (granularity === 'quarter') return r.quarter;
    if (granularity === 'year') return String(r.year);
    if (granularity === 'day') return r.dateOnly;
    return r.month;
  };

  // Helper filter for membership in period
  const isBaseRecord = (r: StandardSalesRecord): boolean => {
    if (granularity === 'custom') {
      if (!customBaseRange || !customBaseRange[0] || !customBaseRange[1]) return false;
      return r.dateOnly >= customBaseRange[0] && r.dateOnly <= customBaseRange[1];
    }
    return getRecordPeriodKey(r) === baseKey;
  };

  const isCompRecord = (r: StandardSalesRecord): boolean => {
    if (!compKey && granularity !== 'custom') return false;
    if (granularity === 'custom') {
      if (!customCompRange || !customCompRange[0] || !customCompRange[1]) return false;
      return r.dateOnly >= customCompRange[0] && r.dateOnly <= customCompRange[1];
    }
    return getRecordPeriodKey(r) === compKey;
  };

  // Group accumulators
  type RawGroup = {
    key: string;
    label: string;
    onlineProductSKU?: string;
    internalSKU?: string;
    SPU?: string;
    productType?: string;
    currQty: number;
    currSales: number;
    currCost: number;
    currProfit: number;
    currOrders: Set<string>;
    compQty: number;
    compSales: number;
    compCost: number;
    compProfit: number;
    compOrders: Set<string>;
    // Multi-period accumulators by period key
    periods: Map<string, {
      qty: number;
      sales: number;
      cost: number;
      profit: number;
      orders: Set<string>;
    }>;
  };

  const createGroup = (
    key: string,
    label: string,
    extra?: Partial<RawGroup>
  ): RawGroup => ({
    key,
    label,
    currQty: 0,
    currSales: 0,
    currCost: 0,
    currProfit: 0,
    currOrders: new Set(),
    compQty: 0,
    compSales: 0,
    compCost: 0,
    compProfit: 0,
    compOrders: new Set(),
    periods: new Map(),
    ...extra,
  });

  const catMap = new Map<string, RawGroup>();
  const spuMap = new Map<string, RawGroup>();
  const skuMap = new Map<string, RawGroup>();

  let macroCurrSales = 0;
  let macroCompSales = 0;
  let macroCurrQty = 0;
  let macroCompQty = 0;
  let macroCurrCost = 0;
  let macroCompCost = 0;

  const macroPeriodMap = new Map<string, { sales: number; cost: number; qty: number; orders: Set<string> }>();
  activeMultiPeriods.forEach((pk) => {
    macroPeriodMap.set(pk, { sales: 0, cost: 0, qty: 0, orders: new Set() });
  });

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const recPeriod = getRecordPeriodKey(r);
    const inBase = isBaseRecord(r);
    const inComp = isCompRecord(r);
    const inMulti = activeMultiPeriods.includes(recPeriod);

    if (!inBase && !inComp && !inMulti) continue;

    if (inBase) {
      macroCurrSales += r.finalSales;
      macroCurrQty += r.salesQuantity;
      macroCurrCost += r.salesCost;
    }
    if (inComp) {
      macroCompSales += r.finalSales;
      macroCompQty += r.salesQuantity;
      macroCompCost += r.salesCost;
    }

    if (inMulti) {
      const mp = macroPeriodMap.get(recPeriod);
      if (mp) {
        mp.sales += r.finalSales;
        mp.cost += r.salesCost;
        mp.qty += r.salesQuantity;
        mp.orders.add(r.orderId);
      }
    }

    const updateGroupMetrics = (g: RawGroup) => {
      if (inBase) {
        g.currQty += r.salesQuantity;
        g.currSales += r.finalSales;
        g.currCost += r.salesCost;
        g.currProfit += r.basicGrossProfit;
        g.currOrders.add(r.orderId);
      }
      if (inComp) {
        g.compQty += r.salesQuantity;
        g.compSales += r.finalSales;
        g.compCost += r.salesCost;
        g.compProfit += r.basicGrossProfit;
        g.compOrders.add(r.orderId);
      }
      if (inMulti) {
        let pEntry = g.periods.get(recPeriod);
        if (!pEntry) {
          pEntry = { qty: 0, sales: 0, cost: 0, profit: 0, orders: new Set() };
          g.periods.set(recPeriod, pEntry);
        }
        pEntry.qty += r.salesQuantity;
        pEntry.sales += r.finalSales;
        pEntry.cost += r.salesCost;
        pEntry.profit += r.basicGrossProfit;
        pEntry.orders.add(r.orderId);
      }
    };

    // 1. Category
    const catKey = r.productType || 'Unmapped';
    let cat = catMap.get(catKey);
    if (!cat) {
      cat = createGroup(catKey, catKey, { productType: catKey });
      catMap.set(catKey, cat);
    }
    updateGroupMetrics(cat);

    // 2. SPU
    const spuKey = r.SPU || 'Unmapped';
    let spu = spuMap.get(spuKey);
    if (!spu) {
      spu = createGroup(spuKey, spuKey, { SPU: spuKey, productType: r.productType });
      spuMap.set(spuKey, spu);
    }
    updateGroupMetrics(spu);

    // 3. Online SKU
    const skuKey = r.onlineProductSKU;
    let sku = skuMap.get(skuKey);
    if (!sku) {
      sku = createGroup(skuKey, skuKey, {
        onlineProductSKU: r.onlineProductSKU,
        internalSKU: r.internalSKU,
        SPU: r.SPU,
        productType: r.productType,
      });
      skuMap.set(skuKey, sku);
    }
    updateGroupMetrics(sku);
  }

  // Convert raw groups to ProductCompareItem with accurate calculations
  const finalizeItems = (map: Map<string, RawGroup>): ProductCompareItem[] => {
    return Array.from(map.values()).map((g) => {
      const currAsp = g.currQty > 0 ? g.currSales / g.currQty : 0;
      const compAsp = g.compQty > 0 ? g.compSales / g.compQty : 0;
      const currMargin = g.currSales > 0 ? g.currProfit / g.currSales : 0;
      const compMargin = g.compSales > 0 ? g.compProfit / g.compSales : 0;

      const diffQty = g.currQty - g.compQty;
      const growthQtyRate = g.compQty > 0 ? diffQty / g.compQty : null;

      const diffSales = g.currSales - g.compSales;
      const growthSalesRate = g.compSales > 0 ? diffSales / g.compSales : null;

      const diffAsp = currAsp - compAsp;
      const growthAspRate = compAsp > 0 ? diffAsp / compAsp : null;

      const diffProfit = g.currProfit - g.compProfit;
      const diffMargin = (currMargin - compMargin) * 100;

      // Build periodData map
      const periodData: Record<string, any> = {};
      const baseEntry = g.periods.get(baseKey);
      const baseSales = baseEntry?.sales || g.currSales || 0;
      const baseQty = baseEntry?.qty || g.currQty || 0;
      const baseAsp = baseQty > 0 ? baseSales / baseQty : 0;

      activeMultiPeriods.forEach((pk) => {
        const p = g.periods.get(pk) || { qty: 0, sales: 0, cost: 0, profit: 0, orders: new Set() };
        const asp = p.qty > 0 ? p.sales / p.qty : 0;
        const margin = p.sales > 0 ? p.profit / p.sales : 0;
        const diffSalesFromBase = p.sales - baseSales;
        const growthSalesFromBase = baseSales > 0 ? (p.sales - baseSales) / baseSales : null;
        const diffQtyFromBase = p.qty - baseQty;
        const growthQtyFromBase = baseQty > 0 ? (p.qty - baseQty) / baseQty : null;
        const diffAspFromBase = asp - baseAsp;
        const growthAspFromBase = baseAsp > 0 ? (asp - baseAsp) / baseAsp : null;

        periodData[pk] = {
          qty: p.qty,
          sales: p.sales,
          asp,
          cost: p.cost,
          profit: p.profit,
          margin,
          orders: p.orders.size,
          diffSalesFromBase,
          growthSalesFromBase,
          diffQtyFromBase,
          growthQtyFromBase,
          diffAspFromBase,
          growthAspFromBase,
        };
      });

      return {
        key: g.key,
        label: g.label,
        onlineProductSKU: g.onlineProductSKU,
        internalSKU: g.internalSKU,
        SPU: g.SPU,
        productType: g.productType,
        currQty: g.currQty,
        currSales: g.currSales,
        currAsp,
        currCost: g.currCost,
        currProfit: g.currProfit,
        currMargin,
        currOrders: g.currOrders.size,
        compQty: g.compQty,
        compSales: g.compSales,
        compAsp,
        compCost: g.compCost,
        compProfit: g.compProfit,
        compMargin,
        compOrders: g.compOrders.size,
        diffQty,
        growthQtyRate,
        diffSales,
        growthSalesRate,
        diffAsp,
        growthAspRate,
        diffProfit,
        diffMargin,
        periodData,
      };
    });
  };

  const categories = finalizeItems(catMap).sort((a, b) => b.currSales - a.currSales);
  const spus = finalizeItems(spuMap).sort((a, b) => b.currSales - a.currSales);
  const skus = finalizeItems(skuMap).sort((a, b) => b.currSales - a.currSales);

  // Macro Summary
  const currProfit = macroCurrSales - macroCurrCost;
  const compProfit = macroCompSales - macroCompCost;
  const currMargin = macroCurrSales > 0 ? currProfit / macroCurrSales : 0;
  const compMargin = macroCompSales > 0 ? compProfit / macroCompSales : 0;

  const currAsp = macroCurrQty > 0 ? macroCurrSales / macroCurrQty : 0;
  const compAsp = macroCompQty > 0 ? macroCompSales / macroCompQty : 0;

  const diffSales = macroCurrSales - macroCompSales;
  const growthSales = macroCompSales > 0 ? diffSales / macroCompSales : null;

  const diffQty = macroCurrQty - macroCompQty;
  const growthQty = macroCompQty > 0 ? diffQty / macroCompQty : null;

  const diffAsp = currAsp - compAsp;
  const growthAsp = compAsp > 0 ? diffAsp / compAsp : null;

  // Build macro period totals
  const periodTotals: Record<string, any> = {};
  const baseMacro = macroPeriodMap.get(baseKey) || { sales: macroCurrSales, cost: macroCurrCost, qty: macroCurrQty, orders: new Set() };
  const baseMSales = baseMacro.sales || macroCurrSales;
  const baseMQty = baseMacro.qty || macroCurrQty;

  activeMultiPeriods.forEach((pk) => {
    const mp = macroPeriodMap.get(pk) || { sales: 0, cost: 0, qty: 0, orders: new Set() };
    const pProfit = mp.sales - mp.cost;
    const pMargin = mp.sales > 0 ? pProfit / mp.sales : 0;
    const pAsp = mp.qty > 0 ? mp.sales / mp.qty : 0;
    periodTotals[pk] = {
      sales: mp.sales,
      qty: mp.qty,
      asp: pAsp,
      profit: pProfit,
      margin: pMargin,
      growthSalesFromBase: baseMSales > 0 ? (mp.sales - baseMSales) / baseMSales : null,
      growthQtyFromBase: baseMQty > 0 ? (mp.qty - baseMQty) / baseMQty : null,
    };
  });

  return {
    availablePeriods,
    categories,
    spus,
    skus,
    macro: {
      currSales: macroCurrSales,
      compSales: macroCompSales,
      diffSales,
      growthSales,
      currQty: macroCurrQty,
      compQty: macroCompQty,
      diffQty,
      growthQty,
      currAsp,
      compAsp,
      diffAsp,
      growthAsp,
      currProfit,
      compProfit,
      diffProfit: currProfit - compProfit,
      currMargin,
      compMargin,
      diffMargin: (currMargin - compMargin) * 100,
      periodTotals,
    },
  };
}
