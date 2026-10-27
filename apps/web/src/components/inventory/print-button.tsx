'use client'

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ghost min-h-11">
      Imprimer
    </button>
  )
}
