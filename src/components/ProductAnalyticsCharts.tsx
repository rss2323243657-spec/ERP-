import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Tag,
  Box,
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  ChevronDown,
  Clock,
  Layers,
  Info,
} from 'lucide-react';
import { StandardSalesRecord } from '../types/sales';

interface ProductAnalyticsChartsProps {
  allRecords: StandardSalesRecord[];
  onSelectCategory?: (category: string) => void;
  onSelectSpu?: (spu: string) => void;
}

export const ProductAnalyticsCharts: React.FC<ProductAnalyticsChartsProps> = ({
  allRecords,
  onSelectCategory,
  onSelectSpu,
}) => {
  // 1. Independent Time Dimension for Chart Group
  // Options: 'last7d' (近一周), 'last30d' (近一个月), 'month' (按月份), 'quarter' (按季度), 'year' (按年份), 'custom' (自定义时间)
  const [timeMode, setTimeMode] = useState<'last7d' | 'last30d' | 'month' | 'quarter' | 'year' | 'custom'>('last30d');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [customRange, setCustomRange] = useState<[string, string]>(['', '']);
  const [chartMetric, setChartMetric] = useState<'sales' | 'qty' | 'profit'>('sales');

  // Discover available years, quarters, and months from dataset
  const dateOptions = useMemo(() => {
    const months = new Set<string>();
    const quarters = new Set<string>();
    const years = new Set<string>();
    let maxDate = '';

    allRecords.forEach((r) => {
      if (r.month) months.add(r.month);
      if (r.quarter) quarters.add(r.quarter);
      if (r.year) years.add(String(r.year));
      if (!maxDate || r.dateOnly > maxDate) maxDate = r.dateOnly;
    });

    const sortedMonths = Array.from(months).sort().reverse();
    const sortedQuarters = Array.from(quarters).sort().reverse();
    const sortedYears = Array.from(years).sort().reverse();

    return {
      months: sortedMonths,
      quarters: sortedQuarters,
      years: sortedYears,
      maxDate,
    };
  }, [allRecords]);

  // Current active selections (fallback to first available)
  const activeMonth = selectedMonth || dateOptions.months[0] || '';
  const activeQuarter = selectedQuarter || dateOptions.quarters[0] || '';
  const activeYear = selectedYear || dateOptions.years[0] || '';

  // Filter records according to the chart group's dedicated time dimension
  const filteredRecords = useMemo(() => {
    if (!allRecords.length) return [];

    if (timeMode === 'last7d') {
      if (!dateOptions.maxDate) return allRecords;
      const maxD = new Date(dateOptions.maxDate);
      const minD = new Date(maxD);
      minD.setDate(minD.getDate() - 6);
      const minIso = minD.toISOString().slice(0, 10);
      return allRecords.filter((r) => r.dateOnly >= minIso && r.dateOnly <= dateOptions.maxDate);
    }

    if (timeMode === 'last30d') {
      if (!dateOptions.maxDate) return allRecords;
      const maxD = new Date(dateOptions.maxDate);
      const minD = new Date(maxD);
      minD.setDate(minD.getDate() - 29);
      const minIso = minD.toISOString().slice(0, 10);
      return allRecords.filter((r) => r.dateOnly >= minIso && r.dateOnly <= dateOptions.maxDate);
    }

    if (timeMode === 'month') {
      return allRecords.filter((r) => r.month === activeMonth);
    }

    if (timeMode === 'quarter') {
      return allRecords.filter((r) => r.quarter === activeQuarter);
    }

    if (timeMode === 'year') {
      return allRecords.filter((r) => String(r.year) === activeYear);
    }

    if (timeMode === 'custom') {
      return allRecords.filter((r) => {
        if (customRange[0] && r.dateOnly < customRange[0]) return false;
        if (customRange[1] && r.dateOnly > customRange[1]) return false;
        return true;
      });
    }

    return allRecords;
  }, [allRecords, timeMode, activeMonth, activeQuarter, activeYear, customRange, dateOptions.maxDate]);

  // Aggregate Category share and SPU ranking for the filtered subset
  const { categoryStats, spuStats, totalSales, totalQty, totalProfit } = useMemo(() => {
    let tSales = 0;
    let tQty = 0;
    let tProfit = 0;

    const catMap = new Map<string, { key: string; label: string; sales: number; qty: number; profit: number; cost: number }>();
    const spuMap = new Map<string, { key: string; SPU: string; productType: string; sales: number; qty: number; profit: number; cost: number }>();

    filteredRecords.forEach((r) => {
      tSales += r.finalSales;
      tQty += r.salesQuantity;
      tProfit += r.basicGrossProfit;

      // Category
      const catKey = r.productType || 'Unmapped';
      let c = catMap.get(catKey);
      if (!c) {
        c = { key: catKey, label: catKey, sales: 0, qty: 0, profit: 0, cost: 0 };
        catMap.set(catKey, c);
      }
      c.sales += r.finalSales;
      c.qty += r.salesQuantity;
      c.profit += r.basicGrossProfit;
      c.cost += r.salesCost;

      // SPU
      const spuKey = r.SPU || 'Unmapped';
      let s = spuMap.get(spuKey);
      if (!s) {
        s = { key: spuKey, SPU: spuKey, productType: r.productType || '-', sales: 0, qty: 0, profit: 0, cost: 0 };
        spuMap.set(spuKey, s);
      }
      s.sales += r.finalSales;
      s.qty += r.salesQuantity;
      s.profit += r.basicGrossProfit;
      s.cost += r.salesCost;
    });

    const categories = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        margin: c.sales > 0 ? c.profit / c.sales : 0,
        asp: c.qty > 0 ? c.sales / c.qty : 0,
        share: tSales > 0 ? c.sales / tSales : 0,
        qtyShare: tQty > 0 ? c.qty / tQty : 0,
      }))
      .sort((a, b) => (chartMetric === 'qty' ? b.qty - a.qty : chartMetric === 'profit' ? b.profit - a.profit : b.sales - a.sales));

    const spus = Array.from(spuMap.values())
      .map((s) => ({
        ...s,
        margin: s.sales > 0 ? s.profit / s.sales : 0,
        asp: s.qty > 0 ? s.sales / s.qty : 0,
        share: tSales > 0 ? s.sales / tSales : 0,
        qtyShare: tQty > 0 ? s.qty / tQty : 0,
      }))
      .sort((a, b) => (chartMetric === 'qty' ? b.qty - a.qty : chartMetric === 'profit' ? b.profit - a.profit : b.sales - a.sales));

    return {
      categoryStats: categories,
      spuStats: spus,
      totalSales: tSales,
      totalQty: tQty,
      totalProfit: tProfit,
    };
  }, [filteredRecords, chartMetric]);

  // Current scope label for header
  const scopeLabel = useMemo(() => {
    if (timeMode === 'last7d') return '近一周 (最近7天)';
    if (timeMode === 'last30d') return '近一个月 (最近30天)';
    if (timeMode === 'month') return `${activeMonth} 月度`;
    if (timeMode === 'quarter') return `${activeQuarter} 季度`;
    if (timeMode === 'year') return `${activeYear} 年度`;
    if (timeMode === 'custom') {
      return customRange[0] || customRange[1]
        ? `${customRange[0] || '起始'} 至 ${customRange[1] || '至今'}`
        : '自定义时间范围';
    }
    return '分析周期';
  }, [timeMode, activeMonth, activeQuarter, activeYear, customRange]);

  // Colors for category bars
  const barColors = [
    'bg-blue-600',
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-violet-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-teal-600',
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs mb-6 space-y-4">
      {/* 1. Header with Title & Independent Dimension Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-150">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">产品销售构成与排行</h3>
              <span
                title="支持按近一周、近一个月、月度、季度、年度或自定义时间范围查看品类与SPU排行；点击可联动下钻"
                className="cursor-pointer text-slate-400 hover:text-blue-600"
              >
                <Info className="w-3.5 h-3.5 inline" />
              </span>
              <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200 font-mono">
                {scopeLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              品类销售占比与 SPU 综合动销排行榜
            </p>
          </div>
        </div>

        {/* Metric Selector (Sales / Qty / Profit) */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
          <button
            onClick={() => setChartMetric('sales')}
            className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
              chartMetric === 'sales'
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            销售额 ($)
          </button>
          <button
            onClick={() => setChartMetric('qty')}
            className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
              chartMetric === 'qty'
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            销量 (件)
          </button>
          <button
            onClick={() => setChartMetric('profit')}
            className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
              chartMetric === 'profit'
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            基础毛利 ($)
          </button>
        </div>
      </div>

      {/* 2. Independent Time Dimension Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
        {/* Quick Granularity Switchers */}
        <div className="flex items-center space-x-1">
          <span className="text-slate-500 font-medium mr-1.5 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
            时间维度:
          </span>
          <button
            onClick={() => setTimeMode('last7d')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'last7d'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            近一周
          </button>
          <button
            onClick={() => setTimeMode('last30d')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'last30d'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            近一个月
          </button>
          <button
            onClick={() => setTimeMode('month')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'month'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            按月份
          </button>
          <button
            onClick={() => setTimeMode('quarter')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'quarter'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            按季度
          </button>
          <button
            onClick={() => setTimeMode('year')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'year'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            按年份
          </button>
          <button
            onClick={() => setTimeMode('custom')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all ${
              timeMode === 'custom'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            自定义范围
          </button>
        </div>

        {/* Dropdown for Month / Quarter / Year Selection or Custom Date Inputs */}
        <div className="flex items-center space-x-2">
          {timeMode === 'custom' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">日期范围:</span>
              <input
                type="date"
                value={customRange[0]}
                onChange={(e) => setCustomRange([e.target.value, customRange[1]])}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={customRange[1]}
                onChange={(e) => setCustomRange([customRange[0], e.target.value])}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
          {timeMode === 'month' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">选择月份:</span>
              <select
                value={activeMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {dateOptions.months.map((m) => (
                  <option key={m} value={m}>
                    {m} (
                    {allRecords.filter((r) => r.month === m).length.toLocaleString()} 单)
                  </option>
                ))}
              </select>
            </div>
          )}

          {timeMode === 'quarter' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">选择季度:</span>
              <select
                value={activeQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {dateOptions.quarters.map((q) => (
                  <option key={q} value={q}>
                    {q} (
                    {allRecords.filter((r) => r.quarter === q).length.toLocaleString()} 单)
                  </option>
                ))}
              </select>
            </div>
          )}

          {timeMode === 'year' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">选择年份:</span>
              <select
                value={activeYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {dateOptions.years.map((y) => (
                  <option key={y} value={y}>
                    {y}年 (
                    {allRecords.filter((r) => String(r.year) === y).length.toLocaleString()} 单)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick summary stats badge */}
          <div className="text-[11px] text-slate-500 font-mono pl-2 border-l border-slate-200">
            总额: <strong className="text-slate-900">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> · 
            总量: <strong className="text-slate-900">{totalQty.toLocaleString()}</strong> 件
          </div>
        </div>
      </div>

      {/* 3. The Visual Chart Group: Two-column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
        {/* Column 1: Product Type Sales Composition Bar & Share Chart */}
        <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-800">产品类型销售构成分析</h4>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">共 {categoryStats.length} 个品类</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-1">
            {categoryStats.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">该时间范围内无销售记录</div>
            ) : (
              categoryStats.map((item, idx) => {
                const metricVal =
                  chartMetric === 'qty'
                    ? item.qty
                    : chartMetric === 'profit'
                    ? item.profit
                    : item.sales;
                const metricTotal =
                  chartMetric === 'qty'
                    ? totalQty
                    : chartMetric === 'profit'
                    ? totalProfit
                    : totalSales;
                const sharePct = metricTotal > 0 ? (metricVal / metricTotal) * 100 : 0;
                const color = barColors[idx % barColors.length];

                return (
                  <div
                    key={item.key}
                    onClick={() => onSelectCategory && onSelectCategory(item.key)}
                    className="group p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>{item.label}</span>
                        {item.key === 'Unmapped' && (
                          <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800 font-mono">未匹配</span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {chartMetric === 'qty' ? `${item.qty.toLocaleString()} 件` : `$${metricVal.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1.5">
                      <div
                        className={`${color} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(1, sharePct))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>销量: {item.qty.toLocaleString()} 件</span>
                      <span>客单价: ${item.asp.toFixed(2)}</span>
                      <span>毛利率: {(item.margin * 100).toFixed(1)}%</span>
                      <span className="font-mono font-bold text-indigo-700">{sharePct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: SPU Sales Ranking & Top Performers */}
        <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <Box className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800">SPU 销售动销排行 TOP</h4>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">共 {spuStats.length} 个 SPU</span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[320px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5 font-semibold w-8 text-center">#</th>
                  <th className="py-2 px-2.5 font-semibold">SPU 编码</th>
                  <th className="py-2 px-2.5 font-semibold">产品类型</th>
                  <th className="py-2 px-2.5 font-semibold text-right">销量</th>
                  <th className="py-2 px-2.5 font-semibold text-right">销售额 ($)</th>
                  <th className="py-2 px-2.5 font-semibold text-right">毛利率</th>
                  <th className="py-2 px-2.5 font-semibold text-center w-10">下钻</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {spuStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      无对应数据
                    </td>
                  </tr>
                ) : (
                  spuStats.slice(0, 30).map((spu, index) => (
                    <tr
                      key={spu.key}
                      onClick={() => onSelectSpu && onSelectSpu(spu.key)}
                      className="hover:bg-white transition-colors cursor-pointer group"
                    >
                      <td className="py-2 px-2.5 font-mono text-center text-slate-500">
                        {index + 1 <= 3 ? (
                          <span className="inline-block w-4 h-4 text-center leading-4 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {index + 1}
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {spu.SPU}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 max-w-[100px] truncate" title={spu.productType}>
                        {spu.productType}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                        {spu.qty.toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                        ${spu.sales.toFixed(2)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-emerald-700 font-semibold">
                        {(spu.margin * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2.5 text-center text-slate-400 group-hover:text-emerald-600">
                        <ExternalLink className="w-3.5 h-3.5 mx-auto" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
