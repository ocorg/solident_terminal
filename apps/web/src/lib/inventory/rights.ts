import 'server-only'
import { prisma } from '@solident/db'
import { isContextManager, type SpaceUser } from '@/lib/space'

// Inventory rights (decided 27 Oct 2026):
// - any member: sees everything, logs their own collecte, creates a catalogue item on the fly,
//   transfers / consumes from their own stock, starts and fills a count draft;
// - logistics managers (non-"membre" position in the Logistique cellule) + space admins:
//   catalogue, move anyone's stock, undo movements, validate any count, edit any needs list;
// - managers of a project: its needs list and its bilan (start + validate);
// - website admins only: wipe the demo data.

export type InventoryRights = {
  logistics: boolean
  canManageCatalog: boolean
  canMoveAny: boolean
  canUndo: boolean
  /** Validate counts / edit needs of the given project (or general counts when no project). */
  canManageProject: boolean
  canClearDemo: boolean
}

/** Manager of the logistics cellule (name contains "logisti"), excluding plain "Membre" positions. */
async function isLogisticsManager(userId: string) {
  const m = await prisma.celluleMember.findFirst({
    where: {
      userId,
      cellule: { name: { contains: 'logisti', mode: 'insensitive' } },
      NOT: { position: { name: { contains: 'membre', mode: 'insensitive' } } },
    },
    select: { id: true },
  })
  return !!m
}

export async function inventoryRights(user: SpaceUser, projectId?: string | null): Promise<InventoryRights> {
  const logistics = user.isSpaceAdmin || (await isLogisticsManager(user.id))
  const canManageProject = logistics || (!!projectId && (await isContextManager(user, 'project', projectId)))
  return {
    logistics,
    canManageCatalog: logistics,
    canMoveAny: logistics,
    canUndo: logistics,
    canManageProject,
    canClearDemo: user.role === 'admin',
  }
}
