import React, { useState } from 'react';
import { LineChart, BarChart2, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { AggregatedRow, FilterState } from '../types/sales';

interface SalesTrendChartProps {
  data: AggregatedRow[];
  granularity: FilterState['timeGranularity'];
  activeMetric: FilterState['primaryMetric'];
  onMetricChange: (metric: FilterState['primaryMetric']) => void;
  showAiAutoAnalysis?: boolean;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data,
  granularity,
  activeMetric,
  onMetricChange,
  showAiAutoAnalysis = true,
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [showValueLabels, setShowValueLabels] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 mb-6">
        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-medium text-slate-500">暂无当前筛选范围内的走势数据，请调整时间范围或清除筛选条件</p>
      </div>
    );
  }

  const metricLabels: Record<FilterState['primaryMetric'], { name: string; unit: string; isCurrency: boolean }> = {
    finalSales: { name: '最终销售额', unit: '$', isCurrency: true },
    salesQuantity: { name: '销售量', unit: '件', isCurrency: false },
    salesCost: { name: '销售成本', unit: '$', isCurrency: true },
    basicGrossProfit: { name: '基础毛利', unit: '$', isCurrency: true },
    basicGrossMargin: { name: '基础毛利率', unit: '%', isCurrency: false },
    averageSellingPrice: { name: '平均售价 (ASP)', unit: '$', isCurrency: true },
  };

  const currentMetricConfig = metricLabels[activeMetric];

  const getVal = (item: AggregatedRow) => {
    switch (activeMetric) {
      case 'finalSales':
        return item.finalSales;
      case 'salesQuantity':
        return item.salesQuantity;
      case 'salesCost':
        return item.salesCost;
      case 'basicGrossProfit':
        return item.basicGrossProfit;
      case 'basicGrossMargin':
        return item.basicGrossMargin * 100;
      case 'averageSellingPrice':
        return item.averageSellingPrice;
      default:
        return item.finalSales;
    }
  };

  const values = data.map((d) => getVal(d));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  // Generous column widths ensuring zero visual overlap of bars, points, and labels
  const colWidth = (() => {
    if (granularity === 'day') {
      return 72; // 72px gives comfortable spacing for bars and dates
    }
    if (granularity === 'week') {
      return 96; // 96px ensures week labels and sublabels never overlap
    }
    if (granularity === 'month') {
      return 110; // 110px gives spacious room for monthly numbers
    }
    if (granularity === 'quarter') {
      return 130;
    }
    // year / custom
    return 140;
  })();

  const minContainerWidth = 840;
  const paddingLeft = 75;
  const paddingRight = 55;
  const paddingTop = 45; // Ample room above bars for value pills
  const paddingBottom = 75; // Generous room below for labels and sublabels

  const contentWidth = Math.max(minContainerWidth, data.length * colWidth + paddingLeft + paddingRight);
  const svgWidth = contentWidth;
  const svgHeight = 320;

  const chartInnerWidth = svgWidth - paddingLeft - paddingRight;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  const getY = (val: number) => {
    if (maxVal === minVal) return paddingTop + chartInnerHeight / 2;
    const ratio = (val - minVal) / (maxVal - minVal);
    return paddingTop + chartInnerHeight - ratio * chartInnerHeight;
  };

  const colStep = data.length > 0 ? chartInnerWidth / data.length : colWidth;

  // Evenly distribute points across chartInnerWidth with centered column offset
  const getX = (idx: number) => {
    if (data.length <= 1) return paddingLeft + chartInnerWidth / 2;
    return paddingLeft + (idx + 0.5) * colStep;
  };

  const points = data.map((d, i) => `${getX(i)},${getY(getVal(d))}`).join(' ');

  const formatValue = (v: number) => {
    if (currentMetricConfig.isCurrency) {
      return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (activeMetric === 'basicGrossMargin') {
      return `${v.toFixed(2)}%`;
    }
    return v.toLocaleString();
  };

  const latestItem = data[data.length - 1];
  const previousItem = data.length > 1 ? data[data.length - 2] : null;
  const momGrowth = previousItem && previousItem.finalSales > 0
    ? (latestItem.finalSales - previousItem.finalSales) / previousItem.finalSales
    : null;
  const momQtyGrowth = previousItem && previousItem.salesQuantity > 0
    ? (latestItem.salesQuantity - previousItem.salesQuantity) / previousItem.salesQuantity
    : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs mb-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              销售走势分析
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              · {data.length} 个周期 ({currentMetricConfig.name})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            自适应间距展示 · 点击上方指标切换走势
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Metric Selector Tabs */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => onMetricChange('finalSales')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'finalSales' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              最终销售额
            </button>
            <button
              onClick={() => onMetricChange('salesQuantity')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'salesQuantity' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              最终销量
            </button>
            <button
              onClick={() => onMetricChange('basicGrossProfit')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'basicGrossProfit' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              基础毛利
            </button>
            <button
              onClick={() => onMetricChange('averageSellingPrice')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'averageSellingPrice' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              平均售价 ASP
            </button>
          </div>

          {/* Line / Bar Switch */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded cursor-pointer ${
                chartType === 'line' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
              title="折线图"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded cursor-pointer ${
                chartType === 'bar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
              title="柱状图"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>

          {/* Show Value Labels Toggle */}
          <button
            type="button"
            onClick={() => setShowValueLabels(!showValueLabels)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              showValueLabels
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="显示或隐藏图表上方柱子/节点的具体数值标签"
          >
            {showValueLabels ? '✓ 数值已显示' : '显示数值'}
          </button>
        </div>
      </div>

      {/* Horizontally scrollable canvas with crisp 1:1 pixel rendering */}
      <div className="relative w-full overflow-x-auto pb-3 scrollbar-thin">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="overflow-visible select-none shrink-0"
        >
          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = paddingTop + chartInnerHeight * (1 - r);
            const gridVal = minVal + (maxVal - minVal) * r;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1.2"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {currentMetricConfig.isCurrency
                    ? `$${Math.round(gridVal).toLocaleString()}`
                    : Math.round(gridVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {chartType === 'line' && data.length > 1 && (
            <polygon
              points={`${points} ${getX(data.length - 1)},${paddingTop + chartInnerHeight} ${getX(0)},${paddingTop + chartInnerHeight}`}
              fill="url(#trendCleanGradient)"
              opacity="0.18"
            />
          )}

          {/* Line Path */}
          {chartType === 'line' && data.length > 1 && (
            <polyline
              fill="none"
              stroke="#0071dc"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )}

          {/* Bars / Points and Value Labels */}
          {data.map((d, i) => {
            const val = getVal(d);
            const cx = getX(i);
            const cy = getY(val);
            const isHovered = hoveredIdx === i;

            // Value text for label
            const displayValText = currentMetricConfig.isCurrency
              ? val >= 10000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`
              : activeMetric === 'basicGrossMargin'
              ? `${val.toFixed(1)}%`
              : val >= 10000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`;

            if (chartType === 'bar') {
              const barWidth = Math.max(16, Math.min(32, colStep * 0.44));
              const barHeight = Math.max(3, paddingTop + chartInnerHeight - cy);
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={cx - barWidth / 2}
                    y={cy}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    fill={isHovered ? '#00509d' : '#0071dc'}
                    className="transition-colors"
                  />
                  {(showValueLabels || isHovered) && (
                    <text
                      x={cx}
                      y={Math.max(14, cy - 6)}
                      textAnchor="middle"
                      className={`text-[10px] font-mono font-bold transition-all ${
                        isHovered ? 'fill-blue-900 font-extrabold' : 'fill-slate-600'
                      }`}
                    >
                      {displayValText}
                    </text>
                  )}
                </g>
              );
            }

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6.5 : 4.5}
                  fill="#ffffff"
                  stroke={isHovered ? '#00509d' : '#0071dc'}
                  strokeWidth={isHovered ? '3' : '2.2'}
                  className="transition-all"
                />
                {(showValueLabels || isHovered) && (
                  <text
                    x={cx}
                    y={Math.max(14, cy - 9)}
                    textAnchor="middle"
                    className={`text-[10px] font-mono font-bold transition-all ${
                      isHovered ? 'fill-blue-900 font-extrabold' : 'fill-slate-600'
                    }`}
                  >
                    {displayValText}
                  </text>
                )}
              </g>
            );
          })}

          {/* Clean X Axis labels: Dynamic stride (>= 85px between ticks) ensuring zero collisions */}
          {(() => {
            const minLabelInterval = 85; // Strict 85px minimum between labels
            const labelStep = Math.max(1, Math.ceil(minLabelInterval / colStep));

            return data.map((d, i) => {
              const isFirst = i === 0;
              const isLast = i === data.length - 1;
              const isStepMatch = i % labelStep === 0;

              // Don't show last tick if it's too close to the previous shown tick
              const prevShownIdx = Math.floor((data.length - 1) / labelStep) * labelStep;
              const isTooCloseToPrev = isLast && (i - prevShownIdx) < labelStep * 0.7;

              const show = (isStepMatch && !isLast) || (isLast && !isTooCloseToPrev) || isFirst;
              if (!show) return null;

              const cx = getX(i);

              // Ultra-concise label formatting to avoid long-string overlapping
              let displayLabel = d.label;
              let displaySubLabel = d.subLabel;

              if (granularity === 'day') {
                const m = d.label.match(/(\d{1,2})[月\/-](\d{1,2})/);
                displayLabel = m ? `${m[1]}/${m[2]}` : d.label.replace(/^\d{4}[年\/-]/, '').replace('月', '/').replace('日', '');
              } else if (granularity === 'week') {
                // e.g. "2025年第42周" -> "第42周"
                const wm = d.label.match(/第?\s*(\d+)\s*周/);
                displayLabel = wm ? `第${wm[1]}周` : d.label.replace(/^\d{4}[年\/-]/, '');
                // SubLabel: "10/13 - 10/19" -> "10/13~" (concise)
                if (d.subLabel) {
                  const sm = d.subLabel.match(/(\d{1,2}\/\d{1,2})/);
                  displaySubLabel = sm ? `${sm[1]}~` : d.subLabel;
                }
              } else if (granularity === 'month') {
                // e.g. "2025年10月" -> "10月" or "25-10"
                const mm = d.label.match(/(\d{4})[年\/-](\d{1,2})/);
                displayLabel = mm ? `${mm[1].substring(2)}/${mm[2]}月` : d.label;
              } else if (granularity === 'quarter') {
                // e.g. "2025-Q4" or "2025年Q4" -> "25-Q4"
                const qm = d.label.match(/(\d{4})[年\/-]?Q?(\d)/i);
                displayLabel = qm ? `${qm[1].substring(2)}-Q${qm[2]}` : d.label;
              }

              return (
                <g key={i}>
                  <text
                    x={cx}
                    y={svgHeight - 34}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-800 font-bold font-mono"
                  >
                    {displayLabel}
                  </text>
                  {displaySubLabel && (
                    <text
                      x={cx}
                      y={svgHeight - 18}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {displaySubLabel}
                    </text>
                  )}
                </g>
              );
            });
          })()}

          <defs>
            <linearGradient id="trendCleanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071dc" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0071dc" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-2 right-4 bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs pointer-events-none z-20 min-w-[210px]">
            <div className="border-b border-slate-100 pb-1.5 mb-2">
              <div className="font-bold text-slate-900">{data[hoveredIdx].label}</div>
              {data[hoveredIdx].subLabel && (
                <div className="text-[10px] text-slate-500 font-mono">{data[hoveredIdx].subLabel}</div>
              )}
            </div>
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span>{currentMetricConfig.name}:</span>
              <span className="font-mono font-bold text-blue-700">{formatValue(getVal(data[hoveredIdx]))}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>最终销量:</span>
              <span className="font-mono text-slate-800">{data[hoveredIdx].salesQuantity} 件</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>最终销售额:</span>
              <span className="font-mono text-slate-800">${data[hoveredIdx].finalSales.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>基础毛利:</span>
              <span className="font-mono text-emerald-700 font-semibold">${data[hoveredIdx].basicGrossProfit.toFixed(2)}</span>
            </div>
            {data[hoveredIdx].growthMoM !== null && data[hoveredIdx].growthMoM !== undefined && (
              <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-100 mt-1">
                <span>环比变化:</span>
                <span
                  className={`font-mono font-semibold ${
                    (data[hoveredIdx].growthMoM || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {(data[hoveredIdx].growthMoM || 0) >= 0 ? '+' : ''}
                  {((data[hoveredIdx].growthMoM || 0) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Automated AI Real-Time Insights & Warning Banner */}
      {showAiAutoAnalysis && latestItem && (
        <div className="mt-5 pt-4 border-t border-slate-150 bg-slate-50/80 p-4 rounded-xl text-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>当前趋势区间全自动 AI 诊断与异动预警</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              最新周期: {latestItem.label} {latestItem.subLabel ? `(${latestItem.subLabel})` : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">最新周期销售业绩</div>
              <div className="text-base font-bold text-slate-900 font-mono mt-1">
                ${latestItem.finalSales.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-1">
                <span>销量: {latestItem.salesQuantity} 件 · 毛利率:</span>
                <span className="text-emerald-700 font-semibold font-mono">
                  {(latestItem.basicGrossMargin * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">环比驱动逻辑诊断</div>
              <div className="text-base font-bold font-mono mt-1 flex items-center space-x-1">
                {momGrowth !== null ? (
                  <span className={momGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {momGrowth >= 0 ? '+' : ''}{(momGrowth * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-slate-400">基期无数据</span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {momGrowth !== null && momQtyGrowth !== null ? (
                  momQtyGrowth > 0 && momGrowth < 0 ? (
                    <span className="text-amber-800 font-semibold">⚠️ 量增额跌 (促销折扣严重侵蚀ASP)</span>
                  ) : momQtyGrowth < 0 && momGrowth > 0 ? (
                    <span className="text-blue-800 font-semibold">📈 量跌额增 (高客单款拉升平均售价)</span>
                  ) : momGrowth >= 0 ? (
                    <span className="text-emerald-800 font-semibold">✅ 量额同增 (产品动销良性健康)</span>
                  ) : (
                    <span className="text-rose-800 font-semibold">🔻 销量收缩驱动整体下滑</span>
                  )
                ) : (
                  <span>单周期基准分析中</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">运营实操核验方向</div>
              <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                当前系统核算数据准确。若近期发生业绩下滑，请核查 <strong>WFS (Walmart Fulfillment Services) 库存周转天数</strong> 与 <strong>Buy Box 胜率</strong>，避免误判广告效果。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
