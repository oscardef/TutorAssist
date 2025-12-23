import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tutorassist'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL // Optional public URL

// Create S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/markdown',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface UploadResult {
  key: string
  url: string
  signedUrl?: string
}

// Generate a storage key
function generateKey(workspaceId: string, folder: string, filename: string): string {
  const ext = filename.split('.').pop() || ''
  const uniqueId = uuidv4()
  return `${workspaceId}/${folder}/${uniqueId}.${ext}`
}

// Upload a file to R2
export async function uploadFile(
  workspaceId: string,
  folder: 'materials' | 'exports' | 'avatars',
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  
  // Validate file size
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  
  const key = generateKey(workspaceId, folder, filename)
  
  await s3Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    Metadata: {
      'workspace-id': workspaceId,
      'original-filename': filename,
    },
  }))
  
  // Generate public URL or signed URL
  const url = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${key}`
    : await getSignedDownloadUrl(key, 60 * 60 * 24 * 7) // 7 day signed URL
  
  return { key, url }
}

// Get a signed URL for downloading
export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  
  return getSignedUrl(s3Client, command, { expiresIn })
}

// Get a signed URL for uploading (presigned upload)
export async function getSignedUploadUrl(
  workspaceId: string,
  folder: 'materials' | 'exports' | 'avatars',
  filename: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<{ key: string; uploadUrl: string }> {
  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`)
  }
  
  const key = generateKey(workspaceId, folder, filename)
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: {
      'workspace-id': workspaceId,
      'original-filename': filename,
    },
  })
  
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })
  
  return { key, uploadUrl }
}

// Delete a file
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }))
}

// Get file from storage
export async function getFile(key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }))
  
  if (!response.Body) {
    throw new Error('File not found')
  }
  
  // Convert stream to buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
