/**
 * Email Templates for TutorAssist
 * 
 * These templates provide beautiful, consistent email designs for:
 * - Supabase auth emails (confirmation, password reset, magic link)
 * - System emails (invitations, notifications)
 * 
 * To use the Supabase templates, copy the generated HTML from the
 * getSupabaseEmailTemplate function into your Supabase Dashboard:
 * Authentication > Email Templates
 */

// Brand colors
const BRAND = {
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryLight: '#dbeafe',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
}

// Common email wrapper
function emailWrapper(content: string, previewText?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  ${previewText ? `<!--[if !mso]><!--><meta name="x-apple-disable-message-reformatting"><!--<![endif]-->` : ''}
  <title>TutorAssist</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: ${BRAND.gray[100]};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Button hover states for email clients that support it */
    .button:hover {
      background-color: ${BRAND.primaryDark} !important;
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1f2937 !important;
      }
    }
    
    /* Mobile responsiveness */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 20px !important;
      }
      .content {
        padding: 24px !important;
      }
      .header {
        padding: 24px !important;
      }
      h1 {
        font-size: 24px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.gray[100]}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>` : ''}
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND.gray[100]};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Header component with gradient
function emailHeader(title: string, subtitle?: string, icon?: string): string {
  const iconHtml = icon || `
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.15"/>
      <path d="M24 14L32 20V28L24 34L16 28V20L24 14Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 14V34" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M16 20L24 26L32 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
  
  return `
    <tr>
      <td class="header" style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
        <div style="margin-bottom: 16px;">
          ${iconHtml}
        </div>
        <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
          ${title}
        </h1>
        ${subtitle ? `
          <p style="margin: 0; color: rgba(255, 255, 255, 0.85); font-size: 16px; font-weight: 400;">
            ${subtitle}
          </p>
        ` : ''}
      </td>
    </tr>`
}

// CTA button
function emailButton(text: string, url: string, style: 'primary' | 'secondary' = 'primary'): string {
  const bgColor = style === 'primary' ? BRAND.primary : BRAND.gray[700]
  const shadowColor = style === 'primary' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(0, 0, 0, 0.1)'
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
      <tr>
        <td align="center">
          <a href="${url}" class="button" style="display: inline-block; background-color: ${bgColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px ${shadowColor}; transition: all 0.2s ease;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`
}

// Footer
function emailFooter(showUnsubscribe = false): string {
  return `
    <tr>
      <td style="padding: 32px 40px; text-align: center; border-top: 1px solid ${BRAND.gray[200]};">
        <p style="margin: 0 0 12px; color: ${BRAND.gray[400]}; font-size: 13px;">
          This email was sent by <strong style="color: ${BRAND.gray[500]};">TutorAssist</strong>
        </p>
        <p style="margin: 0; color: ${BRAND.gray[400]}; font-size: 12px;">
          © ${new Date().getFullYear()} TutorAssist. All rights reserved.
        </p>
        ${showUnsubscribe ? `
          <p style="margin: 16px 0 0; color: ${BRAND.gray[400]}; font-size: 12px;">
            <a href="{{ .SiteURL }}/unsubscribe" style="color: ${BRAND.gray[500]}; text-decoration: underline;">Unsubscribe</a>
          </p>
        ` : ''}
      </td>
    </tr>`
}

// Info box component
function infoBox(content: string, icon?: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background-color: ${BRAND.gray[50]}; border-radius: 12px; border: 1px solid ${BRAND.gray[200]};">
      <tr>
        <td style="padding: 20px; text-align: center;">
          ${icon ? `<div style="margin-bottom: 8px;">${icon}</div>` : ''}
          ${content}
        </td>
      </tr>
    </table>`
}

// Feature list item
function featureItem(text: string): string {
  return `
    <tr>
      <td style="padding: 8px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <div style="width: 20px; height: 20px; background-color: ${BRAND.primaryLight}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13l4 4L19 7" stroke="${BRAND.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </td>
            <td style="color: ${BRAND.gray[700]}; font-size: 15px; line-height: 1.5;">
              ${text}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

// ==========================================
// SUPABASE EMAIL TEMPLATES
// Copy these into your Supabase Dashboard
// ==========================================

/**
 * Confirmation Email Template for Supabase
 * Use this in: Authentication > Email Templates > Confirm signup
 */
export const SUPABASE_CONFIRMATION_EMAIL = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Confirm your TutorAssist account</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .header { padding: 24px 24px 20px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0; overflow: hidden;">Welcome to TutorAssist! Please confirm your email to get started.</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 520px;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <!-- Logo/Icon -->
              <div style="margin-bottom: 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="background-color: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
                      <img src="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 10L36 18V30L24 38L12 30V18L24 10Z' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M24 10V38' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3Cpath d='M12 18L24 26L36 18' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="32" height="32" style="display: block;">
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                Welcome to TutorAssist!
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                Let's get your account set up
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 36px 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03);">
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Thanks for signing up! To complete your registration and start using TutorAssist, please confirm your email address by clicking the button below.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0 24px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);">
                      Confirm Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security note -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px; background-color: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px;">
                          <img src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="20" height="20" style="display: block;">
                        </td>
                        <td style="color: #6b7280; font-size: 13px; line-height: 1.5;">
                          <strong style="color: #374151;">Didn't request this?</strong><br>
                          If you didn't create a TutorAssist account, you can safely ignore this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative link -->
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Button not working? Copy this link:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #3b82f6; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                <strong style="color: #6b7280;">TutorAssist</strong> — Math Tutoring Made Easy
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2024 TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

/**
 * Password Reset Email Template for Supabase
 * Use this in: Authentication > Email Templates > Reset password
 */
export const SUPABASE_PASSWORD_RESET_EMAIL = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset your TutorAssist password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .header { padding: 24px 24px 20px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Reset your TutorAssist password - link expires in 24 hours</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 520px;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <div style="margin-bottom: 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="background-color: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
                      <img src="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='3' y='11' width='18' height='11' rx='2' stroke='white' stroke-width='2'/%3E%3Cpath d='M7 11V7a5 5 0 0110 0v4' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E" alt="" width="32" height="32" style="display: block;">
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                Reset Your Password
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                We received a request to reset your password
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 36px 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03);">
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Someone requested a password reset for your TutorAssist account. Click the button below to choose a new password.
              </p>
              
              <!-- Expiry notice -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #fef3c7; border-radius: 10px; border: 1px solid #fcd34d;">
                <tr>
                  <td style="padding: 14px 20px; text-align: center;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      ⏱️ This link will expire in <strong>24 hours</strong>
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0 24px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security note -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px; background-color: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px;">
                          <img src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="20" height="20" style="display: block;">
                        </td>
                        <td style="color: #6b7280; font-size: 13px; line-height: 1.5;">
                          <strong style="color: #374151;">Didn't request this?</strong><br>
                          If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Button not working? Copy this link:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #6366f1; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                <strong style="color: #6b7280;">TutorAssist</strong> — Math Tutoring Made Easy
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2024 TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

/**
 * Magic Link Email Template for Supabase
 * Use this in: Authentication > Email Templates > Magic link
 */
export const SUPABASE_MAGIC_LINK_EMAIL = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your TutorAssist login link</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .header { padding: 24px 24px 20px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Your secure login link for TutorAssist - expires in 1 hour</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 520px;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <div style="margin-bottom: 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="background-color: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
                      <img src="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M10 17l5-5-5-5' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M15 12H3' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="32" height="32" style="display: block;">
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                Your Login Link
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                One-click secure access to TutorAssist
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 36px 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03);">
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Click the button below to securely log in to your TutorAssist account. No password needed!
              </p>
              
              <!-- Expiry notice -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #ecfdf5; border-radius: 10px; border: 1px solid #a7f3d0;">
                <tr>
                  <td style="padding: 14px 20px; text-align: center;">
                    <p style="margin: 0; color: #065f46; font-size: 14px;">
                      🔐 This secure link expires in <strong>1 hour</strong>
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0 24px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                      Log In to TutorAssist
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security note -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px; background-color: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px;">
                          <img src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="20" height="20" style="display: block;">
                        </td>
                        <td style="color: #6b7280; font-size: 13px; line-height: 1.5;">
                          <strong style="color: #374151;">Didn't request this?</strong><br>
                          If you didn't request a login link, you can safely ignore this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Button not working? Copy this link:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #10b981; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                <strong style="color: #6b7280;">TutorAssist</strong> — Math Tutoring Made Easy
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2024 TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

/**
 * Email Change Confirmation Template for Supabase  
 * Use this in: Authentication > Email Templates > Change email address
 */
export const SUPABASE_EMAIL_CHANGE_EMAIL = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Confirm your new email address</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .header { padding: 24px 24px 20px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Confirm your new email address for TutorAssist</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 520px;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <div style="margin-bottom: 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="background-color: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
                      <img src="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M22 6l-10 7L2 6' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="32" height="32" style="display: block;">
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                Confirm Email Change
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                Verify your new email address
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 36px 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03);">
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                You've requested to change your email address for your TutorAssist account. Please confirm this change by clicking the button below.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0 24px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);">
                      Confirm New Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security note -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px; background-color: #fef2f2; border-radius: 10px; border: 1px solid #fecaca;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px;">
                          <img src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' stroke='%23dc2626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M12 9v4' stroke='%23dc2626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M12 17h.01' stroke='%23dc2626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="20" height="20" style="display: block;">
                        </td>
                        <td style="color: #991b1b; font-size: 13px; line-height: 1.5;">
                          <strong>Didn't request this change?</strong><br>
                          If you didn't request an email change, please secure your account immediately by resetting your password.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Button not working? Copy this link:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #8b5cf6; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                <strong style="color: #6b7280;">TutorAssist</strong> — Math Tutoring Made Easy
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2024 TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// ==========================================
// APPLICATION EMAIL GENERATOR
// Use this for programmatic emails
// ==========================================

export interface InviteEmailParams {
  studentName: string
  tutorName: string
  workspaceName: string
  inviteUrl: string
}

export function generateInviteEmail(params: InviteEmailParams): string {
  const { studentName, tutorName, workspaceName, inviteUrl } = params

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>You're Invited to TutorAssist</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .button:hover { background-color: #1d4ed8 !important; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .header { padding: 24px 24px 20px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${tutorName} has invited you to join ${workspaceName} on TutorAssist!</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 520px;">
          
          <!-- Header -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <div style="margin-bottom: 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="background-color: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
                      <img src="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 10L36 18V30L24 38L12 30V18L24 10Z' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M24 10V38' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3Cpath d='M12 18L24 26L36 18' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" alt="" width="32" height="32" style="display: block;">
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                You're Invited! 🎉
              </h1>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px;">
                Join ${workspaceName} on TutorAssist
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 36px 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03);">
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${studentName},
              </p>
              
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>${tutorName}</strong> has invited you to join their tutoring workspace on TutorAssist!
              </p>
              
              <!-- Workspace Info Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 1px solid #bae6fd;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 4px; color: #0369a1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Workspace</p>
                    <p style="margin: 0; color: #0c4a6e; font-size: 20px; font-weight: 700;">${workspaceName}</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; color: #374151; font-size: 15px; font-weight: 600;">
                With TutorAssist, you'll be able to:
              </p>
              
              <!-- Features List -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px;">
                            <span style="color: #3b82f6; font-size: 14px;">✓</span>
                          </div>
                        </td>
                        <td style="color: #4b5563; font-size: 15px;">Complete personalized assignments</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px;">
                            <span style="color: #3b82f6; font-size: 14px;">✓</span>
                          </div>
                        </td>
                        <td style="color: #4b5563; font-size: 15px;">Track your progress and improvement</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px;">
                            <span style="color: #3b82f6; font-size: 14px;">✓</span>
                          </div>
                        </td>
                        <td style="color: #4b5563; font-size: 15px;">Practice with instant feedback & hints</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px;">
                            <span style="color: #3b82f6; font-size: 14px;">✓</span>
                          </div>
                        </td>
                        <td style="color: #4b5563; font-size: 15px;">Master math through spaced repetition</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 12px 0 24px;">
                    <a href="${inviteUrl}" class="button" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 10px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Button not working? Copy this link:<br>
                <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                <strong style="color: #6b7280;">TutorAssist</strong> — Math Tutoring Made Easy
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2024 TutorAssist. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// Export for easy access to raw templates
export const SupabaseEmailTemplates = {
  confirmation: SUPABASE_CONFIRMATION_EMAIL,
  passwordReset: SUPABASE_PASSWORD_RESET_EMAIL,
  magicLink: SUPABASE_MAGIC_LINK_EMAIL,
  emailChange: SUPABASE_EMAIL_CHANGE_EMAIL,
}
