import { ContextPage } from '../../_lib/context-page'

export default async function CellulePage({ params }: PageProps<'/espace/cellules/[id]'>) {
  const { id } = await params
  return <ContextPage type="cellule" id={id} />
}
