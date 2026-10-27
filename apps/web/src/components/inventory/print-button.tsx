'use client'

import { IconPrint } from '@/components/ui/icons'
import { Btn } from '@/components/ui'

export function PrintButton() {
  return (
    <Btn variant="secondary" icon={<IconPrint />} onClick={() => window.print()}>
      Imprimer
    </Btn>
  )
}
