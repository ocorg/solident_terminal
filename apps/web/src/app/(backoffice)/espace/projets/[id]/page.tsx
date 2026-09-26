import { ContextPage } from '../../_lib/context-page'

export default async function ProjectPage({ params }: PageProps<'/espace/projets/[id]'>) {
  const { id } = await params
  return <ContextPage type="project" id={id} />
}
