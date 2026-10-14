import React, { useState } from 'react';
import { Hash, Search, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { AggregatedRow } from '../types/sales';

interface SkuRankTableProps {
  skuList: AggregatedRow[];
  onSelectSku: (sku: string) => void;
}

export const SkuRankTable: React.FC<SkuRankTableProps> = ({ skuList, onSelectSku }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof AggregatedRow>('finalSales');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const handleSort = (field: keyof AggregatedRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filtered = skuList.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.onlineProductSKU || '').toLowerCase().includes(term) ||
      (item.internalSKU || '').toLowerCase().includes(term) ||
      (item.SPU || '').toLowerCase().includes(term) ||
      (item.productType || '').toLowerCase().includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = (aVal as string).toLowerCase();
    if (typeof bVal === 'string') bVal = (bVal as string).toLowerCase();

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const effectivePageSize = pageSize === 99999 ? Math.max(sorted.length, 1) : pageSize;
  const totalPages = Math.ceil(sorted.length / effectivePageSize) || 1;
  const currentRows = pageSize === 99999 ? sorted : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-150">
        <div>
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Walmart 销售SKU 表现排行 (线上商品SKU核心主键)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            线上商品SKU为销售汇算主键 · 内部SKU作为对照附加字段展示 · 点击进入单SKU深度详情
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索销售SKU / 内部SKU / SPU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-250 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 w-60"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
            <tr>
              <th className="py-2.5 px-3 font-semibold text-center w-12">排名</th>
              <th
                onClick={() => handleSort('onlineProductSKU')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center space-x-1">
                  <span className="text-blue-700 font-bold">Walmart销售SKU (线上商品SKU)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('internalSKU')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center space-x-1" title="仅作对照显示，不参与主键映射与汇总">
                  <span className="text-slate-600">公司内部SKU (对照)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th onClick={() => handleSort('SPU')} className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900">
                <div className="flex items-center space-x-1">
                  <span>SPU</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold">产品类型</th>
              <th
                onClick={() => handleSort('salesQuantity')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>最终销量</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('finalSales')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>最终销售额</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('salesCost')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>成本</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('basicGrossProfit')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>基础毛利</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('basicGrossMargin')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>毛利率</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('averageSellingPrice')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>ASP</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('sharePercentage')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>占比</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 font-mono">
            {currentRows.map((row, idx) => {
              const rankNum = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr
                  key={row.key}
                  onClick={() => onSelectSku(row.onlineProductSKU || row.key)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-3 text-center text-slate-500">
                    {rankNum <= 3 ? (
                      <span className="inline-block w-4 h-4 text-center leading-4 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                        {rankNum}
                      </span>
                    ) : (
                      rankNum
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-blue-700 group-hover:text-blue-900 transition-colors">
                    {row.onlineProductSKU}
                  </td>
                  <td className="py-2.5 px-3 text-amber-700 bg-amber-50/30 font-medium">
                    {row.internalSKU || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{row.SPU}</td>
                  <td className="py-2.5 px-3 text-slate-600 font-sans max-w-[130px] truncate" title={row.productType}>
                    {row.productType}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-800 font-semibold">{row.salesQuantity.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">${row.finalSales.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">${row.salesCost.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                    ${row.basicGrossProfit.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                    {(row.basicGrossMargin * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-800">${row.averageSellingPrice.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-indigo-700 font-semibold">
                    {((row.sharePercentage || 0) * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 group-hover:text-blue-600">
                    <ExternalLink className="w-3.5 h-3.5 mx-auto" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar (Requirement 3) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-150 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span>每页行数:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
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
            显示 {(currentPage - 1) * (pageSize === 99999 ? sorted.length : pageSize) + 1} 至{' '}
            {Math.min(currentPage * (pageSize === 99999 ? sorted.length : pageSize), sorted.length)} 条 / 共{' '}
            {sorted.length.toLocaleString()} 个 SKU
          </span>
        </div>
        {pageSize !== 99999 && totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded bg-white border border-slate-250 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50 text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-slate-700 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded bg-white border border-slate-250 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50 text-slate-700"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
