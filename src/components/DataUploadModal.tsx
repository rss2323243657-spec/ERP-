import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  inspectWorkbookSheets,
  processWorkbookOrders,
  parseProductMappingFile,
  SheetAnalysis,
} from '../services/dataProcessor';
import { getSavedMonthlyExchangeRates } from '../services/db';
import {
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
} from '../types/sales';
import { createDemoOrderWorkbook, createDemoMappingWorkbook } from '../services/sampleDataGenerator';

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  productMappings: Map<string, ProductMappingItem>;
  onSaveMappings: (mappings: ProductMappingItem[]) => void;
  onSaveProcessedOrders: (
    results: {
      cleanRecords: StandardSalesRecord[];
      excludedRecords: ExcludedRecord[];
      adjustmentRecords: AdjustmentRecord[];
      log: ProcessingLog;
      maxOrderDate: string;
    },
    mode: 'replace' | 'append'
  ) => void;
  hasDemoData: boolean;
  onClearDemoData: () => void;
}

export const DataUploadModal: React.FC<DataUploadModalProps> = ({
  isOpen,
  onClose,
  productMappings,
  onSaveMappings,
  onSaveProcessedOrders,
  hasDemoData,
  onClearDemoData,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'mappings'>('orders');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    stepName: string;
    isComplete: boolean;
  }>({
    percent: 0,
    stepName: '',
    isComplete: false,
  });

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetAnalyses, setSheetAnalyses] = useState<SheetAnalysis[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [processingSummary, setProcessingSummary] = useState<ProcessingLog | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mappingInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // File chosen for Orders
  const handleOrderFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setCurrentFile(file);
    setProcessingSummary(null);
    setUploadProgress({
      percent: 25,
      stepName: '正在解析工作簿二进制数据流...',
      isComplete: false,
    });

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      setWorkbook(wb);

      setUploadProgress({
        percent: 60,
        stepName: '正在全Sheet扫描识别订单数据结构...',
        isComplete: false,
      });

      const analyses = inspectWorkbookSheets(wb);
      setSheetAnalyses(analyses);

      const valid = analyses.filter((a) => a.isOrderSheet).map((a) => a.sheetName);
      setSelectedSheets(valid.length > 0 ? valid : [analyses[0]?.sheetName].filter(Boolean));

      setUploadProgress({
        percent: 100,
        stepName: `文件识别完成，共发现 ${analyses.length} 个工作表。请确认勾选需要处理的 Sheet。`,
        isComplete: false,
      });
    } catch (err) {
      console.error('File read error:', err);
      alert('Excel/CSV 读取失败，请确认文件格式无损。');
      setUploadProgress({ percent: 0, stepName: '解析异常', isComplete: false });
    } finally {
      setLoading(false);
    }
  };

  // Execute processing of selected sheets
  const handleProcessOrders = () => {
    if (!workbook || !currentFile) return;

    setLoading(true);
    setUploadProgress({
      percent: 40,
      stepName: '正在执行核心清洗规则 (过滤 Cancelled、过滤单价=0、核对发货数量)...',
      isComplete: false,
    });

    setTimeout(() => {
      try {
        const result = processWorkbookOrders({
          fileName: currentFile.name,
          workbook,
          targetSheets: selectedSheets,
          productMappings,
          monthlyExchangeRates: getSavedMonthlyExchangeRates(),
        });

        setUploadProgress({
          percent: 85,
          stepName: '正在生成统一标准销售数据集并写入 IndexedDB 本地库...',
          isComplete: false,
        });

        setTimeout(() => {
          setProcessingSummary(result.log);
          onSaveProcessedOrders(result, importMode);

          setUploadProgress({
            percent: 100,
            stepName: `处理完毕！原始总行数: ${result.log.rawCount.toLocaleString()}，有效纳入销售: ${result.log.validSalesCount.toLocaleString()} 条。`,
            isComplete: true,
          });
          setLoading(false);
        }, 150);
      } catch (err: any) {
        console.error('Processing error:', err);
        alert('订单清洗处理出错: ' + (err?.message || '未知错误'));
        setLoading(false);
      }
    }, 150);
  };

  // Upload Product Mapping File
  const handleMappingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const mappings = parseProductMappingFile(wb);

      if (mappings.length === 0) {
        alert('未在文件中识别到有效的 SKU/SPU/产品类型 映射数据');
      } else {
        onSaveMappings(mappings);
        alert(`成功导入 ${mappings.length} 条产品映射规则！`);
      }
    } catch (err) {
      console.error('Mapping error:', err);
      alert('产品映射表读取失败。');
    } finally {
      setLoading(false);
    }
  };

  // Download Demo Templates
  const handleDownloadDemoOrders = () => {
    const wb = createDemoOrderWorkbook();
    XLSX.writeFile(wb, 'Walmart_US_ERP订单标准示例_多Sheet.xlsx');
  };

  const handleDownloadDemoMapping = () => {
    const wb = createDemoMappingWorkbook();
    XLSX.writeFile(wb, 'Walmart_US_产品映射表标准模板.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-250 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <span>数据导入与多 Sheet 自动识别中心</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              支持 XLSX / XLS / CSV · 逐 Sheet 扫描识别 · 严格两级过滤 (Cancelled ➔ 单价=0)
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50 text-xs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ① 导入 ERP 订单数据 (支持多Sheet/自动合并)
          </button>
          <button
            onClick={() => setActiveTab('mappings')}
            className={`py-3 px-4 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'mappings'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ② 导入产品映射表 (线上SKU ➔ SPU ➔ 产品类型)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Demo Data Notice */}
              {hasDemoData && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>检测到当前包含模拟演示数据。为防止与您的真实数据混淆，建议选择<strong>【覆盖替换】</strong>或先点击清空。</span>
                  </div>
                  <button
                    onClick={onClearDemoData}
                    className="px-2.5 py-1 text-xs rounded font-medium bg-amber-200 hover:bg-amber-300 text-amber-900 cursor-pointer"
                  >
                    先清空演示数据
                  </button>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleOrderFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <FileSpreadsheet className="w-10 h-10 text-blue-600 mx-auto mb-2 opacity-90" />
                <div className="text-sm font-bold text-slate-800">
                  {currentFile ? currentFile.name : '点击或拖拽上传 Walmart ERP 订单文件'}
                </div>
                <p className="text-xs text-slate-500 mt-1">支持 .xlsx, .xls, .csv 格式 (系统自动扫描工作簿中的全部 Sheet 表格)</p>
              </div>

              {/* Upload Progress Bar (Requirement 5) */}
              {uploadProgress.percent > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center space-x-1.5">
                      {uploadProgress.isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                      <span>{uploadProgress.stepName}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-700">{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        uploadProgress.isComplete ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Template Download Prompt */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2 text-slate-700">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>需要参考格式？可直接下载包含 Cancelled / 单价=0 / 数量不一致的示例模板</span>
                </div>
                <button
                  onClick={handleDownloadDemoOrders}
                  className="px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer font-medium"
                >
                  下载订单示例 Excel
                </button>
              </div>

              {/* Import Mode Options (Requirement 3) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium">数据入库模式:</span>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-blue-600"
                    />
                    <span className="text-slate-800 font-semibold">覆盖当前数据 (推荐，避免混合统计)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-blue-600"
                    />
                    <span className="text-slate-600">追加合并至现有数据</span>
                  </label>
                </div>
              </div>

              {/* Sheet Scanning Results */}
              {sheetAnalyses.length > 0 && !uploadProgress.isComplete && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      工作簿 Sheet 扫描识别结果 (共发现 {sheetAnalyses.length} 个 Sheet)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      已选中 {selectedSheets.length} 个订单数据 Sheet
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sheetAnalyses.map((s) => {
                      const isSelected = selectedSheets.includes(s.sheetName);
                      return (
                        <div
                          key={s.sheetName}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSheets(selectedSheets.filter((name) => name !== s.sheetName));
                            } else {
                              setSelectedSheets([...selectedSheets, s.sheetName]);
                            }
                          }}
                          className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-400 text-blue-900'
                              : 'bg-white border-slate-200 text-slate-400 opacity-70'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-blue-600 focus:ring-0"
                            />
                            <div>
                              <span className="font-mono font-bold text-slate-900">{s.sheetName}</span>
                              <span className="ml-2 text-[11px] text-slate-500 font-sans">
                                ({s.rowCount.toLocaleString()} 行数据)
                              </span>
                            </div>
                          </div>

                          <div>
                            {s.isOrderSheet ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>识别为有效订单表</span>
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                                非订单结构 (已默认排除)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleProcessOrders}
                      disabled={loading || selectedSheets.length === 0}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {loading ? '正在执行标准化清洗...' : '确认合并并执行清洗'}
                    </button>
                  </div>
                </div>
              )}

              {/* Exact Cleaning Verification Box (Requirement 4) */}
              {processingSummary && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-3">
                  <div className="font-bold flex items-center justify-between text-emerald-950">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm">数据清洗完毕并成功入库！</span>
                    </div>
                    <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                      有效销售率: {((processingSummary.validSalesCount / (processingSummary.rawCount || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-white p-3 rounded-lg border border-emerald-200 text-slate-800">
                    <div>
                      原始总行数: <strong className="text-slate-900">{processingSummary.rawCount.toLocaleString()}</strong>
                    </div>
                    <div>
                      Cancelled 排除: <strong className="text-rose-700">{processingSummary.cancelledCount.toLocaleString()}</strong>
                    </div>
                    <div>
                      单价=0 排除: <strong className="text-slate-700">{processingSummary.zeroPriceCount.toLocaleString()}</strong>
                    </div>
                    <div>
                      有效纳入销售: <strong className="text-emerald-700 font-bold">{processingSummary.validSalesCount.toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-emerald-800">
                      公式校验：{processingSummary.rawCount} - {processingSummary.cancelledCount} (Cancelled) - {processingSummary.zeroPriceCount} (单价=0) = {processingSummary.validSalesCount} 条
                    </span>
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
                    >
                      立即查看销售分析仪表盘 ➔
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mappings' && (
            <div className="space-y-4">
              <div
                onClick={() => mappingInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-250 hover:border-indigo-500 bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  type="file"
                  ref={mappingInputRef}
                  onChange={handleMappingFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <Layers className="w-10 h-10 text-indigo-600 mx-auto mb-2 opacity-90" />
                <div className="text-sm font-bold text-slate-800">上传产品映射表 (Product Mapping)</div>
                <p className="text-xs text-slate-500 mt-1">包含列: SKU (对应线上商品SKU) · SPU · 产品类型</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2 text-slate-700">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>下载标准产品映射表模板</span>
                </div>
                <button
                  onClick={handleDownloadDemoMapping}
                  className="px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer font-medium"
                >
                  下载映射表模板
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-2">当前生效的产品映射规则 ({productMappings.size} 条)</div>
                <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                  {Array.from(productMappings.values()).map((m) => (
                    <div
                      key={m.SKU}
                      className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between"
                    >
                      <span className="text-blue-700 font-semibold">{m.SKU}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-emerald-700 font-semibold">{m.SPU}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-indigo-800 font-sans font-medium">{m.productType}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">
            数据将保存在浏览器本地 IndexedDB，保障企业数据隐私且刷新不丢失
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
