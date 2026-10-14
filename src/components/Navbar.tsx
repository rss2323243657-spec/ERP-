import React, { useState } from 'react';
import {
  Upload,
  Database,
  BarChart3,
  Layers,
  FileCheck2,
  Sparkles,
  Download,
  Search,
  Trash2,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  Check,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'trends' | 'products' | 'ai' | 'details' | 'quality';
  setActiveTab: (tab: 'dashboard' | 'trends' | 'products' | 'ai' | 'details' | 'quality') => void;
  globalSearch: string;
  setGlobalSearch: (val: string) => void;
  totalRecordsCount: number;
  hasDemoData: boolean;
  onOpenUpload: () => void;
  onLoadDemo: () => void;
  onExportCleanData: (format: 'xlsx' | 'csv') => void;
  onClearDemoData: () => void;
  onClearAllData: () => void;
  onOpenAiModal: () => void;
  isLoadingDemo: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  globalSearch,
  setGlobalSearch,
  totalRecordsCount,
  hasDemoData,
  onOpenUpload,
  onLoadDemo,
  onExportCleanData,
  onClearDemoData,
  onClearAllData,
  onOpenAiModal,
  isLoadingDemo,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner if demo data is active */}
      {hasDemoData && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>提示：</strong>当前正处于<strong>【模拟业务演示数据】</strong>浏览状态。导入您真实的 ERP 订单前，建议先清空演示数据，避免数据合并统计。
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClearDemoData}
              className="text-xs font-medium text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              清空演示数据
            </button>
            <button
              onClick={onOpenUpload}
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-2.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              上传真实ERP数据
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900 tracking-tight">Walmart US</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  ERP 销售数据分析系统
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                线上SKU销售主键 · 发货数量精准纠偏 · 内部SKU对照留存
              </p>
            </div>
          </div>

          {/* Global Search Bar (Scoped to active time range) */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="在当前时间范围内全局检索: 订单号 / 线上SKU / SPU / 内部SKU..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-900 pl-9 pr-6 py-2 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* AI Diagnose Button */}
            <button
              onClick={onOpenAiModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">AI 运营诊断</span>
            </button>

            {/* Clear Data Dropdown */}
            {totalRecordsCount > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setShowClearMenu(!showClearMenu)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80 transition-colors cursor-pointer"
                  title="数据管理与清空选项"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden lg:inline">清除数据</span>
                </button>
                {showClearMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-xs">
                    {hasDemoData && (
                      <button
                        onClick={() => {
                          onClearDemoData();
                          setShowClearMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-amber-700 hover:bg-amber-50 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">清空模拟演示数据</div>
                          <div className="text-[10px] text-amber-600">包含示例产品映射关系表</div>
                        </div>
                        <span className="text-[10px] bg-amber-100 px-1 py-0.5 rounded font-mono">Demo</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onClearAllData();
                        setShowClearMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center justify-between border-t border-slate-100"
                    >
                      <div>
                        <div className="font-semibold">彻底清空全部数据</div>
                        <div className="text-[10px] text-rose-600">清空订单、映射表及日志</div>
                      </div>
                      <span className="text-[10px] bg-rose-100 px-1 py-0.5 rounded font-mono">All</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onLoadDemo}
                disabled={isLoadingDemo}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <span>{isLoadingDemo ? '正在生成示例...' : '加载模拟演示数据'}</span>
              </button>
            )}

            {/* Export Menu */}
            {totalRecordsCount > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-250 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>导出</span>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-xs">
                    <button
                      onClick={() => {
                        onExportCleanData('xlsx');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                    >
                      <span>导出标准销售明细 (.xlsx)</span>
                      <span className="text-[10px] font-mono text-emerald-600">Excel</span>
                    </button>
                    <button
                      onClick={() => {
                        onExportCleanData('csv');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                    >
                      <span>导出标准销售明细 (.csv)</span>
                      <span className="text-[10px] font-mono text-blue-600">CSV</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upload File */}
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入文件</span>
            </button>
          </div>
        </div>

        {/* Global Navigation Tabs (Bright ERP Tab Bar) */}
        <div className="flex items-center space-x-1 sm:space-x-2 py-1.5 overflow-x-auto border-t border-slate-150 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>销售仪表</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>销售数据总览</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'products'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>产品多维分析</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>销售AI分析</span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>销售明细</span>
            {totalRecordsCount > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                {totalRecordsCount.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('quality')}
            className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'quality'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>数据质量中心</span>
          </button>
        </div>
      </div>
    </header>
  );
};
