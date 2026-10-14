import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  XCircle,
  Download,
  CheckCircle2,
  Plus,
  Coins,
  RefreshCw,
  Edit3,
  RotateCcw,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AdjustmentRecord,
  ExcludedRecord,
  ProcessingLog,
  StandardSalesRecord,
  ProductMappingItem,
} from '../types/sales';
import {
  exportToXLSX,
  exportToCSV,
  formatAdjustmentsForExport,
  formatExcludedForExport,
} from '../services/exporter';
import {
  DEFAULT_MONTHLY_EXCHANGE_RATES,
  FALLBACK_EXCHANGE_RATE,
} from '../services/dataProcessor';

interface DataQualityCenterProps {
  adjustments: AdjustmentRecord[];
  excluded: ExcludedRecord[];
  cleanRecords: StandardSalesRecord[];
  logs: ProcessingLog[];
  onAddProductMapping: (mapping: ProductMappingItem) => void;
  monthlyExchangeRates?: Record<string, number>;
  onSyncExchangeRates?: (rates: Record<string, number>) => void;
}

export const DataQualityCenter: React.FC<DataQualityCenterProps> = ({
  adjustments,
  excluded,
  cleanRecords,
  logs,
  onAddProductMapping,
  monthlyExchangeRates = {},
  onSyncExchangeRates,
}) => {
  const [activeTab, setActiveTab] = useState<'adjustments' | 'excluded' | 'unmapped' | 'rates' | 'rules' | 'logs'>('rates');
  const [editingRates, setEditingRates] = useState<Record<string, number>>({ ...monthlyExchangeRates });
  const [rateFeedback, setRateFeedback] = useState<string | null>(null);
  // Requirement 6: Selector to sync specific month or ALL
  const [syncMonthScope, setSyncMonthScope] = useState<string>('ALL');

  // Pagination states for detail tables (Requirement 3: Default 20, selectable)
  const [adjPage, setAdjPage] = useState<number>(1);
  const [adjPageSize, setAdjPageSize] = useState<number>(20);

  const [excPage, setExcPage] = useState<number>(1);
  const [excPageSize, setExcPageSize] = useState<number>(20);

  const [unmapPage, setUnmapPage] = useState<number>(1);
  const [unmapPageSize, setUnmapPageSize] = useState<number>(20);

  const [ratePage, setRatePage] = useState<number>(1);
  const [ratePageSize, setRatePageSize] = useState<number>(20);

  const [newSkuMapping, setNewSkuMapping] = useState<{ sku: string; spu: string; productType: string }>({
    sku: '',
    spu: '',
    productType: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const totalClean = cleanRecords.length;
  const totalExcluded = excluded.length;
  const cancelledCount = excluded.filter((e) => e.excludeReason.includes('Cancelled')).length;
  const zeroPriceCount = excluded.filter((e) => e.excludeReason.includes('Unit Price = 0')).length;
  const mismatchCount = adjustments.length;

  const unmappedRecords = cleanRecords.filter((r) => r.isUnmapped);
  const unmappedSkuSet = Array.from(new Set(unmappedRecords.map((r) => r.onlineProductSKU)));

  const handleExportAdjustments = (fmt: 'xlsx' | 'csv') => {
    const formatted = formatAdjustmentsForExport(adjustments);
    if (fmt === 'xlsx') exportToXLSX(formatted, '销售额修正明细表_商品数量不等于发货数量', 'Adjustments');
    else exportToCSV(formatted, '销售额修正明细表_商品数量不等于发货数量');
  };

  const handleExportExcluded = (fmt: 'xlsx' | 'csv') => {
    const formatted = formatExcludedForExport(excluded);
    if (fmt === 'xlsx') exportToXLSX(formatted, '被排除订单明细表', 'Excluded');
    else exportToCSV(formatted, '被排除订单明细表');
  };

  const submitNewMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuMapping.sku || !newSkuMapping.spu) return;
    onAddProductMapping({
      SKU: newSkuMapping.sku,
      SPU: newSkuMapping.spu,
      productType: newSkuMapping.productType || 'General Category',
    });
    setNewSkuMapping({ sku: '', spu: '', productType: '' });
    setShowAddModal(false);
  };

  // Group clean records by month to compute statistics & exchange rates
  const monthlyStats = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        orderCount: number;
        salesQty: number;
        finalSalesUSD: number;
        totalCostCNY: number;
        totalCostUSD: number;
        basicGrossProfitUSD: number;
      }
    >();

    cleanRecords.forEach((r) => {
      const m = r.month || '2026-09';
      let stat = map.get(m);
      if (!stat) {
        stat = {
          month: m,
          orderCount: 0,
          salesQty: 0,
          finalSalesUSD: 0,
          totalCostCNY: 0,
          totalCostUSD: 0,
          basicGrossProfitUSD: 0,
        };
        map.set(m, stat);
      }
      stat.orderCount += 1;
      stat.salesQty += r.salesQuantity;
      stat.finalSalesUSD += r.finalSales;
      const cnyCost = r.salesCostCNY ?? (r.salesQuantity * (r.productCostCNY ?? r.productCost * 7.2));
      stat.totalCostCNY += cnyCost;
      stat.totalCostUSD += r.salesCost;
      stat.basicGrossProfitUSD += r.basicGrossProfit;
    });

    // Also include months present in DEFAULT_MONTHLY_EXCHANGE_RATES if no records yet
    if (map.size === 0) {
      ['2026-10', '2026-09', '2026-08'].forEach((m) => {
        map.set(m, {
          month: m,
          orderCount: 0,
          salesQty: 0,
          finalSalesUSD: 0,
          totalCostCNY: 0,
          totalCostUSD: 0,
          basicGrossProfitUSD: 0,
        });
      });
    }

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [cleanRecords]);

  // Handle rate input change
  const handleRateChange = (month: string, val: string) => {
    const num = parseFloat(val);
    setEditingRates((prev) => ({
      ...prev,
      [month]: isNaN(num) ? 0 : num,
    }));
  };

  // Sync rates to whole dataset or selected month (Requirement 6)
  const handleApplySync = (targetMonth?: string) => {
    const scope = targetMonth || syncMonthScope;
    if (!onSyncExchangeRates) return;
    if (scope === 'ALL') {
      onSyncExchangeRates(editingRates);
      setRateFeedback('全部月份汇率已成功同步并立即重新核算全部销售数据！');
    } else {
      const targetRate =
        editingRates[scope] ??
        monthlyExchangeRates[scope] ??
        DEFAULT_MONTHLY_EXCHANGE_RATES[scope] ??
        FALLBACK_EXCHANGE_RATE;
      const merged = { ...monthlyExchangeRates, ...editingRates, [scope]: targetRate };
      onSyncExchangeRates(merged);
      setRateFeedback(`已单独同步【${scope}】月份结算汇率 (${targetRate}) 并重新核算销售数据！`);
    }
    setTimeout(() => setRateFeedback(null), 3500);
  };

  // Reset to default standard rates
  const handleResetDefaults = () => {
    setEditingRates({ ...DEFAULT_MONTHLY_EXCHANGE_RATES });
    if (onSyncExchangeRates) {
      onSyncExchangeRates({ ...DEFAULT_MONTHLY_EXCHANGE_RATES });
      setRateFeedback('已重置为基准汇率表并重新核算！');
      setTimeout(() => setRateFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Quality Center Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">有效销售记录数</div>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {totalClean.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">已纳入销售核算标准表</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">已排除无效记录数</div>
          <div className="text-xl font-bold text-rose-700 font-mono mt-1">
            {totalExcluded.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Cancelled 或 单价=0</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">Cancelled 排除订单</div>
          <div className="text-xl font-bold text-slate-800 font-mono mt-1">
            {cancelledCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">已彻底剔除出有效大盘</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">单价=0 排除订单</div>
          <div className="text-xl font-bold text-slate-800 font-mono mt-1">
            {zeroPriceCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">非正常Walmart销售排除</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">数量不一致修正订单</div>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {mismatchCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">按实际发货重算销售额</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">未匹配销售SKU数</div>
          <div className="text-xl font-bold text-indigo-700 font-mono mt-1">
            {unmappedSkuSet.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">计入总额，未匹配SPU</div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center space-x-2 px-4 pt-2 border-b border-slate-200 bg-slate-50 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rates'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center space-x-1.5">
              <Coins className="w-3.5 h-3.5 text-blue-600" />
              <span>月度核算汇率与成本折算 ({monthlyStats.length})</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'adjustments'
                ? 'border-amber-500 text-amber-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            销售额修正记录 ({adjustments.length})
          </button>
          <button
            onClick={() => setActiveTab('excluded')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'excluded'
                ? 'border-rose-500 text-rose-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            被排除订单明细 ({excluded.length})
          </button>
          <button
            onClick={() => setActiveTab('unmapped')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'unmapped'
                ? 'border-indigo-500 text-indigo-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            未匹配Walmart销售SKU ({unmappedSkuSet.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            底层数据清洗与核算规则可视化
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            数据导入与解析日志 ({logs.length})
          </button>
        </div>

        {/* Tab 0: Monthly Exchange Rates (USD/CNY) */}
        {activeTab === 'rates' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-150">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>月度结算汇率与成本折算 (USD / CNY)</span>
                  <span
                    title="上传数据中商品成本为人民币，销售单价为美金。本系统按月份统一汇率将商品总成本换算为美金以核算真实基础毛利"
                    className="cursor-pointer text-slate-400 hover:text-blue-600"
                  >
                    <Info className="w-3.5 h-3.5 inline" />
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  同一个月采用统一汇率 · 支持自定义编辑并一键同步更新至销售核算数据
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-250 px-2.5 py-1 rounded-lg">
                  <span className="text-xs text-slate-600 font-medium">同步范围:</span>
                  <select
                    value={syncMonthScope}
                    onChange={(e) => setSyncMonthScope(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">全部月份 (批量同步所有汇率)</option>
                    {monthlyStats.map((item) => (
                      <option key={item.month} value={item.month}>
                        仅同步 {item.month}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>重置默认</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplySync()}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>
                    {syncMonthScope === 'ALL'
                      ? '同步全部月份汇率并重算'
                      : `仅同步【${syncMonthScope}】汇率并重算`}
                  </span>
                </button>
              </div>
            </div>

            {rateFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{rateFeedback}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">业务月份</th>
                    <th className="py-2.5 px-3 font-semibold">统一结算汇率 (1 USD = X RMB)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">状态</th>
                    <th className="py-2.5 px-3 font-semibold text-center">快捷同步</th>
                    <th className="py-2.5 px-3 font-semibold text-right">有效订单数</th>
                    <th className="py-2.5 px-3 font-semibold text-right">发货销量</th>
                    <th className="py-2.5 px-3 font-semibold text-right">商品总成本 (RMB)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">折算美金成本 (USD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">最终销售额 (USD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">基础毛利 (USD)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">基础毛利率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono">
                  {(ratePageSize === 99999
                    ? monthlyStats
                    : monthlyStats.slice((ratePage - 1) * ratePageSize, ratePage * ratePageSize)
                  ).map((item) => {
                    const currentRate =
                      editingRates[item.month] ??
                      monthlyExchangeRates[item.month] ??
                      DEFAULT_MONTHLY_EXCHANGE_RATES[item.month] ??
                      FALLBACK_EXCHANGE_RATE;
                    const isAbnormal = currentRate < 6.0 || currentRate > 8.5;
                    const recalculatedUsdCost = currentRate > 0 ? item.totalCostCNY / currentRate : 0;
                    const recalculatedProfit = item.finalSalesUSD - recalculatedUsdCost;
                    const recalculatedMargin = item.finalSalesUSD > 0 ? recalculatedProfit / item.finalSalesUSD : 0;

                    return (
                      <tr key={item.month} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                          {item.month}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-slate-400 font-sans text-[11px]">USD:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={currentRate}
                              onChange={(e) => handleRateChange(item.month, e.target.value)}
                              className={`w-24 px-2 py-1 rounded text-xs font-mono font-bold border focus:outline-none focus:ring-1 ${
                                isAbnormal
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-400'
                                  : 'border-slate-300 bg-white text-slate-800 focus:border-blue-500 focus:ring-blue-500'
                              }`}
                            />
                            <span className="text-slate-400 font-sans text-[11px]">RMB</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isAbnormal ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-800 font-sans">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>偏离合理区间</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-sans">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>正常</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleApplySync(item.month)}
                            title={`单独同步【${item.month}】汇率并重算销售数据`}
                            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 text-[11px] font-sans font-medium transition-colors cursor-pointer"
                          >
                            单月同步
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {item.orderCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {item.salesQty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          ¥{item.totalCostCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          ${recalculatedUsdCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-900">
                          ${item.finalSalesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${recalculatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          ${recalculatedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${recalculatedMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {(recalculatedMargin * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination for Monthly Exchange Rates */}
            {monthlyStats.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-150 text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <span>每页显示:</span>
                  <select
                    value={ratePageSize}
                    onChange={(e) => {
                      setRatePageSize(Number(e.target.value));
                      setRatePage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20 (默认)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={99999}>全部显示</option>
                  </select>
                  <span>
                    显示 {(ratePage - 1) * (ratePageSize === 99999 ? monthlyStats.length : ratePageSize) + 1} -{' '}
                    {Math.min(ratePage * (ratePageSize === 99999 ? monthlyStats.length : ratePageSize), monthlyStats.length)} / 共{' '}
                    {monthlyStats.length.toLocaleString()} 个业务月份
                  </span>
                </div>
                {ratePageSize !== 99999 && Math.ceil(monthlyStats.length / ratePageSize) > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={ratePage === 1}
                      onClick={() => setRatePage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-slate-800 font-semibold">
                      {ratePage} / {Math.ceil(monthlyStats.length / ratePageSize)}
                    </span>
                    <button
                      disabled={ratePage === Math.ceil(monthlyStats.length / ratePageSize)}
                      onClick={() => setRatePage((p) => Math.min(Math.ceil(monthlyStats.length / ratePageSize), p + 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Adjustments Table */}
        {activeTab === 'adjustments' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>商品SKU数量 ≠ 发货数量 修正记录</span>
                  <span className="text-xs text-amber-700 font-mono">({adjustments.length} 笔订单已校正)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  依据系统铁律：销售额必须以【实际出库发货数量 × 单价】为唯一准绳，杜绝以ERP订购数量虚增销售额。
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExportAdjustments('xlsx')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出修正记录 (.xlsx)
                </button>
                <button
                  onClick={() => handleExportAdjustments('csv')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出 (.csv)
                </button>
              </div>
            </div>

            {adjustments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                暂无数量不一致订单，所有有效订单订购数量均等于实际发货数量。
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">订单号</th>
                      <th className="py-2.5 px-3 font-semibold">下单时间</th>
                      <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU</th>
                      <th className="py-2.5 px-3 text-amber-700 font-semibold">内部SKU (对照)</th>
                      <th className="py-2.5 px-3 text-right font-semibold">订购数量</th>
                      <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">发货数量</th>
                      <th className="py-2.5 px-3 text-right font-semibold">单价</th>
                      <th className="py-2.5 px-3 text-right text-slate-400 font-semibold">订购原始金额</th>
                      <th className="py-2.5 px-3 text-right text-slate-900 font-bold">最终核算销售额</th>
                      <th className="py-2.5 px-3 text-right text-rose-700 font-bold">核算差额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {(adjPageSize === 99999 ? adjustments : adjustments.slice((adjPage - 1) * adjPageSize, adjPage * adjPageSize)).map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-800">{a.orderId}</td>
                        <td className="py-2 px-3 text-slate-500 font-sans">{a.orderTime}</td>
                        <td className="py-2 px-3 text-blue-700 font-semibold">{a.onlineProductSKU}</td>
                        <td className="py-2 px-3 text-amber-700">{a.internalSKU}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{a.orderedQuantity}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-bold">{a.shippedQuantity}</td>
                        <td className="py-2 px-3 text-right">${a.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-400 line-through">
                          ${a.rawCalculatedAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-900 font-bold">
                          ${a.finalSales.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700 font-semibold">
                          {a.diffAmount >= 0 ? '+' : ''}
                          ${a.diffAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination for Adjustments */}
            {adjustments.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-150 text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <span>每页显示:</span>
                  <select
                    value={adjPageSize}
                    onChange={(e) => {
                      setAdjPageSize(Number(e.target.value));
                      setAdjPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20 (默认)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={99999}>全部显示</option>
                  </select>
                  <span>
                    显示 {(adjPage - 1) * (adjPageSize === 99999 ? adjustments.length : adjPageSize) + 1} -{' '}
                    {Math.min(adjPage * (adjPageSize === 99999 ? adjustments.length : adjPageSize), adjustments.length)} / 共{' '}
                    {adjustments.length.toLocaleString()} 条
                  </span>
                </div>
                {adjPageSize !== 99999 && Math.ceil(adjustments.length / adjPageSize) > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={adjPage === 1}
                      onClick={() => setAdjPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-slate-800 font-semibold">
                      {adjPage} / {Math.ceil(adjustments.length / adjPageSize)}
                    </span>
                    <button
                      disabled={adjPage === Math.ceil(adjustments.length / adjPageSize)}
                      onClick={() => setAdjPage((p) => Math.min(Math.ceil(adjustments.length / adjPageSize), p + 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Excluded Orders */}
        {activeTab === 'excluded' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>被排除订单明细</span>
                  <span className="text-xs text-rose-700 font-mono">({excluded.length} 笔)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  原始记录完好保留，严格隔离于有效销售统计之外。
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExportExcluded('xlsx')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出排除明细 (.xlsx)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">订单号</th>
                    <th className="py-2.5 px-3 font-semibold">下单时间</th>
                    <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU</th>
                    <th className="py-2.5 px-3 text-amber-700">内部SKU</th>
                    <th className="py-2.5 px-3 font-semibold">平台状态</th>
                    <th className="py-2.5 px-3 text-right font-semibold">单价</th>
                    <th className="py-2.5 px-3 text-right font-semibold">订购</th>
                    <th className="py-2.5 px-3 text-right font-semibold">发货</th>
                    <th className="py-2.5 px-3 text-rose-700 font-semibold font-sans">排除原因</th>
                    <th className="py-2.5 px-3 font-semibold font-sans">来源Sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {(excPageSize === 99999 ? excluded : excluded.slice((excPage - 1) * excPageSize, excPage * excPageSize)).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-800">{e.orderId}</td>
                      <td className="py-2 px-3 text-slate-500 font-sans">{e.orderTime}</td>
                      <td className="py-2 px-3 text-blue-700">{e.onlineProductSKU}</td>
                      <td className="py-2 px-3 text-amber-700">{e.internalSKU}</td>
                      <td className="py-2 px-3 text-slate-700">{e.platformStatus}</td>
                      <td className="py-2 px-3 text-right">${e.unitPrice}</td>
                      <td className="py-2 px-3 text-right">{e.orderedQuantity}</td>
                      <td className="py-2 px-3 text-right">{e.shippedQuantity}</td>
                      <td className="py-2 px-3 font-sans text-rose-700 font-medium">{e.excludeReason}</td>
                      <td className="py-2 px-3 text-slate-500 font-sans">{e.sheetSource || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination for Excluded */}
            {excluded.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-150 text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <span>每页显示:</span>
                  <select
                    value={excPageSize}
                    onChange={(e) => {
                      setExcPageSize(Number(e.target.value));
                      setExcPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 cursor-pointer font-medium"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20 (默认)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={99999}>全部显示</option>
                  </select>
                  <span>
                    显示 {(excPage - 1) * (excPageSize === 99999 ? excluded.length : excPageSize) + 1} -{' '}
                    {Math.min(excPage * (excPageSize === 99999 ? excluded.length : excPageSize), excluded.length)} / 共{' '}
                    {excluded.length.toLocaleString()} 条
                  </span>
                </div>
                {excPageSize !== 99999 && Math.ceil(excluded.length / excPageSize) > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={excPage === 1}
                      onClick={() => setExcPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-slate-800 font-semibold">
                      {excPage} / {Math.ceil(excluded.length / excPageSize)}
                    </span>
                    <button
                      disabled={excPage === Math.ceil(excluded.length / excPageSize)}
                      onClick={() => setExcPage((p) => Math.min(Math.ceil(excluded.length / excPageSize), p + 1))}
                      className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Unmapped SKU list */}
        {activeTab === 'unmapped' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  未匹配产品映射表的 Walmart 销售SKU ({unmappedSkuSet.length} 个)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  注意：未匹配SKU的销售额与销量仍 100% 纳入全店大盘统计，但无法聚类至 SPU 和产品类型。可快速补充映射！
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>手动补充映射</span>
              </button>
            </div>

            {unmappedSkuSet.length === 0 ? (
              <div className="text-center py-12 text-emerald-700 text-xs flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="w-8 h-8 opacity-90 text-emerald-600" />
                <span className="font-semibold">当前所有在售 SKU 均已成功匹配至 SPU 及产品类型！</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(unmapPageSize === 99999
                    ? unmappedSkuSet
                    : unmappedSkuSet.slice((unmapPage - 1) * unmapPageSize, unmapPage * unmapPageSize)
                  ).map((sku) => {
                    const recordsForSku = unmappedRecords.filter((r) => r.onlineProductSKU === sku);
                    const sales = recordsForSku.reduce((a, b) => a + b.finalSales, 0);
                    const qty = recordsForSku.reduce((a, b) => a + b.salesQuantity, 0);

                    return (
                      <div
                        key={sku}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-blue-700 text-xs">{sku}</div>
                          <div className="text-[11px] text-slate-600 mt-1">
                            销售额: <span className="font-mono font-bold text-slate-900">${sales.toFixed(2)}</span> · 销量:{' '}
                            <span className="font-mono">{qty}</span> 件
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setNewSkuMapping({ sku, spu: '', productType: '' });
                            setShowAddModal(true);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold cursor-pointer"
                        >
                          映射
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination for Unmapped */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-150 text-xs text-slate-500">
                  <div className="flex items-center space-x-2">
                    <span>每页显示:</span>
                    <select
                      value={unmapPageSize}
                      onChange={(e) => {
                        setUnmapPageSize(Number(e.target.value));
                        setUnmapPage(1);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 cursor-pointer font-medium"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20 (默认)</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={99999}>全部显示</option>
                    </select>
                    <span>
                      显示 {(unmapPage - 1) * (unmapPageSize === 99999 ? unmappedSkuSet.length : unmapPageSize) + 1} -{' '}
                      {Math.min(unmapPage * (unmapPageSize === 99999 ? unmappedSkuSet.length : unmapPageSize), unmappedSkuSet.length)} / 共{' '}
                      {unmappedSkuSet.length.toLocaleString()} 个未匹配 SKU
                    </span>
                  </div>
                  {unmapPageSize !== 99999 && Math.ceil(unmappedSkuSet.length / unmapPageSize) > 1 && (
                    <div className="flex items-center space-x-2">
                      <button
                        disabled={unmapPage === 1}
                        onClick={() => setUnmapPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-slate-800 font-semibold">
                        {unmapPage} / {Math.ceil(unmappedSkuSet.length / unmapPageSize)}
                      </span>
                      <button
                        disabled={unmapPage === Math.ceil(unmappedSkuSet.length / unmapPageSize)}
                        onClick={() => setUnmapPage((p) => Math.min(Math.ceil(unmappedSkuSet.length / unmapPageSize), p + 1))}
                        className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Rules Visual Architecture */}
        {activeTab === 'rules' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">系统底层固定销售统计与清洗规则</h3>
              <p className="text-xs text-slate-500 mt-1">
                任何 Dashboard、图表、排行、AI分析及导出结果均 100% 遵循本套透明、可追溯的标准数据链路：
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-blue-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-center leading-5 text-[11px]">1</span>
                  <span>双 SKU 严格区分原则</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>线上商品SKU (onlineProductSKU)</strong>: Walmart平台实际销售SKU，全店销售分析与产品映射的主键。<br />
                  • <strong>SKU (internalSKU)</strong>: 公司内部产品编码，仅作为ERP识别、追踪与核对辅助字段，严禁替代线上SKU做映射。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-rose-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-center leading-5 text-[11px]">2</span>
                  <span>无效订单过滤与原始留痕</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>排除 Cancelled</strong>: 平台取消订单彻底剔除出有效销售。<br />
                  • <strong>排除 Unit Price = 0</strong>: 多渠道配送及赠品等非正常零售数据隔离。<br />
                  • 原始记录 Raw Data 永久完好保存于数据库，提供排除溯源。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-amber-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-center leading-5 text-[11px]">3</span>
                  <span>发货数量统一核算口径</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>最终销售额 (finalSales)</strong> = 实际发货数量 × 商品单价。<br />
                  • <strong>最终销量 (salesQuantity)</strong> = 实际发货数量。<br />
                  • 当订购数量 ≠ 发货数量时，自动按实际发货纠偏并生成修正明细。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-emerald-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-center leading-5 text-[11px]">4</span>
                  <span>成本与基础毛利标准</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>销售成本 (salesCost)</strong> = 实际发货数量 × 单件商品成本。<br />
                  • <strong>基础毛利 (basicGrossProfit)</strong> = 最终销售额 - 销售成本。<br />
                  • 基础毛利率 = 基础毛利 ÷ 最终销售额 (未扣除Walmart佣金与WFS费用)。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Logs */}
        {activeTab === 'logs' && (
          <div className="p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">数据处理与解析日志</h3>
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">暂无处理日志。</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-700 border-b border-slate-200 pb-2 mb-2 font-sans">
                      <span className="font-bold text-blue-700">{log.fileName}</span>
                      <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        总Sheet数: <span className="text-slate-900 font-bold">{log.totalSheets}</span>
                      </div>
                      <div>
                        识别订单Sheet: <span className="text-emerald-700 font-bold">{log.detectedOrderSheets.join(', ')}</span>
                      </div>
                      <div>
                        原始记录: <span className="text-slate-900 font-bold">{log.rawCount}</span>
                      </div>
                      <div>
                        有效纳入销售: <span className="text-emerald-700 font-bold">{log.validSalesCount}</span>
                      </div>
                      <div>
                        Cancelled排除: <span className="text-rose-700 font-bold">{log.cancelledCount}</span>
                      </div>
                      <div>
                        单价=0排除: <span className="text-slate-700 font-bold">{log.zeroPriceCount}</span>
                      </div>
                      <div>
                        数量不一致修正: <span className="text-amber-700 font-bold">{log.qtyMismatchCount}</span>
                      </div>
                      <div>
                        销售额总计: <span className="text-emerald-700 font-bold">${log.totalSalesAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Mapping Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="text-sm font-bold text-slate-900">添加产品映射</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <form onSubmit={submitNewMapping} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Walmart 销售SKU (线上商品SKU)</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.sku}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, sku: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-mono focus:bg-white"
                  placeholder="如: PET1005-XS-BLK"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-medium">所属 SPU</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.spu}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, spu: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-mono focus:bg-white"
                  placeholder="如: PET1005"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-medium">产品类型 (Category)</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.productType}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, productType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 focus:bg-white"
                  placeholder="如: Harness"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-slate-700"
                >
                  取消
                </button>
                <button type="submit" className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700">
                  保存映射
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
