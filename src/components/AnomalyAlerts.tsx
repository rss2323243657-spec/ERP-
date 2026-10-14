import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { AnomalyItem } from '../types/sales';

interface AnomalyAlertsProps {
  anomalies: AnomalyItem[];
  onNavigateToQuality?: () => void;
}

export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({ anomalies }) => {
  if (!anomalies || anomalies.length === 0) return null;

  return (
    <div className="mb-6 space-y-2.5">
      <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>销售异常诊断预警 ({anomalies.length} 项)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {anomalies.map((item) => {
          const isDanger = item.level === 'danger';
          const isWarning = item.level === 'warning';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border text-xs flex items-start space-x-3 transition-all ${
                isDanger
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : isWarning
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDanger ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{item.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                      isDanger
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isWarning
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <p className="mt-1 text-slate-700 text-[11px] leading-relaxed">{item.description}</p>
                <div className="mt-1.5 text-slate-600 text-[11px] flex items-center space-x-1">
                  <span className="text-amber-800 font-bold">建议行动:</span>
                  <span>{item.suggestedAction}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
