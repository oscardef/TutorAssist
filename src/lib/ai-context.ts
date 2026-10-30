import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Who an AI call is made for, carried through async code so the OpenAI
 * client can attribute usage (lib/openai.ts) without every call site passing
 * it. Routes set it in aiAccessError(); the worker sets it per job.
 */
export interface AIContext {
  workspaceId: string | null
  userId: string | null
  operation: string
  jobId?: string
}

const storage = new AsyncLocalStorage<AIContext>()

export function currentAIContext(): AIContext | undefined {
  return storage.getStore()
}

/** Set the context for the rest of the current request. */
export function enterAIContext(ctx: AIContext) {
  storage.enterWith(ctx)
}

export function runWithAIContext<T>(ctx: AIContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}
