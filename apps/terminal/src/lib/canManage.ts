import { createClient } from '@/lib/supabase/server'

/**
 * Server-side canManage check.
 * Returns true if the user is admin OR holds a non-Membre position
 * in the given context (project or cellule).
 */
export async function canManageInContext(
  userId: string,
  contextType: 'project' | 'cellule',
  contextId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true

  const supabase = await createClient()

  if (contextType === 'project') {
    const { data: positions } = await supabase
      .from('project_positions')
      .select('id, position_name')
      .eq('project_id', contextId)

    const mgmtIds = new Set(
      (positions || [])
        .filter(p => !p.position_name.toLowerCase().includes('membre'))
        .map(p => p.id)
    )

    const { data: membership } = await supabase
      .from('project_members')
      .select('position_id')
      .eq('project_id', contextId)
      .eq('user_id', userId)
      .single()

    return membership ? mgmtIds.has(membership.position_id) : false
  }

  if (contextType === 'cellule') {
    const { data: positions } = await supabase
      .from('cellule_positions')
      .select('id, position_name')
      .eq('cellule_id', contextId)

    const mgmtIds = new Set(
      (positions || [])
        .filter(p => !p.position_name.toLowerCase().includes('membre'))
        .map(p => p.id)
    )

    const { data: membership } = await supabase
      .from('cellule_members')
      .select('position_id')
      .eq('cellule_id', contextId)
      .eq('user_id', userId)
      .single()

    return membership ? mgmtIds.has(membership.position_id) : false
  }

  return false
}

/**
 * Server-side check: does the user hold ANY non-Membre position
 * across all projects and cellules? Used for event creation permission.
 */
export async function canCreateEvents(
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true

  const supabase = await createClient()

  const [{ data: pmRows }, { data: cmRows }] = await Promise.all([
    supabase
      .from('project_members')
      .select('project_positions(position_name)')
      .eq('user_id', userId),
    supabase
      .from('cellule_members')
      .select('cellule_positions(position_name)')
      .eq('user_id', userId),
  ])

  const allPositions = [
    ...(pmRows || []).map((r: any) => r.project_positions?.position_name || ''),
    ...(cmRows || []).map((r: any) => r.cellule_positions?.position_name || ''),
  ]

  return allPositions.some(p => !p.toLowerCase().includes('membre'))
}