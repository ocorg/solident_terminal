import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'

// Browser calls go through /api/auth, so Better Auth's validation and rate limits apply.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] })

/** French messages for Better Auth error codes shown in toasts. */
export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.status === 429) return 'Trop de tentatives. Patientez une minute puis réessayez.'
  switch (error?.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'E-mail ou mot de passe incorrect.'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'Un compte existe déjà avec cet e-mail. Connectez-vous, ou utilisez « Mot de passe oublié ».'
    case 'PASSWORD_TOO_SHORT':
      return 'Le mot de passe doit contenir au moins 8 caractères.'
    case 'PASSWORD_TOO_LONG':
      return 'Mot de passe trop long.'
    case 'INVALID_EMAIL':
      return 'Adresse e-mail invalide.'
    case 'INVALID_TOKEN':
      return 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.'
    case 'FAILED_TO_CREATE_SESSION':
      return "Votre compte n'est pas encore validé par un administrateur."
    default:
      return 'Une erreur est survenue. Réessayez.'
  }
}
