/**
 * In-process publish/subscribe for live features (session boards). Lives on
 * globalThis so it survives module reloads. It only reaches clients connected
 * to this web process, which is all of them while Mathium runs as a single
 * container; running several web replicas would need Redis or Postgres
 * LISTEN/NOTIFY here instead.
 */
export type LiveEvent = { type: string; from?: string; [key: string]: unknown }
type Listener = (event: LiveEvent) => void

const g = globalThis as unknown as { __mathiumBus?: Map<string, Set<Listener>> }
const rooms = (g.__mathiumBus ??= new Map())

export function subscribe(room: string, listener: Listener): () => void {
  let set = rooms.get(room)
  if (!set) rooms.set(room, (set = new Set()))
  set.add(listener)
  return () => {
    set!.delete(listener)
    if (set!.size === 0) rooms.delete(room)
  }
}

export function publish(room: string, event: LiveEvent) {
  for (const listener of rooms.get(room) ?? []) {
    try { listener(event) } catch { /* a broken stream must not stop the others */ }
  }
}

export function listenerCount(room: string) {
  return rooms.get(room)?.size ?? 0
}
