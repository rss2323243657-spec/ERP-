import * as XLSX from 'xlsx';
import {
  StandardSalesRecord,
  AggregatedRow,
  ExcludedRecord,
  AdjustmentRecord,
  ProcessingLog,
} from '../types/sales';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToXLSX(data: any[], fileName: string, sheetName: string = 'Data') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${fileName}.xlsx`);
}

export function exportToCSV(data: any[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${fileName}.csv`);
}

// Format clean sales records for export
export function formatCleanRecordsForExport(records: StandardSalesRecord[]) {
  return records.map((r) => ({
    订单号: r.orderId,
    下单时间: r.orderTime,
    'Walmart销售SKU(线上商品SKU)': r.onlineProductSKU,
    '内部产品编码(SKU)': r.internalSKU,
    SPU: r.SPU,
    产品类型: r.productType,
    商品单价: r.unitPrice,
    发货数量: r.shippedQuantity,
    订购数量: r.orderedQuantity,
    '最终销售额(finalSales)': r.finalSales.toFixed(2),
    '最终销量(salesQuantity)': r.salesQuantity,
    '销售成本(salesCost)': r.salesCost.toFixed(2),
    '基础毛利(basicGrossProfit)': r.basicGrossProfit.toFixed(2),
    '基础毛利率': (r.basicGrossMargin * 100).toFixed(2) + '%',
    '平均销售单价(ASP)': r.averageSellingPrice.toFixed(2),
    平台状态: r.platformStatus,
    数量修正状态: r.isQtyMismatched ? '已修正(订购!=发货)' : '正常',
    映射状态: r.isUnmapped ? '未匹配' : '已匹配',
  }));
}

// Format SKU summary for export
export function formatSkuAggForExport(rows: AggregatedRow[]) {
  return rows.map((r, idx) => ({
    排名: idx + 1,
    'Walmart销售SKU': r.onlineProductSKU,
    公司内部SKU: r.internalSKU,
    SPU: r.SPU,
    产品类型: r.productType,
    销售额: r.finalSales.toFixed(2),
    销量: r.salesQuantity,
    销售成本: r.salesCost.toFixed(2),
    基础毛利: r.basicGrossProfit.toFixed(2),
    毛利率: (r.basicGrossMargin * 100).toFixed(2) + '%',
    平均售价ASP: r.averageSellingPrice.toFixed(2),
    订单量: r.orderCount,
    销售占比: r.sharePercentage ? (r.sharePercentage * 100).toFixed(2) + '%' : '0%',
  }));
}

// Format SPU summary for export
export function formatSpuAggForExport(rows: AggregatedRow[]) {
  return rows.map((r, idx) => ({
    排名: idx + 1,
    SPU: r.SPU,
    产品类型: r.productType,
    销售额: r.finalSales.toFixed(2),
    销量: r.salesQuantity,
    销售成本: r.salesCost.toFixed(2),
    基础毛利: r.basicGrossProfit.toFixed(2),
    毛利率: (r.basicGrossMargin * 100).toFixed(2) + '%',
    平均售价ASP: r.averageSellingPrice.toFixed(2),
    订单量: r.orderCount,
    销售占比: r.sharePercentage ? (r.sharePercentage * 100).toFixed(2) + '%' : '0%',
  }));
}

// Format Product Type summary for export
export function formatProductTypeAggForExport(rows: AggregatedRow[]) {
  return rows.map((r) => ({
    产品类型: r.productType,
    销售额: r.finalSales.toFixed(2),
    销量: r.salesQuantity,
    销售成本: r.salesCost.toFixed(2),
    基础毛利: r.basicGrossProfit.toFixed(2),
    毛利率: (r.basicGrossMargin * 100).toFixed(2) + '%',
    平均售价ASP: r.averageSellingPrice.toFixed(2),
    订单量: r.orderCount,
    销售占比: r.sharePercentage ? (r.sharePercentage * 100).toFixed(2) + '%' : '0%',
  }));
}

// Format Adjustment records for export
export function formatAdjustmentsForExport(adjustments: AdjustmentRecord[]) {
  return adjustments.map((a) => ({
    订单号: a.orderId,
    下单时间: a.orderTime,
    'Walmart销售SKU': a.onlineProductSKU,
    内部SKU: a.internalSKU,
    订购数量: a.orderedQuantity,
    实际发货数量: a.shippedQuantity,
    商品单价: a.unitPrice.toFixed(2),
    订购原始金额: a.rawCalculatedAmount.toFixed(2),
    最终核算销售额: a.finalSales.toFixed(2),
    修正差额: a.diffAmount.toFixed(2),
  }));
}

// Format Excluded records for export
export function formatExcludedForExport(excluded: ExcludedRecord[]) {
  return excluded.map((e) => ({
    订单号: e.orderId,
    下单时间: e.orderTime,
    'Walmart销售SKU': e.onlineProductSKU,
    内部SKU: e.internalSKU,
    平台状态: e.platformStatus,
    商品单价: e.unitPrice,
    订购数量: e.orderedQuantity,
    发货数量: e.shippedQuantity,
    排除原因: e.excludeReason,
    来源Sheet: e.sheetSource,
    来源文件: e.fileName,
  }));
}

// Export AI Diagnostic Report as text/markdown
export function exportAiReportAsMarkdown(reportText: string, contextTitle: string = 'Walmart_US_销售AI诊断报告') {
  const content = `# Walmart US 销售数据 AI 智能诊断分析报告
**生成时间:** ${new Date().toLocaleString('zh-CN')}
**分析范围:** ${contextTitle}

---

${reportText}
`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  downloadBlob(blob, `${contextTitle}_${new Date().toISOString().substring(0, 10)}.md`);
}
