/**
 * Jest stand-in for `@/lib/users`. The real module opens a Postgres connection
 * through the ESM-only `postgres` driver, which Jest's CommonJS runtime cannot
 * load; unit tests mock the directory instead (wired in jest.config.js).
 */
import { jest } from '@jest/globals'

export const getUserById = jest.fn(async () => null)
export const getUsersByIds = jest.fn(async () => new Map())
export const getUserByEmail = jest.fn(async () => null)
export const listUsers = jest.fn(async () => [])
export const deleteUser = jest.fn(async () => undefined)
export const updateUserName = jest.fn(async () => undefined)
export const createUserWithPassword = jest.fn(async () => { throw new Error('not mocked') })
