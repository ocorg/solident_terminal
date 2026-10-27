import type { Metadata } from 'next'
import { prisma } from '@solident/db'
import { ContextPage } from '../../_lib/context-page'

export async function generateMetadata({ params }: PageProps<'/espace/projets/[id]'>): Promise<Metadata> {
  const { id } = await params
  const row = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.project.findUnique({ where: { id }, select: { name: true } }) : null
  return { title: row?.name ?? 'Projet' }
}

export default async function ProjectPage({ params }: PageProps<'/espace/projets/[id]'>) {
  const { id } = await params
  return <ContextPage type="project" id={id} />
}
