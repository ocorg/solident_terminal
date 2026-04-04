import { useState } from 'react'

export interface Toast {
  msg: string
  ok: boolean
}

export function useToast() {
  const [toast,        setToast]        = useState<Toast | null>(null)
  const [toastLeaving, setToastLeaving] = useState(false)

  function showToast(msg: string, ok = true) {
    setToastLeaving(false)
    setToast({ msg, ok })
    setTimeout(() => setToastLeaving(true), 2800)
    setTimeout(() => { setToast(null); setToastLeaving(false) }, 3500)
  }

  return { toast, toastLeaving, showToast }
}

export function ToastStyle(toastLeaving: boolean) {
  return {
    animation: toastLeaving
      ? 'toastOut 0.4s cubic-bezier(0.36,0,0.66,0) forwards'
      : 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards'
  }
}