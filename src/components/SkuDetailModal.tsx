import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { StandardSalesRecord } from '../types/sales';

interface SkuDetailModalProps {
  sku: string;
  allRecords: StandardSalesRecord[];
  onClose: () => void;
  onRequestAiSkuDiagnose: (skuData: any) => void;
}

export const SkuDetailModal: React.FC<SkuDetailModalProps> = ({
  sku,
  allRecords,
  onClose,
  onRequestAiSkuDiagnose,
}) => {
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'week' | 'month'>('month');

  const records = useMemo(() => {
    return allRecords.filter((r) => r.onlineProductSKU === sku);
  }, [allRecords, sku]);

  if (records.length === 0) {
    return null;
  }

  const first = records[0];
  const internalSKU = first.internalSKU;
  const spu = first.SPU;
  const productType = first.productType;

  const totalSales = records.reduce((acc, cur) => acc + cur.finalSales, 0);
  const totalQty = records.reduce((acc, cur) => acc + cur.salesQuantity, 0);
  const totalCost = records.reduce((acc, cur) => acc + cur.salesCost, 0);
  const totalProfit = records.reduce((acc, cur) => acc + cur.basicGrossProfit, 0);
  const grossMargin = totalSales > 0 ? totalProfit / totalSales : 0;
  const asp = totalQty > 0 ? totalSales / totalQty : 0;

  const trendData = useMemo(() => {
    const map = new Map<string, { label: string; sales: number; qty: number; profit: number; asp: number }>();
    for (const r of records) {
      let key = r.month;
      if (timeGranularity === 'day') key = r.dateOnly;
      if (timeGranularity === 'week') key = r.week;

      if (!map.has(key)) {
        map.set(key, { label: key, sales: 0, qty: 0, profit: 0, asp: 0 });
      }
      const entry = map.get(key)!;
      entry.sales += r.finalSales;
      entry.qty += r.salesQuantity;
      entry.profit += r.basicGrossProfit;
    }

    const sortedKeys = Array.from(map.keys()).sort();
    return sortedKeys.map((k) => {
      const e = map.get(k)!;
      return {
        ...e,
        asp: e.qty > 0 ? e.sales / e.qty : 0,
      };
    });
  }, [records, timeGranularity]);

  let momSales: number | null = null;
  let momQty: number | null = null;
  if (trendData.length >= 2) {
    const cur = trendData[trendData.length - 1];
    const prev = trendData[trendData.length - 2];
    if (prev.sales > 0) momSales = (cur.sales - prev.sales) / prev.sales;
    if (prev.qty > 0) momQty = (cur.qty - prev.qty) / prev.qty;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-250 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Walmart 销售SKU
              </span>
              <h2 className="text-lg font-bold text-slate-900 font-mono">{sku}</h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              公司内部编码: <span className="text-amber-800 font-mono font-semibold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">{internalSKU}</span> · SPU:{' '}
              <span className="text-emerald-800 font-mono font-semibold">{spu}</span> · 类型:{' '}
              <span className="text-indigo-800 font-medium">{productType}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">最终销售额</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-1">${totalSales.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">最终销量 (发货)</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-1">{totalQty} 件</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">销售成本</div>
              <div className="text-base font-bold text-slate-700 font-mono mt-1">${totalCost.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">基础毛利</div>
              <div className="text-base font-bold text-emerald-700 font-mono mt-1">${totalProfit.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">基础毛利率</div>
              <div className="text-base font-bold text-emerald-700 font-mono mt-1">
                {(grossMargin * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">平均售价 (ASP)</div>
              <div className="text-base font-bold text-amber-800 font-mono mt-1">${asp.toFixed(2)}</div>
            </div>
          </div>

          {/* Time Trend Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800">周期销售明细与走势</h4>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                {(['day', 'week', 'month'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setTimeGranularity(g)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      timeGranularity === g ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {g === 'day' ? '日' : g === 'week' ? '周' : '月'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">期间</th>
                    <th className="py-2 px-3 text-right font-semibold">销量</th>
                    <th className="py-2 px-3 text-right font-semibold">销售额</th>
                    <th className="py-2 px-3 text-right font-semibold">毛利</th>
                    <th className="py-2 px-3 text-right font-semibold">ASP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {trendData.map((t) => (
                    <tr key={t.label} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-800">{t.label}</td>
                      <td className="py-2 px-3 text-right text-slate-700">{t.qty} 件</td>
                      <td className="py-2 px-3 text-right text-slate-900 font-bold">${t.sales.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-semibold">${t.profit.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-amber-800 font-medium">${t.asp.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            有效订单行: <span className="font-mono font-bold text-slate-800">{records.length}</span> 笔
          </div>
          <button
            onClick={() => {
              onRequestAiSkuDiagnose({
                onlineProductSKU: sku,
                internalSKU,
                SPU: spu,
                productType,
                totalSales,
                totalQty,
                totalProfit,
                grossMargin,
                asp,
                momSales,
                momQty,
                recentTrend: trendData.slice(-3),
              });
              onClose();
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI 深度诊断该款走势</span>
          </button>
        </div>
      </div>
    </div>
  );
};
