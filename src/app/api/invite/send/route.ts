import { createServerClient } from '@/lib/supabase/server'
import { requireTutor } from '@/lib/auth'
import { validateInviteToken } from '@/lib/workspace'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

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
    const { data: { user } } = await supabase.auth.getUser()
    const tutorName = user?.user_metadata?.full_name || 'Your Tutor'

    // Get workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', context.workspaceId)
      .single()

    const workspaceName = workspace?.name || 'TutorAssist'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tutor-assist.vercel.app'
    const inviteUrl = `${baseUrl}/invite/${token}`

    // Send the email using Nodemailer
    await transporter.sendMail({
      from: `"TutorAssist" <${process.env.SMTP_EMAIL}>`,
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

function generateInviteEmail(params: {
  studentName: string
  tutorName: string
  workspaceName: string
  inviteUrl: string
}): string {
  const { studentName, tutorName, workspaceName, inviteUrl } = params

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to TutorAssist</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                You're Invited!
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${studentName},
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>${tutorName}</strong> has invited you to join their tutoring workspace on TutorAssist.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 5px; color: #6b7280; font-size: 14px;">Workspace</p>
                    <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${workspaceName}</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                With TutorAssist, you'll be able to:
              </p>
              
              <ul style="margin: 0 0 30px; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.8;">
                <li>Complete assignments tailored to your learning needs</li>
                <li>Track your progress and see your improvement</li>
                <li>Practice with interactive questions and get instant feedback</li>
                <li>Communicate with your tutor seamlessly</li>
              </ul>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 30px; color: #3b82f6; font-size: 14px; word-break: break-all;">
                <a href="${inviteUrl}" style="color: #3b82f6; text-decoration: none;">${inviteUrl}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6; text-align: center;">
                This invite link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                © ${new Date().getFullYear()} TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
