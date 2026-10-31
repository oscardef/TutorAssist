import { redirect } from 'next/navigation'
import { requireTutor } from '@/lib/auth'
import AiAdmin from './AiAdmin'

export const metadata = { title: 'AI usage' }

export default async function AiAdminPage() {
  const context = await requireTutor()
  if (!context.isPlatformOwner) redirect('/tutor/dashboard')
  return <AiAdmin />
}
