import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 p-6 rounded-[28px] w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] transition-colors border border-slate-200 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex justify-center mb-4 text-amber-500">
          <AlertCircle size={48} />
        </div>
        <h3
          id="confirm-dialog-title"
          className="text-xl font-bold mb-2 text-center text-slate-950 dark:text-white"
        >
          {title}
        </h3>
        <p className="text-slate-600 dark:text-slate-300 mb-6 text-center text-sm font-medium">
          {message}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 py-3 text-xs">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary flex-1 py-3 text-xs bg-error hover:bg-red-600 border-error"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
