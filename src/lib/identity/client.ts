'use client'

import { createAuthClient } from 'better-auth/react'

/** Browser-side auth client (sign in, sign up, sign out, password reset). */
export const authClient = createAuthClient()
