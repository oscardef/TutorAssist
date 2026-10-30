import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * Live state of a session whiteboard. Elements are merged by Excalidraw's
 * rule (higher version wins; on a tie the lower versionNonce wins) so every
 * client converges, and the scene is written to session_boards a few seconds
 * after the last change.
 */
export interface BoardElement { id: string; version: number; versionNonce: number; index?: string | null; isDeleted?: boolean; [key: string]: unknown }

export interface ShownQuestion {
  id: string
  prompt_text: string
  prompt_latex: string | null
  figure_json: unknown
  prompt_image_r2_key: string | null
}

interface BoardState {
  sessionId: string
  workspaceId: string
  elements: Map<string, BoardElement>
  question: ShownQuestion | null
  saveTimer: ReturnType<typeof setTimeout> | null
}

const g = globalThis as unknown as { __mathiumBoards?: Map<string, Promise<BoardState>> }
const boards = (g.__mathiumBoards ??= new Map())

export interface RoomAccess {
  userId: string
  name: string
  isTutor: boolean
  session: { id: string; workspace_id: string; student_id: string | null; status: string | null; actual_start: string | null; meet_link: string | null; scheduled_at: string | null; duration_minutes: number | null; session_notes: string | null }
}

// Pointer updates arrive many times a second; cache who may use a room briefly
const accessCache = new Map<string, { access: RoomAccess; expires: number }>()

export async function authorizeRoom(sessionId: string, cookie: string | null): Promise<RoomAccess | null> {
  const key = `${sessionId}:${cookie ?? ''}`
  const hit = accessCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.access

  const user = await getUser()
  if (!user) return null
  const supabase = await createServerClient()
  // RLS: visible to the workspace's tutors and to the session's student
  const { data: session } = await supabase
    .from('sessions')
    .select('id, workspace_id, student_id, status, actual_start, meet_link, scheduled_at, duration_minutes, session_notes')
    .eq('id', sessionId)
    .maybeSingle()
  if (!session) return null
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', session.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()
  const isTutor = member?.role === 'tutor' || member?.role === 'platform_owner'
  if (!isTutor && session.student_id !== user.id) return null
  const access: RoomAccess = { userId: user.id, name: user.name || user.email, isTutor, session }
  accessCache.set(key, { access, expires: Date.now() + 30_000 })
  if (accessCache.size > 500) for (const [k, v] of accessCache) if (v.expires < Date.now()) accessCache.delete(k)
  return access
}

async function load(sessionId: string, workspaceId: string): Promise<BoardState> {
  const admin = await createAdminClient()
  const { data } = await admin.from('session_boards').select('scene_json, shown_question_id').eq('session_id', sessionId).maybeSingle()
  const elements = new Map<string, BoardElement>()
  for (const el of ((data?.scene_json as { elements?: BoardElement[] } | null)?.elements ?? [])) elements.set(el.id, el)
  const question = data?.shown_question_id ? await fetchQuestion(data.shown_question_id, workspaceId) : null
  return { sessionId, workspaceId, elements, question, saveTimer: null }
}

export function getBoard(sessionId: string, workspaceId: string): Promise<BoardState> {
  let b = boards.get(sessionId)
  if (!b) {
    b = load(sessionId, workspaceId)
    boards.set(sessionId, b)
    b.catch(() => boards.delete(sessionId))
  }
  return b
}

export function sceneElements(board: BoardState): BoardElement[] {
  return [...board.elements.values()].sort((a, b) => ((a.index ?? '') < (b.index ?? '') ? -1 : (a.index ?? '') > (b.index ?? '') ? 1 : 0))
}

/** Merge incoming elements; returns the ones that changed the board. */
export function mergeElements(board: BoardState, incoming: BoardElement[]): BoardElement[] {
  const changed: BoardElement[] = []
  for (const el of incoming) {
    if (!el || typeof el.id !== 'string' || typeof el.version !== 'number') continue
    const cur = board.elements.get(el.id)
    if (!cur || el.version > cur.version || (el.version === cur.version && el.versionNonce < cur.versionNonce)) {
      board.elements.set(el.id, el)
      changed.push(el)
    }
  }
  if (changed.length) scheduleSave(board)
  return changed
}

export async function setShownQuestion(board: BoardState, questionId: string | null) {
  board.question = questionId ? await fetchQuestion(questionId, board.workspaceId) : null
  scheduleSave(board)
  return board.question
}

function scheduleSave(board: BoardState) {
  if (board.saveTimer) clearTimeout(board.saveTimer)
  board.saveTimer = setTimeout(() => { board.saveTimer = null; void save(board) }, 3000)
}

async function save(board: BoardState) {
  try {
    const admin = await createAdminClient()
    await admin.from('session_boards').upsert({
      session_id: board.sessionId,
      workspace_id: board.workspaceId,
      scene_json: { elements: sceneElements(board).filter(e => !e.isDeleted) },
      shown_question_id: board.question?.id ?? null,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[session-board] save failed', err)
  }
}

async function fetchQuestion(id: string, workspaceId: string): Promise<ShownQuestion | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('questions')
    .select('id, prompt_text, prompt_latex, figure_json, prompt_image_r2_key')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return (data as ShownQuestion | null) ?? null
}
