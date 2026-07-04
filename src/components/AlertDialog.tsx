import { CheckCircle2 } from 'lucide-react';

interface AlertDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

export function AlertDialog({ title, message, onClose }: AlertDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 p-6 rounded-[28px] w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] text-center transition-colors border border-slate-200 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        <div className="flex justify-center mb-4 text-emerald-500">
          <CheckCircle2 size={48} />
        </div>
        <h3
          id="alert-dialog-title"
          className="text-xl font-bold mb-2 text-slate-900 dark:text-white"
        >
          {title}
        </h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <button onClick={onClose} className="btn-primary w-full py-3 text-xs">
          Aceptar
        </button>
      </div>
    </div>
  );
}
