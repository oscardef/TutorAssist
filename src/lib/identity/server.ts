import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { nextCookies } from 'better-auth/next-js'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db, identity } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { passwordResetEmail, verifyEmailEmail } from '@/lib/email-templates'

const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Better Auth instance. Passwords are bcrypt so the hashes migrated from
 * Supabase Auth keep working; new passwords are bcrypt too.
 */
export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  appName: 'Mathium',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: identity.users,
      session: identity.sessions,
      account: identity.accounts,
      verification: identity.verifications,
    },
  }),
  advanced: {
    database: { generateId: () => randomUUID() },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({ to: user.email, subject: 'Reset your Mathium password', html: passwordResetEmail(user.name, url) })
    },
  },
  emailVerification: {
    sendOnSignUp: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({ to: user.email, subject: 'Confirm your Mathium email', html: verifyEmailEmail(user.name, url) })
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  trustedOrigins: [baseURL],
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
