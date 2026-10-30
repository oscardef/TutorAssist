import nodemailer from 'nodemailer'

/**
 * Single transactional-email transport. SMTP settings come from the environment:
 * either SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD, or the legacy Gmail pair
 * SMTP_EMAIL/SMTP_PASSWORD. Returns null when nothing is configured, so callers
 * can degrade gracefully in development.
 */
export function getEmailTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL
  const pass = process.env.SMTP_PASSWORD
  if (!user || !pass) return null
  if (host) {
    const port = Number(process.env.SMTP_PORT || 587)
    return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  }
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

export function fromAddress(displayName = 'Mathium') {
  const address = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.SMTP_EMAIL || 'no-reply@mathium.app'
  return `"${displayName}" <${address}>`
}

export async function sendEmail(options: { to: string; subject: string; html: string; text?: string }) {
  const transporter = getEmailTransporter()
  if (!transporter) {
    console.warn(`[email] SMTP not configured; would have sent "${options.subject}" to ${options.to}`)
    return false
  }
  await transporter.sendMail({ from: fromAddress(), ...options })
  return true
}
