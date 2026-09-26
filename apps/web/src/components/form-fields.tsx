'use client'

import { useState } from 'react'
import { Spinner } from './spinner'

export const inputClass =
  'w-full rounded-[10px] border border-navy-100 bg-white px-4 py-3 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-100'

export function Field({ id, label, children }: { id: string; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-navy-900">
        {label}
      </label>
      {children}
    </div>
  )
}

export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${inputClass} pe-24`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-0 px-4 text-sm text-navy-700 hover:underline"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? 'Masquer' : 'Afficher'}
      </button>
    </div>
  )
}

export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy-700 px-4 py-3 font-semibold text-white transition hover:brightness-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
