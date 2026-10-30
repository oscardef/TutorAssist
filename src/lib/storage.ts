import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * File storage behind one interface with two backends:
 *  - local: files on disk under STORAGE_LOCAL_DIR, served through /api/files/<key>
 *    (the default on m70q; the route checks the caller may see the workspace)
 *  - s3:    any S3-compatible bucket (Cloudflare R2, MinIO, AWS) via STORAGE_S3_* / R2_* vars
 */

export type StorageFolder = 'materials' | 'exports' | 'avatars' | 'questions' | 'boards'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/markdown',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export interface UploadResult {
  key: string
  url: string
}

interface StorageBackend {
  put(key: string, body: Buffer | Uint8Array, contentType: string, meta: Record<string, string>): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  downloadUrl(key: string, expiresIn: number): Promise<string>
  uploadUrl(key: string, contentType: string, expiresIn: number): Promise<string>
}

function generateKey(workspaceId: string, folder: StorageFolder, filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${workspaceId}/${folder}/${uuidv4()}${ext ? '.' + ext : ''}`
}

/** Keys are `<workspaceId>/<folder>/<uuid>.<ext>`; anything else is rejected. */
export function isValidKey(key: string): boolean {
  return /^[0-9a-f-]{36}\/(materials|exports|avatars|questions|boards)\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/.test(key)
}

export function workspaceIdFromKey(key: string): string | null {
  return isValidKey(key) ? key.split('/')[0] : null
}

// ---------------------------------------------------------------------------
// Local disk backend
// ---------------------------------------------------------------------------
function localBackend(): StorageBackend {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.data/files')
  const resolve = (key: string) => {
    if (!isValidKey(key)) throw new Error('Invalid storage key')
    return path.join(root, key)
  }
  return {
    async put(key, body, contentType) {
      const file = resolve(key)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, body)
      await fs.writeFile(file + '.meta.json', JSON.stringify({ contentType }))
    },
    async get(key) {
      return fs.readFile(resolve(key))
    },
    async delete(key) {
      const file = resolve(key)
      await fs.rm(file, { force: true })
      await fs.rm(file + '.meta.json', { force: true })
    },
    async downloadUrl(key) {
      return `/api/files/${key}`
    },
    async uploadUrl(key) {
      return `/api/files/${key}`
    },
  }
}

export async function localContentType(key: string): Promise<string | null> {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.data/files')
  try {
    const meta = JSON.parse(await fs.readFile(path.join(root, key + '.meta.json'), 'utf8'))
    return meta.contentType || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// S3-compatible backend (R2, MinIO, AWS)
// ---------------------------------------------------------------------------
function s3Backend(): StorageBackend {
  const bucket = process.env.STORAGE_S3_BUCKET || process.env.R2_BUCKET_NAME || 'mathium'
  const endpoint = process.env.STORAGE_S3_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined)
  const publicUrl = process.env.STORAGE_S3_PUBLIC_URL || process.env.R2_PUBLIC_URL
  const client = new S3Client({
    region: process.env.STORAGE_S3_REGION || 'auto',
    endpoint,
    forcePathStyle: !!process.env.STORAGE_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })
  return {
    async put(key, body, contentType, meta) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, Metadata: meta }))
    },
    async get(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      if (!response.Body) throw new Error('File not found')
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
      return Buffer.concat(chunks)
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    async downloadUrl(key, expiresIn) {
      if (publicUrl) return `${publicUrl}/${key}`
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
    },
    async uploadUrl(key, contentType, expiresIn) {
      return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn })
    },
  }
}

let backend: StorageBackend | null = null
function storage(): StorageBackend {
  if (!backend) backend = (process.env.STORAGE_BACKEND || 'local') === 's3' ? s3Backend() : localBackend()
  return backend
}

export function isLocalStorage(): boolean {
  return (process.env.STORAGE_BACKEND || 'local') !== 's3'
}

// ---------------------------------------------------------------------------
// Public API (unchanged signatures)
// ---------------------------------------------------------------------------
export async function uploadFile(
  workspaceId: string,
  folder: StorageFolder,
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  const key = generateKey(workspaceId, folder, filename)
  await storage().put(key, file, contentType, { 'workspace-id': workspaceId, 'original-filename': filename })
  const url = await storage().downloadUrl(key, 60 * 60 * 24 * 7)
  return { key, url }
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  return storage().downloadUrl(key, expiresIn)
}

export async function getSignedUploadUrl(
  workspaceId: string,
  folder: StorageFolder,
  filename: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<{ key: string; uploadUrl: string }> {
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  const key = generateKey(workspaceId, folder, filename)
  return { key, uploadUrl: await storage().uploadUrl(key, contentType, expiresIn) }
}

export async function deleteFile(key: string): Promise<void> {
  await storage().delete(key)
}

export async function getFile(key: string): Promise<Buffer> {
  return storage().get(key)
}

/** Copy a stored file into another workspace (used when importing library questions). */
export async function copyFile(key: string, workspaceId: string, folder: StorageFolder): Promise<string> {
  const body = await storage().get(key)
  const contentType = (await localContentType(key)) || 'application/octet-stream'
  const newKey = generateKey(workspaceId, folder, key.split('/').pop() || 'file')
  await storage().put(newKey, body, contentType, { 'workspace-id': workspaceId, 'copied-from': key })
  return newKey
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE }

/** Remove every stored file of a deleted workspace (local disk backend). */
export async function deleteWorkspaceFiles(workspaceId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(workspaceId)) throw new Error('Invalid workspace id')
  if (process.env.STORAGE_BACKEND && process.env.STORAGE_BACKEND !== 'local') return
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.data/files')
  await fs.rm(path.join(root, workspaceId), { recursive: true, force: true })
}
