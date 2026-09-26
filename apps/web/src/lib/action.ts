// Result shape of every server action (CLAUDE.md conventions).
// Expected, user-facing errors are returned as data: Next.js hides thrown error messages in production.
export type ActionResult<T> = { status: 'success'; data: T } | { status: 'error'; message: string }

export const ok = <T>(data: T): ActionResult<T> => ({ status: 'success', data })
export const fail = (message: string): ActionResult<never> => ({ status: 'error', message })

/** Runs an action body and turns thrown errors (Zod, guards, DB) into a generic error result. */
export async function run<T>(body: () => Promise<ActionResult<T>>, fallback = 'Une erreur est survenue. Réessayez.') {
  try {
    return await body()
  } catch (e) {
    if (e && typeof e === 'object' && 'issues' in e) return fail('Certains champs sont invalides.')
    if (e instanceof Error && ['Non connecté', 'Accès refusé'].includes(e.message)) return fail(e.message)
    console.error(e)
    return fail(fallback)
  }
}
