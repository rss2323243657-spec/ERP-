import React from 'react';
import { Calendar, Tag, Box, Hash, Layers, RotateCcw, Search } from 'lucide-react';
import { FilterState } from '../types/sales';

interface FilterBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  availableProductTypes: string[];
  availableSpus: string[];
  availableOnlineSkus: string[];
  maxOrderDate: string;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  availableProductTypes,
  availableSpus,
  availableOnlineSkus,
  maxOrderDate,
  onReset,
}) => {
  const handleGranularityChange = (gran: FilterState['timeGranularity']) => {
    let start = '';
    let end = maxOrderDate || '';

    if (maxOrderDate) {
      const maxD = new Date(maxOrderDate);
      if (gran === 'day') {
        const startD = new Date(maxD);
        startD.setDate(maxD.getDate() - 29);
        start = startD.toISOString().substring(0, 10);
      } else if (gran === 'week') {
        const startD = new Date(maxD);
        startD.setDate(maxD.getDate() - 83); // 12 weeks
        start = startD.toISOString().substring(0, 10);
      } else if (gran === 'month') {
        const startD = new Date(maxD);
        startD.setDate(maxD.getDate() - 364); // 12 months
        start = startD.toISOString().substring(0, 10);
      } else if (gran === 'quarter') {
        const startD = new Date(maxD);
        startD.setDate(maxD.getDate() - 729); // 8 quarters
        start = startD.toISOString().substring(0, 10);
      } else if (gran === 'year') {
        start = ''; // all time
      } else if (gran === 'custom') {
        start = filters.selectedDateRange[0];
        end = filters.selectedDateRange[1];
      }
    }

    setFilters((prev) => ({
      ...prev,
      timeGranularity: gran,
      selectedDateRange: [start, end],
    }));
  };

  const handleApplyPreset = (days: number | 'all') => {
    if (days === 'all') {
      setFilters((prev) => ({ ...prev, selectedDateRange: ['', ''] }));
      return;
    }
    const end = maxOrderDate || new Date().toISOString().substring(0, 10);
    const maxD = new Date(end);
    const startD = new Date(maxD);
    startD.setDate(maxD.getDate() - (days - 1));
    setFilters((prev) => ({
      ...prev,
      selectedDateRange: [startD.toISOString().substring(0, 10), end],
    }));
  };

  const isFiltered =
    filters.selectedProductType !== 'ALL' ||
    filters.selectedSpu !== 'ALL' ||
    filters.selectedOnlineSku !== 'ALL' ||
    filters.onlineSkuSearch !== '' ||
    filters.spuSearch !== '' ||
    filters.internalSkuSearch !== '' ||
    filters.globalSearch !== '' ||
    filters.selectedDateRange[0] !== '' ||
    filters.selectedDateRange[1] !== '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs mb-6">
      {/* Top Filter Row: Time Granularity & Metric */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-150">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>时间粒度:</span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            {(
              [
                { id: 'day', label: '日维度 (近30天)' },
                { id: 'week', label: '自然周 (周一~周日)' },
                { id: 'month', label: '月度' },
                { id: 'quarter', label: '季度' },
                { id: 'year', label: '年度' },
                { id: 'custom', label: '自定义时间' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => handleGranularityChange(item.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  filters.timeGranularity === item.id
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">日期范围:</span>
            <input
              type="date"
              value={filters.selectedDateRange[0]}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  selectedDateRange: [e.target.value, prev.selectedDateRange[1]],
                }))
              }
              className="bg-slate-50 border border-slate-250 rounded px-2 py-1 text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 text-xs"
              placeholder="起始日期"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={filters.selectedDateRange[1]}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  selectedDateRange: [prev.selectedDateRange[0], e.target.value],
                }))
              }
              className="bg-slate-50 border border-slate-250 rounded px-2 py-1 text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 text-xs"
              placeholder="截止日期"
            />
            {/* Quick Presets */}
            <div className="flex items-center space-x-1 pl-1">
              <button
                type="button"
                onClick={() => handleApplyPreset(30)}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                近30天
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(90)}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                近90天
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('all')}
                className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                全部时间
              </button>
            </div>

            {maxOrderDate && (
              <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
                (最新订单: {maxOrderDate})
              </span>
            )}
          </div>
        </div>

        {/* Primary Metric Selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">主要统计指标:</span>
          <select
            value={filters.primaryMetric}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                primaryMetric: e.target.value as FilterState['primaryMetric'],
              }))
            }
            className="bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1 text-xs text-blue-700 font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="finalSales">最终销售额 (finalSales $)</option>
            <option value="salesQuantity">最终销量 (salesQuantity 件)</option>
            <option value="salesCost">销售成本 (salesCost $)</option>
            <option value="basicGrossProfit">基础毛利 (basicGrossProfit $)</option>
            <option value="basicGrossMargin">基础毛利率 (basicGrossMargin %)</option>
            <option value="averageSellingPrice">平均销售价格 (ASP $)</option>
          </select>
        </div>
      </div>

      {/* Bottom Filter Row: Product Hierarchy & Search */}
      <div className="pt-3 flex flex-wrap items-center gap-3 text-xs">
        {/* Product Type Filter */}
        <div className="flex items-center space-x-1.5 min-w-[170px]">
          <Tag className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-slate-600 font-medium">产品类型:</span>
          <select
            value={filters.selectedProductType}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                selectedProductType: e.target.value,
                selectedSpu: 'ALL',
                selectedOnlineSku: 'ALL',
              }))
            }
            className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 text-xs"
          >
            <option value="ALL">全部产品类型</option>
            {availableProductTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* SPU Search & Select */}
        <div className="flex items-center space-x-1.5 min-w-[180px]">
          <Box className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-slate-600 font-medium">SPU搜索:</span>
          <input
            type="text"
            placeholder="搜索SPU名称/编码..."
            value={filters.spuSearch}
            onChange={(e) => setFilters((prev) => ({ ...prev, spuSearch: e.target.value }))}
            className="w-32 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-blue-500 text-xs placeholder:text-slate-400"
          />
        </div>

        {/* Online SKU Search (Walmart销售SKU) */}
        <div className="flex items-center space-x-1.5 min-w-[210px]">
          <Hash className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-slate-600 font-medium" title="Walmart平台实际销售SKU（核心销售主键）">
            Walmart销售SKU:
          </span>
          <input
            type="text"
            placeholder="检索销售SKU..."
            value={filters.onlineSkuSearch}
            onChange={(e) => setFilters((prev) => ({ ...prev, onlineSkuSearch: e.target.value }))}
            className="w-36 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-blue-700 font-mono focus:bg-white focus:outline-none focus:border-blue-500 text-xs placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Internal SKU Search (Auxiliary) */}
        <div className="flex items-center space-x-1.5 min-w-[190px]">
          <Layers className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-slate-600 font-medium" title="公司内部编码（仅对照留存，不作为主键）">
            内部SKU (对照):
          </span>
          <input
            type="text"
            placeholder="内部编码核对..."
            value={filters.internalSkuSearch}
            onChange={(e) => setFilters((prev) => ({ ...prev, internalSkuSearch: e.target.value }))}
            className="w-32 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-blue-500 text-xs placeholder:text-slate-400"
          />
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            onClick={onReset}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer text-xs ml-auto font-medium"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>重置筛选</span>
          </button>
        )}
      </div>
    </div>
  );
};
