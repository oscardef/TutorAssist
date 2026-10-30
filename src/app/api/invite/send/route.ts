import { createServerClient } from '@/lib/supabase/server'
import { requireTutor, getUser } from '@/lib/auth'
import { validateInviteToken } from '@/lib/workspace'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { generateInviteEmail } from '@/lib/email-templates'

// Initialize email transporter lazily
function getEmailTransporter() {
  const email = process.env.SMTP_EMAIL
  const password = process.env.SMTP_PASSWORD
  
  if (!email || !password) {
    console.warn('SMTP credentials not configured')
    return null
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password,
    },
  })
}

export async function POST(request: Request) {
  try {
    const transporter = getEmailTransporter()
    if (!transporter) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    }

    const context = await requireTutor()
    const supabase = await createServerClient()
    
    const { token, email, studentName } = await request.json()

    if (!token || !email) {
      return NextResponse.json({ error: 'Token and email are required' }, { status: 400 })
    }

    // Validate the invite token exists and belongs to this tutor's workspace
    const invite = await validateInviteToken(token)
    if (!invite || invite.workspace_id !== context.workspaceId) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })
    }

    // Get tutor info
    const user = await getUser()
    const tutorName = user?.name || 'Your Tutor'

    // Get workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', context.workspaceId)
      .single()

    const workspaceName = workspace?.name || 'Mathium'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mathium.app'
    const inviteUrl = `${baseUrl}/invite/${token}`

    // Send the email using Nodemailer
    await transporter.sendMail({
      from: `"Mathium" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `${tutorName} has invited you to join ${workspaceName}`,
      html: generateInviteEmail({
        studentName: studentName || 'Student',
        tutorName,
        workspaceName,
        inviteUrl,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending invite email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
