import * as XLSX from 'xlsx';
import { ProductMappingItem } from '../types/sales';

// Standard demo product mapping
export const DEMO_PRODUCT_MAPPINGS: ProductMappingItem[] = [
  // PET1005 SPU - Harness
  { SKU: 'PET1005-XS-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-S-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-M-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-L-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-XL-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-M-RED', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-L-RED', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },

  // PET2008 SPU - Dog Toy
  { SKU: 'PET2008-BALL-BLU', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-BALL-ORN', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-ROPE-TRI', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-SQUEAK-DUC', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },

  // PET3012 SPU - Training Leash
  { SKU: 'PET3012-5FT-BLK', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },
  { SKU: 'PET3012-6FT-REF', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },
  { SKU: 'PET3012-10FT-TRN', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },

  // PET4050 SPU - Grooming Brush
  { SKU: 'PET4050-DESHED-GRN', SPU: 'PET4050', productType: 'Grooming (宠物美容梳)' },
  { SKU: 'PET4050-SLICKER-BLU', SPU: 'PET4050', productType: 'Grooming (宠物美容梳)' },

  // PET6001 SPU - Smart Pet Feeder
  { SKU: 'PET6001-AUTO-WIFI', SPU: 'PET6001', productType: 'Smart Pet (智能喂食器)' },
  { SKU: 'PET6001-CAMERA-4L', SPU: 'PET6001', productType: 'Smart Pet (智能喂食器)' },
];

export function createDemoOrderWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Helper to generate rows for a given month
  const generateMonthRows = (yearMonth: string, count: number, orderIdPrefix: string) => {
    const rows = [];
    const skuCatalog = [
      { online: 'PET1005-M-BLK', internal: 'PET1005', price: 23.99, cost: 45.0 },
      { online: 'PET1005-L-BLK', internal: 'PET1005', price: 25.99, cost: 50.0 },
      { online: 'PET1005-S-BLK', internal: 'PET1005', price: 21.99, cost: 40.0 },
      { online: 'PET1005-XL-BLK', internal: 'PET1005', price: 28.99, cost: 58.0 },
      { online: 'PET1005-M-RED', internal: 'PET1005', price: 23.99, cost: 45.0 },
      { online: 'PET2008-BALL-BLU', internal: 'PET2008', price: 12.99, cost: 22.0 },
      { online: 'PET2008-BALL-ORN', internal: 'PET2008', price: 12.99, cost: 22.0 },
      { online: 'PET2008-ROPE-TRI', internal: 'PET2008', price: 15.5, cost: 26.0 },
      { online: 'PET3012-6FT-REF', internal: 'PET3012', price: 18.99, cost: 32.0 },
      { online: 'PET3012-5FT-BLK', internal: 'PET3012', price: 16.99, cost: 28.0 },
      { online: 'PET4050-DESHED-GRN', internal: 'PET4050', price: 19.99, cost: 35.0 },
      { online: 'PET6001-AUTO-WIFI', internal: 'PET6001', price: 69.99, cost: 145.0 },
      // Intentional unmapped SKU for real-world verification
      { online: 'PET9999-NEW-BOWL', internal: 'PET9999', price: 14.99, cost: 25.0 },
    ];

    for (let i = 1; i <= count; i++) {
      const day = String(Math.min(28, Math.floor((i % 28) + 1))).padStart(2, '0');
      const hour = String(Math.floor((i * 7) % 24)).padStart(2, '0');
      const min = String(Math.floor((i * 13) % 60)).padStart(2, '0');
      const sec = String(Math.floor((i * 23) % 60)).padStart(2, '0');
      const orderTime = `${yearMonth}-${day} ${hour}:${min}:${sec}`;

      const item = skuCatalog[i % skuCatalog.length];
      const orderId = `${orderIdPrefix}${String(10000 + i)}`;

      // Realistic business edge cases:
      // ~4% Cancelled
      let platformStatus = 'Shipped';
      if (i % 25 === 0) {
        platformStatus = 'Cancelled';
      }

      // ~3% Multi-channel zero price
      let unitPrice = item.price;
      if (i % 33 === 0 && platformStatus !== 'Cancelled') {
        unitPrice = 0;
      }

      // Ordered quantity
      let orderedQty = 1;
      if (i % 7 === 0) orderedQty = 2;
      if (i % 19 === 0) orderedQty = 3;

      // Shipped quantity: ~6% has difference (ordered 3, shipped 2; or ordered 2, shipped 1)
      let shippedQty = orderedQty;
      if (i % 17 === 0 && orderedQty > 1) {
        shippedQty = orderedQty - 1;
      }

      rows.push({
        订单号: orderId,
        下单时间: orderTime,
        线上商品SKU: item.online,
        SKU: item.internal,
        平台状态: platformStatus,
        商品SKU数量: orderedQty,
        发货数量: shippedQty,
        商品单价: unitPrice,
        商品成本: item.cost,
        原价: item.price * 1.1,
        税前金额: (shippedQty * unitPrice).toFixed(2),
        订单金额: (shippedQty * unitPrice).toFixed(2),
      });
    }

    return rows;
  };

  // Sheet 1: 2026-08 订单数据 (Order Sheet)
  const rowsAug26 = generateMonthRows('2026-08', 260, 'WM2608-');
  const wsAug26 = XLSX.utils.json_to_sheet(rowsAug26);
  XLSX.utils.book_append_sheet(wb, wsAug26, '2026-08订单');

  // Sheet 2: 2026-09 订单数据 (Order Sheet)
  const rowsSep26 = generateMonthRows('2026-09', 300, 'WM2609-');
  const wsSep26 = XLSX.utils.json_to_sheet(rowsSep26);
  XLSX.utils.book_append_sheet(wb, wsSep26, '2026-09订单');

  // Sheet 3: 2026-10 订单数据 (Order Sheet)
  const rowsOct26 = generateMonthRows('2026-10', 160, 'WM2610-');
  const wsOct26 = XLSX.utils.json_to_sheet(rowsOct26);
  XLSX.utils.book_append_sheet(wb, wsOct26, '2026-10实时订单');

  // Sheet 4: 2025-08 历史订单 (For authentic 2025-Q3 and 2026-08 YoY benchmarks)
  const rowsAug25 = generateMonthRows('2025-08', 220, 'WM2508-');
  const wsAug25 = XLSX.utils.json_to_sheet(rowsAug25);
  XLSX.utils.book_append_sheet(wb, wsAug25, '2025-08历史订单');

  // Sheet 5: 2025-09 历史同比订单 (For realistic YoY & MoM benchmarks)
  const rowsSep25 = generateMonthRows('2025-09', 240, 'WM2509-');
  const wsSep25 = XLSX.utils.json_to_sheet(rowsSep25);
  XLSX.utils.book_append_sheet(wb, wsSep25, '2025-09历史订单');

  // Sheet 6: 2025-10 历史订单
  const rowsOct25 = generateMonthRows('2025-10', 210, 'WM2510-');
  const wsOct25 = XLSX.utils.json_to_sheet(rowsOct25);
  XLSX.utils.book_append_sheet(wb, wsOct25, '2025-10历史订单');

  // Sheet 7: 2024-08 跨年订单 (For 2024-Q3 benchmark)
  const rowsAug24 = generateMonthRows('2024-08', 170, 'WM2408-');
  const wsAug24 = XLSX.utils.json_to_sheet(rowsAug24);
  XLSX.utils.book_append_sheet(wb, wsAug24, '2024-08同期订单');

  // Sheet 8: 2024-09 跨年比对订单 (For 3-year multi-period benchmarks)
  const rowsSep24 = generateMonthRows('2024-09', 190, 'WM2409-');
  const wsSep24 = XLSX.utils.json_to_sheet(rowsSep24);
  XLSX.utils.book_append_sheet(wb, wsSep24, '2024-09同期订单');

  // Sheet 9: 2024-10 跨年比对订单 (For authentic 2025-Q4 and 2025-10 YoY benchmarks)
  const rowsOct24 = generateMonthRows('2024-10', 180, 'WM2410-');
  const wsOct24 = XLSX.utils.json_to_sheet(rowsOct24);
  XLSX.utils.book_append_sheet(wb, wsOct24, '2024-10历史同期订单');

  // Sheet 10: 2023-10 跨年对比订单 (For 3-year multi-period trend comparisons)
  const rowsOct23 = generateMonthRows('2023-10', 150, 'WM2310-');
  const wsOct23 = XLSX.utils.json_to_sheet(rowsOct23);
  XLSX.utils.book_append_sheet(wb, wsOct23, '2023-10跨年同期订单');

  // Sheet 8: 系统导出说明 (Non-order sheet - tests multi-sheet auto filtering!)
  const metaRows = [
    { 导出信息: 'Walmart US ERP 自动化销售导出', 导出人: 'Walmart_Ops_Team', 导出时间: '2026-10-08 23:00:00' },
    { 导出信息: '注意事项: 请勿修改线上商品SKU与SKU字段映射关系', 导出人: 'System', 导出时间: '' },
    { 导出信息: '本Sheet为元数据配置，系统将根据表头自动忽略', 导出人: 'System', 导出时间: '' },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, '导出说明_Meta');

  return wb;
}

export function createDemoMappingWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const rows = DEMO_PRODUCT_MAPPINGS.map((m) => ({
    线上商品SKU: m.SKU,
    SPU: m.SPU,
    产品类型: m.productType,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '产品映射表');
  return wb;
}
