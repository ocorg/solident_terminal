import 'server-only'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins/magic-link'
import { prisma } from '@solident/db'
import { magicLinkEmail, sendMail } from './mail'

const DAY = 60 * 60 * 24

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: { database: { generateId: 'uuid' } },
  session: {
    expiresIn: 30 * DAY, // stay logged in 30 days
    updateAge: DAY, // sliding: extended at most once a day while in use
  },
  user: {
    additionalFields: {
      // input: false → never settable from a sign-in request; managed in /admin/utilisateurs
      role: { type: 'string', input: false },
      isActive: { type: 'boolean', input: false },
    },
  },
  databaseHooks: {
    // Invite-only: nobody is ever created through the login flow.
    user: { create: { before: async () => false } },
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
