import { redirect } from 'next/navigation'
import { requireTutor } from '@/lib/auth'
import SponsorsAdmin from './SponsorsAdmin'

export const metadata = { title: 'Sponsor messages' }

export default async function SponsorsAdminPage() {
  const context = await requireTutor()
  if (!context.isPlatformOwner) redirect('/tutor/dashboard')
  return <SponsorsAdmin />
}
