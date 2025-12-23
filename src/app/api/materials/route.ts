import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { uploadFile, getSignedUploadUrl } from '@/lib/storage'
import { enqueueJob } from '@/lib/jobs'

// Upload a file
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can upload materials' }, { status: 403 })
  }
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null
    const topicIds = formData.get('topicIds') as string | null
    const extractContent = formData.get('extractContent') === 'true'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Upload to R2
    const { key, url } = await uploadFile(
      context.workspaceId,
      'materials',
      buffer,
      file.name,
      file.type
    )
    
    const supabase = await createServerClient()
    
    // Create material record
    const { data: material, error } = await supabase
      .from('source_materials')
      .insert({
        workspace_id: context.workspaceId,
        uploaded_by_user_id: user.id,
        title: title || file.name,
        description,
        file_url: url,
        file_type: file.type,
        file_size_bytes: buffer.length,
        storage_key: key,
        status: extractContent ? 'processing' : 'ready',
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Link to topics if provided
    if (topicIds) {
      const ids = JSON.parse(topicIds) as string[]
      // Would update topics_json on the material
      await supabase
        .from('source_materials')
        .update({ topics_json: ids })
        .eq('id', material.id)
    }
    
    // Enqueue extraction job if requested
    if (extractContent) {
      await enqueueJob({
        workspaceId: context.workspaceId,
        userId: user.id,
        type: 'EXTRACT_MATERIAL',
        payload: {
          materialId: material.id,
          fileUrl: url,
          fileType: file.type,
        },
      })
    }
    
    return NextResponse.json({ material })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

// Get presigned upload URL (for large files / client-side uploads)
export async function PUT(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can upload materials' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { filename, contentType } = body
    
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Filename and content type required' },
        { status: 400 }
      )
    }
    
    const { key, uploadUrl } = await getSignedUploadUrl(
      context.workspaceId,
      'materials',
      filename,
      contentType
    )
    
    return NextResponse.json({ key, uploadUrl })
  } catch (error) {
    console.error('Get upload URL error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get upload URL' },
      { status: 500 }
    )
  }
}

// Get materials
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const supabase = await createServerClient()
  
  const { data: materials, error } = await supabase
    .from('source_materials')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ materials })
}
