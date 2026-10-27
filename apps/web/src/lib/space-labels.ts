// Members area vocabulary, identical to Solident Terminal (shared by server and client code).
import type { Tone } from '@/components/ui/tones'
import type { ApprovalStatus, ProjectStatus, Rsvp, TaskPriority, TaskStatus, TeamEventType } from '@solident/db'

// No emoji: statuses are shown as tags (components/ui Tag) and priorities as a coloured mark.
export const taskStatusLabel: Record<TaskStatus, string> = { a_faire: 'À faire', en_cours: 'En cours', bloque: 'Bloqué', termine: 'Terminé' }
export const taskStatusTone: Record<TaskStatus, Tone> = { a_faire: 'navy', en_cours: 'gold', bloque: 'danger', termine: 'success' }
export const taskPriorityLabel: Record<TaskPriority, string> = { urgent: 'Urgent', eleve: 'Élevée', moyen: 'Moyenne', faible: 'Faible' }
/** Colour of the priority mark (a small bar, not an emoji). */
export const taskPriorityColor: Record<TaskPriority, string> = { urgent: 'bg-danger', eleve: 'bg-gold-600', moyen: 'bg-gold-500', faible: 'bg-navy-100' }
export const priorityRank: Record<TaskPriority, number> = { urgent: 0, eleve: 1, moyen: 2, faible: 3 }

export const projectStatusLabel: Record<ProjectStatus, string> = { actif: 'Actif', en_pause: 'En pause', bloque: 'Bloqué', termine: 'Terminé' }
export const projectStatusTone: Record<ProjectStatus, Tone> = { actif: 'success', en_pause: 'gold', bloque: 'danger', termine: 'muted' }
export const approvalLabel: Record<ApprovalStatus, string> = { en_attente: 'En attente', approuve: 'Approuvé', rejete: 'Rejeté' }
export const approvalTone: Record<ApprovalStatus, Tone> = { en_attente: 'gold', approuve: 'success', rejete: 'danger' }
export const teamEventTypeLabel: Record<TeamEventType, string> = { activite: 'Activité', action: 'Action', reunion: 'Réunion', evenement: 'Événement' }
export const rsvpLabel: Record<Rsvp, string> = { oui: 'Oui', non: 'Non', en_attente: 'En attente' }

export const TASK_STATUSES = Object.keys(taskStatusLabel) as TaskStatus[]
export const TASK_PRIORITIES = Object.keys(taskPriorityLabel) as TaskPriority[]
export const PROJECT_STATUSES = Object.keys(projectStatusLabel) as ProjectStatus[]
export const TEAM_EVENT_TYPES = Object.keys(teamEventTypeLabel) as TeamEventType[]

/** Positions whose name does not contain "membre" are management positions (Terminal rule). */
export const isManagementPosition = (name: string) => !name.toLowerCase().includes('membre')

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
