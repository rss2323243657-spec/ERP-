import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Tag,
  Box,
  Hash,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { StandardSalesRecord } from '../types/sales';
import { exportToXLSX, exportToCSV, formatCleanRecordsForExport } from '../services/exporter';

interface SalesRawTableProps {
  records: StandardSalesRecord[];
}

export const SalesRawTable: React.FC<SalesRawTableProps> = ({ records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMismatchOnly, setFilterMismatchOnly] = useState(false);
  const [filterUnmappedOnly, setFilterUnmappedOnly] = useState(false);

  // Stats
  const totalRecords = records.length;
  const mismatchCount = useMemo(() => records.filter((r) => r.isQtyMismatched).length, [records]);
  const unmappedCount = useMemo(() => records.filter((r) => r.isUnmapped).length, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterMismatchOnly && !r.isQtyMismatched) return false;
      if (filterUnmappedOnly && !r.isUnmapped) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        r.orderId.toLowerCase().includes(term) ||
        r.onlineProductSKU.toLowerCase().includes(term) ||
        r.internalSKU.toLowerCase().includes(term) ||
        r.SPU.toLowerCase().includes(term) ||
        r.productType.toLowerCase().includes(term)
      );
    });
  }, [records, filterMismatchOnly, filterUnmappedOnly, searchTerm]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = (format: 'xlsx' | 'csv') => {
    const formatted = formatCleanRecordsForExport(filtered);
    if (format === 'xlsx') {
      exportToXLSX(formatted, `Walmart_标准销售核算底账_${filtered.length}条`, 'Clean_Sales');
    } else {
      exportToCSV(formatted, `Walmart_标准销售核算底账_${filtered.length}条`);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      {/* 1. Purpose & Explanation Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  标准销售核算底账与纠偏溯源中心 (Audited Sales Ledger)
                </h3>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                  审计核对凭证
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                <strong>业务核心价值：</strong> 本底账是 ERP 订单经规则清洗后（已自动剔除平台已取消 Cancelled 订单、剔除商品单价=0 异常单）的<strong>唯一有效销售核算事实依据</strong>。
                不仅保留线上与内部 SKU 对照，更对<strong>「客户拍单数量 ≠ 实际发货数量」</strong>提供清晰差额纠偏与溯源依据，用于财务对账与运营复盘。
              </p>
            </div>
          </div>
        </div>

        {/* Audit Filter Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
          <div
            onClick={() => {
              setFilterMismatchOnly(false);
              setFilterUnmappedOnly(false);
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              !filterMismatchOnly && !filterUnmappedOnly
                ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>全部有效核算底账</span>
              <span className="font-mono font-bold">{totalRecords.toLocaleString()} 条</span>
            </div>
          </div>

          <div
            onClick={() => {
              setFilterMismatchOnly(!filterMismatchOnly);
              setFilterUnmappedOnly(false);
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              filterMismatchOnly
                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>数量纠偏订单 (拍单≠发货)</span>
              <span className="font-mono font-bold text-amber-800">{mismatchCount.toLocaleString()} 条</span>
            </div>
          </div>

          <div
            onClick={() => {
              setFilterUnmappedOnly(!filterUnmappedOnly);
              setFilterMismatchOnly(false);
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              filterUnmappedOnly
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>未匹配映射订单 (需补齐SPU)</span>
              <span className="font-mono font-bold text-indigo-800">{unmappedCount.toLocaleString()} 条</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Table & Filters */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-150">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">当前查询结果:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-semibold">
              {filtered.length.toLocaleString()} 条记录
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="检索订单号 / 线上SKU / 内部SKU..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-250 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 w-56"
              />
            </div>

            {/* Export button */}
            <button
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 text-xs cursor-pointer font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>导出审计底账 (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-3 font-semibold">订单号</th>
                <th className="py-2.5 px-3 font-semibold font-sans">下单时间</th>
                <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU (线上商品SKU)</th>
                <th className="py-2.5 px-3 text-slate-600 font-medium" title="公司内部产品编码（仅作对照信息）">
                  内部SKU (对照)
                </th>
                <th className="py-2.5 px-3 text-emerald-800 font-semibold">映射 SPU</th>
                <th className="py-2.5 px-3 text-slate-700 font-sans font-semibold">产品类型</th>
                <th className="py-2.5 px-3 text-right font-semibold">单价 ($)</th>
                <th className="py-2.5 px-3 text-right text-slate-500 font-semibold">客户拍单</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">实际发货(销量)</th>
                <th className="py-2.5 px-3 text-right text-slate-900 font-bold bg-blue-50/30">核算销售额 ($)</th>
                <th className="py-2.5 px-3 text-right text-slate-500">单位成本</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 font-semibold">基础毛利</th>
                <th className="py-2.5 px-3 text-right font-semibold">毛利率</th>
                <th className="py-2.5 px-3 text-center font-sans font-semibold">核算纠偏状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentRows.map((r) => {
                const rawOrderedAmount = r.orderedQuantity * r.unitPrice;
                const diffAmount = r.finalSales - rawOrderedAmount;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 text-slate-800 font-medium font-mono">{r.orderId}</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px] font-sans whitespace-nowrap">{r.orderTime}</td>
                    <td className="py-2 px-3 font-bold text-blue-700 font-mono">{r.onlineProductSKU}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{r.internalSKU || '-'}</td>
                    <td className="py-2 px-3 text-emerald-800 font-semibold font-mono">{r.SPU}</td>
                    <td className="py-2 px-3 text-slate-600 font-sans max-w-[120px] truncate" title={r.productType}>
                      {r.productType}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">${r.unitPrice.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono">{r.orderedQuantity}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-bold font-mono">{r.salesQuantity}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 bg-blue-50/20 font-mono">
                      ${r.finalSales.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono">${r.productCost.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold font-mono">
                      ${r.basicGrossProfit.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold font-mono">
                      {(r.basicGrossMargin * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 font-sans">
                        {r.isQtyMismatched ? (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
                            title={`原拍单额: $${rawOrderedAmount.toFixed(2)}, 纠偏差额: ${diffAmount >= 0 ? '+' : ''}$${diffAmount.toFixed(2)}`}
                          >
                            发货纠偏 ({diffAmount >= 0 ? '+' : ''}${diffAmount.toFixed(2)})
                          </span>
                        ) : r.isUnmapped ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-medium">
                            未匹配品类
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 flex items-center space-x-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>合规已核算</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-150 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>每页行数:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20 (默认)</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
            <span>
              显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} / 共{' '}
              {filtered.length.toLocaleString()} 条
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-slate-800 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
