import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { getFile, isValidKey, workspaceIdFromKey, localContentType, isLocalStorage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/storage'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Serves and accepts files for the local storage backend. A caller must be a
 * member of the workspace the key belongs to.
 */
async function authorise(key: string) {
  if (!isValidKey(key)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const context = await getUserContext()
  if (!context) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (workspaceIdFromKey(key) !== context.workspaceId && !context.isPlatformOwner) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { context }
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join('/')
  const auth = await authorise(key)
  if (auth.error) return auth.error
  try {
    const body = await getFile(key)
    const contentType = (await localContentType(key)) || 'application/octet-stream'
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(body.length),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    }
    // Uploaded files come from users. An SVG opened directly could run script
    // on our origin, so markup types get a policy that allows no script at all.
    if (/svg|html|xml/.test(contentType)) {
      headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    }
    return new NextResponse(new Uint8Array(body), { headers })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage()) return NextResponse.json({ error: 'Direct upload not supported for this backend' }, { status: 400 })
  const key = (await params).key.join('/')
  const auth = await authorise(key)
  if (auth.error) return auth.error
  if (auth.context.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const contentType = request.headers.get('content-type') || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.includes(contentType)) return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
  const body = Buffer.from(await request.arrayBuffer())
  if (body.length > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large' }, { status: 413 })
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.data/files')
  const file = path.join(root, key)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, body)
  await fs.writeFile(file + '.meta.json', JSON.stringify({ contentType }))
  return NextResponse.json({ key })
}
