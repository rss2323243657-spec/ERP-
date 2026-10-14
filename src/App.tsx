import React, { useState, useEffect, useMemo } from 'react';
import {
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
  FilterState,
} from './types/sales';
import {
  getAllCleanSalesRecords,
  saveCleanSalesRecords,
  getAllExcludedRecords,
  saveExcludedRecords,
  getAllAdjustmentRecords,
  saveAdjustmentRecords,
  getAllProductMappings,
  saveProductMappings,
  getAllProcessingLogs,
  saveProcessingLog,
  clearAllAnalyticsData,
  clearDemoDataOnly,
  getSavedMonthlyExchangeRates,
  saveMonthlyExchangeRatesToStorage,
} from './services/db';
import {
  filterAndAggregateSales,
  processWorkbookOrders,
  recalculateRecordsWithExchangeRates,
  DEFAULT_MONTHLY_EXCHANGE_RATES,
} from './services/dataProcessor';
import {
  DEMO_PRODUCT_MAPPINGS,
  createDemoOrderWorkbook,
} from './services/sampleDataGenerator';
import { exportToXLSX, exportToCSV, formatCleanRecordsForExport } from './services/exporter';

import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { KPICards } from './components/KPICards';
import { AnomalyAlerts } from './components/AnomalyAlerts';
import { SalesTrendChart } from './components/SalesTrendChart';
import { CategoryAndSpuRank } from './components/CategoryAndSpuRank';
import { SkuRankTable } from './components/SkuRankTable';
import { SkuDetailModal } from './components/SkuDetailModal';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { DataQualityCenter } from './components/DataQualityCenter';
import { SalesRawTable } from './components/SalesRawTable';
import { DataUploadModal } from './components/DataUploadModal';
import { ProductMultiAnalysis } from './components/ProductMultiAnalysis';
import { SalesAiAnalysisTab } from './components/SalesAiAnalysisTab';
import { ConfirmModal } from './components/ConfirmModal';

export default function App() {
  const [cleanRecords, setCleanRecords] = useState<StandardSalesRecord[]>([]);
  const [excludedRecords, setExcludedRecords] = useState<ExcludedRecord[]>([]);
  const [adjustmentRecords, setAdjustmentRecords] = useState<AdjustmentRecord[]>([]);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [productMappings, setProductMappings] = useState<Map<string, ProductMappingItem>>(new Map());

  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'products' | 'ai' | 'details' | 'quality'>('dashboard');
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Monthly USD/CNY exchange rates state (Requirement 7)
  const [monthlyExchangeRates, setMonthlyExchangeRates] = useState<Record<string, number>>(() => {
    const saved = getSavedMonthlyExchangeRates();
    return { ...DEFAULT_MONTHLY_EXCHANGE_RATES, ...saved };
  });

  // In-app confirmation dialog state (no window.confirm / alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: '确认清除',
    action: async () => {},
  });

  // In-app toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [drillDownSku, setDrillDownSku] = useState<string | null>(null);
  const [skuAiContext, setSkuAiContext] = useState<any>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    timeGranularity: 'month',
    selectedDateRange: ['', ''],
    productHierarchy: 'all',
    selectedProductType: 'ALL',
    selectedSpu: 'ALL',
    selectedOnlineSku: 'ALL',
    onlineSkuSearch: '',
    spuSearch: '',
    internalSkuSearch: '',
    globalSearch: '',
    primaryMetric: 'finalSales',
  });

  // Check if any demo data exists in records
  const hasDemoData = useMemo(() => {
    return cleanRecords.some((r) => r.isDemoData);
  }, [cleanRecords]);

  // Load from IndexedDB on startup
  useEffect(() => {
    async function loadData() {
      try {
        const [savedSales, savedExcluded, savedAdj, savedMappings, savedLogs] = await Promise.all([
          getAllCleanSalesRecords(),
          getAllExcludedRecords(),
          getAllAdjustmentRecords(),
          getAllProductMappings(),
          getAllProcessingLogs(),
        ]);

        const mappingMap = new Map<string, ProductMappingItem>();
        if (savedMappings.length > 0) {
          savedMappings.forEach((m) => mappingMap.set(m.SKU, m));
          setProductMappings(mappingMap);
        }

        if (savedSales.length > 0) {
          setCleanRecords(savedSales);
          setExcludedRecords(savedExcluded);
          setAdjustmentRecords(savedAdj);
          setProcessingLogs(savedLogs);
          // Default to all records so user immediately sees their dataset
          setFilters((prev) => ({
            ...prev,
            selectedDateRange: ['', ''],
          }));
        } else {
          // If totally empty and user hasn't explicitly cleared demo, load initial demo dataset
          const hasCleared = localStorage.getItem('walmart_has_cleared_demo') === 'true';
          if (!hasCleared) {
            DEMO_PRODUCT_MAPPINGS.forEach((m) => mappingMap.set(m.SKU, m));
            await saveProductMappings(DEMO_PRODUCT_MAPPINGS);
            setProductMappings(mappingMap);
            await loadDemoData(mappingMap);
          }
        }
      } catch (err) {
        console.error('Failed to load DB:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    loadData();
  }, []);

  // Helper for loading demo dataset
  const loadDemoData = async (currentMappings?: Map<string, ProductMappingItem>) => {
    localStorage.removeItem('walmart_has_cleared_demo');
    setIsLoadingDemo(true);
    try {
      const mappingsToUse = currentMappings || productMappings;
      const wb = createDemoOrderWorkbook();

      const result = processWorkbookOrders({
        fileName: 'Walmart_US_ERP_2026_Q3_Q4_模拟业务订单.xlsx',
        workbook: wb,
        productMappings: mappingsToUse,
        monthlyExchangeRates: getSavedMonthlyExchangeRates(),
      });

      // Mark records as demo data
      result.cleanRecords.forEach((r) => (r.isDemoData = true));

      setCleanRecords(result.cleanRecords);
      setExcludedRecords(result.excludedRecords);
      setAdjustmentRecords(result.adjustmentRecords);
      setProcessingLogs([result.log]);

      // Set default date range to all demo data
      setFilters((prev) => ({
        ...prev,
        timeGranularity: 'month',
        selectedDateRange: ['', ''],
      }));

      await Promise.all([
        saveCleanSalesRecords(result.cleanRecords),
        saveExcludedRecords(result.excludedRecords),
        saveAdjustmentRecords(result.adjustmentRecords),
        saveProcessingLog(result.log),
      ]);
    } catch (e) {
      console.error('Failed demo load:', e);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // Clear demo data only (including demo mapping) - using in-app ConfirmModal
  const handleClearDemoData = () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空模拟业务演示数据',
      description:
        '确认清空当前的【模拟演示数据】（包含示例产品映射关系表）吗？清空后将仅保留您正式上传的真实业务数据，防止与演示数据混合汇总。',
      confirmText: '确认清空演示数据',
      action: async () => {
        try {
          localStorage.setItem('walmart_has_cleared_demo', 'true');
          await clearDemoDataOnly();
          const updated = cleanRecords.filter((r) => !r.isDemoData);
          setCleanRecords(updated);
          setProductMappings(new Map());
          setFilters((prev) => ({
            ...prev,
            selectedDateRange: ['', ''],
          }));
          showToast('已成功清除演示数据及示例产品映射表！现在上传的文件将不会与任何示例数据混合。');
        } catch (err: any) {
          console.error('Clear demo error:', err);
          showToast('清除演示数据失败: ' + (err?.message || '未知错误'));
        }
      },
    });
  };

  // Clear all data - using in-app ConfirmModal
  const handleClearAllData = () => {
    setConfirmDialog({
      isOpen: true,
      title: '彻底清空全部系统数据',
      description:
        '确认清空系统内所有已导入的销售订单底账、产品映射关系表、排除明细与修正日志吗？清空后系统将重置为空白状态，此操作不可逆。',
      confirmText: '确认清空全部数据',
      action: async () => {
        try {
          localStorage.setItem('walmart_has_cleared_demo', 'true');
          await clearAllAnalyticsData();
          setCleanRecords([]);
          setExcludedRecords([]);
          setAdjustmentRecords([]);
          setProcessingLogs([]);
          setProductMappings(new Map());
          setFilters((prev) => ({
            ...prev,
            selectedDateRange: ['', ''],
          }));
          showToast('已彻底清空全部销售订单及产品映射表数据。');
        } catch (err: any) {
          console.error('Clear all error:', err);
          showToast('清空数据失败: ' + (err?.message || '未知错误'));
        }
      },
    });
  };

  // Add single product mapping item
  const handleAddProductMapping = async (item: ProductMappingItem) => {
    const updated = new Map(productMappings);
    updated.set(item.SKU, item);
    setProductMappings(updated);
    await saveProductMappings(Array.from(updated.values()));

    setCleanRecords((prev) =>
      prev.map((r) => {
        if (r.onlineProductSKU === item.SKU) {
          return {
            ...r,
            SPU: item.SPU,
            productType: item.productType,
            isUnmapped: false,
          };
        }
        return r;
      })
    );
  };

  // Sync monthly exchange rates and recalculate all current clean records immediately (Requirement 7)
  const handleSyncExchangeRates = async (rates: Record<string, number>) => {
    saveMonthlyExchangeRatesToStorage(rates);
    setMonthlyExchangeRates(rates);
    if (cleanRecords.length > 0) {
      const recalculated = recalculateRecordsWithExchangeRates(cleanRecords, rates);
      setCleanRecords(recalculated);
      await saveCleanSalesRecords(recalculated);
      showToast('月度结算汇率已成功同步，全部订单底账与毛利已完成重算！');
    } else {
      showToast('月度结算汇率设置已保存！');
    }
  };

  // Bulk update product mappings from upload
  const handleSaveBulkMappings = async (items: ProductMappingItem[]) => {
    const updated = new Map(productMappings);
    items.forEach((m) => updated.set(m.SKU, m));
    setProductMappings(updated);
    await saveProductMappings(Array.from(updated.values()));

    setCleanRecords((prev) =>
      prev.map((r) => {
        const m = updated.get(r.onlineProductSKU);
        if (m) {
          return {
            ...r,
            SPU: m.SPU,
            productType: m.productType,
            isUnmapped: false,
          };
        }
        return r;
      })
    );
  };

  // Save freshly processed uploaded orders with replace or append
  const handleSaveProcessedOrders = async (
    result: {
      cleanRecords: StandardSalesRecord[];
      excludedRecords: ExcludedRecord[];
      adjustmentRecords: AdjustmentRecord[];
      log: ProcessingLog;
      maxOrderDate: string;
    },
    mode: 'replace' | 'append'
  ) => {
    let finalClean: StandardSalesRecord[] = [];
    let finalExcluded: ExcludedRecord[] = [];
    let finalAdj: AdjustmentRecord[] = [];
    let finalLogs: ProcessingLog[] = [];

    if (mode === 'replace') {
      await clearAllAnalyticsData();
      finalClean = result.cleanRecords;
      finalExcluded = result.excludedRecords;
      finalAdj = result.adjustmentRecords;
      finalLogs = [result.log];
    } else {
      finalClean = [...cleanRecords, ...result.cleanRecords];
      finalExcluded = [...excludedRecords, ...result.excludedRecords];
      finalAdj = [...adjustmentRecords, ...result.adjustmentRecords];
      finalLogs = [result.log, ...processingLogs];
    }

    setCleanRecords(finalClean);
    setExcludedRecords(finalExcluded);
    setAdjustmentRecords(finalAdj);
    setProcessingLogs(finalLogs);

    // Reset filters to show all newly uploaded records immediately
    setFilters((prev) => ({
      ...prev,
      selectedDateRange: ['', ''], // Unrestricted date range so all valid records are visible!
      selectedProductType: 'ALL',
      selectedSpu: 'ALL',
      selectedOnlineSku: 'ALL',
      globalSearch: '',
      onlineSkuSearch: '',
      spuSearch: '',
      internalSkuSearch: '',
    }));

    await Promise.all([
      saveCleanSalesRecords(finalClean),
      saveExcludedRecords(finalExcluded),
      saveAdjustmentRecords(finalAdj),
      saveProcessingLog(result.log),
    ]);
  };

  // Export clean data
  const handleExportCleanData = (format: 'xlsx' | 'csv') => {
    const formatted = formatCleanRecordsForExport(cleanRecords);
    if (format === 'xlsx') {
      exportToXLSX(formatted, `Walmart_标准销售数据_${cleanRecords.length}条`, 'Clean_Sales');
    } else {
      exportToCSV(formatted, `Walmart_标准销售数据_${cleanRecords.length}条`);
    }
  };

  // Dropdown options
  const availableProductTypes = useMemo(() => {
    const types = new Set<string>();
    cleanRecords.forEach((r) => {
      if (r.productType) types.add(r.productType);
    });
    return Array.from(types).sort();
  }, [cleanRecords]);

  const availableSpus = useMemo(() => {
    const spus = new Set<string>();
    cleanRecords.forEach((r) => {
      if (r.SPU) {
        if (filters.selectedProductType === 'ALL' || r.productType === filters.selectedProductType) {
          spus.add(r.SPU);
        }
      }
    });
    return Array.from(spus).sort();
  }, [cleanRecords, filters.selectedProductType]);

  const availableOnlineSkus = useMemo(() => {
    const skus = new Set<string>();
    cleanRecords.forEach((r) => {
      if (filters.selectedProductType !== 'ALL' && r.productType !== filters.selectedProductType) return;
      if (filters.selectedSpu !== 'ALL' && r.SPU !== filters.selectedSpu) return;
      skus.add(r.onlineProductSKU);
    });
    return Array.from(skus).sort();
  }, [cleanRecords, filters.selectedProductType, filters.selectedSpu]);

  // Execute Core Filtering & Aggregation
  const {
    filteredRecords,
    kpis,
    aggregatedByTime,
    aggregatedByProductType,
    aggregatedBySpu,
    aggregatedBySku,
    timeComparison,
    anomalies,
    maxDateFound,
  } = useMemo(() => {
    return filterAndAggregateSales(cleanRecords, filters);
  }, [cleanRecords, filters]);

  // Reset filters to default (last 30 days of data)
  const handleResetFilters = () => {
    let start = '';
    let end = maxDateFound;
    if (maxDateFound) {
      const maxD = new Date(maxDateFound);
      const startD = new Date(maxD);
      startD.setDate(maxD.getDate() - 29);
      start = startD.toISOString().substring(0, 10);
    }

    setFilters({
      timeGranularity: 'month',
      selectedDateRange: [start, end],
      productHierarchy: 'all',
      selectedProductType: 'ALL',
      selectedSpu: 'ALL',
      selectedOnlineSku: 'ALL',
      onlineSkuSearch: '',
      spuSearch: '',
      internalSkuSearch: '',
      globalSearch: '',
      primaryMetric: 'finalSales',
    });
  };

  // Open SKU AI Diagnose
  const handleRequestAiSkuDiagnose = (skuData: any) => {
    setSkuAiContext(skuData);
    setShowAiModal(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">正在初始化 Walmart US ERP 销售分析引擎...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        globalSearch={filters.globalSearch}
        setGlobalSearch={(val) => setFilters((prev) => ({ ...prev, globalSearch: val }))}
        totalRecordsCount={cleanRecords.length}
        hasDemoData={hasDemoData}
        onOpenUpload={() => setShowUploadModal(true)}
        onLoadDemo={() => loadDemoData()}
        onExportCleanData={handleExportCleanData}
        onClearDemoData={handleClearDemoData}
        onClearAllData={handleClearAllData}
        onOpenAiModal={() => setShowAiModal(true)}
        isLoadingDemo={isLoadingDemo}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Filter Bar (Active in executive dashboard and sales trend tabs; Product Multi-Analysis has its own independent dedicated dimensions) */}
        {(activeTab === 'dashboard' || activeTab === 'trends') && (
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            availableProductTypes={availableProductTypes}
            availableSpus={availableSpus}
            availableOnlineSkus={availableOnlineSkus}
            maxOrderDate={maxDateFound}
            onReset={handleResetFilters}
          />
        )}

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            <KPICards kpis={kpis} timeComparison={timeComparison} />

            <AnomalyAlerts anomalies={anomalies} />

            <SalesTrendChart
              data={aggregatedByTime}
              granularity={filters.timeGranularity}
              activeMetric={filters.primaryMetric}
              onMetricChange={(m) => setFilters((prev) => ({ ...prev, primaryMetric: m }))}
              showAiAutoAnalysis={true}
            />

            <CategoryAndSpuRank
              productTypes={aggregatedByProductType}
              spus={aggregatedBySpu}
              onSelectProductType={(pt) => setFilters((prev) => ({ ...prev, selectedProductType: pt }))}
              onSelectSpu={(spu) => setFilters((prev) => ({ ...prev, selectedSpu: spu }))}
            />

            <SkuRankTable
              skuList={aggregatedBySku}
              onSelectSku={(sku) => setDrillDownSku(sku)}
            />
          </div>
        )}

        {/* TAB 2: SALES DATA OVERVIEW (Requirement 3: Renamed from sales trend) */}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    销售数据总览
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    基于发货订单有效销售核算 · 支持量额毛利多指标与时间粒度自由切换
                  </p>
                </div>
                <button
                  onClick={() => setShowAiModal(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                >
                  生成全店经营诊断
                </button>
              </div>
            </div>

            <KPICards kpis={kpis} timeComparison={timeComparison} />

            <AnomalyAlerts anomalies={anomalies} />

            <SalesTrendChart
              data={aggregatedByTime}
              granularity={filters.timeGranularity}
              activeMetric={filters.primaryMetric}
              onMetricChange={(m) => setFilters((prev) => ({ ...prev, primaryMetric: m }))}
              showAiAutoAnalysis={true}
            />
          </div>
        )}

        {/* TAB 3: PRODUCT ANALYSIS (SKU / SPU / CATEGORY - DEDICATED MULTI-DIMENSIONAL COMPARISON & DRILLDOWN) */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <ProductMultiAnalysis
              allRecords={cleanRecords}
              onSelectSkuForDrillDown={(sku) => setDrillDownSku(sku)}
            />
          </div>
        )}

        {/* TAB 4: DEDICATED SALES AI ANALYSIS (Requirement 3: Dedicated Section with shop & product multi-dimensional depth) */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-fadeIn">
            <SalesAiAnalysisTab
              allRecords={cleanRecords}
              onSelectSkuForDrillDown={(sku) => setDrillDownSku(sku)}
            />
          </div>
        )}

        {/* TAB 5: CLEAN SALES DATA DETAILS TABLE */}
        {activeTab === 'details' && (
          <div className="animate-fadeIn">
            <SalesRawTable records={filteredRecords} />
          </div>
        )}

        {/* TAB 6: DATA QUALITY CENTER */}
        {activeTab === 'quality' && (
          <div className="animate-fadeIn">
            <DataQualityCenter
              adjustments={adjustmentRecords}
              excluded={excludedRecords}
              cleanRecords={cleanRecords}
              logs={processingLogs}
              onAddProductMapping={handleAddProductMapping}
              monthlyExchangeRates={monthlyExchangeRates}
              onSyncExchangeRates={handleSyncExchangeRates}
            />
          </div>
        )}
      </main>

      {/* Confirmation Dialog (replaces window.confirm) */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
      />

      {/* In-app Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounceIn bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Modal with Progress Bar & Mode Choice */}
      <DataUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        productMappings={productMappings}
        onSaveMappings={handleSaveBulkMappings}
        onSaveProcessedOrders={handleSaveProcessedOrders}
        hasDemoData={hasDemoData}
        onClearDemoData={handleClearDemoData}
      />

      {/* SKU Drill-Down Detail Modal */}
      {drillDownSku && (
        <SkuDetailModal
          sku={drillDownSku}
          allRecords={cleanRecords}
          onClose={() => setDrillDownSku(null)}
          onRequestAiSkuDiagnose={handleRequestAiSkuDiagnose}
        />
      )}

      {/* AI Analysis Modal */}
      <AiAnalysisModal
        isOpen={showAiModal}
        onClose={() => {
          setShowAiModal(false);
          setSkuAiContext(null);
        }}
        kpis={kpis}
        timeComparison={timeComparison}
        productTypes={aggregatedByProductType}
        spus={aggregatedBySpu}
        skus={aggregatedBySku}
        filters={filters}
        skuSpecificContext={skuAiContext}
      />
    </div>
  );
}
