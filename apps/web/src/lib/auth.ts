import 'server-only'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins/magic-link'
import { prisma } from '@solident/db'
import { accessRequestEmail, existingAccountEmail, magicLinkEmail, resetPasswordEmail, sendMail } from './mail'

const DAY = 60 * 60 * 24

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: { database: { generateId: 'uuid' } },
  session: {
    expiresIn: 30 * DAY, // stay logged in 30 days
    updateAge: DAY, // sliding: extended at most once a day while in use
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: false, // new accounts wait for admin approval
    resetPasswordTokenExpiresIn: 60 * 60, // reset link valid 1 h
    revokeSessionsOnPasswordReset: true,
    // Sign-up with an existing email answers like a success (hides who has an account);
    // the real owner gets a heads-up instead.
    async onExistingUserSignUp({ user }) {
      const mail = existingAccountEmail(user.name)
      await sendMail(user.email, mail.subject, mail.html, mail.text)
    },
    async sendResetPassword({ user, url }) {
      const mail = resetPasswordEmail(url, user.name)
      await sendMail(user.email, mail.subject, mail.html, mail.text)
    },
  },
  user: {
    additionalFields: {
      // input: false → never settable from a sign-up request; managed with `pnpm db:user` / /admin/utilisateurs
      role: { type: 'string', input: false },
      isActive: { type: 'boolean', input: false },
    },
  },
  // Brute-force protection, stored in Postgres so it holds across Vercel instances (dev included, to test it).
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/sign-in/magic-link': { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every self-created account starts as an inactive member until an admin approves it.
        before: async (user) => ({ data: { ...user, role: 'member', isActive: false } }),
        after: async (user) => {
          const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true } })
          const mail = accessRequestEmail({ name: user.name, email: user.email })
          const results = await Promise.allSettled(admins.map((a) => sendMail(a.email, mail.subject, mail.html, mail.text)))
          results.forEach((r) => r.status === 'rejected' && console.error('New-account alert failed:', r.reason))
        },
      },
    },
    // A deactivated member cannot open a new session.
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } })
          return user?.isActive ? undefined : false
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: DAY, // link valid 24 h, single use
      disableSignUp: true,
      async sendMagicLink({ email, url }) {
        // Unknown or inactive emails get no email, but the caller sees the same response,
        // so the login page never reveals who is a member.
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
        if (!user?.isActive) return
        const mail = magicLinkEmail(url, user.name)
        await sendMail(email, mail.subject, mail.html, mail.text)
      },
    }),
    nextCookies(), // must stay last
  ],
})

export type Session = typeof auth.$Infer.Session
