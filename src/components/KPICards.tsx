import React from 'react';
import {
  DollarSign,
  Package,
  TrendingUp,
  Percent,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { KPIOverview, TimeComparison } from '../types/sales';

interface KPICardsProps {
  kpis: KPIOverview;
  timeComparison: TimeComparison;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis, timeComparison }) => {
  const formatCurrency = (val: number) => {
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderBadge = (change: number | null, label: string) => {
    if (change === null) {
      return (
        <span className="inline-flex items-center text-[10px] text-slate-400 font-mono">
          <Minus className="w-2.5 h-2.5 mr-0.5" />
          {label}: 暂无
        </span>
      );
    }
    const isPositive = change > 0;
    const isZero = change === 0;
    const pct = (Math.abs(change) * 100).toFixed(1) + '%';

    if (isZero) {
      return (
        <span className="inline-flex items-center text-[10px] text-slate-500 font-mono">
          <Minus className="w-2.5 h-2.5 mr-0.5" />
          {label}: 0%
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
          isPositive
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            : 'text-rose-700 bg-rose-50 border border-rose-200'
        }`}
      >
        {isPositive ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
        {label}: {isPositive ? '+' : '-'}{pct}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {/* 1. Final Sales */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-blue-400 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold text-slate-700">最终销售额 (finalSales)</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight font-mono mb-2">
          {formatCurrency(kpis.finalSales)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {renderBadge(timeComparison.momSalesChange, '环比')}
          {renderBadge(timeComparison.yoySalesChange, '同比')}
        </div>
      </div>

      {/* 2. Sales Quantity */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-indigo-400 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold text-slate-700">最终销量 (出库发货)</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight font-mono mb-2">
          {kpis.salesQuantity.toLocaleString()} <span className="text-xs font-normal text-slate-500">件</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {renderBadge(timeComparison.momQtyChange, '环比')}
          {renderBadge(timeComparison.yoyQtyChange, '同比')}
        </div>
      </div>

      {/* 3. Sales Cost */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-slate-350 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold text-slate-700">销售成本 (salesCost)</span>
          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-slate-800 tracking-tight font-mono mb-2">
          {formatCurrency(kpis.salesCost)}
        </div>
        <div className="text-[11px] text-slate-500">
          成本占比: {kpis.finalSales > 0 ? ((kpis.salesCost / kpis.finalSales) * 100).toFixed(1) + '%' : '0%'}
        </div>
      </div>

      {/* 4. Basic Gross Profit & Margin */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-emerald-400 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold text-slate-700">基础毛利 & 毛利率</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-emerald-600 tracking-tight font-mono mb-1">
          {formatCurrency(kpis.basicGrossProfit)}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">基础毛利率:</span>
          <span className="font-bold text-emerald-700 font-mono">
            {(kpis.basicGrossMargin * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 5. ASP & Counts */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs hover:border-amber-400 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold text-slate-700">平均销售单价 (ASP)</span>
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-amber-700 tracking-tight font-mono mb-1">
          ${kpis.averageSellingPrice.toFixed(2)}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>动销SKU: {kpis.activeOnlineSkuCount}</span>
          <span>SPU: {kpis.activeSpuCount}</span>
          <span>订单数: {kpis.orderCount}</span>
        </div>
      </div>
    </div>
  );
};
