import OpenAI from 'openai'

/**
 * Shared OpenAI client, created on first use so that importing a route module
 * (for example while `next build` collects page data) never requires the API
 * key to be present.
 */
let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
