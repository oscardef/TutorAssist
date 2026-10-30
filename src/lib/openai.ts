import OpenAI from 'openai'
import { currentAIContext } from '@/lib/ai-context'
import { logAIUsage } from '@/lib/ai-usage'

/**
 * Shared OpenAI client, created on first use so that importing a route module
 * (for example while `next build` collects page data) never requires the API
 * key to be present.
 *
 * Every chat and embedding call is logged to ai_usage_log with its tokens and
 * estimated cost, attributed from the current AI context (lib/ai-context.ts).
 * Usage limits (lib/ai-access.ts) are measured from that log.
 */
let client: OpenAI | null = null

function record(model: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null, started: number, success: boolean, error?: unknown) {
  const ctx = currentAIContext()
  void logAIUsage({
    workspaceId: ctx?.workspaceId ?? null,
    userId: ctx?.userId ?? null,
    operationType: ctx?.operation ?? 'unattributed',
    model,
    tokensInput: usage?.prompt_tokens ?? 0,
    tokensOutput: usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
    success,
    errorMessage: error instanceof Error ? error.message.slice(0, 500) : undefined,
    jobId: ctx?.jobId,
  })
}

function instrument(c: OpenAI) {
  const chat = c.chat.completions
  const chatCreate = chat.create.bind(chat) as (...args: unknown[]) => Promise<unknown>
  ;(chat as unknown as { create: unknown }).create = async (...args: unknown[]) => {
    const body = args[0] as { model: string }
    const started = Date.now()
    try {
      const res = await chatCreate(...args) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }
      record(body.model, res?.usage, started, true)
      return res
    } catch (error) {
      record(body.model, null, started, false, error)
      throw error
    }
  }
  const emb = c.embeddings
  const embCreate = emb.create.bind(emb) as (...args: unknown[]) => Promise<unknown>
  ;(emb as unknown as { create: unknown }).create = async (...args: unknown[]) => {
    const body = args[0] as { model: string }
    const started = Date.now()
    try {
      const res = await embCreate(...args) as { usage?: { prompt_tokens?: number } }
      record(body.model, res?.usage, started, true)
      return res
    } catch (error) {
      record(body.model, null, started, false, error)
      throw error
    }
  }
}

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    instrument(client)
  }
  return client
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const real = getOpenAI() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})
