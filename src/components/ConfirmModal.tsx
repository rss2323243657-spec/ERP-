import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = '确认清除',
  cancelText = '取消',
  isDangerous = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDangerous ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <span className="text-xs text-slate-500">此操作将更新系统本地数据状态</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs cursor-pointer transition-colors flex items-center space-x-1.5 ${
              isDangerous ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
