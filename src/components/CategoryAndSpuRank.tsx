import React, { useState } from 'react';
import { Tag, Box, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { AggregatedRow } from '../types/sales';

interface CategoryAndSpuRankProps {
  productTypes: AggregatedRow[];
  spus: AggregatedRow[];
  onSelectSpu: (spu: string) => void;
  onSelectProductType: (pType: string) => void;
}

export const CategoryAndSpuRank: React.FC<CategoryAndSpuRankProps> = ({
  productTypes,
  spus,
  onSelectSpu,
  onSelectProductType,
}) => {
  // Requirement 3: Default 20 rows per page, switchable page size dropdown
  const [spuPage, setSpuPage] = useState(1);
  const [spuPageSize, setSpuPageSize] = useState<number>(20);

  const effectiveSize = spuPageSize === 99999 ? Math.max(spus.length, 1) : spuPageSize;
  const totalSpuPages = Math.ceil(spus.length / effectiveSize) || 1;
  const paginatedSpus = spuPageSize === 99999 ? spus : spus.slice((spuPage - 1) * spuPageSize, spuPage * spuPageSize);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* 1. Product Type Share Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">产品类型销售构成</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">共 {productTypes.length} 个类别</span>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
          {productTypes.map((item) => {
            const sharePct = (item.sharePercentage || 0) * 100;
            return (
              <div
                key={item.key}
                onClick={() => onSelectProductType(item.key)}
                className="group p-3 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors flex items-center space-x-1.5">
                    <span>{item.label}</span>
                    {item.key === 'Unmapped' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                        未匹配
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-slate-900">${item.finalSales.toFixed(2)}</span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>销量: {item.salesQuantity.toLocaleString()} 件</span>
                  <span>毛利率: {(item.basicGrossMargin * 100).toFixed(1)}%</span>
                  <span className="font-mono font-semibold text-indigo-700">全店占比: {sharePct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SPU Ranking Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150">
          <div className="flex items-center space-x-2">
            <Box className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">SPU 销售排行 (点击下钻深度趋势)</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">共 {spus.length} 个 SPU</span>
        </div>

        <div className="overflow-x-auto flex-1 max-h-[360px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">排名</th>
                <th className="py-2.5 px-3 font-semibold">SPU</th>
                <th className="py-2.5 px-3 font-semibold">产品类型</th>
                <th className="py-2.5 px-3 font-semibold text-right">销量</th>
                <th className="py-2.5 px-3 font-semibold text-right">销售额</th>
                <th className="py-2.5 px-3 font-semibold text-right">毛利率</th>
                <th className="py-2.5 px-3 font-semibold text-center">下钻</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {paginatedSpus.map((spu, index) => {
                const rank = (spuPage - 1) * (spuPageSize === 99999 ? 0 : spuPageSize) + index + 1;
                return (
                  <tr
                    key={spu.key}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => onSelectSpu(spu.key)}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {rank <= 3 ? (
                        <span className="inline-block w-4 h-4 text-center leading-4 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {rank}
                        </span>
                      ) : (
                        rank
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {spu.SPU}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[120px] truncate" title={spu.productType}>
                      {spu.productType}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {spu.salesQuantity.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ${spu.finalSales.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {(spu.basicGrossMargin * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 group-hover:text-emerald-600">
                      <ExternalLink className="w-3.5 h-3.5 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* SPU Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-150 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>每页:</span>
            <select
              value={spuPageSize}
              onChange={(e) => {
                setSpuPageSize(Number(e.target.value));
                setSpuPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 cursor-pointer font-medium"
            >
              <option value={10}>10</option>
              <option value={20}>20 (默认)</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={99999}>全部</option>
            </select>
            <span>
              显示 {(spuPage - 1) * effectiveSize + 1} - {Math.min(spuPage * effectiveSize, spus.length)} / 共 {spus.length} 个 SPU
            </span>
          </div>

          {spuPageSize !== 99999 && totalSpuPages > 1 && (
            <div className="flex items-center space-x-1.5 font-mono">
              <button
                disabled={spuPage === 1}
                onClick={() => setSpuPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-slate-800">
                {spuPage} / {totalSpuPages}
              </span>
              <button
                disabled={spuPage === totalSpuPages}
                onClick={() => setSpuPage((p) => Math.min(totalSpuPages, p + 1))}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
