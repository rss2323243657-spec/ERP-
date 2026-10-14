import React, { useState, useMemo } from 'react';
import {
  Layers,
  Calendar,
  Tag,
  Box,
  Hash,
  ArrowUpDown,
  Search,
  Filter,
  Download,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Plus,
  Check,
  X,
  Clock,
  Eye,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { StandardSalesRecord, ProductCompareItem } from '../types/sales';
import { computeProductMultiComparison } from '../services/dataProcessor';
import { exportToXLSX, exportToCSV } from '../services/exporter';
import { ProductAnalyticsCharts } from './ProductAnalyticsCharts';

interface ProductMultiAnalysisProps {
  allRecords: StandardSalesRecord[];
  onSelectSkuForDrillDown?: (sku: string) => void;
}

export const ProductMultiAnalysis: React.FC<ProductMultiAnalysisProps> = ({
  allRecords,
  onSelectSkuForDrillDown,
}) => {
  // 1. Dedicated Time Dimension State
  const [granularity, setGranularity] = useState<'month' | 'week' | 'quarter' | 'year' | 'custom'>('year');
  // Modes: 'yoy' (Dual YoY, default), 'mom' (Dual MoM), 'customRange' (Free date range)
  const [compMode, setCompMode] = useState<'yoy' | 'mom' | 'customRange'>('yoy');

  // Column layout for multi-period table: 'metricFirst' (Default, sales metrics compared across periods) vs 'periodFirst'
  const [columnLayout, setColumnLayout] = useState<'metricFirst' | 'periodFirst'>('metricFirst');

  // Base Period (the benchmark, e.g. 2026 or 2026-09)
  const [basePeriod, setBasePeriod] = useState<string>('');

  // Dual comparison fallback (for yoy / mom)
  const [customCompPeriod, setCustomCompPeriod] = useState<string>('');
  const [customBaseRange, setCustomBaseRange] = useState<[string, string]>(['', '']);
  const [customCompRange, setCustomCompRange] = useState<[string, string]>(['', '']);

  // MULTI-TARGET COMPARISON: Selected periods array (e.g. ['2026', '2025', '2024'])
  const [selectedMultiPeriods, setSelectedMultiPeriods] = useState<string[]>([]);
  const [showMultiPicker, setShowMultiPicker] = useState(false);

  // 2. Drill-down Hierarchy State
  const [activeLevel, setActiveLevel] = useState<'category' | 'spu' | 'sku'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSpu, setSelectedSpu] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 3. Optional Column Visibility Config (Mandatory: Qty, Sales, ASP always shown)
  const [visibleColumns, setVisibleColumns] = useState<{
    cost: boolean;
    profit: boolean;
    margin: boolean;
    orders: boolean;
  }>({
    cost: false,
    profit: true,
    margin: true,
    orders: false,
  });
  const [showColSettings, setShowColSettings] = useState(false);

  // 4. Sorting
  const [sortField, setSortField] = useState<string>('currSales');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination for all tables (Requirement 3: Default 20 rows per page, selectable dropdown)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Helper to compute expected YoY key (exact same period in prior year)
  const getExpectedYoyKey = (base: string, gran: string): string => {
    if (!base) return '';
    if (gran === 'quarter') {
      const parts = base.split('-Q');
      if (parts.length === 2) {
        return `${parseInt(parts[0], 10) - 1}-Q${parts[1]}`;
      }
    } else if (gran === 'month') {
      const parts = base.split('-');
      if (parts.length === 2) {
        return `${parseInt(parts[0], 10) - 1}-${parts[1]}`;
      }
    } else if (gran === 'week') {
      const parts = base.split('-W');
      if (parts.length === 2) {
        return `${parseInt(parts[0], 10) - 1}-W${parts[1]}`;
      }
    } else if (gran === 'year') {
      return String(parseInt(base, 10) - 1);
    }
    return '';
  };

  // Helper to compute expected MoM key (immediate preceding sequential period)
  const getExpectedMomKey = (base: string, gran: string): string => {
    if (!base) return '';
    if (gran === 'quarter') {
      const parts = base.split('-Q');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const q = parseInt(parts[1], 10);
        return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
      }
    } else if (gran === 'month') {
      const parts = base.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      }
    } else if (gran === 'week') {
      const parts = base.split('-W');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const w = parseInt(parts[1], 10);
        return w === 1 ? `${y - 1}-W52` : `${y}-W${String(w - 1).padStart(2, '0')}`;
      }
    } else if (gran === 'year') {
      return String(parseInt(base, 10) - 1);
    }
    return '';
  };

  // Compute all available periods in the records first
  const initialComparison = useMemo(() => {
    return computeProductMultiComparison(allRecords, granularity, '', '');
  }, [allRecords, granularity]);

  const availablePeriods = initialComparison.availablePeriods;

  // Auto-select latest period as basePeriod if empty
  const activeBasePeriod = useMemo(() => {
    if (basePeriod && availablePeriods.some((p) => p.key === basePeriod)) {
      return basePeriod;
    }
    return availablePeriods[0]?.key || '';
  }, [basePeriod, availablePeriods]);

  // Determine compare period key for dual mode (Requirement 2: Strictly distinguish YoY vs MoM)
  const activeCompPeriod = useMemo(() => {
    if (!activeBasePeriod) return '';
    if (compMode === 'customRange') return '';

    // If user explicitly chose a comparison period from dropdown, check compatibility with YoY / MoM
    if (customCompPeriod && availablePeriods.some((p) => p.key === customCompPeriod)) {
      if (compMode === 'yoy') {
        const baseYear = parseInt(activeBasePeriod.split(/[-QW]/)[0], 10);
        const compYear = parseInt(customCompPeriod.split(/[-QW]/)[0], 10);
        // Strictly require prior year for YoY mode - never allow same-year period as YoY!
        if (!isNaN(baseYear) && !isNaN(compYear) && compYear < baseYear) {
          return customCompPeriod;
        }
      } else {
        return customCompPeriod;
      }
    }

    if (compMode === 'yoy') {
      // Find same period in previous year
      const yoyKey = getExpectedYoyKey(activeBasePeriod, granularity);
      if (yoyKey && availablePeriods.some((p) => p.key === yoyKey)) {
        return yoyKey;
      }
      // If exact last year not found, check older years with same quarter/month/week
      if (granularity === 'quarter') {
        const qPart = activeBasePeriod.split('-Q')[1];
        if (qPart) {
          const match = availablePeriods.find((p) => p.key.endsWith(`-Q${qPart}`) && p.key !== activeBasePeriod);
          if (match) return match.key;
        }
      } else if (granularity === 'month') {
        const mPart = activeBasePeriod.split('-')[1];
        if (mPart) {
          const match = availablePeriods.find((p) => p.key.endsWith(`-${mPart}`) && p.key !== activeBasePeriod);
          if (match) return match.key;
        }
      } else if (granularity === 'week') {
        const wPart = activeBasePeriod.split('-W')[1];
        if (wPart) {
          const match = availablePeriods.find((p) => p.key.endsWith(`-W${wPart}`) && p.key !== activeBasePeriod);
          if (match) return match.key;
        }
      }
      // Strictly avoid fallback to availablePeriods[1] (which is MoM)! Return empty so user is clearly notified
      return '';
    }

    if (compMode === 'mom') {
      const momKey = getExpectedMomKey(activeBasePeriod, granularity);
      if (momKey && availablePeriods.some((p) => p.key === momKey)) {
        return momKey;
      }
      // Fallback to chronologically immediate preceding period in availablePeriods
      const curIdx = availablePeriods.findIndex((p) => p.key === activeBasePeriod);
      if (curIdx >= 0 && curIdx + 1 < availablePeriods.length) {
        return availablePeriods[curIdx + 1].key;
      }
      return '';
    }

    if (selectedMultiPeriods.length > 0) {
      const other = selectedMultiPeriods.find((p) => p !== activeBasePeriod);
      if (other) return other;
    }

    return '';
  }, [activeBasePeriod, compMode, customCompPeriod, availablePeriods, granularity, selectedMultiPeriods]);

  // Compute effective comparison periods:
  // If user has chosen specific periods via checkboxes, use those (always ensuring base is included).
  // Otherwise default to the dual period pair [activeBasePeriod, activeCompPeriod].
  const effectiveMultiPeriods = useMemo(() => {
    if (selectedMultiPeriods.length > 0) {
      const filtered = selectedMultiPeriods.filter((k) => availablePeriods.some((p) => p.key === k));
      if (!filtered.includes(activeBasePeriod) && activeBasePeriod) {
        return [activeBasePeriod, ...filtered];
      }
      return filtered.length > 0 ? filtered : [activeBasePeriod, activeCompPeriod].filter(Boolean);
    }
    return [activeBasePeriod, activeCompPeriod].filter(Boolean);
  }, [selectedMultiPeriods, availablePeriods, activeBasePeriod, activeCompPeriod]);

  // Once user has 3 or more periods, automatically becomes multi-period comparison
  const isMultiPeriod = effectiveMultiPeriods.length > 2;

  // Execute full comparison computation with multiPeriodKeys passed
  const comparisonResult = useMemo(() => {
    return computeProductMultiComparison(
      allRecords,
      granularity,
      activeBasePeriod,
      activeCompPeriod,
      customBaseRange,
      customCompRange,
      isMultiPeriod ? effectiveMultiPeriods : [activeBasePeriod, activeCompPeriod].filter(Boolean)
    );
  }, [
    allRecords,
    granularity,
    activeBasePeriod,
    activeCompPeriod,
    customBaseRange,
    customCompRange,
    isMultiPeriod,
    effectiveMultiPeriods,
  ]);

  // Base Period & Comp Period Labels
  const baseLabel = useMemo(() => {
    const found = availablePeriods.find((p) => p.key === activeBasePeriod);
    return found ? `${found.label} ${found.subLabel ? `(${found.subLabel})` : ''}` : activeBasePeriod || '基准期';
  }, [availablePeriods, activeBasePeriod]);

  const compLabel = useMemo(() => {
    const found = availablePeriods.find((p) => p.key === activeCompPeriod);
    return found ? `${found.label} ${found.subLabel ? `(${found.subLabel})` : ''}` : activeCompPeriod || '无对比基期';
  }, [availablePeriods, activeCompPeriod]);

  // Helper toggle for multi-period selection
  const handleToggleMultiPeriod = (key: string) => {
    if (effectiveMultiPeriods.includes(key)) {
      if (effectiveMultiPeriods.length <= 1) return; // Keep at least one period
      setSelectedMultiPeriods(effectiveMultiPeriods.filter((k) => k !== key));
    } else {
      setSelectedMultiPeriods([...effectiveMultiPeriods, key]);
    }
  };

  // Filter items according to drill-down category & SPU & search
  const filteredCategories = useMemo(() => {
    let list = comparisonResult.categories;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c) => c.label.toLowerCase().includes(term));
    }
    return list;
  }, [comparisonResult.categories, searchTerm]);

  const filteredSpus = useMemo(() => {
    let list = comparisonResult.spus;
    if (selectedCategory) {
      list = list.filter((s) => s.productType === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.label.toLowerCase().includes(term) ||
          (s.productType || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [comparisonResult.spus, selectedCategory, searchTerm]);

  const filteredSkus = useMemo(() => {
    let list = comparisonResult.skus;
    if (selectedCategory) {
      list = list.filter((s) => s.productType === selectedCategory);
    }
    if (selectedSpu) {
      list = list.filter((s) => s.SPU === selectedSpu);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          (s.onlineProductSKU || '').toLowerCase().includes(term) ||
          (s.internalSKU || '').toLowerCase().includes(term) ||
          (s.SPU || '').toLowerCase().includes(term) ||
          (s.productType || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [comparisonResult.skus, selectedCategory, selectedSpu, searchTerm]);

  // Sorting function
  const sortItems = (items: ProductCompareItem[]) => {
    return [...items].sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];

      // Support dynamic period column sorting
      if (sortField.startsWith('p_sales_')) {
        const pKey = sortField.replace('p_sales_', '');
        aVal = a.periodData?.[pKey]?.sales || 0;
        bVal = b.periodData?.[pKey]?.sales || 0;
      } else if (sortField.startsWith('p_qty_')) {
        const pKey = sortField.replace('p_qty_', '');
        aVal = a.periodData?.[pKey]?.qty || 0;
        bVal = b.periodData?.[pKey]?.qty || 0;
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  };

  const sortedCategories = useMemo(() => sortItems(filteredCategories), [filteredCategories, sortField, sortAsc]);
  const sortedSpus = useMemo(() => sortItems(filteredSpus), [filteredSpus, sortField, sortAsc]);
  const sortedSkus = useMemo(() => sortItems(filteredSkus), [filteredSkus, sortField, sortAsc]);

  const currentLevelItems = useMemo(() => {
    if (activeLevel === 'category') return sortedCategories;
    if (activeLevel === 'spu') return sortedSpus;
    return sortedSkus;
  }, [activeLevel, sortedCategories, sortedSpus, sortedSkus]);

  const effectivePageSize = pageSize === 99999 ? Math.max(currentLevelItems.length, 1) : pageSize;
  const totalPages = Math.ceil(currentLevelItems.length / effectivePageSize) || 1;

  const pagedItems = useMemo(() => {
    if (pageSize === 99999) return currentLevelItems;
    const start = (currentPage - 1) * pageSize;
    return currentLevelItems.slice(start, start + pageSize);
  }, [currentLevelItems, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Helper renderers for numbers and rates
  const renderMoney = (val: number) =>
    `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderGrowthBadge = (rate: number | null | undefined, diff?: number, isCurrency = false) => {
    if (rate === null || rate === undefined || isNaN(rate)) {
      return <span className="text-[11px] text-slate-400 font-mono">-</span>;
    }
    const isPos = rate > 0;
    const isZero = rate === 0;
    const diffStr = diff !== undefined
      ? (isCurrency
        ? `${isPos ? '+' : ''}$${Math.abs(diff).toFixed(2)}`
        : `${isPos ? '+' : ''}${diff.toLocaleString()}`)
      : null;

    if (isZero) {
      return <span className="text-[11px] text-slate-400 font-mono">0.0%</span>;
    }

    return (
      <div className={`inline-flex flex-col text-right font-mono text-[11px] ${
        isPos ? 'text-emerald-700' : 'text-rose-700'
      }`}>
        <span className="font-semibold flex items-center justify-end">
          {isPos ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
          {isPos ? '+' : ''}{(rate * 100).toFixed(1)}%
        </span>
        {diffStr && <span className="text-[10px] opacity-75">{diffStr}</span>}
      </div>
    );
  };

  // Export comparison table
  const handleExportComparison = (fmt: 'xlsx' | 'csv') => {
    const dataToExport = activeLevel === 'category'
      ? sortedCategories
      : activeLevel === 'spu'
      ? sortedSpus
      : sortedSkus;

    const formatted = dataToExport.map((item, idx) => {
      const row: Record<string, any> = {
        排名: idx + 1,
        分析对象: item.label,
        线上商品SKU: item.onlineProductSKU || '',
        内部SKU: item.internalSKU || '',
        SPU: item.SPU || '',
        产品类型: item.productType || '',
      };

      // Add columns for each period in multi-period mode
      if (isMultiPeriod) {
        effectiveMultiPeriods.forEach((pk) => {
          const pd = item.periodData?.[pk];
          row[`[${pk}]销量`] = pd?.qty || 0;
          row[`[${pk}]销售额`] = pd?.sales || 0;
          row[`[${pk}]客单价`] = pd?.asp || 0;
          if (pk !== activeBasePeriod) {
            row[`[${pk}]较基准增长率`] = pd?.growthSalesFromBase != null ? (pd.growthSalesFromBase * 100).toFixed(2) + '%' : '-';
          }
        });
      } else {
        row['本期销量'] = item.currQty;
        row['对比期销量'] = item.compQty;
        row['销量增减率'] = item.growthQtyRate !== null ? (item.growthQtyRate * 100).toFixed(2) + '%' : '';
        row['本期销售额'] = item.currSales;
        row['对比期销售额'] = item.compSales;
        row['销售额增减率'] = item.growthSalesRate !== null ? (item.growthSalesRate * 100).toFixed(2) + '%' : '';
        row['本期客单价ASP'] = item.currAsp;
        row['对比期客单价ASP'] = item.compAsp;
      }

      row['本期基础毛利'] = item.currProfit;
      row['本期毛利率'] = (item.currMargin * 100).toFixed(2) + '%';
      return row;
    });

    const filename = `Walmart_产品多维对比分析_${activeLevel}_${effectiveMultiPeriods.join('_vs_')}`;
    if (fmt === 'xlsx') {
      exportToXLSX(formatted, filename, 'Multi_Product_Comparison');
    } else {
      exportToCSV(formatted, filename);
    }
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* MODULE 1: PRODUCT SALES ANALYTICS CHART GROUP (REQUIREMENT 2) */}
      {/* With independent time dimension: 7d, 30d, month, quarter, year */}
      {/* ======================================================== */}
      <ProductAnalyticsCharts
        allRecords={allRecords}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setActiveLevel('spu');
        }}
        onSelectSpu={(spu) => {
          setSelectedSpu(spu);
          setActiveLevel('sku');
          setCurrentPage(1);
        }}
      />

      {/* ======================================================== */}
      {/* MODULE 2: MULTI-PERIOD COMPARISON & DRILLDOWN TABLE (REQUIREMENT 1) */}
      {/* Free multi-period selection: 2026 vs 2025 vs 2024 (3+ periods) */}
      {/* ======================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-150">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                多周期对比与明细
              </h3>
              <span
                title="支持同比(YoY)、环比(MoM)及自由勾选多期同台对比；默认展示销量、销售额、客单价等核心指标"
                className="cursor-pointer text-slate-400 hover:text-blue-600"
              >
                <Info className="w-3.5 h-3.5 inline" />
              </span>
              {isMultiPeriod && (
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200 font-mono">
                  已开启多期对比 ({effectiveMultiPeriods.length}期)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExportComparison('xlsx')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>导出对比表 (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* 1. Comparison Configuration Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          {/* Time Granularity */}
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">时间对比粒度</label>
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 w-full justify-between">
              {(
                [
                  { id: 'year', label: '年度' },
                  { id: 'quarter', label: '季度' },
                  { id: 'month', label: '月度' },
                  { id: 'week', label: '自然周' },
                  { id: 'custom', label: '自定义' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setGranularity(item.id);
                    setBasePeriod('');
                    setCustomCompPeriod('');
                    setSelectedMultiPeriods([]);
                  }}
                  className={`flex-1 py-1 text-center rounded-md font-medium cursor-pointer transition-all ${
                    granularity === item.id
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Mode Choice */}
          <div>
            <label className="block text-slate-600 font-medium mb-1.5 flex items-center justify-between">
              <span>比对模式</span>
              {isMultiPeriod && (
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                  多期对比 ({effectiveMultiPeriods.length}期)
                </span>
              )}
            </label>
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 w-full justify-between">
              <button
                onClick={() => {
                  setCompMode('yoy');
                  setCustomCompPeriod('');
                  setSelectedMultiPeriods([]);
                }}
                className={`flex-1 py-1 text-center rounded-md font-medium cursor-pointer transition-all ${
                  compMode === 'yoy' && !isMultiPeriod
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : compMode === 'yoy' && isMultiPeriod
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="同比 (YoY)：与上年同季度/同月份/同周/同年度对比"
              >
                同比 (YoY)
              </button>
              <button
                onClick={() => {
                  setCompMode('mom');
                  setCustomCompPeriod('');
                  setSelectedMultiPeriods([]);
                }}
                className={`flex-1 py-1 text-center rounded-md font-medium cursor-pointer transition-all ${
                  compMode === 'mom' && !isMultiPeriod
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : compMode === 'mom' && isMultiPeriod
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="环比 (MoM)：与上一连续季度/上一月份/上一周对比"
              >
                环比 (MoM)
              </button>
            </div>
          </div>

          {/* Base Benchmark Period */}
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">
              主基准期 (以其作为增减比对基础)
            </label>
            <select
              value={activeBasePeriod}
              onChange={(e) => {
                setBasePeriod(e.target.value);
                setCustomCompPeriod('');
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {availablePeriods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} {p.subLabel ? `(${p.subLabel})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Period / Multi-Period Selector */}
          <div>
            {!isMultiPeriod ? (
              <div>
                <label className="block text-slate-600 font-medium mb-1.5 flex items-center justify-between">
                  <span>对比期 ({compMode === 'yoy' ? '同比' : '环比'})</span>
                  <button
                    type="button"
                    onClick={() => setShowMultiPicker(true)}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    + 开启多期对比
                  </button>
                </label>
                <select
                  value={activeCompPeriod}
                  onChange={(e) => setCustomCompPeriod(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer ${
                    !activeCompPeriod && compMode === 'yoy'
                      ? 'border-amber-400 text-amber-800 bg-amber-50'
                      : 'border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {!activeCompPeriod && compMode === 'yoy' ? (
                    <option value="">(无上年同期，请手动选择或换环比)</option>
                  ) : null}
                  {availablePeriods
                    .filter((p) => p.key !== activeBasePeriod)
                    .map((p) => {
                      const isYoy = p.key === getExpectedYoyKey(activeBasePeriod, granularity);
                      const isMom = p.key === getExpectedMomKey(activeBasePeriod, granularity);
                      return (
                        <option key={p.key} value={p.key}>
                          {p.label} {isYoy ? '★ [YoY 同比上年]' : isMom ? '★ [MoM 环比上期]' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-600 font-medium mb-1.5 flex items-center justify-between">
                  <span>参评周期 ({effectiveMultiPeriods.length} 个)</span>
                  <button
                    onClick={() => {
                      setSelectedMultiPeriods([]);
                      setShowMultiPicker(false);
                    }}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    恢复双期对比
                  </button>
                </label>

                <div className="relative">
                  <div
                    onClick={() => setShowMultiPicker(!showMultiPicker)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:border-blue-400"
                  >
                    <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
                      {effectiveMultiPeriods.map((pk) => (
                        <span
                          key={pk}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold whitespace-nowrap ${
                            pk === activeBasePeriod
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {pk} {pk === activeBasePeriod && '(基准)'}
                        </span>
                      ))}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Period Floating Modal / Dropdown */}
            {showMultiPicker && (
              <div className="absolute right-6 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-xs space-y-1 max-h-64 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-700 pb-1.5 mb-1 border-b border-slate-150 flex items-center justify-between">
                  <span>勾选参评周期 (自由扩展多期比对)</span>
                  <button
                    onClick={() => setShowMultiPicker(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                {availablePeriods.map((p) => {
                  const isChecked = effectiveMultiPeriods.includes(p.key);
                  return (
                    <div
                      key={p.key}
                      onClick={() => handleToggleMultiPeriod(p.key)}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>{p.label}</span>
                      </div>
                      {p.key === activeBasePeriod && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono">
                          基准
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Clear Alert Banner when YoY does not have a prior year match in database */}
        {compMode === 'yoy' && !activeCompPeriod && !isMultiPeriod && (
          <div className="bg-amber-50 border border-amber-250 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                基准期【{activeBasePeriod}】未检索到上年同期数据 (YoY同比需对应上年同季/同月，如 {getExpectedYoyKey(activeBasePeriod, granularity)})
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                当前数据源中暂未找到该周期的去年同期记录。您可以：
                <button
                  type="button"
                  onClick={() => {
                    setCompMode('mom');
                    setCustomCompPeriod('');
                  }}
                  className="font-bold underline text-blue-700 hover:text-blue-900 mx-1 cursor-pointer"
                >
                  一键切换为环比 (MoM)
                </button>
                对比上期表现，或在上方对比期下拉框手动指定历史周期。
              </p>
            </div>
          </div>
        )}

        {/* Custom Range Date Pickers for Product Multi-Analysis (Requirement 4) */}
        {granularity === 'custom' && (
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 text-xs grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="font-semibold text-slate-800 block mb-1">【基准期】自定义时间范围:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={customBaseRange[0]}
                  onChange={(e) => setCustomBaseRange([e.target.value, customBaseRange[1]])}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs"
                />
                <span className="text-slate-400">至</span>
                <input
                  type="date"
                  value={customBaseRange[1]}
                  onChange={(e) => setCustomBaseRange([customBaseRange[0], e.target.value])}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs"
                />
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block mb-1">【对比期】自定义时间范围:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={customCompRange[0]}
                  onChange={(e) => setCustomCompRange([e.target.value, customCompRange[1]])}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs"
                />
                <span className="text-slate-400">至</span>
                <input
                  type="date"
                  value={customCompRange[1]}
                  onChange={(e) => setCustomCompRange([customCompRange[0], e.target.value])}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Current Active Comparison Period Indicator Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-700">
            <span className="font-medium text-slate-500">已选周期:</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {isMultiPeriod ? (
                effectiveMultiPeriods.map((pk) => (
                  <span
                    key={pk}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-semibold font-mono text-xs ${
                      pk === activeBasePeriod
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    <span>{pk}</span>
                    {pk === activeBasePeriod && <span className="text-[10px] opacity-75">(基准)</span>}
                  </span>
                ))
              ) : (
                <>
                  <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded border border-blue-200 font-mono font-semibold">
                    【本期】{baseLabel}
                  </span>
                  <span className="text-slate-400 font-bold">VS</span>
                  <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200 font-mono font-semibold">
                    【对比期】{compLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Layout Mode Toggle (Requirement 6) */}
            {isMultiPeriod && (
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  onClick={() => setColumnLayout('metricFirst')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    columnLayout === 'metricFirst'
                      ? 'bg-white text-blue-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="按照销量、销售额、客单价等销售指标横向对比各年度/周期（推荐）"
                >
                  按指标对比周期 (默认)
                </button>
                <button
                  onClick={() => setColumnLayout('periodFirst')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    columnLayout === 'periodFirst'
                      ? 'bg-white text-blue-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="按照年度/周期顺序依次排布销售指标"
                >
                  按周期对比指标
                </button>
              </div>
            )}

            {/* Column Display Configurator Button */}
            <div className="relative">
              <button
                onClick={() => setShowColSettings(!showColSettings)}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>指标显示设置</span>
              </button>

            {showColSettings && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 z-40 text-xs space-y-2.5">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                  自定义明细展示列配置
                </div>
                <div className="space-y-2 text-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">默认核心必须显示项（锁定）:</div>
                  <label className="flex items-center space-x-2 text-slate-500 cursor-not-allowed">
                    <input type="checkbox" checked disabled className="rounded text-blue-600" />
                    <span className="font-semibold text-slate-700">销量 (Sales Quantity)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-500 cursor-not-allowed">
                    <input type="checkbox" checked disabled className="rounded text-blue-600" />
                    <span className="font-semibold text-slate-700">销售额 (Final Sales $)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-500 cursor-not-allowed">
                    <input type="checkbox" checked disabled className="rounded text-blue-600" />
                    <span className="font-semibold text-slate-700">客单价 / 平均售价 (ASP $)</span>
                  </label>

                  <div className="text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
                    可选附加展示指标:
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.profit}
                      onChange={(e) => setVisibleColumns((p) => ({ ...p, profit: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>基础毛利 (Gross Profit $)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.margin}
                      onChange={(e) => setVisibleColumns((p) => ({ ...p, margin: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>基础毛利率 (Gross Margin %)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.cost}
                      onChange={(e) => setVisibleColumns((p) => ({ ...p, cost: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>销售成本 (Sales Cost $)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.orders}
                      onChange={(e) => setVisibleColumns((p) => ({ ...p, orders: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>订单笔数 (Order Count)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* 2. MACRO COMPARISON SUMMARY CARDS (Multi-Period Aware) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Total Final Sales Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>基准期销售额 [{activeBasePeriod}]</span>
              <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                finalSales
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
              {renderMoney(comparisonResult.macro.currSales)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>对比期: {renderMoney(comparisonResult.macro.compSales)}</span>
              {renderGrowthBadge(
                comparisonResult.macro.growthSales,
                comparisonResult.macro.diffSales,
                true
              )}
            </div>
          </div>

          {/* Total Sales Quantity Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>基准期出库销量 [{activeBasePeriod}]</span>
              <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                salesQuantity
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
              {comparisonResult.macro.currQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">件</span>
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>对比期: {comparisonResult.macro.compQty.toLocaleString()} 件</span>
              {renderGrowthBadge(
                comparisonResult.macro.growthQty,
                comparisonResult.macro.diffQty
              )}
            </div>
          </div>

          {/* Average Selling Price (ASP) Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>基准期平均售价 (ASP)</span>
              <span className="font-mono text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                ASP
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-700 mt-1.5">
              ${comparisonResult.macro.currAsp.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>对比期: ${comparisonResult.macro.compAsp.toFixed(2)}</span>
              {renderGrowthBadge(
                comparisonResult.macro.growthAsp,
                comparisonResult.macro.diffAsp,
                true
              )}
            </div>
          </div>

          {/* Gross Margin Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>基准期基础毛利率</span>
              <span className="font-mono text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Gross Margin
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1.5">
              {(comparisonResult.macro.currMargin * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>对比期: {(comparisonResult.macro.compMargin * 100).toFixed(2)}%</span>
              <span className={`font-mono font-semibold ${
                comparisonResult.macro.diffMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {comparisonResult.macro.diffMargin >= 0 ? '+' : ''}
                {comparisonResult.macro.diffMargin.toFixed(1)} pct
              </span>
            </div>
          </div>
        </div>

        {/* 3. DRILL-DOWN HIERARCHY TABS & BREADCRUMB */}
        <div className="pt-2">
          {/* Sub-tabs Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-150">
            <div className="flex items-center space-x-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  onClick={() => setActiveLevel('category')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                    activeLevel === 'category'
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>一级：产品类型 ({filteredCategories.length})</span>
                </button>
                <button
                  onClick={() => setActiveLevel('spu')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                    activeLevel === 'spu'
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>二级：SPU 编码 ({filteredSpus.length})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveLevel('sku');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                    activeLevel === 'sku'
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>三级：Walmart销售SKU ({filteredSkus.length})</span>
                </button>
              </div>
            </div>

            {/* In-table Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索产品类型 / SPU / 线上SKU / 内部SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-250 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>

          {/* Drill-Down Breadcrumbs Navigation */}
          <div className="flex items-center space-x-2 text-xs bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200 mb-3">
            <span className="text-slate-500 font-medium">当前下钻路径:</span>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSpu(null);
              }}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              全店产品
            </button>

            {selectedCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="inline-flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                  <Tag className="w-3 h-3 text-indigo-600" />
                  <span>类别: {selectedCategory}</span>
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedSpu(null);
                    }}
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              </>
            )}

            {selectedSpu && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="inline-flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                  <Box className="w-3 h-3 text-emerald-600" />
                  <span>SPU: {selectedSpu}</span>
                  <button
                    onClick={() => setSelectedSpu(null)}
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              </>
            )}

            {(selectedCategory || selectedSpu) && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedSpu(null);
                }}
                className="text-slate-400 hover:text-slate-700 ml-auto flex items-center space-x-1 text-[11px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置下钻</span>
              </button>
            )}
          </div>

          {/* 4. COMPARISON DATA TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-10 text-center">#</th>
                  <th
                    onClick={() => handleSort('label')}
                    className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{activeLevel === 'category' ? '产品类型' : activeLevel === 'spu' ? 'SPU 编号' : 'Walmart销售SKU (线上商品SKU)'}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* MULTI-PERIOD COLUMNS (In Multi-Period Mode) */}
                  {isMultiPeriod && columnLayout === 'metricFirst' ? (
                    <>
                      {/* 1. Sales Quantity Metric Group */}
                      {effectiveMultiPeriods.map((pk) => {
                        const isBase = pk === activeBasePeriod;
                        return (
                          <th
                            key={`h_qty_${pk}`}
                            onClick={() => handleSort(`p_qty_${pk}`)}
                            className={`py-2 px-2 font-semibold text-right cursor-pointer hover:text-slate-900 ${
                              isBase ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-end space-x-0.5">
                              <span>[{pk}] 销量</span>
                              <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                          </th>
                        );
                      })}
                      <th className="py-2 px-2 font-semibold text-right text-slate-600 border-r border-slate-200">
                        销量变动
                      </th>

                      {/* 2. Final Sales Metric Group */}
                      {effectiveMultiPeriods.map((pk) => {
                        const isBase = pk === activeBasePeriod;
                        return (
                          <th
                            key={`h_sales_${pk}`}
                            onClick={() => handleSort(`p_sales_${pk}`)}
                            className={`py-2 px-2 font-semibold text-right cursor-pointer hover:text-slate-900 ${
                              isBase ? 'bg-blue-100/70 text-blue-900 font-bold' : 'text-blue-900 font-semibold'
                            }`}
                          >
                            <div className="flex items-center justify-end space-x-0.5">
                              <span>[{pk}] 销售额</span>
                              <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                          </th>
                        );
                      })}
                      <th className="py-2 px-2 font-semibold text-right text-blue-900 border-r border-slate-200">
                        较基期变动
                      </th>

                      {/* 3. ASP Metric Group */}
                      {effectiveMultiPeriods.map((pk) => {
                        const isBase = pk === activeBasePeriod;
                        return (
                          <th
                            key={`h_asp_${pk}`}
                            className={`py-2 px-2 font-semibold text-right ${
                              isBase ? 'bg-amber-50 text-amber-900 font-bold' : 'text-slate-600'
                            }`}
                          >
                            [{pk}] ASP
                          </th>
                        );
                      })}

                      {/* Optional Metrics */}
                      {visibleColumns.profit &&
                        effectiveMultiPeriods.map((pk) => (
                          <th key={`h_prof_${pk}`} className="py-2 px-2 font-semibold text-right text-emerald-800">
                            [{pk}] 毛利
                          </th>
                        ))}
                      {visibleColumns.margin &&
                        effectiveMultiPeriods.map((pk) => (
                          <th key={`h_marg_${pk}`} className="py-2 px-2 font-semibold text-right text-emerald-800">
                            [{pk}] 毛利率
                          </th>
                        ))}
                      {visibleColumns.cost &&
                        effectiveMultiPeriods.map((pk) => (
                          <th key={`h_cost_${pk}`} className="py-2 px-2 font-semibold text-right text-slate-600">
                            [{pk}] 成本
                          </th>
                        ))}
                      {visibleColumns.orders &&
                        effectiveMultiPeriods.map((pk) => (
                          <th key={`h_ord_${pk}`} className="py-2 px-2 font-semibold text-right text-slate-600">
                            [{pk}] 订单
                          </th>
                        ))}
                    </>
                  ) : isMultiPeriod && columnLayout === 'periodFirst' ? (
                    effectiveMultiPeriods.map((pk) => {
                      const isBase = pk === activeBasePeriod;
                      return (
                        <React.Fragment key={pk}>
                          {/* Sales Column */}
                          <th
                            onClick={() => handleSort(`p_sales_${pk}`)}
                            className={`py-2.5 px-2.5 font-semibold text-right cursor-pointer hover:text-slate-900 ${
                              isBase ? 'bg-blue-50/70 text-blue-900 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center justify-end space-x-0.5">
                              <span>[{pk}] 销售额</span>
                              <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                          </th>
                          {/* Qty Column */}
                          <th
                            onClick={() => handleSort(`p_qty_${pk}`)}
                            className={`py-2.5 px-2.5 font-semibold text-right cursor-pointer hover:text-slate-900 ${
                              isBase ? 'bg-blue-50/50 text-blue-900' : 'text-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-end space-x-0.5">
                              <span>[{pk}] 销量</span>
                              <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                            </div>
                          </th>
                          {/* ASP Column */}
                          <th
                            className={`py-2.5 px-2 font-semibold text-right ${
                              isBase ? 'bg-blue-50/30 text-amber-900 font-bold' : 'text-slate-500'
                            }`}
                          >
                            [{pk}] ASP
                          </th>
                          {/* Growth from base (if not base) */}
                          {!isBase && (
                            <th className="py-2.5 px-2 font-semibold text-right text-slate-600">
                              较[{activeBasePeriod}]变动
                            </th>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    /* DUAL MODE COLUMNS (YoY / MoM) */
                    <>
                      {/* 1. Mandatory: Sales Quantity */}
                      <th
                        onClick={() => handleSort('currQty')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-slate-900 font-bold">本期销量</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right text-slate-500">
                        对比期销量
                      </th>
                      <th
                        onClick={() => handleSort('growthQtyRate')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>销量增减(%)</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>

                      {/* 2. Mandatory: Final Sales Amount */}
                      <th
                        onClick={() => handleSort('currSales')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900 bg-blue-50/50"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-blue-800 font-bold">本期销售额 ($)</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right text-slate-500 bg-blue-50/30">
                        对比期销售额 ($)
                      </th>
                      <th
                        onClick={() => handleSort('growthSalesRate')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900 bg-blue-50/50"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-blue-800">销售额增减(%)</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>

                      {/* 3. Mandatory: Average Selling Price ASP */}
                      <th
                        onClick={() => handleSort('currAsp')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900 bg-amber-50/40"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-amber-800 font-bold">本期客单价ASP</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right text-slate-500 bg-amber-50/20">
                        对比期ASP
                      </th>
                      <th
                        onClick={() => handleSort('growthAspRate')}
                        className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900 bg-amber-50/40"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-amber-800">ASP增减(%)</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    </>
                  )}

                  {/* Optional Columns */}
                  {visibleColumns.profit && (
                    <th
                      onClick={() => handleSort('currProfit')}
                      className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>本期毛利</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.margin && (
                    <th
                      onClick={() => handleSort('currMargin')}
                      className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>毛利率</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.cost && (
                    <th className="py-2.5 px-3 font-semibold text-right text-slate-500">
                      本期成本
                    </th>
                  )}
                  {visibleColumns.orders && (
                    <th className="py-2.5 px-3 font-semibold text-right text-slate-500">
                      订单数
                    </th>
                  )}

                  <th className="py-2.5 px-3 font-semibold text-center w-16">联动下钻</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-mono">
                {pagedItems.map((item, idx) => {
                  const rank = (currentPage - 1) * (pageSize === 99999 ? 0 : pageSize) + idx + 1;
                  return (
                    <tr
                      key={item.key}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (activeLevel === 'category') {
                          setSelectedCategory(item.key);
                          setActiveLevel('spu');
                          setCurrentPage(1);
                        } else if (activeLevel === 'spu') {
                          setSelectedSpu(item.key);
                          setActiveLevel('sku');
                          setCurrentPage(1);
                        } else if (onSelectSkuForDrillDown && item.onlineProductSKU) {
                          onSelectSkuForDrillDown(item.onlineProductSKU);
                        }
                      }}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-sans text-[11px]">
                        {rank}
                      </td>

                      {/* Subject Column */}
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center space-x-2">
                          {activeLevel === 'category' && <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          {activeLevel === 'spu' && <Box className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          {activeLevel === 'sku' && <Hash className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors font-mono">
                              {item.label}
                            </div>
                            {activeLevel === 'sku' && (
                              <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                                <span>内部编码: {item.internalSKU || '-'}</span>
                                <span>·</span>
                                <span>SPU: {item.SPU || '-'}</span>
                              </div>
                            )}
                            {activeLevel === 'spu' && item.productType && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                品类: {item.productType}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* MULTI-PERIOD DATA CELLS (Requirement 6: Metric-First default or Period-First) */}
                      {isMultiPeriod && columnLayout === 'metricFirst' ? (
                        <>
                          {/* 1. Sales Quantity Metric Group across all periods */}
                          {effectiveMultiPeriods.map((pk) => {
                            const isBase = pk === activeBasePeriod;
                            const pd = item.periodData?.[pk];
                            return (
                              <td
                                key={`m_qty_${pk}`}
                                className={`py-2.5 px-2 text-right ${
                                  isBase ? 'font-bold text-slate-900 bg-slate-100/60' : 'text-slate-700'
                                }`}
                              >
                                {pd?.qty !== undefined ? pd.qty.toLocaleString() : '0'}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-2 text-right border-r border-slate-200">
                            {renderGrowthBadge(item.growthQtyRate, item.diffQty)}
                          </td>

                          {/* 2. Final Sales Metric Group across all periods */}
                          {effectiveMultiPeriods.map((pk) => {
                            const isBase = pk === activeBasePeriod;
                            const pd = item.periodData?.[pk];
                            return (
                              <td
                                key={`m_sales_${pk}`}
                                className={`py-2.5 px-2 text-right font-bold ${
                                  isBase ? 'text-blue-900 bg-blue-100/40' : 'text-blue-800'
                                }`}
                              >
                                {pd?.sales !== undefined ? renderMoney(pd.sales) : '$0.00'}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-2 text-right border-r border-slate-200">
                            {renderGrowthBadge(item.growthSalesRate, item.diffSales, true)}
                          </td>

                          {/* 3. ASP Metric Group across all periods */}
                          {effectiveMultiPeriods.map((pk) => {
                            const isBase = pk === activeBasePeriod;
                            const pd = item.periodData?.[pk];
                            return (
                              <td
                                key={`m_asp_${pk}`}
                                className={`py-2.5 px-2 text-right text-amber-800 ${
                                  isBase ? 'font-bold bg-amber-50/30' : ''
                                }`}
                              >
                                ${pd?.asp !== undefined ? pd.asp.toFixed(2) : '0.00'}
                              </td>
                            );
                          })}

                          {/* Optional Metrics across periods */}
                          {visibleColumns.profit &&
                            effectiveMultiPeriods.map((pk) => {
                              const pd = item.periodData?.[pk];
                              return (
                                <td key={`m_prof_${pk}`} className="py-2.5 px-2 text-right text-emerald-700 font-semibold">
                                  {pd?.profit !== undefined ? renderMoney(pd.profit) : '-'}
                                </td>
                              );
                            })}
                          {visibleColumns.margin &&
                            effectiveMultiPeriods.map((pk) => {
                              const pd = item.periodData?.[pk];
                              return (
                                <td key={`m_marg_${pk}`} className="py-2.5 px-2 text-right text-emerald-700 font-semibold">
                                  {pd?.margin !== undefined ? `${(pd.margin * 100).toFixed(1)}%` : '-'}
                                </td>
                              );
                            })}
                          {visibleColumns.cost &&
                            effectiveMultiPeriods.map((pk) => {
                              const pd = item.periodData?.[pk];
                              return (
                                <td key={`m_cost_${pk}`} className="py-2.5 px-2 text-right text-slate-600">
                                  {pd?.cost !== undefined ? renderMoney(pd.cost) : '-'}
                                </td>
                              );
                            })}
                          {visibleColumns.orders &&
                            effectiveMultiPeriods.map((pk) => {
                              const pd = item.periodData?.[pk];
                              return (
                                <td key={`m_ord_${pk}`} className="py-2.5 px-2 text-right text-slate-600">
                                  {pd?.orders !== undefined ? pd.orders.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                        </>
                      ) : isMultiPeriod && columnLayout === 'periodFirst' ? (
                        effectiveMultiPeriods.map((pk) => {
                          const isBase = pk === activeBasePeriod;
                          const pd = item.periodData?.[pk];
                          return (
                            <React.Fragment key={pk}>
                              {/* Sales Cell */}
                              <td
                                className={`py-2.5 px-2.5 text-right font-bold ${
                                  isBase ? 'text-blue-800 bg-blue-50/30' : 'text-slate-800'
                                }`}
                              >
                                {pd?.sales !== undefined ? renderMoney(pd.sales) : '$0.00'}
                              </td>
                              {/* Qty Cell */}
                              <td
                                className={`py-2.5 px-2.5 text-right ${
                                  isBase ? 'font-bold text-slate-900 bg-blue-50/20' : 'text-slate-600'
                                }`}
                              >
                                {pd?.qty !== undefined ? pd.qty.toLocaleString() : '0'}
                              </td>
                              {/* ASP Cell */}
                              <td className="py-2.5 px-2 text-right text-amber-800">
                                ${pd?.asp !== undefined ? pd.asp.toFixed(2) : '0.00'}
                              </td>
                              {/* Growth Cell */}
                              {!isBase && (
                                <td className="py-2.5 px-2 text-right">
                                  {renderGrowthBadge(
                                    pd?.growthSalesFromBase,
                                    pd?.diffSalesFromBase,
                                    true
                                  )}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        /* DUAL MODE DATA CELLS */
                        <>
                          {/* 1. Sales Quantity */}
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {item.currQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {item.compQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {renderGrowthBadge(item.growthQtyRate, item.diffQty)}
                          </td>

                          {/* 2. Final Sales */}
                          <td className="py-2.5 px-3 text-right font-bold text-blue-800 bg-blue-50/20">
                            {renderMoney(item.currSales)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 bg-blue-50/10">
                            {renderMoney(item.compSales)}
                          </td>
                          <td className="py-2.5 px-3 text-right bg-blue-50/20">
                            {renderGrowthBadge(item.growthSalesRate, item.diffSales, true)}
                          </td>

                          {/* 3. ASP */}
                          <td className="py-2.5 px-3 text-right font-bold text-amber-800 bg-amber-50/20">
                            ${item.currAsp.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 bg-amber-50/10">
                            ${item.compAsp.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right bg-amber-50/20">
                            {renderGrowthBadge(item.growthAspRate, item.diffAsp, true)}
                          </td>
                        </>
                      )}

                      {/* Optional Columns */}
                      {visibleColumns.profit && (
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          {renderMoney(item.currProfit)}
                        </td>
                      )}
                      {visibleColumns.margin && (
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          {(item.currMargin * 100).toFixed(1)}%
                        </td>
                      )}
                      {visibleColumns.cost && (
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {renderMoney(item.currCost)}
                        </td>
                      )}
                      {visibleColumns.orders && (
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {item.currOrders.toLocaleString()}
                        </td>
                      )}

                      {/* Drill-down Arrow */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="p-1 rounded bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-400 inline-block transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Universal Pagination for All Levels (Requirement 3: Default 20, selectable dropdown) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span>每页显示:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 cursor-pointer font-medium"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页 (默认)</option>
                <option value={50}>50 条/页</option>
                <option value={100}>100 条/页</option>
                <option value={99999}>全部显示</option>
              </select>
              <span>
                显示第 {(currentPage - 1) * (pageSize === 99999 ? currentLevelItems.length : pageSize) + 1} -{' '}
                {Math.min(currentPage * (pageSize === 99999 ? currentLevelItems.length : pageSize), currentLevelItems.length)} 条，共{' '}
                {currentLevelItems.length.toLocaleString()} 条明细 ({activeLevel === 'category' ? '品类' : activeLevel === 'spu' ? 'SPU' : 'SKU'})
              </span>
            </div>

            {pageSize !== 99999 && totalPages > 1 && (
              <div className="flex items-center space-x-1 font-mono">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer text-slate-700"
                >
                  上一页
                </button>
                <span className="px-3 py-1 text-slate-700 font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer text-slate-700"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
