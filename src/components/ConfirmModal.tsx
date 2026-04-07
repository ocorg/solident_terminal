'use client'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  danger = false, onConfirm, onCancel
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 ${danger ? 'bg-red-100 dark:bg-red-500/20' : 'bg-[#1E5F7A]/10'}`}>
          {danger ? '⚠️' : '❓'}
        </div>
        <h3 className="text-gray-900 dark:text-white font-bold text-center text-lg mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98] ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1E5F7A] hover:bg-[#2a7a9a]'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}