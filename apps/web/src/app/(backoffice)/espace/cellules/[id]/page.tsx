import type { Metadata } from 'next'
import { prisma } from '@solident/db'
import { ContextPage } from '../../_lib/context-page'

export async function generateMetadata({ params }: PageProps<'/espace/cellules/[id]'>): Promise<Metadata> {
  const { id } = await params
  const row = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.cellule.findUnique({ where: { id }, select: { name: true } }) : null
  return { title: row?.name ?? 'Cellule' }
}

export default async function CellulePage({ params }: PageProps<'/espace/cellules/[id]'>) {
  const { id } = await params
  return <ContextPage type="cellule" id={id} />
}
