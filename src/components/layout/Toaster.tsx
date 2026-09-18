import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useErp } from '../../context/ErpContext';

export const Toaster: React.FC = () => {
  const { toasts, dismissToast } = useErp();

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 p-3 rounded-lg border shadow-lg text-xs ${
            t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {t.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
