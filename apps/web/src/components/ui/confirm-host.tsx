'use client'

import { useEffect, useState } from 'react'
import { ConfirmDialog, type ConfirmOpts } from './index'

// One confirmation dialog per page (mounted in the root layouts), callable from anywhere:
//   if (!(await askConfirm({ title: 'Supprimer ?', confirm: 'Supprimer', danger: true }))) return
type Pending = ConfirmOpts & { resolve: (v: boolean) => void }
let show: ((p: Pending) => void) | null = null

export function askConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...opts, resolve })
    else resolve(window.confirm(opts.title)) // host not mounted (should not happen)
  })
}

export function ConfirmHost() {
  const [state, setState] = useState<Pending | null>(null)
  useEffect(() => {
    show = setState
    return () => {
      show = null
    }
  }, [])
  return <ConfirmDialog state={state} onDone={() => setState(null)} />
}
