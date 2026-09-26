// Members area vocabulary, identical to Solident Terminal (shared by server and client code).
import type { ApprovalStatus, ProjectStatus, Rsvp, TaskPriority, TaskStatus, TeamEventType } from '@solident/db'

export const taskStatusLabel: Record<TaskStatus, string> = { a_faire: '📋 À faire', en_cours: '🔄 En cours', bloque: '🚫 Bloqué', termine: '✅ Terminé' }
export const taskStatusStyle: Record<TaskStatus, string> = {
  a_faire: 'bg-navy-100 text-navy-700',
  en_cours: 'bg-gold-100 text-navy-900',
  bloque: 'bg-danger/15 text-danger',
  termine: 'bg-success/15 text-success',
}
export const taskPriorityLabel: Record<TaskPriority, string> = { urgent: '🔴 Urgent', eleve: '🟠 Élevé', moyen: '🟡 Moyen', faible: '🟢 Faible' }
export const priorityRank: Record<TaskPriority, number> = { urgent: 0, eleve: 1, moyen: 2, faible: 3 }

export const projectStatusLabel: Record<ProjectStatus, string> = { actif: 'Actif', en_pause: 'En pause', bloque: 'Bloqué', termine: 'Terminé' }
export const projectStatusStyle: Record<ProjectStatus, string> = {
  actif: 'bg-success/15 text-success',
  en_pause: 'bg-gold-100 text-navy-900',
  bloque: 'bg-danger/15 text-danger',
  termine: 'bg-navy-100 text-navy-700',
}
export const approvalLabel: Record<ApprovalStatus, string> = { en_attente: 'En attente', approuve: 'Approuvé', rejete: 'Rejeté' }
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
